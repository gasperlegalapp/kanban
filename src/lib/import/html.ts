const NAMED_ENTITIES: Record<string, string> = {
  nbsp: " ",
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  ldquo: "“",
  rdquo: "”",
  lsquo: "‘",
  rsquo: "’",
  ndash: "–",
  mdash: "—",
  hellip: "…",
};

export function decodeEntities(s: string): string {
  return s
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(parseInt(dec, 10)))
    .replace(/&([a-z]+);/gi, (m, name: string) => NAMED_ENTITIES[name.toLowerCase()] ?? m);
}

/**
 * Converts the rich-text HTML Businessmap stores in card descriptions into
 * readable plain text. Paragraphs and list items become lines; table cells are
 * tab separated so waiver-tracking tables stay legible.
 */
export function htmlToText(html: string | null | undefined): string {
  if (!html) return "";
  let s = html;
  s = s.replace(/<\s*br\s*\/?>/gi, "\n");
  s = s.replace(/<\/(td|th)>/gi, "\t");
  s = s.replace(/<\/(p|div|li|tr|h[1-6]|figure|table|thead|tbody|blockquote)>/gi, "\n");
  s = s.replace(/<li[^>]*>/gi, "- ");
  s = s.replace(/<[^>]+>/g, "");
  s = decodeEntities(s);
  s = s.replace(/ /g, " ");
  s = s
    .split("\n")
    .map((line) => line.replace(/[ \t]+$/g, "").replace(/^[ ]+/g, "").replace(/ {2,}/g, " "))
    .join("\n");
  s = s.replace(/\n{3,}/g, "\n\n");
  return s.trim();
}
