import { describe, expect, it } from "vitest";
import { stripHtmlToText } from "@/lib/formatting/html";

describe("stripHtmlToText", () => {
  it("removes tags and collapses whitespace", () => {
    expect(stripHtmlToText("<p>Hello <b>world</b></p>")).toBe("Hello world");
  });
});
