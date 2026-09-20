import { NextRequest, NextResponse } from "next/server";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

export const runtime = "nodejs";

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
    .replace(/[^\x00-\xFF]/g, "");
}

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
    const { title = "Compiled_Document", html = "" } = await req.json();

    // Strip HTML tags to extract clean text blocks with headings
    const rawBlocks = html
      .replace(/<\/h[1-6]>/gi, "\n\n")
      .replace(/<\/p>/gi, "\n\n")
      .replace(/<br\s*[\/]?>/gi, "\n")
      .replace(/<hr\s*[\/]?>/gi, "\n---PAGE---\n")
      .replace(/<[^>]+>/g, "");

    const pdfDoc = await PDFDocument.create();
    const PAGE_WIDTH = 595.28;
    const PAGE_HEIGHT = 841.89;
    const MARGIN_X = 54;
    const MARGIN_TOP = 64;
    const MARGIN_BOTTOM = 54;

    const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    let currentPage = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
    let currentY = PAGE_HEIGHT - MARGIN_TOP;

    // Header Title
    const cleanTitle = sanitizeForPdf(title);
    currentPage.drawText(cleanTitle, {
      x: MARGIN_X,
      y: currentY,
      size: 18,
      font: boldFont,
      color: rgb(0.1, 0.1, 0.1),
    });
    currentY -= 28;

    currentPage.drawLine({
      start: { x: MARGIN_X, y: currentY },
      end: { x: PAGE_WIDTH - MARGIN_X, y: currentY },
      thickness: 0.75,
      color: rgb(0.8, 0.8, 0.8),
    });
    currentY -= 28;

    const paragraphs = rawBlocks.split(/\n\s*\n/);

    for (const para of paragraphs) {
      const trimmed = para.trim();
      if (!trimmed) continue;

      if (trimmed === "---PAGE---") {
        currentPage = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
        currentY = PAGE_HEIGHT - MARGIN_TOP;
        continue;
      }

      const isHeading = trimmed.length < 50 && (trimmed === trimmed.toUpperCase() || !trimmed.endsWith("."));
      const fontSize = isHeading ? 13 : 10.5;
      const paraFont = isHeading ? boldFont : font;
      const lineHeight = fontSize * 1.45;

      const sanitizedPara = sanitizeForPdf(trimmed);
      const wrappedLines = wrapText(sanitizedPara, isHeading ? 65 : 82);

      for (const line of wrappedLines) {
        if (currentY <= MARGIN_BOTTOM + 20) {
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

      currentY -= 12;
    }

    const pdfBytes = await pdfDoc.save();
    const outputFileName = `${title.replace(/\.pdf$/i, "")}_edited.pdf`;

    return new NextResponse(new Uint8Array(pdfBytes), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${encodeURIComponent(outputFileName)}"`,
        "X-Filename": outputFileName,
      },
    });
  } catch (error: unknown) {
    console.error("Compile to PDF error:", error);
    const message = error instanceof Error ? error.message : "Compilation failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
