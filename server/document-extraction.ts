import mammoth from "mammoth";

const MAX_RAW_BYTES = 3 * 1024 * 1024;
const MAX_EXTRACTED_CHARS = 30_000;

export class DocumentExtractionError extends Error {
  constructor(message: string, readonly status = 400) {
    super(message);
  }
}

function dataUrlToBuffer(dataUrl: string) {
  const match = /^data:([^;,]+)?;base64,([A-Za-z0-9+/=\s]+)$/i.exec(dataUrl);
  if (!match) throw new DocumentExtractionError("Upload could not be read. Choose a supported document and try again.");
  const buffer = Buffer.from(match[2].replace(/\s/g, ""), "base64");
  if (!buffer.length || buffer.length > MAX_RAW_BYTES) {
    throw new DocumentExtractionError("Documents must be between 1 byte and 3 MB.", 413);
  }
  return { buffer, mimeType: match[1]?.toLowerCase() ?? "" };
}

function clean(text: string) {
  const normalized = text.replace(/\u0000/g, "").replace(/\r\n/g, "\n").trim();
  if (normalized.length < 20) throw new DocumentExtractionError("We could not find enough readable text in that document. Try a DOCX or text-based file.");
  return normalized.length > MAX_EXTRACTED_CHARS ? `${normalized.slice(0, MAX_EXTRACTED_CHARS - 1)}…` : normalized;
}

export async function extractDocumentText(input: { fileName: string; dataUrl: string }) {
  const ext = input.fileName.split(".").pop()?.toLowerCase() ?? "";
  const { buffer, mimeType } = dataUrlToBuffer(input.dataUrl);

  try {
    if (ext === "docx" || mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document") {
      const parsed = await mammoth.extractRawText({ buffer });
      return clean(parsed.value);
    }
    if (["txt", "md", "csv", "json", "rtf"].includes(ext) || mimeType.startsWith("text/")) {
      return clean(buffer.toString("utf8"));
    }
  } catch (error) {
    if (error instanceof DocumentExtractionError) throw error;
    throw new DocumentExtractionError("We could not read that document. Use a DOCX, TXT, MD, CSV, JSON, or RTF file.");
  }

  throw new DocumentExtractionError("Unsupported document type. Use DOCX, TXT, MD, CSV, JSON, or RTF.");
}
