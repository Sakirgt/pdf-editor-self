export type ToolCategory = "from-pdf" | "to-pdf" | "all";

export type ConversionStatus = "idle" | "ready" | "converting" | "success" | "error";

export interface ToolConfig {
  id: string;
  slug: string;
  title: string;
  shortTitle: string;
  description: string;
  category: "from-pdf" | "to-pdf";
  inputFormats: string[]; // e.g. [".pdf"] or [".doc", ".docx"]
  outputFormat: string; // e.g. ".docx"
  outputFormatName: string; // e.g. "Word"
  acceptMimeTypes: string; // e.g. "application/pdf"
  icon: string; // Lucide icon identifier
  color: {
    bg: string;
    text: string;
    border: string;
    gradient: string;
    button: string;
  };
  badge?: string;
  popular?: boolean;
}

export interface ConversionResult {
  downloadUrl?: string;
  fileName?: string;
  fileSize?: number;
  error?: string;
}

export interface UserProfile {
  id: string;
  email: string | null;
}
