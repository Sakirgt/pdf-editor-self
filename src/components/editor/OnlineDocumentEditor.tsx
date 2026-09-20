"use client";

import React, { useState, useRef } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import TextAlign from "@tiptap/extension-text-align";
import Image from "@tiptap/extension-image";
import {
  Bold,
  Italic,
  Underline as UnderlineIcon,
  Strikethrough,
  Heading1,
  Heading2,
  Heading3,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignJustify,
  List,
  ListOrdered,
  Quote,
  Minus,
  Undo,
  Redo,
  Download,
  Printer,
  ArrowLeft,
  ImageIcon,
  FileText,
  Sparkles,
  Loader2,
  CheckCircle2,
  AlertCircle,
} from "lucide-react";

interface OnlineDocumentEditorProps {
  initialHtml: string;
  documentTitle: string;
  onClose: () => void;
}

export const OnlineDocumentEditor: React.FC<OnlineDocumentEditorProps> = ({
  initialHtml,
  documentTitle,
  onClose,
}) => {
  const [title, setTitle] = useState(documentTitle || "Untitled Document");
  const [isCompiling, setIsCompiling] = useState(false);
  const [compileStatus, setCompileStatus] = useState<string | null>(null);
  const editorRef = useRef<HTMLDivElement>(null);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3],
        },
      }),
      Underline,
      TextAlign.configure({
        types: ["heading", "paragraph"],
      }),
      Image.configure({
        inline: true,
      }),
    ],
    content: initialHtml || "<p>Start editing your document here...</p>",
    editorProps: {
      attributes: {
        class:
          "prose prose-zinc max-w-none focus:outline-none min-h-[900px] text-zinc-900 leading-relaxed font-sans text-base",
      },
    },
    immediatelyRender: false,
  });

  // Handle native Browser Print (Guarantees exact layout, fonts, currency symbols ₹, no overlapping)
  const handlePrintPdf = () => {
    window.print();
  };

  // Compile to PDF via API Route
  const handleCompilePdf = async () => {
    if (!editor) return;
    setIsCompiling(true);
    setCompileStatus("Compiling to PDF...");

    try {
      const htmlContent = editor.getHTML();
      const response = await fetch("/api/compile-to-pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          html: htmlContent,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to compile PDF");
      }

      const blob = await response.blob();
      const pdfBlob = new Blob([blob], { type: "application/pdf" });
      const downloadUrl = URL.createObjectURL(pdfBlob);

      const link = document.createElement("a");
      link.href = downloadUrl;
      link.download = `${title.replace(/\.pdf$/i, "")}_edited.pdf`;
      document.body.appendChild(link);
      link.click();

      setTimeout(() => {
        document.body.removeChild(link);
        URL.revokeObjectURL(downloadUrl);
      }, 1000);

      setCompileStatus("Downloaded PDF Successfully!");
      setTimeout(() => setCompileStatus(null), 3000);
    } catch (err) {
      console.error("Compile error:", err);
      setCompileStatus("Error compiling PDF");
      setTimeout(() => setCompileStatus(null), 3000);
    } finally {
      setIsCompiling(false);
    }
  };

  const handleInsertImage = () => {
    const url = prompt("Enter image URL:");
    if (url && editor) {
      editor.chain().focus().setImage({ src: url }).run();
    }
  };

  if (!editor) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950 text-white">
        <Loader2 className="animate-spin text-red-500 mr-2" size={24} />
        <span>Loading In-Browser Document Editor...</span>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-zinc-900 text-zinc-100 overflow-hidden print:bg-white print:text-black">
      {/* Top Header Bar */}
      <header className="h-16 bg-zinc-950 border-b border-zinc-800 px-4 sm:px-6 flex items-center justify-between shrink-0 select-none print:hidden">
        {/* Left: Back button & Document title */}
        <div className="flex items-center space-x-3">
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
            title="Exit Editor"
          >
            <ArrowLeft size={18} />
          </button>

          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 rounded-lg bg-red-600/20 text-red-400 border border-red-500/30 flex items-center justify-center">
              <FileText size={16} />
            </div>
            <div className="flex flex-col">
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="bg-transparent text-sm font-bold text-white border-b border-transparent hover:border-zinc-700 focus:border-red-500 focus:outline-none px-1 py-0.5 max-w-[220px] sm:max-w-[320px] truncate"
                title="Click to rename document"
              />
              <span className="text-[10px] text-zinc-500 px-1">
                Live In-Browser Document Editor
              </span>
            </div>
          </div>
        </div>

        {/* Right: Action Buttons */}
        <div className="flex items-center space-x-2.5">
          {compileStatus && (
            <span className="hidden sm:inline-flex text-xs text-emerald-400 font-medium px-2 py-1 rounded bg-emerald-950/40 border border-emerald-800/40">
              {compileStatus}
            </span>
          )}

          {/* Quick Browser Print / PDF */}
          <button
            type="button"
            onClick={handlePrintPdf}
            className="px-3.5 py-2 rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-semibold flex items-center gap-1.5 border border-zinc-700 transition-colors cursor-pointer"
            title="Print or Save as PDF with exact browser layout"
          >
            <Printer size={15} />
            <span className="hidden sm:inline">Print / Save PDF</span>
          </button>

          {/* Compile to PDF & Download */}
          <button
            type="button"
            disabled={isCompiling}
            onClick={handleCompilePdf}
            className="px-4 py-2 rounded-xl bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white text-xs font-bold flex items-center gap-2 shadow-lg shadow-red-600/25 transition-all cursor-pointer disabled:opacity-50"
          >
            {isCompiling ? (
              <>
                <Loader2 size={15} className="animate-spin" />
                <span>Compiling...</span>
              </>
            ) : (
              <>
                <Download size={15} />
                <span>Compile to PDF</span>
              </>
            )}
          </button>
        </div>
      </header>

      {/* Formatting Toolbar */}
      <div className="bg-zinc-950/90 border-b border-zinc-800 px-4 py-2 flex items-center gap-1 overflow-x-auto select-none shrink-0 print:hidden scrollbar-none">
        {/* Undo / Redo */}
        <button
          onClick={() => editor.chain().focus().undo().run()}
          disabled={!editor.can().undo()}
          className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 disabled:opacity-30"
          title="Undo"
        >
          <Undo size={16} />
        </button>
        <button
          onClick={() => editor.chain().focus().redo().run()}
          disabled={!editor.can().redo()}
          className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 disabled:opacity-30"
          title="Redo"
        >
          <Redo size={16} />
        </button>

        <div className="w-px h-5 bg-zinc-800 mx-1" />

        {/* Headings */}
        <button
          onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}
          className={`p-1.5 rounded-lg text-xs font-bold ${
            editor.isActive("heading", { level: 1 })
              ? "bg-red-600 text-white"
              : "text-zinc-400 hover:text-white hover:bg-zinc-800"
          }`}
          title="Heading 1"
        >
          <Heading1 size={16} />
        </button>
        <button
          onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
          className={`p-1.5 rounded-lg text-xs font-bold ${
            editor.isActive("heading", { level: 2 })
              ? "bg-red-600 text-white"
              : "text-zinc-400 hover:text-white hover:bg-zinc-800"
          }`}
          title="Heading 2"
        >
          <Heading2 size={16} />
        </button>
        <button
          onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
          className={`p-1.5 rounded-lg text-xs font-bold ${
            editor.isActive("heading", { level: 3 })
              ? "bg-red-600 text-white"
              : "text-zinc-400 hover:text-white hover:bg-zinc-800"
          }`}
          title="Heading 3"
        >
          <Heading3 size={16} />
        </button>

        <div className="w-px h-5 bg-zinc-800 mx-1" />

        {/* Text Formats */}
        <button
          onClick={() => editor.chain().focus().toggleBold().run()}
          className={`p-1.5 rounded-lg ${
            editor.isActive("bold")
              ? "bg-red-600 text-white"
              : "text-zinc-400 hover:text-white hover:bg-zinc-800"
          }`}
          title="Bold"
        >
          <Bold size={16} />
        </button>
        <button
          onClick={() => editor.chain().focus().toggleItalic().run()}
          className={`p-1.5 rounded-lg ${
            editor.isActive("italic")
              ? "bg-red-600 text-white"
              : "text-zinc-400 hover:text-white hover:bg-zinc-800"
          }`}
          title="Italic"
        >
          <Italic size={16} />
        </button>
        <button
          onClick={() => editor.chain().focus().toggleUnderline().run()}
          className={`p-1.5 rounded-lg ${
            editor.isActive("underline")
              ? "bg-red-600 text-white"
              : "text-zinc-400 hover:text-white hover:bg-zinc-800"
          }`}
          title="Underline"
        >
          <UnderlineIcon size={16} />
        </button>
        <button
          onClick={() => editor.chain().focus().toggleStrike().run()}
          className={`p-1.5 rounded-lg ${
            editor.isActive("strike")
              ? "bg-red-600 text-white"
              : "text-zinc-400 hover:text-white hover:bg-zinc-800"
          }`}
          title="Strikethrough"
        >
          <Strikethrough size={16} />
        </button>

        <div className="w-px h-5 bg-zinc-800 mx-1" />

        {/* Alignment */}
        <button
          onClick={() => editor.chain().focus().setTextAlign("left").run()}
          className={`p-1.5 rounded-lg ${
            editor.isActive({ textAlign: "left" })
              ? "bg-red-600 text-white"
              : "text-zinc-400 hover:text-white hover:bg-zinc-800"
          }`}
          title="Align Left"
        >
          <AlignLeft size={16} />
        </button>
        <button
          onClick={() => editor.chain().focus().setTextAlign("center").run()}
          className={`p-1.5 rounded-lg ${
            editor.isActive({ textAlign: "center" })
              ? "bg-red-600 text-white"
              : "text-zinc-400 hover:text-white hover:bg-zinc-800"
          }`}
          title="Align Center"
        >
          <AlignCenter size={16} />
        </button>
        <button
          onClick={() => editor.chain().focus().setTextAlign("right").run()}
          className={`p-1.5 rounded-lg ${
            editor.isActive({ textAlign: "right" })
              ? "bg-red-600 text-white"
              : "text-zinc-400 hover:text-white hover:bg-zinc-800"
          }`}
          title="Align Right"
        >
          <AlignRight size={16} />
        </button>
        <button
          onClick={() => editor.chain().focus().setTextAlign("justify").run()}
          className={`p-1.5 rounded-lg ${
            editor.isActive({ textAlign: "justify" })
              ? "bg-red-600 text-white"
              : "text-zinc-400 hover:text-white hover:bg-zinc-800"
          }`}
          title="Justify"
        >
          <AlignJustify size={16} />
        </button>

        <div className="w-px h-5 bg-zinc-800 mx-1" />

        {/* Lists & Blocks */}
        <button
          onClick={() => editor.chain().focus().toggleBulletList().run()}
          className={`p-1.5 rounded-lg ${
            editor.isActive("bulletList")
              ? "bg-red-600 text-white"
              : "text-zinc-400 hover:text-white hover:bg-zinc-800"
          }`}
          title="Bullet List"
        >
          <List size={16} />
        </button>
        <button
          onClick={() => editor.chain().focus().toggleOrderedList().run()}
          className={`p-1.5 rounded-lg ${
            editor.isActive("orderedList")
              ? "bg-red-600 text-white"
              : "text-zinc-400 hover:text-white hover:bg-zinc-800"
          }`}
          title="Numbered List"
        >
          <ListOrdered size={16} />
        </button>
        <button
          onClick={() => editor.chain().focus().toggleBlockquote().run()}
          className={`p-1.5 rounded-lg ${
            editor.isActive("blockquote")
              ? "bg-red-600 text-white"
              : "text-zinc-400 hover:text-white hover:bg-zinc-800"
          }`}
          title="Blockquote"
        >
          <Quote size={16} />
        </button>
        <button
          onClick={() => editor.chain().focus().setHorizontalRule().run()}
          className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800"
          title="Horizontal Rule"
        >
          <Minus size={16} />
        </button>

        <div className="w-px h-5 bg-zinc-800 mx-1" />

        {/* Insert Image */}
        <button
          onClick={handleInsertImage}
          className="p-1.5 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800"
          title="Insert Image URL"
        >
          <ImageIcon size={16} />
        </button>
      </div>

      {/* Main Document Workspace (A4 Paper sheet style) */}
      <div
        ref={editorRef}
        className="flex-1 overflow-y-auto p-4 sm:p-10 flex justify-center bg-zinc-950/90 print:p-0 print:m-0 print:overflow-visible print:bg-white"
      >
        <div className="w-full max-w-[850px] min-h-[1100px] bg-white text-zinc-900 shadow-2xl p-10 sm:p-16 rounded-xl border border-zinc-200/80 print:border-none print:shadow-none print:p-0 print:max-w-none print:min-h-0 print:w-full">
          <EditorContent editor={editor} />
        </div>
      </div>

      {/* Print Specific CSS to prevent overlaps and guarantee layout */}
      <style jsx global>{`
        @media print {
          body {
            background-color: white !important;
            color: black !important;
            margin: 0 !important;
            padding: 0 !important;
          }
          header,
          footer,
          .print\\:hidden {
            display: none !important;
          }
          .ProseMirror {
            color: black !important;
            padding: 0 !important;
            margin: 0 !important;
          }
          .ProseMirror h1 {
            font-size: 24pt !important;
            line-height: 1.3 !important;
            margin-bottom: 12pt !important;
          }
          .ProseMirror h2 {
            font-size: 18pt !important;
            line-height: 1.3 !important;
            margin-bottom: 10pt !important;
          }
          .ProseMirror p {
            font-size: 11pt !important;
            line-height: 1.6 !important;
            margin-bottom: 10pt !important;
          }
          @page {
            size: A4;
            margin: 20mm;
          }
        }

        /* TipTap Editor Inner Content Styling */
        .ProseMirror h1 {
          font-size: 1.875rem;
          font-weight: 800;
          color: #111827;
          margin-bottom: 1rem;
          line-height: 1.25;
        }
        .ProseMirror h2 {
          font-size: 1.35rem;
          font-weight: 700;
          color: #1f2937;
          margin-top: 1.5rem;
          margin-bottom: 0.75rem;
          line-height: 1.3;
        }
        .ProseMirror h3 {
          font-size: 1.15rem;
          font-weight: 600;
          color: #374151;
          margin-top: 1.25rem;
          margin-bottom: 0.5rem;
        }
        .ProseMirror p {
          margin-bottom: 0.85rem;
          line-height: 1.65;
          color: #1f2937;
          word-break: break-word;
        }
        .ProseMirror hr {
          border-top: 1px dashed #d1d5db;
          margin: 2rem 0;
        }
        .ProseMirror blockquote {
          border-left: 3px solid #ef4444;
          padding-left: 1rem;
          color: #4b5563;
          font-style: italic;
          margin: 1rem 0;
        }
        .ProseMirror ul {
          list-style-type: disc;
          padding-left: 1.5rem;
          margin-bottom: 0.85rem;
        }
        .ProseMirror ol {
          list-style-type: decimal;
          padding-left: 1.5rem;
          margin-bottom: 0.85rem;
        }
        .ProseMirror img {
          max-width: 100%;
          height: auto;
          border-radius: 0.5rem;
          margin: 1rem 0;
        }
      `}</style>
    </div>
  );
};
