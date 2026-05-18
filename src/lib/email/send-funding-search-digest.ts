function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function appOrigin(): string {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/$/, "");
  if (explicit) return explicit;
  const v = process.env.VERCEL_URL?.trim();
  if (v) return `https://${v.replace(/^https?:\/\//, "")}`;
  return "http://localhost:3000";
}

export type FundingDigestLine = {
  id: string;
  title: string;
  agency: string | null;
  opportunityNumber: string | null;
};

export async function sendFundingSearchDigestEmail(input: {
  to: string;
  searchName: string;
  lines: FundingDigestLine[];
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const key = process.env.RESEND_API_KEY?.trim();
  const from = process.env.RESEND_FROM_EMAIL?.trim();
  if (!key || !from) {
    return { ok: false, error: "RESEND_API_KEY or RESEND_FROM_EMAIL not configured." };
  }

  const origin = appOrigin();
  const maxLines = 75;
  const slice = input.lines.slice(0, maxLines);
  const more = input.lines.length - slice.length;

  const itemsHtml = slice
    .map((l) => {
      const url = `${origin}/funding-opportunities/${l.id}`;
      const sub = [l.agency, l.opportunityNumber].filter(Boolean).join(" · ");
      return `<li style="margin:0 0 12px 0;">
  <a href="${escapeHtml(url)}" style="font-weight:600;color:#0f766e;">${escapeHtml(l.title || "(untitled)")}</a>
  ${sub ? `<div style="font-size:13px;color:#64748b;margin-top:4px;">${escapeHtml(sub)}</div>` : ""}
</li>`;
    })
    .join("");

  const html = `<!DOCTYPE html><html><body style="font-family:system-ui,sans-serif;line-height:1.5;color:#0f172a;">
<p style="font-size:15px;">New or updated <strong>posted</strong> or <strong>forecasted</strong> notices match your saved search <strong>${escapeHtml(input.searchName)}</strong>:</p>
<ul style="padding-left:18px;margin:16px 0;">${itemsHtml}</ul>
${more > 0 ? `<p style="font-size:14px;color:#64748b;">And ${more} more — open <a href="${escapeHtml(`${origin}/funding-opportunities`)}">Search</a> with your saved filters.</p>` : ""}
<p style="font-size:13px;color:#94a3b8;margin-top:24px;">You received this because email alerts are enabled for a saved search. Turn them off from Search → Refine → Saved searches.</p>
</body></html>`;

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [input.to],
      subject: `${slice.length} new notice${slice.length === 1 ? "" : "s"} — ${input.searchName}`,
      html,
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    return { ok: false, error: `Resend HTTP ${res.status}: ${text.slice(0, 400)}` };
  }
  return { ok: true };
}
