import type { PipelinePiMatchRow } from "@/lib/opportunity-pipeline/serializers";

/** Simplified PI response state for Monitor workspace cards. */
export type MonitorPiResponseUi = "awaiting" | "interested" | "declined";

export function monitorResponseUiFromMatch(m: PipelinePiMatchRow): MonitorPiResponseUi {
  const s = String(m.outreach_status ?? "");
  if (s === "responded_interested") return "interested";
  if (s === "responded_declined") return "declined";
  return "awaiting";
}

/** Maps UI selection back to persisted `outreach_status`. */
export function outreachStatusFromMonitorUi(ui: MonitorPiResponseUi, prev: PipelinePiMatchRow): string {
  if (ui === "interested") return "responded_interested";
  if (ui === "declined") return "responded_declined";
  const was = String(prev.outreach_status ?? "");
  if (was === "responded_interested" || was === "responded_declined" || was === "responded_maybe") {
    return "sent";
  }
  if (was === "drafted") return "drafted";
  if (was === "sent") return "sent";
  return "not_contacted";
}

export function daysSinceIso(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return null;
  return Math.floor((Date.now() - t) / 86400000);
}
