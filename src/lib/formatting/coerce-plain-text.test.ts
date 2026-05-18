import { describe, expect, it } from "vitest";
import { coerceDateString, coercePlainTextFromUnknown } from "./coerce-plain-text";

describe("coercePlainTextFromUnknown", () => {
  it("returns strings unchanged", () => {
    expect(coercePlainTextFromUnknown("hello")).toBe("hello");
  });

  it("extracts text from nested summary objects", () => {
    expect(
      coercePlainTextFromUnknown({
        plain_text: "Synopsis body",
      })
    ).toBe("Synopsis body");
  });

  it("stringifies unknown objects without [object Object] in React path", () => {
    const s = coercePlainTextFromUnknown({ foo: 1, bar: "baz" });
    expect(s).toContain("foo");
    expect(s).toContain("baz");
  });
});

describe("coerceDateString", () => {
  it("accepts ISO date prefix", () => {
    expect(coerceDateString("2026-04-01")).toBe("2026-04-01");
  });

  it("accepts full ISO datetimes", () => {
    expect(coerceDateString("2026-04-01T15:30:00Z")).toBe("2026-04-01");
  });

  it("unwraps value and date wrappers", () => {
    expect(coerceDateString({ value: "2026-05-10" })).toBe("2026-05-10");
    expect(coerceDateString({ date: "2026-05-11" })).toBe("2026-05-11");
  });

  it("accepts unix timestamps in seconds or ms", () => {
    expect(coerceDateString(1_717_209_600)).toBe("2024-06-01");
    expect(coerceDateString(1_717_209_600_000)).toBe("2024-06-01");
  });
});
