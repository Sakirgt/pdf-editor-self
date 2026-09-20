import { NextRequest, NextResponse } from "next/server";
import { Document, Packer, Paragraph, TextRun, HeadingLevel, PageBreak } from "docx";
import { extractText } from "unpdf";
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

    // 3. Built-in Conversion Engine: PDF to Word (PDF -> DOCX)
    let pageTexts: string[] = [];
    let totalPages = 1;

    try {
      const uint8 = new Uint8Array(await file.arrayBuffer());
      const extracted = await extractText(uint8, { mergePages: false });
      totalPages = extracted.totalPages || 1;
      const rawText = extracted.text as unknown;
      if (Array.isArray(rawText)) {
        pageTexts = rawText.map((t) => String(t || ""));
      } else if (typeof rawText === "string" && rawText.trim()) {
        pageTexts = [rawText];
      }
    } catch (parseErr) {
      console.warn("PDF text parsing warning:", parseErr);
    }

    const hasExtractedText = pageTexts.some((p) => p && p.trim().length > 0);
    const docChildren: Paragraph[] = [];

    if (hasExtractedText) {
      pageTexts.forEach((pageContent, pageIndex) => {
        if (pageIndex > 0) {
          docChildren.push(new Paragraph({ children: [new PageBreak()] }));
        }

        const rawLines = pageContent.split(/\r?\n/);
        let currentParagraphLines: string[] = [];

        const flushParagraph = () => {
          if (currentParagraphLines.length > 0) {
            const blockText = currentParagraphLines.join(" ").trim();
            if (blockText) {
              const isShort = blockText.length < 60;
              const isUppercase = blockText === blockText.toUpperCase() && /[A-Z]/.test(blockText);
              const isTitleLike = pageIndex === 0 && docChildren.length === 0 && blockText.length < 80;

              if (isTitleLike) {
                docChildren.push(
                  new Paragraph({
                    text: blockText,
                    heading: HeadingLevel.TITLE,
                    spacing: { after: 200 },
                  })
                );
              } else if (isShort && isUppercase) {
                docChildren.push(
                  new Paragraph({
                    text: blockText,
                    heading: HeadingLevel.HEADING_2,
                    spacing: { before: 240, after: 120 },
                  })
                );
              } else {
                docChildren.push(
                  new Paragraph({
                    children: [
                      new TextRun({
                        text: blockText,
                        size: 24, // 12pt standard readable font
                      }),
                    ],
                    spacing: { after: 140, line: 276 },
                  })
                );
              }
            }
            currentParagraphLines = [];
          }
        };

        for (const rawLine of rawLines) {
          const line = rawLine.trim();
          if (!line) {
            flushParagraph();
          } else {
            currentParagraphLines.push(line);
            if (line.endsWith(".") || line.endsWith(":") || line.endsWith("!") || line.endsWith("?")) {
              flushParagraph();
            }
          }
        }
        flushParagraph();
      });
    } else {
      docChildren.push(
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
          spacing: { after: 120 },
        }),
        new Paragraph({
          children: [
            new TextRun({
              text: `Pages Detected: ${totalPages}`,
            }),
          ],
          spacing: { after: 200 },
        })
      );
    }

    const doc = new Document({
      sections: [
        {
          properties: {},
          children: docChildren,
        },
      ],
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
