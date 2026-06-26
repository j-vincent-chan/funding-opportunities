import { describe, expect, it } from "vitest";
import { decodeHtmlEntities, stripHtmlToText } from "@/lib/formatting/html";

describe("stripHtmlToText", () => {
  it("removes tags and collapses whitespace", () => {
    expect(stripHtmlToText("<p>Hello <b>world</b></p>")).toBe("Hello world");
  });

  it("decodes nbsp entities from plain or HTML text", () => {
    expect(stripHtmlToText("Early-Career&nbsp;&nbsp;Clinician")).toBe("Early-Career Clinician");
    expect(stripHtmlToText("<p>Line&nbsp;break</p>")).toBe("Line break");
    expect(stripHtmlToText("&#160;spaced")).toBe("spaced");
  });

  it("removes empty markdown bold markers from CDMRP-style summaries", () => {
    expect(stripHtmlToText("·**&nbsp;&nbsp;** Early-Career Clinician")).toBe("· Early-Career Clinician");
  });

  it("decodes other named entities", () => {
    expect(decodeHtmlEntities("Tom &amp; Jerry &quot;friends&quot;")).toBe('Tom & Jerry "friends"');
  });
});
