import { unzipSync } from "fflate";

/** ZIP local-file magic: PK\x03\x04 (also empty/span variants). */
export function isZipBuffer(buf: Buffer): boolean {
  return (
    buf.length >= 4 &&
    buf[0] === 0x50 &&
    buf[1] === 0x4b &&
    (buf[2] === 0x03 || buf[2] === 0x05 || buf[2] === 0x07)
  );
}

/**
 * Freshchat Extract often returns a ZIP that contains one or more CSVs
 * even when `format: "csv"` was requested. Unwrap to CSV bytes.
 */
export function unwrapExtractCsv(buf: Buffer): Buffer {
  if (!isZipBuffer(buf)) return buf;

  const files = unzipSync(new Uint8Array(buf));
  const csvChunks: Uint8Array[] = [];

  for (const [name, data] of Object.entries(files)) {
    if (!data || name.endsWith("/") || name.includes("__MACOSX")) continue;
    const lower = name.toLowerCase();
    if (lower.endsWith(".csv") || lower.endsWith(".txt")) {
      csvChunks.push(data);
    }
  }

  // Fallback: single non-directory entry with no extension
  if (!csvChunks.length) {
    const entries = Object.entries(files).filter(
      ([name, data]) => data && !name.endsWith("/") && !name.includes("__MACOSX"),
    );
    if (entries.length === 1) csvChunks.push(entries[0][1]);
  }

  if (!csvChunks.length) {
    throw new Error("Extract ZIP contained no CSV files");
  }

  if (csvChunks.length === 1) return Buffer.from(csvChunks[0]);

  // Multiple CSVs: keep header from the first file, strip headers from the rest
  const texts = csvChunks.map((c) => Buffer.from(c).toString("utf8"));
  const merged: string[] = [];
  for (let i = 0; i < texts.length; i++) {
    const lines = texts[i].replace(/^\uFEFF/, "").split(/\r?\n/);
    if (i === 0) merged.push(...lines);
    else merged.push(...lines.slice(1));
  }
  return Buffer.from(merged.join("\n"), "utf8");
}
