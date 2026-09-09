import { parse } from "csv-parse/sync";

export function parseCsv(buffer: Buffer | string): Record<string, string>[] {
  const text = typeof buffer === "string" ? buffer : buffer.toString("utf8");
  if (!text.trim()) return [];

  return parse(text, {
    columns: true,
    skip_empty_lines: true,
    relax_column_count: true,
    trim: true,
    bom: true,
  }) as Record<string, string>[];
}

export function getField(
  row: Record<string, string>,
  ...keys: string[]
): string | null {
  for (const key of keys) {
    if (row[key] != null && String(row[key]).trim() !== "") {
      return String(row[key]).trim();
    }
    // case-insensitive fallback
    const found = Object.keys(row).find(
      (k) => k.toLowerCase() === key.toLowerCase(),
    );
    if (found && row[found] != null && String(row[found]).trim() !== "") {
      return String(row[found]).trim();
    }
  }
  return null;
}
