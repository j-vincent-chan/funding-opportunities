import type { SupabaseClient } from "@supabase/supabase-js";
import { prosperaCommunityItemId } from "@/lib/community/prospera-community-item-id";

const UCSF_SITEMAP_ROOT = "https://www.ucsf.edu/sitemap.xml";
const DEFAULT_MAX_ITEMS = 5000;
const DEFAULT_MAX_SITEMAPS = 250;
const UPSERT_BATCH_SIZE = 400;

type SitemapUrlEntry = {
  loc: string;
  lastmod: string | null;
};

function decodeXmlEntities(text: string): string {
  return text
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function extractTag(block: string, tag: string): string | null {
  const re = new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`, "i");
  const m = block.match(re);
  if (!m?.[1]) return null;
  return decodeXmlEntities(m[1]).trim();
}

function parseSitemapIndex(xml: string): string[] {
  const blocks = xml.match(/<sitemap\b[\s\S]*?<\/sitemap>/gi) ?? [];
  const urls: string[] = [];
  for (const block of blocks) {
    const loc = extractTag(block, "loc");
    if (loc) urls.push(loc);
  }
  return urls;
}

function parseUrlSet(xml: string): SitemapUrlEntry[] {
  const blocks = xml.match(/<url\b[\s\S]*?<\/url>/gi) ?? [];
  const entries: SitemapUrlEntry[] = [];
  for (const block of blocks) {
    const loc = extractTag(block, "loc");
    if (!loc) continue;
    entries.push({
      loc,
      lastmod: extractTag(block, "lastmod"),
    });
  }
  return entries;
}

function normalizeUrl(raw: string): string | null {
  try {
    const url = new URL(raw.trim());
    if (!/ucsf\.edu$/i.test(url.hostname)) return null;
    return url.toString();
  } catch {
    return null;
  }
}

function isUcsfNewsUrl(raw: string): boolean {
  const normalized = normalizeUrl(raw);
  if (!normalized) return false;
  const u = new URL(normalized);
  return u.pathname.startsWith("/news/");
}

function titleFromNewsUrl(raw: string): string {
  try {
    const u = new URL(raw);
    const segments = u.pathname.split("/").filter(Boolean);
    const slug = segments[segments.length - 1] ?? "ucsf-news";
    const text = decodeURIComponent(slug)
      .replace(/[-_]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    if (!text) return "UCSF News";
    return text
      .split(" ")
      .map((w) => (w ? `${w[0]!.toUpperCase()}${w.slice(1)}` : w))
      .join(" ");
  } catch {
    return "UCSF News";
  }
}

function publishedAtFromUrlOrLastmod(url: string, lastmod: string | null): string | null {
  const m = url.match(/\/news\/(\d{4})\/(\d{2})\//);
  if (m?.[1] && m?.[2]) {
    return `${m[1]}-${m[2]}-01T12:00:00.000Z`;
  }
  if (lastmod?.trim()) {
    const d = new Date(lastmod.trim());
    if (!Number.isNaN(d.getTime())) return d.toISOString();
  }
  return null;
}

function yearFromNewsUrl(url: string): number | null {
  const m = url.match(/\/news\/(\d{4})\//);
  if (!m?.[1]) return null;
  const y = Number(m[1]);
  return Number.isFinite(y) ? y : null;
}

export async function ingestUcsfNewsFromSitemaps(
  supabase: SupabaseClient,
  params?: { maxItems?: number; sinceYear?: number | null; maxSitemaps?: number }
): Promise<{
  crawledSitemaps: number;
  discoveredNewsUrls: number;
  selectedNewsUrls: number;
  upserted: number;
  failed: number;
  errors: string[];
}> {
  const maxItems = Math.max(1, Math.min(20000, params?.maxItems ?? DEFAULT_MAX_ITEMS));
  const maxSitemaps = Math.max(1, Math.min(1000, params?.maxSitemaps ?? DEFAULT_MAX_SITEMAPS));
  const sinceYear = params?.sinceYear ?? null;

  const queue = [UCSF_SITEMAP_ROOT];
  const visited = new Set<string>();
  const newsEntries = new Map<string, SitemapUrlEntry>();
  const errors: string[] = [];

  while (queue.length > 0 && visited.size < maxSitemaps) {
    const sitemapUrl = queue.shift()!;
    if (visited.has(sitemapUrl)) continue;
    visited.add(sitemapUrl);

    try {
      const res = await fetch(sitemapUrl, { cache: "no-store" });
      if (!res.ok) {
        if (errors.length < 50) errors.push(`${sitemapUrl}: HTTP ${res.status}`);
        continue;
      }
      const xml = await res.text();
      const nested = parseSitemapIndex(xml);
      if (nested.length > 0) {
        for (const child of nested) {
          const normalized = normalizeUrl(child);
          if (normalized && !visited.has(normalized)) queue.push(normalized);
        }
      }
      for (const entry of parseUrlSet(xml)) {
        if (!isUcsfNewsUrl(entry.loc)) continue;
        const normalized = normalizeUrl(entry.loc);
        if (!normalized) continue;
        if (sinceYear != null) {
          const y = yearFromNewsUrl(normalized);
          if (y != null && y < sinceYear) continue;
        }
        if (!newsEntries.has(normalized)) {
          newsEntries.set(normalized, { ...entry, loc: normalized });
        }
      }
    } catch (e) {
      if (errors.length < 50) {
        errors.push(`${sitemapUrl}: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
  }

  const selected = Array.from(newsEntries.values())
    .sort((a, b) => a.loc.localeCompare(b.loc))
    .slice(0, maxItems);

  const nowIso = new Date().toISOString();
  const rows = selected.map((entry) => {
    const cacheKey = `ucsf-news:${entry.loc}`;
    return {
      id: prosperaCommunityItemId("ucsf-news", cacheKey),
      origin: "prospera" as const,
      prospera_cache_key: cacheKey,
      title: titleFromNewsUrl(entry.loc),
      category: "media",
      source_type: "web",
      status: "approved",
      published_at: publishedAtFromUrlOrLastmod(entry.loc, entry.lastmod),
      found_at: nowIso,
      source_url: entry.loc,
      source_domain: "www.ucsf.edu",
      raw_summary: "UCSF News",
      signal_created_at: nowIso,
      imported_at: nowIso,
    };
  });

  let upserted = 0;
  let failed = 0;
  for (let i = 0; i < rows.length; i += UPSERT_BATCH_SIZE) {
    const chunk = rows.slice(i, i + UPSERT_BATCH_SIZE);
    const { error } = await supabase.from("community_source_items").upsert(chunk, {
      onConflict: "id",
    });
    if (error) {
      failed += chunk.length;
      if (errors.length < 50) errors.push(`upsert batch ${Math.floor(i / UPSERT_BATCH_SIZE) + 1}: ${error.message}`);
    } else {
      upserted += chunk.length;
    }
  }

  return {
    crawledSitemaps: visited.size,
    discoveredNewsUrls: newsEntries.size,
    selectedNewsUrls: selected.length,
    upserted,
    failed,
    errors,
  };
}
