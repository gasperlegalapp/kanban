import { describe, expect, it } from "vitest";
import { activeMentionQuery, findMentions, mentionToken } from "./mentions";

const people = [
  { id: "chris", fullName: "Christopher Gasper" },
  { id: "christine", fullName: "Christine" },
  { id: "grace", fullName: "Grace" },
  { id: "laura", fullName: "Laura Smith" },
  { id: "laura2", fullName: "Laura Jones" },
  { id: "gone", fullName: "Tina", isActive: false },
];

describe("mentions", () => {
  it("finds first names, full names and squashed names", () => {
    expect(findMentions("@Grace please review", people)).toEqual(["grace"]);
    expect(findMentions("cc @christine and @Christopher Gasper", people).sort()).toEqual(["chris", "christine"]);
    expect(findMentions("thanks @ChristopherGasper!", people)).toEqual(["chris"]);
  });

  it("does not match partial names or emails", () => {
    expect(findMentions("@Chris can you look", people)).toEqual([]);
    expect(findMentions("email grace@example.com", people)).toEqual([]);
    expect(findMentions("@Gracefully", people)).toEqual([]);
  });

  it("requires the full name when first names clash, and ignores inactive people", () => {
    expect(findMentions("@Laura see this", people)).toEqual([]);
    expect(findMentions("@LauraJones see this", people)).toEqual(["laura2"]);
    expect(findMentions("@Tina", people)).toEqual([]);
  });

  it("builds tokens that round-trip", () => {
    expect(mentionToken(people[2], people)).toBe("Grace");
    expect(mentionToken(people[3], people)).toBe("LauraSmith");
    for (const p of people.filter((x) => x.isActive !== false)) {
      expect(findMentions(`hi @${mentionToken(p, people)} `, people)).toEqual([p.id]);
    }
  });

  it("detects an in-progress mention before the caret", () => {
    expect(activeMentionQuery("hello @Gr")).toBe("Gr");
    expect(activeMentionQuery("hello @")).toBe("");
    expect(activeMentionQuery("hello grace@ex")).toBeNull();
    expect(activeMentionQuery("hello @Grace done")).toBeNull();
  });
});
