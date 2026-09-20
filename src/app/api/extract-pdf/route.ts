import { NextRequest, NextResponse } from "next/server";
import { extractText } from "unpdf";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const fileBuffer = Buffer.from(await file.arrayBuffer());
    const uint8 = new Uint8Array(fileBuffer);

    let pageTexts: string[] = [];
    try {
      const extracted = await extractText(uint8, { mergePages: false });
      const rawText = extracted.text as unknown;
      if (Array.isArray(rawText)) {
        pageTexts = rawText.map((t) => String(t || ""));
      } else if (typeof rawText === "string" && rawText.trim()) {
        pageTexts = [rawText];
      }
    } catch (err) {
      console.warn("PDF extraction warning in /api/extract-pdf:", err);
    }

    // Convert extracted text into clean, structured HTML for TipTap
    let htmlContent = "";
    const baseTitle = file.name.substring(0, file.name.lastIndexOf(".")) || "Document";

    if (pageTexts.some((p) => p && p.trim().length > 0)) {
      pageTexts.forEach((pageContent, pageIndex) => {
        if (pageIndex > 0) {
          htmlContent += "<hr />";
        }

        const lines = pageContent.split(/\r?\n/);
        let currentBlock: string[] = [];

        const flushBlock = () => {
          if (currentBlock.length > 0) {
            const blockText = currentBlock.join(" ").trim();
            if (blockText) {
              const isTitle = pageIndex === 0 && htmlContent === "" && blockText.length < 70;
              const isHeading = blockText.length < 50 && (blockText === blockText.toUpperCase() && /[A-Za-z]/.test(blockText));

              if (isTitle) {
                htmlContent += `<h1>${escapeHtml(blockText)}</h1>`;
              } else if (isHeading) {
                htmlContent += `<h2>${escapeHtml(blockText)}</h2>`;
              } else {
                htmlContent += `<p>${escapeHtml(blockText)}</p>`;
              }
            }
            currentBlock = [];
          }
        };

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) {
            flushBlock();
          } else {
            currentBlock.push(trimmed);
            if (trimmed.endsWith(".") || trimmed.endsWith(":") || trimmed.endsWith("!")) {
              flushBlock();
            }
          }
        }
        flushBlock();
      });
    } else {
      // Default clean template if empty or scanned
      htmlContent = `
        <h1>${escapeHtml(baseTitle)}</h1>
        <p>Start typing or pasting content to edit your document online.</p>
      `;
    }

    return NextResponse.json({
      title: baseTitle,
      html: htmlContent,
    });
  } catch (error: unknown) {
    console.error("Error in /api/extract-pdf:", error);
    const message = error instanceof Error ? error.message : "Failed to extract PDF";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
