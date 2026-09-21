import { NextRequest, NextResponse } from "next/server";
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  PageBreak,
  Table,
  TableRow,
  TableCell,
  WidthType,
  AlignmentType,
  BorderStyle,
} from "docx";
import { extractText, extractTextItems } from "unpdf";
import mammoth from "mammoth";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

export const runtime = "nodejs";

// Sanitize text to ensure it encodes cleanly in WinAnsi (standard PDF Helvetica)
// Replaces currency symbols like ₹ with Rs., smart quotes with standard quotes, etc.
function sanitizeForPdf(text: string): string {
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
    .replace(/[^\x00-\xFF]/g, ""); // Strip any characters unsupported by standard PDF WinAnsi
}

// Word-wrapping helper for pdf-lib text drawing
function wrapText(text: string, maxCharsPerLine: number = 80): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let currentLine = "";

  for (const word of words) {
    if (!currentLine) {
      currentLine = word;
    } else if (currentLine.length + word.length + 1 <= maxCharsPerLine) {
      currentLine += " " + word;
    } else {
      lines.push(currentLine);
      currentLine = word;
    }
  }
  if (currentLine) {
    lines.push(currentLine);
  }
  return lines;
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const from = (formData.get("from") as string || "pdf").toLowerCase().replace(".", "");
    const to = (formData.get("to") as string || "docx").toLowerCase().replace(".", "");

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const baseName = file.name.substring(0, file.name.lastIndexOf(".")) || "converted_document";
    const outputFileName = `${baseName}.${to}`;
    const fileBuffer = Buffer.from(await file.arrayBuffer());

    // 1. Check if ConvertAPI secret is present in environment
    const convertApiSecret = process.env.CONVERT_API_SECRET || process.env.CONVERTAPI_SECRET;

    if (convertApiSecret) {
      try {
        const convertApiFormData = new FormData();
        convertApiFormData.append("File", new Blob([fileBuffer]), file.name);
        convertApiFormData.append("StoreFile", "true");

        const convertResponse = await fetch(
          `https://v2.convertapi.com/convert/${from}/to/${to}?Secret=${convertApiSecret}`,
          {
            method: "POST",
            body: convertApiFormData,
          }
        );

        if (convertResponse.ok) {
          const resultJson = await convertResponse.json();
          if (resultJson.Files && resultJson.Files.length > 0) {
            const fileUrl = resultJson.Files[0].Url;
            const fileDownloadResp = await fetch(fileUrl);
            const convertedBuffer = Buffer.from(await fileDownloadResp.arrayBuffer());

            const contentType =
              to === "pdf"
                ? "application/pdf"
                : "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

            return new NextResponse(convertedBuffer, {
              status: 200,
              headers: {
                "Content-Type": contentType,
                "Content-Disposition": `attachment; filename="${encodeURIComponent(outputFileName)}"`,
                "X-Filename": outputFileName,
              },
            });
          }
        } else {
          console.warn("ConvertAPI error, using built-in conversion engine:", await convertResponse.text());
        }
      } catch (apiErr) {
        console.warn("ConvertAPI request error, using built-in conversion engine:", apiErr);
      }
    }

    // 2. Built-in Conversion Engine: Word to PDF (DOCX -> PDF)
    if (to === "pdf") {
      let rawText = "";

      // If source is DOCX / DOC, extract text using mammoth
      if (from === "docx" || from === "doc") {
        try {
          const result = await mammoth.extractRawText({ buffer: fileBuffer });
          rawText = result.value || "";
        } catch (docxErr) {
          console.warn("Mammoth extraction error:", docxErr);
        }
      }

      // Create high-standard, valid A4 PDF document
      const pdfDoc = await PDFDocument.create();
      const PAGE_WIDTH = 595.28; // Standard A4 points
      const PAGE_HEIGHT = 841.89;
      const MARGIN_X = 54;
      const MARGIN_TOP = 64;
      const MARGIN_BOTTOM = 54;

      const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
      const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

      let currentPage = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
      let currentY = PAGE_HEIGHT - MARGIN_TOP;

      // Draw Header / Title (Sanitized for WinAnsi)
      const title = sanitizeForPdf(baseName.replace(/[_-]/g, " "));
      currentPage.drawText(title, {
        x: MARGIN_X,
        y: currentY,
        size: 18,
        font: boldFont,
        color: rgb(0.1, 0.1, 0.1),
      });
      currentY -= 32;

      // Document details (Sanitized for WinAnsi)
      const docDetails = sanitizeForPdf(`Converted from: ${file.name}`);
      currentPage.drawText(docDetails, {
        x: MARGIN_X,
        y: currentY,
        size: 10,
        font,
        color: rgb(0.4, 0.4, 0.4),
      });
      currentY -= 24;

      // Divider line
      currentPage.drawLine({
        start: { x: MARGIN_X, y: currentY },
        end: { x: PAGE_WIDTH - MARGIN_X, y: currentY },
        thickness: 0.75,
        color: rgb(0.8, 0.8, 0.8),
      });
      currentY -= 28;

      // Render actual content with full sanitization
      const paragraphs = rawText ? rawText.split(/\r?\n\r?\n/) : [file.name];

      for (const para of paragraphs) {
        const trimmed = para.trim();
        if (!trimmed) continue;

        const isHeading = trimmed.length < 50 && (trimmed === trimmed.toUpperCase() || !trimmed.endsWith("."));
        const fontSize = isHeading ? 13 : 10.5;
        const paraFont = isHeading ? boldFont : font;
        const lineHeight = fontSize * 1.45;

        // Sanitize paragraph text to prevent WinAnsi encode errors (e.g. ₹ -> Rs.)
        const sanitizedPara = sanitizeForPdf(trimmed);
        const wrappedLines = wrapText(sanitizedPara, isHeading ? 65 : 82);

        for (const line of wrappedLines) {
          if (currentY <= MARGIN_BOTTOM + 20) {
            // Add next page
            currentPage = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
            currentY = PAGE_HEIGHT - MARGIN_TOP;
          }

          const cleanLine = sanitizeForPdf(line);
          currentPage.drawText(cleanLine, {
            x: MARGIN_X,
            y: currentY,
            size: fontSize,
            font: paraFont,
            color: isHeading ? rgb(0.12, 0.12, 0.12) : rgb(0.2, 0.2, 0.2),
          });
          currentY -= lineHeight;
        }

        currentY -= 12; // Gap between paragraphs
      }

      const pdfBytes = await pdfDoc.save();

      return new NextResponse(new Uint8Array(pdfBytes), {
        status: 200,
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `attachment; filename="${encodeURIComponent(outputFileName)}"`,
          "X-Filename": outputFileName,
        },
      });
    }

    // 3. Layout-Preserving PDF to Word Engine (PDF -> DOCX)
    interface ExtractedDocxItem {
      str: string;
      x: number;
      y: number;
      width: number;
      height: number;
      fontSize: number;
      fontFamily: string;
    }

    interface ExtractedDocxLine {
      y: number;
      items: ExtractedDocxItem[];
    }

    let docSections: any[] = [];
    const uint8 = new Uint8Array(await file.arrayBuffer());

    try {
      const extracted = await extractTextItems(uint8);
      const rawPages = (extracted.items as any[]) || [];

      for (let pageIdx = 0; pageIdx < rawPages.length; pageIdx++) {
        const pageItemsRaw = rawPages[pageIdx] || [];

        // Filter and normalize text items
        const items: ExtractedDocxItem[] = pageItemsRaw
          .filter((it: any) => it.str && it.str.trim().length > 0)
          .map((it: any) => ({
            str: it.str.trim(),
            x: Math.round(it.x * 10) / 10,
            y: Math.round(it.y * 10) / 10,
            width: Math.round((it.width || 0) * 10) / 10,
            height: Math.round((it.height || 0) * 10) / 10,
            fontSize: it.fontSize || 10,
            fontFamily: it.fontFamily || "Arial",
          }));

        if (items.length === 0) continue;

        // Group into lines by Y coordinate (within 3.5pt tolerance)
        const lines: ExtractedDocxLine[] = [];
        const sortedByY = [...items].sort((a: ExtractedDocxItem, b: ExtractedDocxItem) => b.y - a.y || a.x - b.x);

        for (const item of sortedByY) {
          const matched = lines.find((l: ExtractedDocxLine) => Math.abs(l.y - item.y) <= 3.5);
          if (matched) {
            matched.items.push(item);
            matched.items.sort((a: ExtractedDocxItem, b: ExtractedDocxItem) => a.x - b.x);
          } else {
            lines.push({
              y: item.y,
              items: [item],
            });
          }
        }

        // Sort lines from top of page to bottom
        lines.sort((a: ExtractedDocxLine, b: ExtractedDocxLine) => b.y - a.y);

        const pageChildren: (Paragraph | Table)[] = [];
        let i = 0;

        while (i < lines.length) {
          const line = lines[i];

          // 1. Check for tabular regions (tables with columns)
          const tableLines: ExtractedDocxLine[] = [];
          let j = i;
          while (j < lines.length && lines[j].items.length >= 3) {
            tableLines.push(lines[j]);
            j++;
          }

          if (tableLines.length >= 2) {
            // Cluster columns by X positions across the rows
            const colClusters: { center: number; points: number[] }[] = [];
            tableLines.forEach((row: ExtractedDocxLine) => {
              row.items.forEach((it: ExtractedDocxItem) => {
                const existing = colClusters.find((c) => Math.abs(c.center - it.x) < 40);
                if (existing) {
                  existing.points.push(it.x);
                  existing.center =
                    existing.points.reduce((a, b) => a + b, 0) / existing.points.length;
                } else {
                  colClusters.push({ center: it.x, points: [it.x] });
                }
              });
            });

            colClusters.sort((a, b) => a.center - b.center);
            const colStarts = colClusters.map((c) => c.center);
            const numCols = colStarts.length;

            const docxTableRows = tableLines.map((row: ExtractedDocxLine, rIdx: number) => {
              const cells: TableCell[] = [];
              for (let c = 0; c < numCols; c++) {
                const startX = c === 0 ? 0 : (colStarts[c] + colStarts[c - 1]) / 2;
                const endX = c === numCols - 1 ? 9999 : (colStarts[c] + colStarts[c + 1]) / 2;

                const matchingItems = row.items.filter((it: ExtractedDocxItem) => it.x >= startX && it.x < endX);
                const cellText = matchingItems.map((it: ExtractedDocxItem) => it.str).join(" ");
                const isHeader = rIdx === 0;
                const primaryItem = matchingItems[0];
                const fontSize = primaryItem
                  ? Math.max(16, Math.min(26, Math.round(primaryItem.fontSize * 2)))
                  : 20;

                cells.push(
                  new TableCell({
                    children: [
                      new Paragraph({
                        children: [
                          new TextRun({
                            text: cellText || " ",
                            bold:
                              isHeader ||
                              (primaryItem?.fontSize >= 11) ||
                              primaryItem?.fontFamily?.toLowerCase().includes("bold"),
                            size: fontSize,
                            font: "Arial",
                            color: "1e293b",
                          }),
                        ],
                        spacing: { before: 80, after: 80 },
                      }),
                    ],
                    borders: {
                      top: { style: BorderStyle.SINGLE, size: 2, color: "E2E8F0" },
                      bottom: { style: BorderStyle.SINGLE, size: 4, color: "CBD5E1" },
                      left: { style: BorderStyle.NONE },
                      right: { style: BorderStyle.NONE },
                    },
                    shading: isHeader ? { fill: "F8FAFC" } : undefined,
                  })
                );
              }
              return new TableRow({ children: cells });
            });

            pageChildren.push(
              new Table({
                rows: docxTableRows,
                width: { size: 100, type: WidthType.PERCENTAGE },
              })
            );

            i = j;
            continue;
          }

          // 2. Multi-column key-value / status row (e.g. Left info, Right info)
          if (line.items.length === 2 && line.items[1].x - line.items[0].x > 160) {
            const leftItem = line.items[0];
            const rightItem = line.items[1];

            pageChildren.push(
              new Table({
                rows: [
                  new TableRow({
                    children: [
                      new TableCell({
                        children: [
                          new Paragraph({
                            children: [
                              new TextRun({
                                text: leftItem.str,
                                bold:
                                  leftItem.fontSize >= 12 ||
                                  leftItem.fontFamily?.toLowerCase().includes("bold"),
                                size: Math.round(leftItem.fontSize * 2),
                                font: "Arial",
                                color: "1e293b",
                              }),
                            ],
                            spacing: { before: 60, after: 60 },
                          }),
                        ],
                        width: { size: 50, type: WidthType.PERCENTAGE },
                        borders: {
                          top: { style: BorderStyle.NONE },
                          bottom: { style: BorderStyle.NONE },
                          left: { style: BorderStyle.NONE },
                          right: { style: BorderStyle.NONE },
                        },
                      }),
                      new TableCell({
                        children: [
                          new Paragraph({
                            alignment: AlignmentType.RIGHT,
                            children: [
                              new TextRun({
                                text: rightItem.str,
                                bold:
                                  rightItem.fontSize >= 12 ||
                                  rightItem.fontFamily?.toLowerCase().includes("bold"),
                                size: Math.round(rightItem.fontSize * 2),
                                font: "Arial",
                                color: "1e293b",
                              }),
                            ],
                            spacing: { before: 60, after: 60 },
                          }),
                        ],
                        width: { size: 50, type: WidthType.PERCENTAGE },
                        borders: {
                          top: { style: BorderStyle.NONE },
                          bottom: { style: BorderStyle.NONE },
                          left: { style: BorderStyle.NONE },
                          right: { style: BorderStyle.NONE },
                        },
                      }),
                    ],
                  }),
                ],
                width: { size: 100, type: WidthType.PERCENTAGE },
              })
            );
            i++;
            continue;
          }

          // 3. Standard line or Heading
          const maxFont = Math.max(...line.items.map((it: ExtractedDocxItem) => it.fontSize));
          const isTitle = maxFont >= 15;
          const isHeading = maxFont >= 12 && maxFont < 15;
          const isCentered =
            line.items.length === 1 &&
            Math.abs(line.items[0].x + line.items[0].width / 2 - 297.6) < 35;

          const runs = line.items.map((it: ExtractedDocxItem) => {
            return new TextRun({
              text: it.str + " ",
              bold: isTitle || isHeading || it.fontFamily?.toLowerCase().includes("bold"),
              size: Math.max(16, Math.min(36, Math.round(it.fontSize * 2))),
              font: "Arial",
              color: isTitle ? "0f172a" : "1e293b",
            });
          });

          pageChildren.push(
            new Paragraph({
              alignment: isCentered ? AlignmentType.CENTER : AlignmentType.LEFT,
              spacing: {
                before: isTitle ? 180 : isHeading ? 120 : 50,
                after: isTitle ? 120 : isHeading ? 80 : 50,
              },
              children: runs,
            })
          );

          i++;
        }

        docSections.push({
          properties: {
            page: {
              size: { width: 11906, height: 16838 }, // Standard A4 (dxa)
              margin: { top: 900, bottom: 900, left: 900, right: 900 },
            },
          },
          children:
            pageChildren.length > 0
              ? pageChildren
              : [new Paragraph({ text: baseName })],
        });
      }
    } catch (parseErr) {
      console.warn("Layout extraction warning:", parseErr);
    }

    if (docSections.length === 0) {
      // Fallback if extraction returned 0 pages
      docSections.push({
        properties: {},
        children: [
          new Paragraph({
            text: baseName.replace(/[_-]/g, " "),
            heading: HeadingLevel.TITLE,
            spacing: { after: 200 },
          }),
          new Paragraph({
            children: [
              new TextRun({
                text: "Original File: ",
                bold: true,
              }),
              new TextRun({
                text: file.name,
                italics: true,
              }),
            ],
          }),
        ],
      });
    }

    const doc = new Document({
      sections: docSections,
    });

    const docxBuffer = await Packer.toBuffer(doc);

    return new NextResponse(new Uint8Array(docxBuffer), {
      status: 200,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `attachment; filename="${encodeURIComponent(outputFileName)}"`,
        "X-Filename": outputFileName,
      },
    });
  } catch (error: unknown) {
    console.error("Conversion error in /api/convert:", error);
    const message = error instanceof Error ? error.message : "Internal conversion error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
