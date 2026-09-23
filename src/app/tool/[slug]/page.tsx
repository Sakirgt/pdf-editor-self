"use client";

import React, { useState, useRef, useEffect, use } from "react";
import Link from "next/link";
import { Header } from "@/components/layout/Header";
import { AuthModal } from "@/components/auth/AuthModal";
import { ToolIcon } from "@/components/ui/ToolIcon";
import { OnlineDocumentEditor } from "@/components/editor/OnlineDocumentEditor";
import { VisualPdfEditor } from "@/components/editor/VisualPdfEditor";
import { getToolBySlug, validateFileForTool } from "@/lib/tools";
import { supabase } from "@/lib/supabase/client";
import { ConversionStatus } from "@/types";
import {
  UploadCloud,
  FileUp,
  FileText,
  Trash2,
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Download,
  RefreshCw,
  Sparkles,
  Shield,
  Zap,
  Edit3,
  Lock,
  LogIn,
} from "lucide-react";
import { getGuestEditCount, hasReachedGuestLimit, GUEST_EDIT_LIMIT } from "@/lib/userStats";

interface ToolPageProps {
  params: Promise<{ slug: string }>;
}

export default function ToolPage({ params }: ToolPageProps) {
  const resolvedParams = use(params);
  const slug = resolvedParams.slug;
  const tool = getToolBySlug(slug);

  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const [authReason, setAuthReason] = useState<"limit_reached" | "general">("general");
  const [guestEdits, setGuestEdits] = useState<number>(0);

  // Exact Layout Visual PDF Canvas Editor State
  const [isVisualEditorOpen, setIsVisualEditorOpen] = useState(false);

  // In-Browser WYSIWYG Editor States
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editorHtml, setEditorHtml] = useState<string>("");
  const [editorTitle, setEditorTitle] = useState<string>("");
  const [isLoadingEditor, setIsLoadingEditor] = useState(false);

  // File & Conversion States
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [conversionError, setConversionError] = useState<string | null>(null);
  const [conversionStatus, setConversionStatus] = useState<ConversionStatus>("idle");
  const [convertedResult, setConvertedResult] = useState<{
    blob?: Blob;
    url?: string;
    name?: string;
    size?: number;
  } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Check Supabase session
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUserEmail(session?.user?.email ?? null);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUserEmail(session?.user?.email ?? null);
    });

    setGuestEdits(getGuestEditCount());
    const handleCountChange = () => {
      setGuestEdits(getGuestEditCount());
    };
    window.addEventListener("edit-count-changed", handleCountChange);

    return () => {
      subscription.unsubscribe();
      window.removeEventListener("edit-count-changed", handleCountChange);
    };
  }, []);

  if (!tool) {
    return (
      <div className="min-h-screen flex flex-col bg-zinc-950 text-zinc-100 font-sans">
        <Header userEmail={userEmail} onOpenAuth={() => setIsAuthOpen(true)} />
        <main className="flex-1 flex flex-col items-center justify-center p-8 text-center">
          <div className="w-16 h-16 rounded-2xl bg-red-500/10 text-red-400 border border-red-500/20 flex items-center justify-center mb-4">
            <AlertCircle size={32} />
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">Tool Not Found</h1>
          <p className="text-sm text-zinc-400 mb-6 max-w-md">
            The tool &quot;{slug}&quot; does not exist or has been moved.
          </p>
          <Link
            href="/"
            className="px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-500 text-white text-sm font-semibold flex items-center gap-2 transition-all shadow-md shadow-red-600/30"
          >
            <ArrowLeft size={16} />
            <span>Back to All Tools</span>
          </Link>
        </main>
      </div>
    );
  }

  // Open In-Browser Editor with extracted PDF content
  const handleOpenEditor = async (fileToEdit?: File) => {
    const file = fileToEdit || selectedFile;
    if (!file) return;

    setIsLoadingEditor(true);
    setConversionError(null);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/extract-pdf", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        throw new Error("Failed to extract document text for editor");
      }

      const data = await res.json();
      setEditorHtml(data.html || "<p>Start editing...</p>");
      setEditorTitle(data.title || file.name);
      setIsEditorOpen(true);
    } catch (err: unknown) {
      console.error("Editor load error:", err);
      // Fallback: open editor with title
      setEditorHtml(`<h1>${file.name}</h1><p>Start editing your document directly in your browser.</p>`);
      setEditorTitle(file.name);
      setIsEditorOpen(true);
    } finally {
      setIsLoadingEditor(false);
    }
  };

  // File drop & select handlers
  const handleFiles = (files: FileList | null) => {
    if (!files || files.length === 0) return;

    // Check mandatory login for edit-pdf after 3 free guest edits
    if (tool.slug === "edit-pdf" && !userEmail && hasReachedGuestLimit()) {
      setAuthReason("limit_reached");
      setIsAuthOpen(true);
      return;
    }

    const file = files[0];

    // Validate format
    const validation = validateFileForTool(file, tool);
    if (!validation.valid) {
      setValidationError(validation.error || "Invalid file format");
      setSelectedFile(null);
      setConversionStatus("idle");
      return;
    }

    setValidationError(null);
    setConversionError(null);
    setSelectedFile(file);
    setConversionStatus("ready");
    setConvertedResult(null);

    // If on edit-pdf tool, auto-launch exact-layout visual editor directly!
    if (tool.slug === "edit-pdf") {
      setIsVisualEditorOpen(true);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    if (tool.slug === "edit-pdf" && !userEmail && hasReachedGuestLimit()) {
      setAuthReason("limit_reached");
      setIsAuthOpen(true);
      return;
    }

    handleFiles(e.dataTransfer.files);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    handleFiles(e.target.files);
  };

  const handleUploadAreaClick = () => {
    if (tool.slug === "edit-pdf" && !userEmail && hasReachedGuestLimit()) {
      setAuthReason("limit_reached");
      setIsAuthOpen(true);
      return;
    }
    fileInputRef.current?.click();
  };

  const handleReset = () => {
    if (convertedResult?.url) {
      URL.revokeObjectURL(convertedResult.url);
    }
    setSelectedFile(null);
    setValidationError(null);
    setConversionError(null);
    setConversionStatus("idle");
    setConvertedResult(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const triggerDownload = (blob: Blob, fileName: string) => {
    const downloadUrl = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = downloadUrl;
    link.download = fileName;
    link.style.display = "none";
    document.body.appendChild(link);
    link.click();

    setTimeout(() => {
      document.body.removeChild(link);
      URL.revokeObjectURL(downloadUrl);
    }, 1000);
  };

  // Convert Trigger & Backend API Call
  const handleStartConversion = async () => {
    if (!selectedFile) return;

    setConversionStatus("converting");
    setConversionError(null);

    const fromExt = selectedFile.name.substring(selectedFile.name.lastIndexOf(".") + 1).toLowerCase();
    const toExt = tool.outputFormat.replace(".", "").toLowerCase();
    const outputFileName = `${selectedFile.name.substring(0, selectedFile.name.lastIndexOf("."))}.${toExt}`;

    try {
      const formData = new FormData();
      formData.append("file", selectedFile);
      formData.append("from", fromExt);
      formData.append("to", toExt);

      const response = await fetch("/api/convert", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        let errorDetails = "Conversion failed on server";
        try {
          const errJson = await response.json();
          errorDetails = errJson.error || errorDetails;
        } catch {
          errorDetails = await response.text();
        }
        throw new Error(errorDetails);
      }

      // Process response with correct dynamic MIME type
      const rawBlob = await response.blob();
      const outputExt = tool.outputFormat.replace(".", "").toLowerCase();
      let outputMimeType = "application/octet-stream";
      if (outputExt === "pdf") {
        outputMimeType = "application/pdf";
      } else if (outputExt === "docx") {
        outputMimeType = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
      } else if (outputExt === "xlsx") {
        outputMimeType = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
      }

      const convertedBlob = new Blob([rawBlob], { type: outputMimeType });

      setConvertedResult({
        blob: convertedBlob,
        name: outputFileName,
        size: convertedBlob.size,
      });

      setConversionStatus("success");

      // Automatically trigger initial download
      triggerDownload(convertedBlob, outputFileName);
    } catch (err: unknown) {
      console.error("Conversion error:", err);
      const message = err instanceof Error ? err.message : "Conversion failed";
      setConversionError(message);
      setConversionStatus("error");
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  return (
    <div className="min-h-screen flex flex-col bg-zinc-950 text-zinc-100 font-sans antialiased selection:bg-red-500 selection:text-white">
      {/* 1. Exact-Fidelity Visual PDF Editor (Original Layout 100% Preserved) */}
      {isVisualEditorOpen && selectedFile && (
        <VisualPdfEditor
          pdfFile={selectedFile}
          onClose={() => setIsVisualEditorOpen(false)}
        />
      )}

      {/* 2. WYSIWYG Docs Editor */}
      {isEditorOpen && (
        <OnlineDocumentEditor
          initialHtml={editorHtml}
          documentTitle={editorTitle}
          onClose={() => setIsEditorOpen(false)}
        />
      )}

      <Header userEmail={userEmail} onOpenAuth={() => setIsAuthOpen(true)} />

      {/* Breadcrumb / Top Bar */}
      <div className="w-full border-b border-zinc-850 bg-zinc-950/40 px-4 sm:px-8 py-3">
        <div className="max-w-5xl mx-auto flex items-center justify-between text-xs">
          <div className="flex items-center space-x-2 text-zinc-400">
            <Link href="/" className="hover:text-white transition-colors flex items-center gap-1">
              <ArrowLeft size={14} />
              <span>All Tools</span>
            </Link>
            <span className="text-zinc-600">/</span>
            <span className="text-zinc-200 font-medium">{tool.shortTitle}</span>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-zinc-900 border border-zinc-800 text-zinc-400">
              Accepts: <strong className="text-zinc-200">{tool.inputFormats.join(", ").toUpperCase()}</strong>
            </span>
          </div>
        </div>
      </div>

      <main className="flex-1 flex flex-col items-center justify-start px-4 sm:px-8 py-10 max-w-5xl mx-auto w-full">
        {/* Tool Header */}
        <div className="text-center mb-8 max-w-2xl">
          <div
            className={`w-14 h-14 mx-auto rounded-2xl ${tool.color.bg} ${tool.color.text} border ${tool.color.border} flex items-center justify-center mb-4 shadow-lg`}
          >
            <ToolIcon name={tool.icon} size={28} />
          </div>

          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white mb-2.5">
            {tool.title}
          </h1>
          <p className="text-sm text-zinc-400 leading-relaxed">
            {tool.description}
          </p>
        </div>

        {/* Hidden File Input */}
        <input
          ref={fileInputRef}
          type="file"
          accept={tool.acceptMimeTypes}
          className="hidden"
          onChange={handleFileChange}
        />

        {/* Validation Error Banner */}
        {validationError && (
          <div className="w-full max-w-2xl mb-6 p-4 rounded-2xl bg-red-950/60 border border-red-800/80 text-red-200 text-xs sm:text-sm flex items-start gap-3 shadow-lg shadow-red-950/20 animate-fade-in">
            <AlertCircle size={18} className="shrink-0 text-red-400 mt-0.5" />
            <div className="flex-1">
              <p className="font-semibold text-red-300 mb-0.5">Upload Error</p>
              <p className="text-zinc-300 leading-relaxed">{validationError}</p>
            </div>
            <button
              onClick={() => setValidationError(null)}
              className="text-zinc-400 hover:text-white text-xs font-semibold px-2 py-1 rounded-lg hover:bg-red-900/40 transition-colors"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Conversion Error Banner */}
        {conversionError && (
          <div className="w-full max-w-2xl mb-6 p-4 rounded-2xl bg-red-950/60 border border-red-800/80 text-red-200 text-xs sm:text-sm flex items-start gap-3 shadow-lg shadow-red-950/20 animate-fade-in">
            <AlertCircle size={18} className="shrink-0 text-red-400 mt-0.5" />
            <div className="flex-1">
              <p className="font-semibold text-red-300 mb-0.5">Conversion Error</p>
              <p className="text-zinc-300 leading-relaxed">{conversionError}</p>
            </div>
            <button
              onClick={() => setConversionError(null)}
              className="text-zinc-400 hover:text-white text-xs font-semibold px-2 py-1 rounded-lg hover:bg-red-900/40 transition-colors"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Loading Editor Overlay Banner */}
        {isLoadingEditor && (
          <div className="w-full max-w-xl mb-6 p-4 rounded-2xl bg-blue-950/60 border border-blue-800/80 text-blue-200 text-xs sm:text-sm flex items-center justify-center gap-3 shadow-lg animate-fade-in">
            <Loader2 size={18} className="animate-spin text-blue-400" />
            <span>Extracting document content and launching editor...</span>
          </div>
        )}

        {/* Dynamic Zone based on conversionStatus */}
        {conversionStatus === "idle" && (
          tool.slug === "edit-pdf" && !userEmail && hasReachedGuestLimit() ? (
            /* Mandatory Login Block Card when 3 free edits reached */
            <div className="w-full max-w-2xl p-10 sm:p-14 rounded-3xl border-2 border-red-500/40 bg-zinc-900/90 backdrop-blur-xl flex flex-col items-center text-center shadow-2xl animate-fade-in">
              <div className="w-16 h-16 rounded-2xl bg-red-500/15 text-red-400 border border-red-500/30 flex items-center justify-center mb-5 shadow-inner">
                <Lock size={32} />
              </div>
              <h3 className="text-2xl sm:text-3xl font-extrabold text-white mb-2 tracking-tight">
                Sign In Required to Edit
              </h3>
              <p className="text-sm text-zinc-300 max-w-md mb-6 leading-relaxed">
                You have reached your <strong>3 free guest edits</strong> limit. Please sign in or create a free account to continue editing PDFs with zero format loss.
              </p>
              <button
                type="button"
                onClick={() => {
                  setAuthReason("limit_reached");
                  setIsAuthOpen(true);
                }}
                className="px-7 py-3.5 rounded-xl bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white font-bold text-sm flex items-center gap-2.5 shadow-xl shadow-red-600/30 hover:scale-105 active:scale-95 transition-all cursor-pointer"
              >
                <LogIn size={18} />
                <span>Sign In / Create Free Account</span>
              </button>
            </div>
          ) : (
            /* Drag & Drop Upload Zone */
            <div className="w-full max-w-2xl flex flex-col items-center">
              {tool.slug === "edit-pdf" && !userEmail && (
                <div className="mb-3.5 inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-zinc-900/90 border border-zinc-800 text-xs text-zinc-400 shadow-sm">
                  <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                  <span>
                    Guest Access:{" "}
                    <strong className="text-emerald-400">
                      {Math.max(0, GUEST_EDIT_LIMIT - guestEdits)} of {GUEST_EDIT_LIMIT}
                    </strong>{" "}
                    free edits remaining
                  </span>
                </div>
              )}

              <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                onClick={handleUploadAreaClick}
                className={`w-full p-12 sm:p-16 rounded-3xl border-2 border-dashed transition-all duration-300 cursor-pointer flex flex-col items-center text-center group ${
                  isDragging
                    ? "border-red-500 bg-red-500/10 scale-[1.02] shadow-2xl shadow-red-500/20"
                    : "border-zinc-700 hover:border-red-500/80 bg-zinc-900/60 hover:bg-zinc-900/90 shadow-xl"
                }`}
              >
                <div className="w-20 h-20 rounded-3xl bg-gradient-to-tr from-red-600/20 to-rose-600/10 border border-red-500/30 text-red-400 flex items-center justify-center mb-6 group-hover:scale-110 group-hover:border-red-500 transition-all duration-300 shadow-inner">
                  <UploadCloud size={40} className="group-hover:-translate-y-1 transition-transform" />
                </div>

                <h3 className="text-xl sm:text-2xl font-bold text-white mb-2">
                  {isDragging ? "Drop your document here!" : "Select or Drop your Document"}
                </h3>

                <p className="text-xs sm:text-sm text-zinc-400 mb-6 max-w-sm leading-relaxed">
                  Drag & drop your <strong className="text-zinc-200">{tool.inputFormats.join(", ").toUpperCase()}</strong> file here, or click to browse from your device.
                </p>

                <button
                  type="button"
                  className="px-6 py-3 rounded-xl bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white font-bold text-sm flex items-center gap-2.5 shadow-lg shadow-red-600/25 group-hover:shadow-red-600/40 transition-all cursor-pointer"
                >
                  <FileUp size={18} />
                  <span>Choose {tool.shortTitle.split(" ")[0]} File</span>
                </button>

                <div className="mt-8 flex items-center gap-4 text-[11px] text-zinc-500 font-medium">
                  <span className="flex items-center gap-1">
                    <Shield size={13} className="text-zinc-400" />
                    256-Bit SSL Encrypted
                  </span>
                  <span>•</span>
                  <span className="flex items-center gap-1">
                    <Zap size={13} className="text-zinc-400" />
                    Max Size: 25 MB
                  </span>
                </div>
              </div>
            </div>
          )
        )}

        {(conversionStatus === "ready" || conversionStatus === "error") && selectedFile && (
          /* File Selected / Ready State */
          <div className="w-full max-w-2xl rounded-3xl bg-zinc-900 border border-zinc-800 p-8 sm:p-10 shadow-2xl animate-fade-in">
            <div className="flex items-center justify-between pb-6 border-b border-zinc-800 mb-6">
              <span className="text-xs font-bold uppercase tracking-wider text-zinc-400">
                Selected Document
              </span>
              <button
                onClick={handleReset}
                className="text-xs text-red-400 hover:text-red-300 flex items-center gap-1 transition-colors cursor-pointer"
              >
                <Trash2 size={14} />
                <span>Remove</span>
              </button>
            </div>

            {/* File Info Card */}
            <div className="p-5 rounded-2xl bg-zinc-950/70 border border-zinc-800 flex items-center gap-4 mb-8">
              <div
                className={`w-12 h-12 rounded-xl ${tool.color.bg} ${tool.color.text} border ${tool.color.border} flex items-center justify-center shrink-0`}
              >
                <ToolIcon name={tool.icon} size={24} />
              </div>

              <div className="flex-1 min-w-0">
                <h4 className="text-sm font-bold text-white truncate mb-0.5">
                  {selectedFile.name}
                </h4>
                <div className="flex items-center gap-2 text-xs text-zinc-400">
                  <span>{formatFileSize(selectedFile.size)}</span>
                  <span>•</span>
                  <span className="text-emerald-400 font-medium flex items-center gap-1">
                    <CheckCircle2 size={12} />
                    Valid {tool.inputFormats.join(", ").toUpperCase()}
                  </span>
                </div>
              </div>
            </div>

            {/* Action Buttons: Edit Online in Browser OR Convert */}
            <div className="flex flex-col gap-3">
              {/* Prominent Visual Edit Online Button */}
              <button
                type="button"
                onClick={() => setIsVisualEditorOpen(true)}
                className="w-full py-4 px-6 rounded-2xl bg-gradient-to-r from-red-600 via-rose-600 to-red-600 hover:from-red-500 hover:to-rose-500 text-white font-extrabold text-base flex items-center justify-center gap-2.5 shadow-xl shadow-red-600/30 hover:shadow-red-600/50 transition-all cursor-pointer"
              >
                <Edit3 size={18} />
                <span>Edit PDF Directly (Original Format Preserved)</span>
              </button>

              <div className="flex flex-col sm:flex-row items-center gap-3">
                <button
                  type="button"
                  onClick={handleStartConversion}
                  className="w-full py-3.5 px-6 rounded-2xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 hover:text-white font-bold text-sm border border-zinc-700 flex items-center justify-center gap-2 transition-all cursor-pointer"
                >
                  <Sparkles size={16} className="text-red-400" />
                  <span>Convert to {tool.outputFormatName}</span>
                </button>

                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full sm:w-auto py-3.5 px-5 rounded-2xl bg-zinc-800/60 hover:bg-zinc-700/60 text-zinc-400 hover:text-zinc-200 font-semibold text-xs border border-zinc-800 transition-colors whitespace-nowrap cursor-pointer"
                >
                  Change File
                </button>
              </div>
            </div>
          </div>
        )}

        {conversionStatus === "converting" && (
          /* Converting Loading State */
          <div className="w-full max-w-xl rounded-3xl bg-zinc-900 border border-zinc-800 p-12 text-center shadow-2xl flex flex-col items-center animate-fade-in">
            <div className="relative w-20 h-20 mb-6 flex items-center justify-center">
              <div className="absolute inset-0 rounded-full border-4 border-red-500/20 border-t-red-500 animate-spin" />
              <ToolIcon name={tool.icon} size={28} className={tool.color.text} />
            </div>

            <h3 className="text-xl font-bold text-white mb-2">
              Converting your document...
            </h3>
            <p className="text-xs text-zinc-400 mb-6 max-w-sm">
              Processing &quot;{selectedFile?.name}&quot; to {tool.outputFormatName}.
            </p>

            <div className="w-full max-w-xs bg-zinc-800 rounded-full h-2 overflow-hidden mb-3">
              <div className="bg-gradient-to-r from-red-500 to-rose-400 h-full rounded-full animate-pulse w-3/4" />
            </div>
          </div>
        )}

        {conversionStatus === "success" && convertedResult?.blob && (
          /* Converted / Ready State: Offers both Download and Edit Online */
          <div className="w-full max-w-xl rounded-3xl bg-zinc-900 border border-zinc-800 p-10 text-center shadow-2xl flex flex-col items-center animate-fade-in">
            <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center justify-center mb-5 shadow-lg shadow-emerald-500/10">
              <CheckCircle2 size={36} />
            </div>

            <span className="px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-xs font-bold mb-3">
              Conversion Complete!
            </span>

            <h3 className="text-2xl font-extrabold text-white mb-1">
              Your {tool.outputFormatName} is Ready
            </h3>
            <p className="text-xs text-zinc-400 mb-6 truncate max-w-md">
              {convertedResult.name} ({formatFileSize(convertedResult.size || 0)})
            </p>

            {/* Primary Actions */}
            <div className="w-full flex flex-col gap-3">
              {/* Option 1: Edit Online with 100% Original Format Preserved */}
              <button
                type="button"
                onClick={() => setIsVisualEditorOpen(true)}
                className="w-full py-4 px-6 rounded-2xl bg-gradient-to-r from-red-600 via-rose-600 to-red-600 hover:from-red-500 hover:to-rose-500 text-white font-extrabold text-base flex items-center justify-center gap-2.5 shadow-xl shadow-red-600/30 hover:shadow-red-600/50 transition-all cursor-pointer"
              >
                <Edit3 size={18} />
                <span>Edit PDF Directly (Original Format Preserved)</span>
              </button>

              {/* Option 2: Download */}
              <button
                type="button"
                onClick={() => {
                  if (convertedResult.blob && convertedResult.name) {
                    triggerDownload(convertedResult.blob, convertedResult.name);
                  }
                }}
                className="w-full py-3.5 px-6 rounded-2xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 hover:text-white font-bold text-sm border border-zinc-700 flex items-center justify-center gap-2 transition-all cursor-pointer"
              >
                <Download size={18} />
                <span>Download {tool.outputFormatName}</span>
              </button>

              <button
                type="button"
                onClick={handleReset}
                className="w-full py-2.5 px-4 rounded-xl text-zinc-400 hover:text-zinc-200 text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 cursor-pointer mt-1"
              >
                <RefreshCw size={13} />
                <span>Convert Another File</span>
              </button>
            </div>
          </div>
        )}

        {/* Step-by-Step Instructions */}
        <section className="w-full mt-16 pt-12 border-t border-zinc-850">
          <h3 className="text-lg font-bold text-white text-center mb-8">
            How to use {tool.shortTitle} in 3 simple steps
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="p-6 rounded-2xl bg-zinc-900/50 border border-zinc-800/80 flex flex-col items-center text-center">
              <div className="w-10 h-10 rounded-xl bg-red-500/10 text-red-400 font-extrabold text-sm flex items-center justify-center mb-3 border border-red-500/20">
                1
              </div>
              <h4 className="text-sm font-bold text-zinc-100 mb-1.5">Upload PDF</h4>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Drag and drop your PDF file directly into the dropzone above.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-zinc-900/50 border border-zinc-800/80 flex flex-col items-center text-center">
              <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-400 font-extrabold text-sm flex items-center justify-center mb-3 border border-blue-500/20">
                2
              </div>
              <h4 className="text-sm font-bold text-zinc-100 mb-1.5">Edit Online</h4>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Click &quot;Edit Online&quot; to modify text, numbers, images, and formatting right in your browser.
              </p>
            </div>

            <div className="p-6 rounded-2xl bg-zinc-900/50 border border-zinc-800/80 flex flex-col items-center text-center">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-400 font-extrabold text-sm flex items-center justify-center mb-3 border border-emerald-500/20">
                3
              </div>
              <h4 className="text-sm font-bold text-zinc-100 mb-1.5">Compile & Save</h4>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Compile back to PDF or download as DOCX with zero formatting errors.
              </p>
            </div>
          </div>
        </section>
      </main>

      <footer className="w-full border-t border-zinc-850 py-6 text-center text-xs text-zinc-500 mt-12">
        <p>© 2026 iLovePDF DocuConvert. Built with Next.js, Tailwind CSS, and Supabase.</p>
      </footer>

      {/* Auth Modal */}
      <AuthModal
        isOpen={isAuthOpen}
        onClose={() => {
          setIsAuthOpen(false);
          setAuthReason("general");
        }}
        reason={authReason}
        onSuccess={(email) => {
          setUserEmail(email);
          setAuthReason("general");
        }}
      />
    </div>
  );
}
