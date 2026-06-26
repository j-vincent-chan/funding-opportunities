import { describe, expect, it } from "vitest";
import { matchInvestigatorRosterQuery } from "@/lib/opportunity-pipeline/investigator-workflow";

describe("matchInvestigatorRosterQuery", () => {
  it("matches first and last name when a middle initial is stored", () => {
    expect(matchInvestigatorRosterQuery("Mark S Anderson", "msa@ucsf.edu", "Mark Anderson")).toBe(true);
  });

  it("matches full name with middle initial", () => {
    expect(matchInvestigatorRosterQuery("Mark S Anderson", null, "Mark S Anderson")).toBe(true);
  });

  it("matches email tokens", () => {
    expect(matchInvestigatorRosterQuery("Mark S Anderson", "msa@ucsf.edu", "msa@ucsf")).toBe(true);
  });

  it("rejects when a token is missing", () => {
    expect(matchInvestigatorRosterQuery("Mark S Anderson", null, "Mark Wilson")).toBe(false);
  });

  it("matches extra haystack fields", () => {
    expect(
      matchInvestigatorRosterQuery("Mark S Anderson", null, "ImmunoX", ["ImmunoX · Diabetes Center"])
    ).toBe(true);
  });
});
