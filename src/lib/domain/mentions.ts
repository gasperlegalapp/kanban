// @mentions in comments. A person can be mentioned by first name (when no one
// else shares it), by full name, or by full name without spaces.

export type Mentionable = { id: string; fullName: string; isActive?: boolean };

function firstName(fullName: string): string {
  return fullName.trim().split(/\s+/)[0] ?? fullName;
}

/** The token inserted when someone picks a person from the @ list. */
export function mentionToken(person: Mentionable, everyone: Mentionable[]): string {
  const first = firstName(person.fullName);
  const clash = everyone.some((p) => p.id !== person.id && firstName(p.fullName).toLowerCase() === first.toLowerCase());
  return clash ? person.fullName.replace(/\s+/g, "") : first;
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Ids of the people mentioned in a piece of text. */
export function findMentions(text: string, people: Mentionable[]): string[] {
  const active = people.filter((p) => p.isActive !== false);
  const found = new Set<string>();
  for (const p of active) {
    const candidates = [p.fullName, p.fullName.replace(/\s+/g, "")];
    const first = firstName(p.fullName);
    const firstIsUnique = !active.some((o) => o.id !== p.id && firstName(o.fullName).toLowerCase() === first.toLowerCase());
    if (firstIsUnique) candidates.push(first);
    for (const c of candidates) {
      if (new RegExp(`(^|[^\\w@])@${escapeRegex(c)}(?![\\w])`, "i").test(text)) {
        found.add(p.id);
        break;
      }
    }
  }
  return [...found];
}

/** Text before the caret ends in "@partial" — returns the partial, else null. */
export function activeMentionQuery(textBeforeCaret: string): string | null {
  const m = textBeforeCaret.match(/(^|[^\w@])@(\w*)$/);
  return m ? m[2] : null;
}
