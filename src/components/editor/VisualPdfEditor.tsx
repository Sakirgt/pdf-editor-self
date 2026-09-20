"use client";

import React, { useState, useEffect, useRef } from "react";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import {
  ArrowLeft,
  Download,
  Eraser,
  Type,
  MousePointer,
  ZoomIn,
  ZoomOut,
  ChevronLeft,
  ChevronRight,
  Loader2,
  CheckCircle2,
  Sparkles,
} from "lucide-react";

interface TextOverlayItem {
  id: string;
  pageNum: number;
  originalStr: string;
  currentStr: string;
  pdfX: number;
  pdfY: number;
  pdfWidth: number;
  pdfHeight: number;
  fontSize: number;
  domLeft: number;
  domTop: number;
  domWidth: number;
  domHeight: number;
  isEdited: boolean;
  offsetX: number;
  offsetY: number;
  customFontSize?: number;
}

interface FreeTextItem {
  id: string;
  page: number;
  text: string;
  pdfX: number;
  pdfY: number;
  domLeft: number;
  domTop: number;
  fontSize: number;
}

interface WhiteoutBox {
  id: string;
  page: number;
  pdfX: number;
  pdfY: number;
  pdfWidth: number;
  pdfHeight: number;
  domLeft: number;
  domTop: number;
  domWidth: number;
  domHeight: number;
}

interface VisualPdfEditorProps {
  pdfFile: File;
  onClose: () => void;
}

// Fallback sanitization for standard fonts (like Helvetica WinAnsi)
function sanitizeForStandardPdf(text: string): string {
  if (!text) return "";
  return text
    .replace(/₹/g, "Rs. ")
    .replace(/[\u20B9]/g, "Rs. ")
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2013\u2014]/g, "-")
    .replace(/\u2026/g, "...")
    .replace(/[\u2022\u2023\u25E6\u2043\u2219]/g, "* ")
    .replace(/\u00A0/g, " ")
    .replace(/[^\x00-\xFF]/g, "");
}

export const VisualPdfEditor: React.FC<VisualPdfEditorProps> = ({ pdfFile, onClose }) => {
  const [numPages, setNumPages] = useState<number>(1);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [scale, setScale] = useState<number>(1.25);
  const [activeTool, setActiveTool] = useState<"edit" | "text" | "erase">("edit");
  const [loading, setLoading] = useState<boolean>(true);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [saveStatus, setSaveStatus] = useState<string | null>(null);

  // Active page text items and annotations
  const [textItems, setTextItems] = useState<TextOverlayItem[]>([]);
  const [freeTextItems, setFreeTextItems] = useState<FreeTextItem[]>([]);
  const [whiteouts, setWhiteouts] = useState<WhiteoutBox[]>([]);

  // Persistent registry of all edits across all pages
  const [editedItemsMap, setEditedItemsMap] = useState<
    Record<
      string,
      {
        currentStr: string;
        offsetX: number;
        offsetY: number;
        customFontSize?: number;
        isEdited: boolean;
        pageNum: number;
      }
    >
  >({});
  const editedItemsMapRef = useRef(editedItemsMap);
  editedItemsMapRef.current = editedItemsMap;

  // Master cache of all extracted items across all pages
  const allItemsRef = useRef<Map<string, TextOverlayItem>>(new Map());

  // Active item being edited
  const [activeEditingId, setActiveEditingId] = useState<string | null>(null);

  // Eraser drag state
  const [isDraggingEraser, setIsDraggingEraser] = useState(false);
  const [eraserStart, setEraserStart] = useState<{ x: number; y: number } | null>(null);
  const [currentEraserBox, setCurrentEraserBox] = useState<{
    left: number;
    top: number;
    width: number;
    height: number;
  } | null>(null);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const pdfDocRef = useRef<unknown>(null);
  const originalBytesRef = useRef<ArrayBuffer | null>(null);

  // Load PDF document on mount
  useEffect(() => {
    let isCancelled = false;

    const loadPdfDocument = async () => {
      setLoading(true);
      try {
        const arrayBuffer = await pdfFile.arrayBuffer();
        originalBytesRef.current = arrayBuffer.slice(0);

        const pdfjsLib = await import("pdfjs-dist");
        pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version}/build/pdf.worker.min.mjs`;

        const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
        const doc = await loadingTask.promise;
        if (isCancelled) return;

        pdfDocRef.current = doc;
        setNumPages(doc.numPages);
        renderPage(doc, currentPage, scale);
      } catch (err) {
        console.error("Failed to load PDF in VisualPdfEditor:", err);
      } finally {
        if (!isCancelled) setLoading(false);
      }
    };

    loadPdfDocument();

    return () => {
      isCancelled = true;
    };
  }, [pdfFile]);

  // Re-render when page or scale changes
  useEffect(() => {
    if (pdfDocRef.current) {
      renderPage(pdfDocRef.current, currentPage, scale);
    }
  }, [currentPage, scale]);

  const renderPage = async (doc: unknown, pageNum: number, currentScale: number) => {
    const pdfDoc = doc as { getPage: (n: number) => Promise<unknown> };
    if (!pdfDoc) return;

    try {
      const page = (await pdfDoc.getPage(pageNum)) as {
        getViewport: (opts: { scale: number }) => {
          width: number;
          height: number;
          scale: number;
          convertToViewportPoint: (x: number, y: number) => [number, number];
        };
        render: (opts: { canvasContext: CanvasRenderingContext2D; viewport: unknown }) => {
          promise: Promise<void>;
        };
        getTextContent: () => Promise<{
          items: Array<{
            str: string;
            transform: number[];
            width: number;
            height: number;
            fontName?: string;
          }>;
        }>;
      };

      const viewport = page.getViewport({ scale: currentScale });
      const canvas = canvasRef.current;
      if (!canvas) return;

      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      // Crisp rendering on high-DPI displays
      const dpr = window.devicePixelRatio || 1;
      canvas.width = viewport.width * dpr;
      canvas.height = viewport.height * dpr;
      canvas.style.width = `${viewport.width}px`;
      canvas.style.height = `${viewport.height}px`;

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      await page.render({ canvasContext: ctx, viewport }).promise;

      // Extract text items with exact coordinates
      const textContent = await page.getTextContent();
      const items: TextOverlayItem[] = [];

      textContent.items.forEach((item, index) => {
        if (!item.str || item.str.trim() === "") return;

        const id = `item-${pageNum}-${index}`;
        const pdfX = item.transform[4];
        const pdfY = item.transform[5];

        // Font scaling from transform matrix (accurate for all PDF fonts)
        const fontScaleX = Math.hypot(item.transform[0], item.transform[1]);
        const fontScaleY = Math.hypot(item.transform[2], item.transform[3]);
        const fontSize = fontScaleY || item.height || fontScaleX || 12;

        // Use convertToViewportPoint to account for cropBox, rotation, and scaling
        const [vpBaselineX, vpBaselineY] = viewport.convertToViewportPoint(pdfX, pdfY);

        // domLeft starts right at the character position with 0px offset
        const domLeft = vpBaselineX;
        // In typography, capital ascent is ~82% of font size.
        // Placing domTop at vpBaselineY - (fontSize * currentScale * 0.82)
        // ensures the text characters and baseline align exactly with the canvas!
        const domTop = vpBaselineY - fontSize * currentScale * 0.82;
        const domWidth = Math.max(item.width * currentScale, 14);
        const domHeight = Math.max(fontSize * currentScale, 14);

        // Check if there was already an edit on this item from current or past session
        const existingEdit = editedItemsMapRef.current[id];

        const overlayItem: TextOverlayItem = {
          id,
          pageNum,
          originalStr: item.str,
          currentStr: existingEdit ? existingEdit.currentStr : item.str,
          pdfX,
          pdfY,
          pdfWidth: item.width,
          pdfHeight: fontSize,
          fontSize,
          domLeft,
          domTop,
          domWidth,
          domHeight,
          isEdited: existingEdit ? existingEdit.isEdited : false,
          offsetX: existingEdit ? existingEdit.offsetX : 0,
          offsetY: existingEdit ? existingEdit.offsetY : 0,
          customFontSize: existingEdit ? existingEdit.customFontSize : undefined,
        };

        items.push(overlayItem);
        allItemsRef.current.set(id, overlayItem);
      });

      setTextItems(items);
    } catch (err) {
      console.error("Error rendering page:", err);
    }
  };

  // Text modification
  const handleUpdateText = (id: string, newText: string) => {
    setTextItems((prev) =>
      prev.map((item) => {
        if (item.id === id) {
          const isEdited = newText !== item.originalStr || item.offsetX !== 0 || item.offsetY !== 0;
          const updated = {
            ...item,
            currentStr: newText,
            isEdited,
          };
          setEditedItemsMap((m) => ({
            ...m,
            [id]: {
              currentStr: newText,
              offsetX: updated.offsetX,
              offsetY: updated.offsetY,
              customFontSize: updated.customFontSize,
              isEdited,
              pageNum: updated.pageNum,
            },
          }));
          allItemsRef.current.set(id, updated);
          return updated;
        }
        return item;
      })
    );
  };

  // Nudge text horizontally (deltaX) or vertically (deltaY)
  const handleNudge = (id: string, deltaX: number, deltaY: number) => {
    setTextItems((prev) =>
      prev.map((item) => {
        if (item.id === id) {
          const newOffsetX = Number(((item.offsetX || 0) + deltaX).toFixed(2));
          const newOffsetY = Number(((item.offsetY || 0) + deltaY).toFixed(2));
          const updated = {
            ...item,
            offsetX: newOffsetX,
            offsetY: newOffsetY,
            isEdited: true,
          };
          setEditedItemsMap((m) => ({
            ...m,
            [id]: {
              currentStr: item.currentStr,
              offsetX: newOffsetX,
              offsetY: newOffsetY,
              customFontSize: item.customFontSize,
              isEdited: true,
              pageNum: item.pageNum,
            },
          }));
          allItemsRef.current.set(id, updated);
          return updated;
        }
        return item;
      })
    );
  };

  // Adjust font size for perfection
  const handleAdjustFontSize = (id: string, deltaSize: number) => {
    setTextItems((prev) =>
      prev.map((item) => {
        if (item.id === id) {
          const baseSize = item.customFontSize || item.fontSize;
          const newSize = Math.max(Number((baseSize + deltaSize).toFixed(1)), 4);
          const updated = {
            ...item,
            customFontSize: newSize,
            isEdited: true,
          };
          setEditedItemsMap((m) => ({
            ...m,
            [id]: {
              currentStr: item.currentStr,
              offsetX: item.offsetX,
              offsetY: item.offsetY,
              customFontSize: newSize,
              isEdited: true,
              pageNum: item.pageNum,
            },
          }));
          allItemsRef.current.set(id, updated);
          return updated;
        }
        return item;
      })
    );
  };

  // Reset item to original
  const handleResetItem = (id: string) => {
    setTextItems((prev) =>
      prev.map((item) => {
        if (item.id === id) {
          const updated = {
            ...item,
            currentStr: item.originalStr,
            offsetX: 0,
            offsetY: 0,
            customFontSize: undefined,
            isEdited: false,
          };
          setEditedItemsMap((m) => {
            const copy = { ...m };
            delete copy[id];
            return copy;
          });
          allItemsRef.current.set(id, updated);
          return updated;
        }
        return item;
      })
    );
  };

  // Click on canvas container for adding new free text
  const handleOverlayClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (activeTool !== "text") return;
    if (!overlayRef.current) return;

    const rect = overlayRef.current.getBoundingClientRect();
    const domLeft = e.clientX - rect.left;
    const domTop = e.clientY - rect.top;

    // Convert DOM to PDF coordinate
    const pdfX = domLeft / scale;
    const viewportHeight = overlayRef.current.clientHeight;
    const pdfY = (viewportHeight - domTop) / scale;

    const newId = `free-text-${Date.now()}`;
    const newItem: FreeTextItem = {
      id: newId,
      page: currentPage,
      text: "New Text",
      pdfX,
      pdfY,
      domLeft,
      domTop,
      fontSize: 12,
    };

    setFreeTextItems((prev) => [...prev, newItem]);
    setActiveEditingId(newId);
  };

  // Eraser / Whiteout mouse handlers
  const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
    if (activeTool !== "erase") return;
    if (!overlayRef.current) return;

    const rect = overlayRef.current.getBoundingClientRect();
    const startX = e.clientX - rect.left;
    const startY = e.clientY - rect.top;

    setIsDraggingEraser(true);
    setEraserStart({ x: startX, y: startY });
    setCurrentEraserBox({ left: startX, top: startY, width: 0, height: 0 });
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isDraggingEraser || !eraserStart || !overlayRef.current) return;

    const rect = overlayRef.current.getBoundingClientRect();
    const currentX = e.clientX - rect.left;
    const currentY = e.clientY - rect.top;

    const left = Math.min(eraserStart.x, currentX);
    const top = Math.min(eraserStart.y, currentY);
    const width = Math.abs(currentX - eraserStart.x);
    const height = Math.abs(currentY - eraserStart.y);

    setCurrentEraserBox({ left, top, width, height });
  };

  const handleMouseUp = () => {
    if (!isDraggingEraser || !currentEraserBox || !overlayRef.current) {
      setIsDraggingEraser(false);
      setEraserStart(null);
      setCurrentEraserBox(null);
      return;
    }

    if (currentEraserBox.width > 5 && currentEraserBox.height > 5) {
      const viewportHeight = overlayRef.current.clientHeight;
      const pdfX = currentEraserBox.left / scale;
      const pdfWidth = currentEraserBox.width / scale;
      const pdfHeight = currentEraserBox.height / scale;
      const pdfY = (viewportHeight - (currentEraserBox.top + currentEraserBox.height)) / scale;

      const newWhiteout: WhiteoutBox = {
        id: `whiteout-${Date.now()}`,
        page: currentPage,
        pdfX,
        pdfY,
        pdfWidth,
        pdfHeight,
        domLeft: currentEraserBox.left,
        domTop: currentEraserBox.top,
        domWidth: currentEraserBox.width,
        domHeight: currentEraserBox.height,
      };

      setWhiteouts((prev) => [...prev, newWhiteout]);
    }

    setIsDraggingEraser(false);
    setEraserStart(null);
    setCurrentEraserBox(null);
  };

  // Compile and Save PDF using original PDF bytes & pdf-lib with embedded Arial Unicode font
  const handleSavePdf = async () => {
    if (!originalBytesRef.current) return;

    setIsSaving(true);
    setSaveStatus("Saving changes with exact layout...");

    try {
      const pdfDoc = await PDFDocument.load(originalBytesRef.current);

      // Embed Arial font via fontkit for native Unicode and rupee symbol (₹) support
      let customFont: any = null;
      let isUnicodeFont = false;
      try {
        const fontkit = (await import("@pdf-lib/fontkit")).default;
        pdfDoc.registerFontkit(fontkit);
        const fontRes = await fetch("/fonts/arial.ttf");
        if (fontRes.ok) {
          const fontBytes = await fontRes.arrayBuffer();
          customFont = await pdfDoc.embedFont(fontBytes);
          isUnicodeFont = true;
        }
      } catch (err) {
        console.warn("Could not load Arial font via fontkit, falling back to Helvetica:", err);
      }

      const font = customFont || (await pdfDoc.embedFont(StandardFonts.Helvetica));
      const pages = pdfDoc.getPages();

      // 1. Apply user-drawn manual whiteouts
      for (const w of whiteouts) {
        if (w.page <= pages.length) {
          const targetPage = pages[w.page - 1];
          targetPage.drawRectangle({
            x: w.pdfX,
            y: w.pdfY,
            width: w.pdfWidth,
            height: w.pdfHeight,
            color: rgb(1, 1, 1),
          });
        }
      }

      // 2. Gather all edited items across all pages
      const allEditedList: TextOverlayItem[] = [];
      const visited = new Set<string>();

      // Current page items
      for (const it of textItems) {
        if (it.isEdited) {
          allEditedList.push(it);
          visited.add(it.id);
        }
      }

      // Any items edited on other pages stored in editedItemsMapRef
      for (const [id, edit] of Object.entries(editedItemsMapRef.current)) {
        if (edit.isEdited && !visited.has(id)) {
          const cached = allItemsRef.current.get(id);
          if (cached) {
            allEditedList.push({
              ...cached,
              currentStr: edit.currentStr,
              offsetX: edit.offsetX,
              offsetY: edit.offsetY,
              customFontSize: edit.customFontSize,
              isEdited: true,
            });
            visited.add(id);
          }
        }
      }

      // 3. Apply edited text items with exact alignment and whiteout
      for (const item of allEditedList) {
        if (item.pageNum <= pages.length) {
          const targetPage = pages[item.pageNum - 1];
          const fontSize = item.customFontSize || item.fontSize || item.pdfHeight;

          // If Unicode font is active, keep ₹ and all characters intact!
          // Only fallback to WinAnsi sanitization if Helvetica standard font is used.
          const textToWrite = isUnicodeFont ? item.currentStr : sanitizeForStandardPdf(item.currentStr);

          // Measure exact width using the font
          const textWidth = font.widthOfTextAtSize(textToWrite, fontSize);

          const finalX = item.pdfX + (item.offsetX || 0);
          const finalY = item.pdfY + (item.offsetY || 0);

          // Whiteout box: covers whichever is wider (original or new) + margins for clean coverage
          const whiteoutWidth = Math.max(item.pdfWidth, textWidth) + 3;
          const whiteoutHeight = fontSize * 1.25;
          const whiteoutX = finalX - 1;
          // Covers 25% below baseline for descenders (g, j, p, q, y, commas)
          const whiteoutY = finalY - fontSize * 0.25;

          targetPage.drawRectangle({
            x: whiteoutX,
            y: whiteoutY,
            width: whiteoutWidth,
            height: whiteoutHeight,
            color: rgb(1, 1, 1),
          });

          // Draw Replacement Text at the exact position
          targetPage.drawText(textToWrite, {
            x: finalX,
            y: finalY,
            size: fontSize,
            font,
            color: rgb(0.12, 0.12, 0.12),
          });
        }
      }

      // 4. Apply user-added free text
      for (const free of freeTextItems) {
        if (free.page <= pages.length) {
          const targetPage = pages[free.page - 1];
          const textToWrite = isUnicodeFont ? free.text : sanitizeForStandardPdf(free.text);
          targetPage.drawText(textToWrite, {
            x: free.pdfX,
            y: free.pdfY,
            size: free.fontSize,
            font,
            color: rgb(0.12, 0.12, 0.12),
          });
        }
      }

      const modifiedPdfBytes = await pdfDoc.save();
      const blob = new Blob([new Uint8Array(modifiedPdfBytes)], { type: "application/pdf" });
      const downloadUrl = URL.createObjectURL(blob);

      const link = document.createElement("a");
      link.href = downloadUrl;
      const originalName = pdfFile.name.replace(/\.pdf$/i, "");
      link.download = `${originalName}_edited.pdf`;
      document.body.appendChild(link);
      link.click();

      setTimeout(() => {
        document.body.removeChild(link);
        URL.revokeObjectURL(downloadUrl);
      }, 1000);

      setSaveStatus("Downloaded Edited PDF!");
      setTimeout(() => setSaveStatus(null), 3500);
    } catch (err) {
      console.error("Error saving PDF:", err);
      setSaveStatus("Failed to save PDF");
      setTimeout(() => setSaveStatus(null), 3500);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-zinc-950 text-zinc-100 select-none overflow-hidden font-sans">
      {/* Top Header & Navigation */}
      <header className="h-16 bg-zinc-900 border-b border-zinc-800 px-4 sm:px-6 flex items-center justify-between shrink-0 z-20">
        {/* Left: Back & Document Title */}
        <div className="flex items-center space-x-3">
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors cursor-pointer"
            title="Exit Editor"
          >
            <ArrowLeft size={18} />
          </button>
          <div className="flex flex-col">
            <h2 className="text-sm font-bold text-white max-w-[200px] sm:max-w-[340px] truncate">
              {pdfFile.name}
            </h2>
            <span className="text-[11px] text-emerald-400 flex items-center gap-1 font-medium">
              <Sparkles size={11} />
              Original PDF Format 100% Preserved
            </span>
          </div>
        </div>

        {/* Center: Tools (Edit Text, Add Text, Whiteout Eraser) */}
        <div className="flex items-center gap-1 bg-zinc-950/80 p-1 rounded-2xl border border-zinc-800">
          <button
            onClick={() => {
              setActiveTool("edit");
              setActiveEditingId(null);
            }}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
              activeTool === "edit"
                ? "bg-red-600 text-white shadow-md shadow-red-600/30"
                : "text-zinc-400 hover:text-white hover:bg-zinc-800"
            }`}
          >
            <MousePointer size={14} />
            <span className="hidden sm:inline">Click & Edit Text</span>
          </button>

          <button
            onClick={() => {
              setActiveTool("text");
              setActiveEditingId(null);
            }}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
              activeTool === "text"
                ? "bg-red-600 text-white shadow-md shadow-red-600/30"
                : "text-zinc-400 hover:text-white hover:bg-zinc-800"
            }`}
          >
            <Type size={14} />
            <span className="hidden sm:inline">Add Text</span>
          </button>

          <button
            onClick={() => {
              setActiveTool("erase");
              setActiveEditingId(null);
            }}
            className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
              activeTool === "erase"
                ? "bg-red-600 text-white shadow-md shadow-red-600/30"
                : "text-zinc-400 hover:text-white hover:bg-zinc-800"
            }`}
          >
            <Eraser size={14} />
            <span className="hidden sm:inline">Whiteout / Erase</span>
          </button>
        </div>

        {/* Right: Save & Download */}
        <div className="flex items-center space-x-3">
          {saveStatus && (
            <span className="text-xs text-emerald-400 font-medium px-2 py-1 rounded bg-emerald-950/50 border border-emerald-800/50 animate-fade-in hidden sm:inline-block">
              {saveStatus}
            </span>
          )}

          <button
            onClick={handleSavePdf}
            disabled={isSaving || loading}
            className="px-5 py-2 rounded-xl bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white text-xs font-bold flex items-center gap-2 shadow-lg shadow-red-600/30 transition-all cursor-pointer disabled:opacity-50"
          >
            {isSaving ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                <span>Saving PDF...</span>
              </>
            ) : (
              <>
                <Download size={16} />
                <span>Save & Download PDF</span>
              </>
            )}
          </button>
        </div>
      </header>

      {/* Floating Control Ribbon (Page navigation & Zoom) */}
      <div className="h-10 bg-zinc-900/90 border-b border-zinc-800/80 px-4 flex items-center justify-between text-xs text-zinc-400 shrink-0">
        <div className="flex items-center space-x-2">
          <span className="text-[11px] text-zinc-400">
            {activeTool === "edit" &&
              "👉 Click directly on any text/number to edit. Use ◀ ▶ ▲ ▼ buttons or Alt+Arrow keys to nudge."}
            {activeTool === "text" && "✍️ Click anywhere on the PDF page to add new text."}
            {activeTool === "erase" && "⬜ Click & drag to draw a whiteout box over unwanted areas."}
          </span>
        </div>

        <div className="flex items-center space-x-3">
          {/* Zoom Controls */}
          <div className="flex items-center space-x-1 bg-zinc-950 px-2 py-1 rounded-lg border border-zinc-800">
            <button
              onClick={() => setScale((s) => Math.max(Number((s - 0.2).toFixed(1)), 0.8))}
              className="p-0.5 hover:text-white cursor-pointer"
              title="Zoom Out"
            >
              <ZoomOut size={13} />
            </button>
            <span className="text-[11px] font-mono w-10 text-center text-zinc-300">
              {Math.round(scale * 100)}%
            </span>
            <button
              onClick={() => setScale((s) => Math.min(Number((s + 0.2).toFixed(1)), 2.2))}
              className="p-0.5 hover:text-white cursor-pointer"
              title="Zoom In"
            >
              <ZoomIn size={13} />
            </button>
          </div>

          {/* Page Navigation */}
          {numPages > 1 && (
            <div className="flex items-center space-x-1.5 bg-zinc-950 px-2 py-1 rounded-lg border border-zinc-800">
              <button
                onClick={() => setCurrentPage((p) => Math.max(p - 1, 1))}
                disabled={currentPage === 1}
                className="p-0.5 hover:text-white disabled:opacity-30 cursor-pointer"
              >
                <ChevronLeft size={14} />
              </button>
              <span className="text-[11px] text-zinc-300">
                {currentPage} / {numPages}
              </span>
              <button
                onClick={() => setCurrentPage((p) => Math.min(p + 1, numPages))}
                disabled={currentPage === numPages}
                className="p-0.5 hover:text-white disabled:opacity-30 cursor-pointer"
              >
                <ChevronRight size={14} />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Main Document Viewport */}
      <div
        className="flex-1 overflow-auto bg-zinc-950 p-6 flex justify-center items-start relative"
        onClick={() => {
          if (activeTool === "edit") {
            setActiveEditingId(null);
          }
        }}
      >
        {loading ? (
          <div className="flex flex-col items-center justify-center h-full text-zinc-400 gap-3 my-auto">
            <Loader2 size={36} className="animate-spin text-red-500" />
            <span className="text-sm font-medium">Rendering original PDF page...</span>
          </div>
        ) : (
          <div
            ref={overlayRef}
            onClick={handleOverlayClick}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            className="relative shadow-2xl rounded-lg bg-white overflow-visible select-none"
            style={{
              cursor: activeTool === "erase" ? "crosshair" : activeTool === "text" ? "text" : "default",
            }}
          >
            {/* Background: Original Crisp PDF Canvas */}
            <canvas ref={canvasRef} className="block pointer-events-none" />

            {/* Interactive Layer: Whiteouts */}
            {whiteouts
              .filter((w) => w.page === currentPage)
              .map((w) => (
                <div
                  key={w.id}
                  style={{
                    left: `${w.domLeft}px`,
                    top: `${w.domTop}px`,
                    width: `${w.domWidth}px`,
                    height: `${w.domHeight}px`,
                  }}
                  className="absolute bg-white border border-dashed border-red-400/40 group cursor-pointer"
                  title="Whiteout box - click to delete"
                  onClick={(e) => {
                    e.stopPropagation();
                    setWhiteouts((prev) => prev.filter((item) => item.id !== w.id));
                  }}
                >
                  <span className="opacity-0 group-hover:opacity-100 text-[9px] text-red-500 bg-red-100 px-1 rounded absolute -top-4 left-0">
                    Click to delete
                  </span>
                </div>
              ))}

            {/* Dragging Eraser Preview Box */}
            {isDraggingEraser && currentEraserBox && (
              <div
                style={{
                  left: `${currentEraserBox.left}px`,
                  top: `${currentEraserBox.top}px`,
                  width: `${currentEraserBox.width}px`,
                  height: `${currentEraserBox.height}px`,
                }}
                className="absolute bg-white/80 border-2 border-red-500 pointer-events-none"
              />
            )}

            {/* Interactive Layer: Extracted Text Items (Click-to-Edit) */}
            {textItems.map((item) => {
              const isEditing = activeEditingId === item.id;
              const effFontSize = item.customFontSize || item.fontSize;
              const scaledFontSize = effFontSize * scale;
              const curLeft = item.domLeft + (item.offsetX || 0) * scale;
              const curTop = item.domTop - (item.offsetY || 0) * scale;
              // Auto-expanding width so text never clips or truncates
              const minW = Math.max(item.domWidth, (item.currentStr.length + 1) * scaledFontSize * 0.62);

              if (isEditing) {
                return (
                  <div
                    key={item.id}
                    style={{
                      left: `${curLeft}px`,
                      top: `${curTop}px`,
                      minWidth: `${minW}px`,
                      height: `${item.domHeight}px`,
                      zIndex: 40,
                    }}
                    className="absolute"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {/* Floating Micro-Nudge & Font Toolbar */}
                    <div
                      onMouseDown={(e) => e.stopPropagation()}
                      className="absolute -top-10 left-0 flex items-center gap-1 bg-zinc-900 border border-zinc-700 shadow-2xl px-2 py-1 rounded-lg text-xs text-white z-50 whitespace-nowrap"
                    >
                      <span className="text-zinc-400 font-medium text-[10px] mr-0.5">Nudge:</span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          handleNudge(item.id, -0.5, 0);
                        }}
                        className="px-1.5 py-0.5 hover:bg-zinc-700 rounded text-zinc-200 hover:text-white font-bold cursor-pointer"
                        title="Nudge Left (Alt+Left)"
                      >
                        ◀
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          handleNudge(item.id, 0.5, 0);
                        }}
                        className="px-1.5 py-0.5 hover:bg-zinc-700 rounded text-zinc-200 hover:text-white font-bold cursor-pointer"
                        title="Nudge Right (Alt+Right)"
                      >
                        ▶
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          handleNudge(item.id, 0, 0.5);
                        }}
                        className="px-1.5 py-0.5 hover:bg-zinc-700 rounded text-zinc-200 hover:text-white font-bold cursor-pointer"
                        title="Nudge Up (Alt+Up)"
                      >
                        ▲
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          handleNudge(item.id, 0, -0.5);
                        }}
                        className="px-1.5 py-0.5 hover:bg-zinc-700 rounded text-zinc-200 hover:text-white font-bold cursor-pointer"
                        title="Nudge Down (Alt+Down)"
                      >
                        ▼
                      </button>
                      <div className="w-[1px] h-3.5 bg-zinc-700 mx-0.5" />
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          handleAdjustFontSize(item.id, -0.5);
                        }}
                        className="px-1.5 py-0.5 hover:bg-zinc-700 rounded text-zinc-200 hover:text-white text-[10px] font-bold cursor-pointer"
                        title="Decrease Font Size"
                      >
                        A-
                      </button>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          handleAdjustFontSize(item.id, 0.5);
                        }}
                        className="px-1.5 py-0.5 hover:bg-zinc-700 rounded text-zinc-200 hover:text-white text-[10px] font-bold cursor-pointer"
                        title="Increase Font Size"
                      >
                        A+
                      </button>
                      {item.isEdited && (
                        <>
                          <div className="w-[1px] h-3.5 bg-zinc-700 mx-0.5" />
                          <button
                            type="button"
                            onClick={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                              handleResetItem(item.id);
                            }}
                            className="px-1.5 py-0.5 hover:bg-zinc-700 rounded text-amber-400 text-[10px] font-medium cursor-pointer"
                            title="Reset to Original"
                          >
                            Reset
                          </button>
                        </>
                      )}
                      <div className="w-[1px] h-3.5 bg-zinc-700 mx-0.5" />
                      <button
                        type="button"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          setActiveEditingId(null);
                        }}
                        className="px-2 py-0.5 bg-emerald-600 hover:bg-emerald-500 rounded text-white text-[11px] font-bold flex items-center gap-1 cursor-pointer"
                        title="Done"
                      >
                        <CheckCircle2 size={12} />
                        Done
                      </button>
                    </div>

                    {/* Exact-Fidelity Input Box: Zero Padding, Zero Layout Shift */}
                    <input
                      type="text"
                      autoFocus
                      value={item.currentStr}
                      onChange={(e) => handleUpdateText(item.id, e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") setActiveEditingId(null);
                        if (e.altKey && e.key === "ArrowLeft") {
                          e.preventDefault();
                          handleNudge(item.id, -0.5, 0);
                        }
                        if (e.altKey && e.key === "ArrowRight") {
                          e.preventDefault();
                          handleNudge(item.id, 0.5, 0);
                        }
                        if (e.altKey && e.key === "ArrowUp") {
                          e.preventDefault();
                          handleNudge(item.id, 0, 0.5);
                        }
                        if (e.altKey && e.key === "ArrowDown") {
                          e.preventDefault();
                          handleNudge(item.id, 0, -0.5);
                        }
                      }}
                      style={{
                        fontFamily: "Arial, Helvetica, sans-serif",
                        fontSize: `${scaledFontSize}px`,
                        lineHeight: 1,
                        padding: "0px",
                        margin: "0px",
                        border: "none",
                        outline: "none",
                        boxShadow: "0 0 0 2px #2563eb",
                        borderRadius: "2px",
                        width: `${minW}px`,
                        height: `${item.domHeight}px`,
                        backgroundColor: "#ffffff",
                        color: "#18181b",
                      }}
                      className="cursor-text"
                    />
                  </div>
                );
              }

              if (item.isEdited) {
                return (
                  <div
                    key={item.id}
                    style={{
                      left: `${curLeft}px`,
                      top: `${curTop}px`,
                      minWidth: `${minW}px`,
                      height: `${item.domHeight}px`,
                      zIndex: 20,
                    }}
                    className="absolute bg-white cursor-pointer hover:ring-1 hover:ring-blue-500 rounded-xs group"
                    onClick={(e) => {
                      if (activeTool === "edit") {
                        e.stopPropagation();
                        setActiveEditingId(item.id);
                      }
                    }}
                  >
                    <div
                      style={{
                        fontFamily: "Arial, Helvetica, sans-serif",
                        fontSize: `${scaledFontSize}px`,
                        lineHeight: 1,
                        padding: 0,
                        margin: 0,
                        whiteSpace: "nowrap",
                        color: "#18181b",
                      }}
                      className="h-full flex items-center"
                    >
                      {item.currentStr}
                    </div>
                  </div>
                );
              }

              // Unedited item (transparent overlay)
              return (
                <div
                  key={item.id}
                  style={{
                    left: `${curLeft}px`,
                    top: `${curTop}px`,
                    width: `${item.domWidth}px`,
                    height: `${item.domHeight}px`,
                  }}
                  className={`absolute transition-colors ${
                    activeTool === "edit"
                      ? "hover:bg-blue-500/20 hover:outline hover:outline-1 hover:outline-blue-500 cursor-pointer"
                      : "pointer-events-none"
                  }`}
                  onClick={(e) => {
                    if (activeTool === "edit") {
                      e.stopPropagation();
                      setActiveEditingId(item.id);
                    }
                  }}
                />
              );
            })}

            {/* Interactive Layer: User-Added Free Text Items */}
            {freeTextItems
              .filter((f) => f.page === currentPage)
              .map((free) => (
                <div
                  key={free.id}
                  style={{
                    left: `${free.domLeft}px`,
                    top: `${free.domTop}px`,
                  }}
                  className="absolute z-20"
                >
                  <input
                    type="text"
                    autoFocus={activeEditingId === free.id}
                    value={free.text}
                    onChange={(e) => {
                      const val = e.target.value;
                      setFreeTextItems((prev) =>
                        prev.map((item) => (item.id === free.id ? { ...item, text: val } : item))
                      );
                    }}
                    style={{
                      fontFamily: "Arial, Helvetica, sans-serif",
                      fontSize: `${free.fontSize * scale}px`,
                    }}
                    className="bg-white/95 text-zinc-900 border border-red-500 rounded px-1.5 py-0.5 focus:outline-none shadow-md font-sans"
                  />
                </div>
              ))}
          </div>
        )}
      </div>
    </div>
  );
};
