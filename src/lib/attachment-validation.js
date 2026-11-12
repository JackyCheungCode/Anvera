/**
 * Detect an allowed attachment format from its declared MIME type and file signature.
 * @param {string} mime
 * @param {Uint8Array} bytes
 * @returns {"pdf" | "jpg" | "png" | "webp" | null}
 */
export function detectAttachmentExtension(mime, bytes) {
  if (mime === "application/pdf" && new TextDecoder().decode(bytes.slice(0, 5)) === "%PDF-") return "pdf";
  if (mime === "image/jpeg" && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "jpg";
  if (mime === "image/png" && bytes.length >= 8 && [137, 80, 78, 71, 13, 10, 26, 10].every((value, index) => bytes[index] === value)) return "png";
  if (mime === "image/webp" && new TextDecoder().decode(bytes.slice(0, 4)) === "RIFF" && new TextDecoder().decode(bytes.slice(8, 12)) === "WEBP") return "webp";
  return null;
}
