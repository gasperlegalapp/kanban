import { describe, expect, it } from "vitest";
import { alreadyHasTask } from "./template-match";

describe("alreadyHasTask", () => {
  const existing = ["Estate Checking Account - Adkins", "Kirsch - Assets / Inventory", "Inventory - Filing", "Letters Issued"];

  it("matches exact and decorated titles", () => {
    expect(alreadyHasTask(existing, "Letters Issued")).toBe(true);
    expect(alreadyHasTask(existing, "Estate Checking Account")).toBe(true);
    expect(alreadyHasTask(existing, "Assets / Inventory")).toBe(true);
    expect(alreadyHasTask(existing, "inventory - filing")).toBe(true);
  });

  it("does not match different tasks that share words", () => {
    expect(alreadyHasTask(existing, "Inventory")).toBe(false);
    expect(alreadyHasTask(existing, "Pay Debts / Expenses")).toBe(false);
    expect(alreadyHasTask(existing, "Letters")).toBe(false);
    expect(alreadyHasTask(["Bond"], "bond")).toBe(true);
    expect(alreadyHasTask(existing, "Fiduciary Claim(s)")).toBe(false);
    expect(alreadyHasTask(["Bonding company call"], "Bond")).toBe(false);
  });
});
