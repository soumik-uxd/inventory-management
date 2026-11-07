// CSV export utility

// Spreadsheet apps execute cells starting with these characters as formulas
const FORMULA_PREFIXES = ["=", "+", "-", "@", "\t", "\r"];

function escapeCell(value) {
  if (value === null || value === undefined) return "";
  // Real numbers bypass the formula guard: prefixing "-5" with ' would turn it into text.
  // NaN/Infinity (e.g. from a missing field) become empty cells rather than literal words
  if (typeof value === "number") {
    return Number.isFinite(value) ? String(value) : "";
  }

  let text = String(value);
  if (FORMULA_PREFIXES.some((prefix) => text.startsWith(prefix))) {
    text = `'${text}`;
  }
  // RFC 4180: quote cells containing delimiters, quotes or newlines, doubling inner quotes
  if (/[",\r\n]/.test(text)) {
    text = `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

// columns: [{ header, value: (row) => any }]
export function toCsv(rows, columns) {
  const lines = [columns.map((col) => escapeCell(col.header)).join(",")];
  for (const row of rows) {
    lines.push(columns.map((col) => escapeCell(col.value(row))).join(","));
  }
  return lines.join("\r\n");
}

export function downloadCsv(filename, csv) {
  // BOM so Excel opens UTF-8 (e.g. Japanese labels) correctly instead of guessing a legacy codepage
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  // Revoke on a later tick: some browsers (notably WebKit) resolve the blob URL
  // asynchronously after click(), and an immediate revoke cancels the download
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
