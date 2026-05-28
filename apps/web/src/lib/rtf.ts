// Lightweight RTF-to-plain-text fallback.
//
// The legacy Windows app stored chief complaint / notes as RTF documents
// (e.g. `{\rtf1\deff0{\fonttbl{\f0 Times New Roman;}}…`). Until we adopt a
// proper RTF renderer, this helper strips the control words so the text is
// at least readable.
//
// It is intentionally simple — handles \par, \tab, \line, \u<n>?, hex escapes
// `\\'XX`, and discards groups/control words. Not a full RTF parser.

export function isRtf(s: string | null | undefined): boolean {
  if (!s) return false;
  // Match both {\rtf1 (standard) and {\\rtf1 (double-backslash, stored by legacy WPF app).
  return /^\s*\{\\{1,2}rtf\d/i.test(s);
}

export function rtfToPlain(s: string): string {
  let text = s;

  // Normalise double-backslash RTF stored by the legacy Windows app.
  // WPF RichTextBox serialised every backslash as \\ when persisting to the DB.
  if (/^\s*\{\\\\rtf/i.test(text)) {
    text = text.replace(/\\\\/g, "\\");
  }

  // 1. Strip font/color tables and stylesheets fully (they're noisy braces).
  text = text.replace(/\{\\(fonttbl|colortbl|stylesheet|info|listtable|listoverridetable|generator|pict|object|xmlnstbl|themedata)[^}]*\}/gi, "");

  // 2. Convert common paragraph / line breaks.
  text = text.replace(/\\par\b/g, "\n");
  text = text.replace(/\\line\b/g, "\n");
  text = text.replace(/\\tab\b/g, "\t");

  // 3. Unicode escapes: \uNNNN?  (optional ? is a literal placeholder).
  text = text.replace(/\\u(-?\d+)\??/g, (_, n) => {
    const code = parseInt(n, 10);
    if (Number.isNaN(code)) return "";
    return String.fromCharCode(code < 0 ? code + 65536 : code);
  });

  // 4. Hex escapes: \'XX
  text = text.replace(/\\'([0-9a-fA-F]{2})/g, (_, hex) => {
    try {
      return decodeURIComponent("%" + hex);
    } catch {
      return "";
    }
  });

  // 5. Strip remaining control words like \fs20 \cf1 \b \i …
  text = text.replace(/\\[A-Za-z]+-?\d*\s?/g, "");

  // 6. Strip stray braces and backslashes.
  text = text.replace(/[{}]/g, "");
  text = text.replace(/\\\*/g, "");

  // 7. Normalize whitespace.
  text = text.replace(/\r\n?/g, "\n").replace(/\n{3,}/g, "\n\n").trim();

  return text;
}

export function toDisplayText(s: string | null | undefined): string {
  if (!s) return "";
  return isRtf(s) ? rtfToPlain(s) : s;
}
