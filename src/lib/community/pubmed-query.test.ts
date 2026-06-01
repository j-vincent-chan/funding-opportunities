import { describe, expect, it } from "vitest";
import {
  buildStrictPubmedTerm,
  pubmedAuthorVariants,
  pubmedNameResolutionError,
  resolvePubmedInvestigatorName,
} from "@/lib/community/pubmed-query";

describe("buildStrictPubmedTerm", () => {
  it("builds author + UCSF affiliation query from structured names", () => {
    const term = buildStrictPubmedTerm({
      firstName: "Vincent",
      lastName: "Chan",
      middleInitial: "M",
    });
    expect(term).toContain("Chan Vincent M[Author]");
    expect(term).not.toContain("Chan VM[Author]");
    expect(term).toContain('"University of California San Francisco"[Affiliation]');
    expect(term).toContain("UCSF[Affiliation]");
  });

  it("uses only middle-initial author variant when middle is known", () => {
    expect(pubmedAuthorVariants("Anderson", "Mark", "S")).toEqual(["Anderson Mark S[Author]"]);
    expect(pubmedAuthorVariants("Anderson", "Mark", null)).toEqual(["Anderson Mark[Author]"]);
  });

  it("uses full given name for multi-character first names without middle initial", () => {
    expect(pubmedAuthorVariants("He", "Peng", null)).toEqual(["He Peng[Author]"]);
    expect(pubmedAuthorVariants("He", "Peng", null)).not.toContain("He P[Author]");
  });

  it("uses middle initial from full_name when structured middle_initial is empty", () => {
    const resolved = resolvePubmedInvestigatorName({
      firstName: "Mark",
      lastName: "Anderson",
      middleInitial: null,
      fullName: "Mark S. Anderson",
    });
    expect(resolved.middleInitial).toBe("S");
    const term = buildStrictPubmedTerm(resolved);
    expect(term).toContain("Anderson Mark S[Author]");
    expect(term).not.toContain("Anderson MS[Author]");
  });

  it("parses middle initial from full name when fields missing", () => {
    const resolved = resolvePubmedInvestigatorName({
      firstName: "",
      lastName: "",
      fullName: "Alexander R Marson",
    });
    expect(resolved).toEqual({
      firstName: "Alexander",
      lastName: "Marson",
      middleInitial: "R",
    });
  });

  it("parses middle initial from first_name when stored as James C", () => {
    const resolved = resolvePubmedInvestigatorName({
      firstName: "James C",
      lastName: "Lee",
      fullName: "James Lee",
    });
    expect(resolved).toEqual({
      firstName: "James",
      lastName: "Lee",
      middleInitial: "C",
    });
    expect(buildStrictPubmedTerm(resolved)).toContain("Lee James C[Author]");
    expect(buildStrictPubmedTerm(resolved)).not.toContain("Lee JC[Author]");
    expect(buildStrictPubmedTerm(resolved)).not.toContain("Lee James[Author]");
  });

  it("requires middle initial for ambiguous James Lee", () => {
    expect(
      pubmedNameResolutionError({
        firstName: "James",
        lastName: "Lee",
        fullName: "James Lee",
      })
    ).toMatch(/middle_initial/i);
    expect(
      pubmedNameResolutionError({
        firstName: "James",
        lastName: "Lee",
        middleInitial: "C",
        fullName: "James C Lee",
      })
    ).toBeNull();
  });
});
