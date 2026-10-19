/**
 * Escapes a CSV field for import by common spreadsheet applications.
 * Prefix formulas with an apostrophe so untrusted business names cannot be
 * evaluated as executable spreadsheet expressions (CWE-1236).
 */
export function csvCell(value: string): string {
  const plainText = /^[\s\u0000-\u001f]*[=+@-]/.test(value) ? "'" + value : value;
  return /[",\r\n]/.test(plainText)
    ? '"' + plainText.replace(/"/g, '""') + '"'
    : plainText;
}
