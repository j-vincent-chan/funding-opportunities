const FETCH_TIMEOUT_MS = 18_000;
const MAX_HTML_BYTES = 1_500_000;
const MIN_FULLTEXT_CHARS = 900;
const MIN_ABSTRACT_CHARS = 120;

type EnrichmentSuccess = {
  ok: true;
  finalUrl: string;
  contentType: string | null;
  abstractText: string | null;
  fullText: string | null;
  extractionMethod: "html-meta-and-body";
};

type EnrichmentFailure = {
  ok: false;
  finalUrl: string;
  contentType: string | null;
  error: string;
};

export type SourceDocumentUrlEnrichmentResult = EnrichmentSuccess | EnrichmentFailure;

function compact(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">");
}

function stripTags(html: string): string {
  return compact(
    decodeHtmlEntities(
      html
        .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
        .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
        .replace(/<noscript\b[^>]*>[\s\S]*?<\/noscript>/gi, " ")
        .replace(/<!--[\s\S]*?-->/g, " ")
        .replace(/<[^>]+>/g, " ")
    )
  );
}

function firstMetaContentByNames(html: string, names: string[]): string | null {
  for (const name of names) {
    const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regexA = new RegExp(
      `<meta\\s+[^>]*(?:name|property)=["']${escaped}["'][^>]*content=["']([^"']+)["'][^>]*>`,
      "i"
    );
    const regexB = new RegExp(
      `<meta\\s+[^>]*content=["']([^"']+)["'][^>]*(?:name|property)=["']${escaped}["'][^>]*>`,
      "i"
    );
    const match = html.match(regexA) ?? html.match(regexB);
    const content = match?.[1] ? compact(decodeHtmlEntities(match[1])) : "";
    if (content.length >= 20) return content;
  }
  return null;
}

function extractAbstractFromHtml(html: string): string | null {
  const meta = firstMetaContentByNames(html, [
    "citation_abstract",
    "description",
    "og:description",
    "twitter:description",
    "dc.description",
    "dc.Description",
  ]);
  if (meta && meta.length >= MIN_ABSTRACT_CHARS) return meta;

  const abstractSection = html.match(
    /<h[1-6][^>]*>\s*abstract\s*<\/h[1-6]>\s*([\s\S]{0,6000}?)(?:<h[1-6][^>]*>|<\/section>|<\/article>|<\/main>)/i
  );
  if (abstractSection?.[1]) {
    const txt = stripTags(abstractSection[1]);
    if (txt.length >= MIN_ABSTRACT_CHARS) return txt;
  }
  return null;
}

function extractMainBodyFromHtml(html: string): string | null {
  const mainCandidates = [
    /<article\b[^>]*>([\s\S]*?)<\/article>/i,
    /<main\b[^>]*>([\s\S]*?)<\/main>/i,
    /<body\b[^>]*>([\s\S]*?)<\/body>/i,
  ];
  for (const pattern of mainCandidates) {
    const match = html.match(pattern);
    if (!match?.[1]) continue;
    const txt = stripTags(match[1]);
    if (txt.length >= MIN_FULLTEXT_CHARS) return txt;
  }
  const fallback = stripTags(html);
  return fallback.length >= MIN_FULLTEXT_CHARS ? fallback : null;
}

export async function enrichTextFromSourceUrl(
  sourceUrl: string
): Promise<SourceDocumentUrlEnrichmentResult> {
  const trimmed = sourceUrl.trim();
  if (!trimmed) {
    return { ok: false, finalUrl: sourceUrl, contentType: null, error: "Missing source URL." };
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return { ok: false, finalUrl: sourceUrl, contentType: null, error: "Invalid source URL." };
  }
  if (!/^https?:$/i.test(parsed.protocol)) {
    return {
      ok: false,
      finalUrl: sourceUrl,
      contentType: null,
      error: "Only HTTP/HTTPS URLs are supported.",
    };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const response = await fetch(parsed.toString(), {
      method: "GET",
      redirect: "follow",
      signal: controller.signal,
      headers: {
        "User-Agent":
          "Prospera-Portfolio-Intelligence/1.0 (+https://prospera.local; research text enrichment)",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
      cache: "no-store",
    });
    const finalUrl = response.url || parsed.toString();
    const contentType = response.headers.get("content-type");
    if (!response.ok) {
      return {
        ok: false,
        finalUrl,
        contentType,
        error: `HTTP ${response.status}`,
      };
    }
    if (contentType && /pdf|octet-stream/i.test(contentType)) {
      return {
        ok: false,
        finalUrl,
        contentType,
        error: "Binary/PDF response not yet supported by URL enrichment.",
      };
    }

    const rawHtml = (await response.text()).slice(0, MAX_HTML_BYTES);
    const abstractText = extractAbstractFromHtml(rawHtml);
    const fullText = extractMainBodyFromHtml(rawHtml);
    if (!abstractText && !fullText) {
      return {
        ok: false,
        finalUrl,
        contentType,
        error: "No extractable abstract/body text found.",
      };
    }
    return {
      ok: true,
      finalUrl,
      contentType,
      abstractText,
      fullText,
      extractionMethod: "html-meta-and-body",
    };
  } catch (error) {
    return {
      ok: false,
      finalUrl: parsed.toString(),
      contentType: null,
      error: error instanceof Error ? error.message : String(error),
    };
  } finally {
    clearTimeout(timer);
  }
}
