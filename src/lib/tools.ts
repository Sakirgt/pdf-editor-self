import { ToolConfig } from "@/types";

export const TOOLS: ToolConfig[] = [
  {
    id: "edit-pdf",
    slug: "edit-pdf",
    title: "Edit PDF Online",
    shortTitle: "Edit PDF Online",
    description: "Upload any PDF and edit text, formatting, and images directly in your browser. Then compile back to PDF with zero formatting loss.",
    category: "from-pdf",
    inputFormats: [".pdf"],
    outputFormat: ".pdf",
    outputFormatName: "PDF",
    acceptMimeTypes: "application/pdf,.pdf",
    icon: "FileEdit",
    color: {
      bg: "bg-red-500/10",
      text: "text-red-500",
      border: "border-red-500/20",
      gradient: "from-red-600 to-rose-600",
      button: "bg-red-600 hover:bg-red-500",
    },
    badge: "Direct In-Browser Editor",
    popular: true,
  },
  {
    id: "pdf-to-word",
    slug: "pdf-to-word",
    title: "PDF to Word Converter",
    shortTitle: "PDF to Word",
    description: "Convert your PDF files to editable Microsoft Word documents with maximum accuracy.",
    category: "from-pdf",
    inputFormats: [".pdf"],
    outputFormat: ".docx",
    outputFormatName: "DOCX",
    acceptMimeTypes: "application/pdf,.pdf",
    icon: "FileText",
    color: {
      bg: "bg-blue-500/10",
      text: "text-blue-500",
      border: "border-blue-500/20",
      gradient: "from-blue-600 to-indigo-600",
      button: "bg-blue-600 hover:bg-blue-500",
    },
    badge: "Most Popular",
    popular: true,
  },
  {
    id: "word-to-pdf",
    slug: "word-to-pdf",
    title: "Word to PDF Converter",
    shortTitle: "Word to PDF",
    description: "Convert Microsoft Word documents (DOC, DOCX) to professional, shareable PDF format.",
    category: "to-pdf",
    inputFormats: [".doc", ".docx"],
    outputFormat: ".pdf",
    outputFormatName: "PDF",
    acceptMimeTypes: ".doc,.docx,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    icon: "FileCode",
    color: {
      bg: "bg-indigo-500/10",
      text: "text-indigo-400",
      border: "border-indigo-500/20",
      gradient: "from-indigo-600 to-violet-600",
      button: "bg-indigo-600 hover:bg-indigo-500",
    },
    badge: "Popular",
    popular: true,
  },
  {
    id: "pdf-to-excel",
    slug: "pdf-to-excel",
    title: "PDF to Excel Converter",
    shortTitle: "PDF to Excel",
    description: "Extract data and tables directly from your PDF into editable Microsoft Excel (XLSX) spreadsheets.",
    category: "from-pdf",
    inputFormats: [".pdf"],
    outputFormat: ".xlsx",
    outputFormatName: "Excel",
    acceptMimeTypes: "application/pdf,.pdf",
    icon: "FileSpreadsheet",
    color: {
      bg: "bg-emerald-500/10",
      text: "text-emerald-400",
      border: "border-emerald-500/20",
      gradient: "from-emerald-600 to-teal-600",
      button: "bg-emerald-600 hover:bg-emerald-500",
    },
    badge: "Essential",
    popular: true,
  },
  {
    id: "pdf-to-powerpoint",
    slug: "pdf-to-powerpoint",
    title: "PDF to PowerPoint",
    shortTitle: "PDF to PPT",
    description: "Transform your PDF presentations into editable Microsoft PowerPoint (PPTX) slideshows.",
    category: "from-pdf",
    inputFormats: [".pdf"],
    outputFormat: ".pptx",
    outputFormatName: "PowerPoint",
    acceptMimeTypes: "application/pdf,.pdf",
    icon: "Presentation",
    color: {
      bg: "bg-amber-500/10",
      text: "text-amber-400",
      border: "border-amber-500/20",
      gradient: "from-amber-600 to-orange-600",
      button: "bg-amber-600 hover:bg-amber-500",
    },
  },
  {
    id: "excel-to-pdf",
    slug: "excel-to-pdf",
    title: "Excel to PDF Converter",
    shortTitle: "Excel to PDF",
    description: "Make spreadsheets easy to read and distribute by converting XLS and XLSX to PDF.",
    category: "to-pdf",
    inputFormats: [".xls", ".xlsx"],
    outputFormat: ".pdf",
    outputFormatName: "PDF",
    acceptMimeTypes: ".xls,.xlsx,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    icon: "Table",
    color: {
      bg: "bg-teal-500/10",
      text: "text-teal-400",
      border: "border-teal-500/20",
      gradient: "from-teal-600 to-cyan-600",
      button: "bg-teal-600 hover:bg-teal-500",
    },
  },
  {
    id: "image-to-pdf",
    slug: "image-to-pdf",
    title: "JPG / PNG to PDF",
    shortTitle: "Image to PDF",
    description: "Convert JPG, PNG, and WebP images to high quality PDF documents in seconds.",
    category: "to-pdf",
    inputFormats: [".jpg", ".jpeg", ".png", ".webp"],
    outputFormat: ".pdf",
    outputFormatName: "PDF",
    acceptMimeTypes: "image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp",
    icon: "Image",
    color: {
      bg: "bg-rose-500/10",
      text: "text-rose-400",
      border: "border-rose-500/20",
      gradient: "from-rose-600 to-pink-600",
      button: "bg-rose-600 hover:bg-rose-500",
    },
  },
];

export function getToolBySlug(slug: string): ToolConfig | undefined {
  return TOOLS.find((t) => t.slug === slug);
}

export function getAllToolSlugs(): string[] {
  return TOOLS.map((t) => t.slug);
}

export function validateFileForTool(file: File, tool: ToolConfig): { valid: boolean; error?: string } {
  const fileName = file.name.toLowerCase();
  const fileExt = fileName.substring(fileName.lastIndexOf("."));

  const matchesExt = tool.inputFormats.some((fmt) => fmt.toLowerCase() === fileExt);

  if (!matchesExt) {
    return {
      valid: false,
      error: `Invalid file format. "${tool.shortTitle}" only accepts ${tool.inputFormats.join(", ").toUpperCase()} files. You uploaded a "${fileExt || "unknown"}" file.`,
    };
  }

  // File size limit: 25MB
  const maxSizeBytes = 25 * 1024 * 1024;
  if (file.size > maxSizeBytes) {
    return {
      valid: false,
      error: `File is too large (${(file.size / (1024 * 1024)).toFixed(1)} MB). Maximum allowed size is 25 MB.`,
    };
  }

  return { valid: true };
}
