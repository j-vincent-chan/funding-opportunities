import { describe, expect, it } from "vitest";
import {
  buildInvestigatorNameMatchers,
  findInvestigatorIdsInText,
  type WatchlistInvestigator,
} from "@/lib/community/investigator-name-matching";

const roster: WatchlistInvestigator[] = [
  {
    id: "inv-a",
    firstName: "Jane",
    lastName: "Doe",
    fullName: "Jane Doe",
  },
  {
    id: "inv-b",
    firstName: "John",
    lastName: "Smith",
    fullName: "John Smith",
  },
];

describe("investigator name matching", () => {
  it("matches full and first-last forms", () => {
    const matchers = buildInvestigatorNameMatchers(roster);
    const text =
      "UCSF researchers Jane Doe and John Smith published a study on immune regulation.";
    expect(findInvestigatorIdsInText(text, matchers).sort()).toEqual(["inv-a", "inv-b"]);
  });

  it("matches last-comma-first form", () => {
    const matchers = buildInvestigatorNameMatchers(roster);
    expect(findInvestigatorIdsInText("Awarded to Doe, Jane for excellence.", matchers)).toEqual([
      "inv-a",
    ]);
  });

  it("does not match unrelated substring names", () => {
    const matchers = buildInvestigatorNameMatchers(roster);
    expect(findInvestigatorIdsInText("The janitor opened the door.", matchers)).toEqual([]);
  });
});
