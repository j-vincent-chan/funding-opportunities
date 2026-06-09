"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { formatDate } from "@/lib/formatting/dates";
import { FundingOpportunityPeekLink } from "@/components/funding/funding-opportunity-peek-panel";
import { FundingOpportunityStatusPill } from "@/components/funding/funding-opportunity-status-pill";

type Source = {
  id: string;
  title: string;
  agency: string | null;
  status: "open" | "forecasted" | "closed";
  close_date: string | null;
  posted_date: string | null;
  funding_instrument: string | null;
};

type ChatTurn = {
  role: "user" | "assistant";
  content: string;
  sources?: Source[];
};

const EXAMPLE_PROMPTS = [
  "Show new NIH opportunities posted this week",
  "Find immunology opportunities closing in the next 90 days",
  "Which opportunities are best for early-stage investigators?",
  "What major opportunities are closing in the next 3 months?",
];

export function FundingChatPanel() {
  const [isOpen, setIsOpen] = useState(false);
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [turns, loading, isOpen]);

  const send = useCallback(
    async (text: string) => {
      const question = text.trim();
      if (!question || loading) return;
      setError(null);
      setInput("");
      if (!isOpen) setIsOpen(true);

      const history: ChatTurn[] = [...turns, { role: "user", content: question }];
      setTurns(history);
      setLoading(true);

      try {
        const res = await fetch("/api/funding-chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: history.map((t) => ({ role: t.role, content: t.content })),
          }),
        });
        const data = await res.json();
        if (!res.ok || !data?.ok) {
          throw new Error(data?.error || `Request failed (${res.status})`);
        }
        setTurns((prev) => [
          ...prev,
          { role: "assistant", content: data.answer as string, sources: (data.sources as Source[]) ?? [] },
        ]);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong.");
      } finally {
        setLoading(false);
      }
    },
    [turns, loading, isOpen]
  );

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void send(input);
    }
  };

  const hasConversation = turns.length > 0;

  if (!isOpen) {
    return (
      <div className="pointer-events-none fixed bottom-5 right-5 z-50">
        <button
          type="button"
          onClick={() => setIsOpen(true)}
          className="pointer-events-auto relative flex items-center gap-2 rounded-full border border-[var(--fo-border)] bg-[var(--fo-paper)] px-4 py-3 text-sm font-semibold text-[var(--fo-title)] shadow-lg ring-1 ring-black/5 transition-transform hover:scale-[1.02] hover:border-[var(--fo-line-hover)]"
          aria-expanded={false}
          aria-controls="prospera-chat-panel"
        >
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--fo-accent)] text-white">
            <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
          </span>
          Ask Prospera
          <span className="rounded-full bg-[var(--fo-paper-2)] px-2 py-0.5 text-[0.6rem] font-bold uppercase tracking-[0.12em] text-[var(--fo-ink-muted)] ring-1 ring-inset ring-[var(--fo-border)]">
            Beta
          </span>
          {hasConversation ? (
            <span className="absolute -right-0.5 -top-0.5 h-3 w-3 rounded-full bg-[var(--fo-accent)] ring-2 ring-[var(--fo-paper)]" />
          ) : null}
        </button>
      </div>
    );
  }

  return (
    <div className="pointer-events-none fixed bottom-5 right-5 z-50 flex max-h-[calc(100vh-2.5rem)] w-[min(100vw-2.5rem,24rem)] flex-col">
      <section
        id="prospera-chat-panel"
        className="pointer-events-auto flex max-h-[calc(100vh-2.5rem)] flex-col overflow-hidden rounded-2xl border border-[var(--fo-border)] bg-[var(--fo-paper)] shadow-2xl ring-1 ring-black/5"
        aria-label="Ask Prospera chat"
      >
        <div className="flex shrink-0 items-start justify-between gap-2 border-b border-[var(--fo-border)] bg-[var(--fo-paper)] px-4 py-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="text-sm font-bold tracking-tight text-[var(--fo-title)]">Ask Prospera</h2>
              <span className="rounded-full bg-[var(--fo-paper-2)] px-1.5 py-0.5 text-[0.55rem] font-bold uppercase tracking-[0.12em] text-[var(--fo-ink-muted)] ring-1 ring-inset ring-[var(--fo-border)]">
                Beta
              </span>
            </div>
            <p className="mt-0.5 text-[0.7rem] font-medium leading-snug text-[var(--fo-ink-muted)]">
              Deadlines, agencies, fit, and funding strategy
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            {hasConversation ? (
              <button
                type="button"
                onClick={() => {
                  setTurns([]);
                  setError(null);
                }}
                className="rounded-full border border-[var(--fo-border)] bg-[var(--fo-paper)] px-2.5 py-1 text-[0.65rem] font-semibold text-[var(--fo-ink-muted)] transition-colors hover:border-[var(--fo-line-hover)] hover:text-[var(--fo-title)]"
              >
                Clear
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="rounded-full p-1.5 text-[var(--fo-ink-muted)] transition-colors hover:bg-[var(--fo-paper-2)] hover:text-[var(--fo-title)]"
              aria-label="Minimize chat"
            >
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                <path d="M5 12h14" />
              </svg>
            </button>
          </div>
        </div>

        <div className="flex min-h-0 flex-1 flex-col bg-[var(--fo-paper-2)] px-3 py-3">
          {hasConversation ? (
            <div
              ref={scrollRef}
              className="mb-3 min-h-0 flex-1 space-y-3 overflow-y-auto pr-0.5"
              style={{ maxHeight: "min(22rem, calc(100vh - 16rem))" }}
              aria-live="polite"
            >
              {turns.map((turn, i) => (
                <div key={i} className={turn.role === "user" ? "flex justify-end" : "flex justify-start"}>
                  <div
                    className={
                      turn.role === "user"
                        ? "max-w-[90%] rounded-2xl rounded-br-sm bg-[var(--fo-accent)] px-3 py-2 text-xs font-medium text-white shadow-sm"
                        : "max-w-[95%] rounded-2xl rounded-bl-sm border border-[var(--fo-border)] bg-[var(--fo-paper)] px-3 py-2.5 shadow-sm"
                    }
                  >
                    {turn.role === "assistant" ? (
                      <>
                        <p className="whitespace-pre-wrap text-xs leading-relaxed text-[var(--fo-ink-body)]">
                          {turn.content}
                        </p>
                        {turn.sources && turn.sources.length > 0 ? (
                          <div className="mt-2 border-t border-[var(--fo-divider)] pt-2">
                            <p className="mb-1.5 text-[0.6rem] font-bold uppercase tracking-[0.12em] text-[var(--fo-ink-muted)]">
                              Sources ({turn.sources.length})
                            </p>
                            <ul className="space-y-1">
                              {turn.sources.map((s) => (
                                <li key={s.id}>
                                  <FundingOpportunityPeekLink
                                    opportunityId={s.id}
                                    className="group flex w-full items-start gap-1.5 rounded-lg px-1.5 py-1 text-left transition-colors hover:bg-[var(--fo-paper-2)]"
                                  >
                                    <span className="mt-0.5 shrink-0">
                                      <FundingOpportunityStatusPill status={s.status} />
                                    </span>
                                    <span className="min-w-0 flex-1">
                                      <span className="block text-[0.7rem] font-semibold leading-snug text-[var(--fo-title)] group-hover:text-[var(--fo-interaction)] group-hover:underline">
                                        {s.title}
                                      </span>
                                      <span className="block truncate text-[0.65rem] text-[var(--fo-ink-muted)]">
                                        {s.agency ?? "—"}
                                        {s.close_date ? ` · closes ${formatDate(s.close_date)}` : ""}
                                      </span>
                                    </span>
                                  </FundingOpportunityPeekLink>
                                </li>
                              ))}
                            </ul>
                          </div>
                        ) : null}
                      </>
                    ) : (
                      <p className="whitespace-pre-wrap text-xs font-medium leading-relaxed">{turn.content}</p>
                    )}
                  </div>
                </div>
              ))}
              {loading ? (
                <div className="flex justify-start">
                  <div className="rounded-2xl rounded-bl-sm border border-[var(--fo-border)] bg-[var(--fo-paper)] px-3 py-2 text-xs text-[var(--fo-ink-muted)] shadow-sm">
                    Searching opportunities…
                  </div>
                </div>
              ) : null}
            </div>
          ) : (
            <p className="mb-3 text-xs font-medium leading-relaxed text-[var(--fo-ink-body)]">
              Summaries, comparisons, prioritization, and planning across your synced notices.
            </p>
          )}

          {error ? (
            <p className="mb-2 rounded-lg border border-red-200 bg-red-50 px-2.5 py-1.5 text-xs text-red-700">
              {error}
            </p>
          ) : null}

          <div className="mt-auto shrink-0 space-y-2">
            <div className="flex items-end gap-1.5">
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={onKeyDown}
                rows={2}
                placeholder="Ask about deadlines, agencies, fit, or strategy…"
                className="block max-h-28 min-h-[2.75rem] w-full resize-none rounded-xl border border-[var(--fo-border)] bg-[var(--fo-paper)] px-3 py-2 text-xs font-medium leading-snug text-[var(--fo-ink)] shadow-sm placeholder:text-[var(--fo-ink-faint)] transition-[border-color,box-shadow] hover:border-[var(--fo-line-hover)] focus:border-[var(--fo-focus-border)] focus:outline-none focus:ring-[3px] focus:ring-[var(--fo-focus-ring)]"
                disabled={loading}
              />
              <button
                type="button"
                onClick={() => void send(input)}
                disabled={loading || !input.trim()}
                className="shrink-0 rounded-xl bg-[var(--fo-accent)] px-3 py-2.5 text-xs font-semibold text-white shadow-sm transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {loading ? "…" : "Ask"}
              </button>
            </div>
            <p className="text-[0.65rem] leading-snug text-[var(--fo-ink-faint)]">
              AI can make mistakes. Verify deadlines and amounts on the official notice.
            </p>

            {!hasConversation ? (
              <div className="flex flex-wrap gap-1.5">
                {EXAMPLE_PROMPTS.map((prompt) => (
                  <button
                    key={prompt}
                    type="button"
                    onClick={() => void send(prompt)}
                    disabled={loading}
                    className="rounded-full border border-[var(--fo-border)] bg-[var(--fo-paper)] px-2.5 py-1 text-[0.65rem] font-medium leading-snug text-[var(--fo-ink-body)] transition-colors hover:border-[var(--fo-line-hover)] hover:text-[var(--fo-title)] disabled:opacity-50"
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        </div>
      </section>
    </div>
  );
}
