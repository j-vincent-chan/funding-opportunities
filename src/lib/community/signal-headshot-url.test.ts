import { describe, expect, it } from "vitest";
import {
  resolveSignalHeadshotUrl,
  signalInvestigatorHeadshotPublicUrl,
} from "@/lib/community/signal-headshot-url";

describe("signalInvestigatorHeadshotPublicUrl", () => {
  it("builds public URL in the investigator-headshots bucket", () => {
    const url = signalInvestigatorHeadshotPublicUrl(
      "4fb75477-60e0-454e-85bf-3b1bbb64eb8c/286818b6-51a7-43e6-98fe-ad07823d95f6/headshot",
      "https://fxfgduaybiqmaiywdbbx.supabase.co"
    );
    expect(url).toBe(
      "https://fxfgduaybiqmaiywdbbx.supabase.co/storage/v1/object/public/investigator-headshots/4fb75477-60e0-454e-85bf-3b1bbb64eb8c/286818b6-51a7-43e6-98fe-ad07823d95f6/headshot"
    );
  });
});

describe("resolveSignalHeadshotUrl", () => {
  it("prefers storage path over external headshot_url", () => {
    const url = resolveSignalHeadshotUrl(
      {
        headshot_storage_path:
          "4fb75477-60e0-454e-85bf-3b1bbb64eb8c/286818b6-51a7-43e6-98fe-ad07823d95f6/headshot",
        headshot_url: "https://cdn.example.com/old.jpg",
      },
      "https://fxfgduaybiqmaiywdbbx.supabase.co"
    );
    expect(url).toContain("/investigator-headshots/");
    expect(url).not.toContain("cdn.example.com");
  });

  it("falls back to external https headshot_url", () => {
    expect(
      resolveSignalHeadshotUrl({
        headshot_url: "https://cdn.example.com/photo.jpg",
      })
    ).toBe("https://cdn.example.com/photo.jpg");
  });
});
