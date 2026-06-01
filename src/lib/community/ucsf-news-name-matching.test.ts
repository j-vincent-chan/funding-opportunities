import { describe, expect, it } from "vitest";
import {
  buildUcsfNewsNameMatchers,
  findUcsfNewsInvestigatorIdsInText,
} from "@/lib/community/ucsf-news-name-matching";
import type { WatchlistInvestigator } from "@/lib/community/investigator-name-matching";

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
    middleInitial: "M",
    fullName: "John M Smith",
  },
];

describe("ucsf news name matching", () => {
  it("matches contiguous full name in article text", () => {
    const matchers = buildUcsfNewsNameMatchers(roster);
    const text = "UCSF researchers Jane Doe and John M Smith published a study.";
    expect(findUcsfNewsInvestigatorIdsInText(text, matchers).sort()).toEqual(["inv-a", "inv-b"]);
  });

  it("matches last-comma-first form", () => {
    const matchers = buildUcsfNewsNameMatchers(roster);
    expect(findUcsfNewsInvestigatorIdsInText("Awarded to Doe, Jane for excellence.", matchers)).toEqual([
      "inv-a",
    ]);
  });

  it("does not match first and last names appearing separately in prose", () => {
    const matchers = buildUcsfNewsNameMatchers(roster);
    const text = "Jane discussed the project. Later, Doe presented results to Smith.";
    expect(findUcsfNewsInvestigatorIdsInText(text, matchers)).toEqual([]);
  });

  it("does not match bare John Smith when roster name is John M Smith", () => {
    const matchers = buildUcsfNewsNameMatchers(roster);
    expect(findUcsfNewsInvestigatorIdsInText("Contact John Smith for comment.", matchers)).toEqual([]);
  });

  it("does not match last name alone", () => {
    const matchers = buildUcsfNewsNameMatchers(roster);
    expect(findUcsfNewsInvestigatorIdsInText("Smith laboratory received funding.", matchers)).toEqual([]);
  });
});
