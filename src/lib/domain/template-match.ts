function normalize(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

/**
 * True when the case already has a task for this template title. Matching is
 * loose on purpose: imported tasks often carry a suffix such as
 * "Estate Checking Account - Adkins" or a prefix such as "Kirsch - Assets / Inventory".
 */
export function alreadyHasTask(existingTitles: string[], templateTitle: string): boolean {
  const t = normalize(templateTitle);
  if (!t) return false;
  // One-word titles ("Bond", "Inventory") only count as present on an exact match.
  if (!t.includes(" ")) return existingTitles.some((e) => normalize(e) === t);
  const pattern = new RegExp(`(^| )${t}( |$)`);
  return existingTitles.some((e) => {
    const n = normalize(e);
    return n === t || pattern.test(n);
  });
}
