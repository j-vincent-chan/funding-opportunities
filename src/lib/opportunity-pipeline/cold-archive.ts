/** Default Cold retention: 30 days from today, capped before the notice close date. */
export function computeDefaultColdUntil(closeDateIso: string | null | undefined): string {
  const today = new Date();
  const addDays = (base: Date, days: number) => {
    const d = new Date(base);
    d.setDate(d.getDate() + days);
    return d;
  };
  const cap30 = addDays(today, 30);
  if (!closeDateIso) return cap30.toISOString().slice(0, 10);
  const close = new Date(closeDateIso + "T12:00:00");
  if (Number.isNaN(close.getTime())) return cap30.toISOString().slice(0, 10);
  const beforeClose = addDays(close, -1);
  const capS = cap30.toISOString().slice(0, 10);
  const bcS = beforeClose.toISOString().slice(0, 10);
  return capS < bcS ? capS : bcS;
}
