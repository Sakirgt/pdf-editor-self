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
