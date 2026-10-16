const FORMULA_PREFIX = /^[\s\uFEFF]*[=+\-@]/;

export function csvCell(value: string | number) {
  const text = String(value);
  const safeText = FORMULA_PREFIX.test(text) ? `'${text}` : text;
  return `"${safeText.replaceAll('"', '""')}"`;
}
