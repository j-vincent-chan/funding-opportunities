"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { formatDate } from "@/lib/formatting/dates";
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
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [turns, loading]);

  const send = useCallback(
    async (text: string) => {
      const question = text.trim();
      if (!question || loading) return;
      setError(null);
      setInput("");

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
    [turns, loading]
  );

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void send(input);
    }
  };

  const hasConversation = turns.length > 0;

  return (
    <section className="fo-panel overflow-hidden">
      <div className="flex items-center justify-between gap-3 border-b-2 border-[var(--fo-border)] bg-[var(--fo-paper)] px-5 py-4 sm:px-6">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold tracking-tight text-[var(--fo-title)]">Ask Prospera</h2>
            <span className="rounded-full bg-[var(--fo-paper-2)] px-2 py-0.5 text-[0.6rem] font-bold uppercase tracking-[0.12em] text-[var(--fo-ink-muted)] ring-1 ring-inset ring-[var(--fo-border)]">
              Beta
            </span>
          </div>
          <p className="mt-1 text-xs font-medium text-[var(--fo-ink-muted)]">
            Ask questions about deadlines, agencies, award sizes, topics, fit, or funding strategy.
          </p>
        </div>
        {hasConversation ? (
          <button
            type="button"
            onClick={() => {
              setTurns([]);
              setError(null);
            }}
            className="shrink-0 rounded-full border border-[var(--fo-border)] bg-[var(--fo-paper)] px-3 py-1 text-xs font-semibold text-[var(--fo-ink-muted)] transition-colors hover:border-[var(--fo-line-hover)] hover:text-[var(--fo-title)]"
          >
            Clear
          </button>
        ) : null}
      </div>

      <div className="bg-[var(--fo-paper-2)] px-4 py-4 sm:px-6 sm:py-5">
        {hasConversation ? (
          <div
            ref={scrollRef}
            className="mb-4 max-h-[26rem] space-y-4 overflow-y-auto pr-1"
            aria-live="polite"
          >
            {turns.map((turn, i) => (
              <div key={i} className={turn.role === "user" ? "flex justify-end" : "flex justify-start"}>
                <div
                  className={
                    turn.role === "user"
                      ? "max-w-[85%] rounded-2xl rounded-br-sm bg-[var(--fo-accent)] px-4 py-2.5 text-sm font-medium text-white shadow-sm"
                      : "max-w-[92%] rounded-2xl rounded-bl-sm border border-[var(--fo-border)] bg-[var(--fo-paper)] px-4 py-3 shadow-sm"
                  }
                >
                  {turn.role === "assistant" ? (
                    <>
                      <p className="whitespace-pre-wrap text-sm leading-relaxed text-[var(--fo-ink-body)]">
                        {turn.content}
                      </p>
                      {turn.sources && turn.sources.length > 0 ? (
                        <div className="mt-3 border-t border-[var(--fo-divider)] pt-3">
                          <p className="mb-2 text-[0.65rem] font-bold uppercase tracking-[0.12em] text-[var(--fo-ink-muted)]">
                            Sources ({turn.sources.length})
                          </p>
                          <ul className="space-y-1.5">
                            {turn.sources.map((s) => (
                              <li key={s.id}>
                                <Link
                                  href={`/funding-opportunities/${s.id}`}
                                  className="group flex items-start gap-2 rounded-lg px-2 py-1.5 transition-colors hover:bg-[var(--fo-paper-2)]"
                                >
                                  <span className="mt-0.5">
                                    <FundingOpportunityStatusPill status={s.status} />
                                  </span>
                                  <span className="min-w-0 flex-1">
                                    <span className="block truncate text-[0.8125rem] font-semibold text-[var(--fo-title)] group-hover:text-[var(--fo-interaction)] group-hover:underline">
                                      {s.title}
                                    </span>
                                    <span className="block truncate text-[0.7rem] text-[var(--fo-ink-muted)]">
                                      {s.agency ?? "—"}
                                      {s.close_date ? ` · closes ${formatDate(s.close_date)}` : ""}
                                    </span>
                                  </span>
                                </Link>
                              </li>
                            ))}
                          </ul>
                        </div>
                      ) : null}
                    </>
                  ) : (
                    <p className="whitespace-pre-wrap text-sm font-medium leading-relaxed">{turn.content}</p>
                  )}
                </div>
              </div>
            ))}
            {loading ? (
              <div className="flex justify-start">
                <div className="rounded-2xl rounded-bl-sm border border-[var(--fo-border)] bg-[var(--fo-paper)] px-4 py-3 text-sm text-[var(--fo-ink-muted)] shadow-sm">
                  Searching opportunities…
                </div>
              </div>
            ) : null}
          </div>
        ) : (
          <p className="mb-4 text-sm font-medium text-[var(--fo-ink-body)]">
            Summaries, comparisons, prioritization, and planning across your synced notices.
          </p>
        )}

        {error ? (
          <p className="mb-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
        ) : null}

        <div className="flex items-end gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            rows={1}
            placeholder="Ask about deadlines, agencies, award sizes, topics, fit, or strategy…"
            className="block max-h-40 min-h-[3rem] w-full resize-y rounded-2xl border border-[var(--fo-border)] bg-[var(--fo-paper)] px-4 py-3 text-sm font-medium leading-snug text-[var(--fo-ink)] shadow-sm placeholder:text-[var(--fo-ink-faint)] transition-[border-color,box-shadow] hover:border-[var(--fo-line-hover)] focus:border-[var(--fo-focus-border)] focus:outline-none focus:ring-[3px] focus:ring-[var(--fo-focus-ring)]"
            disabled={loading}
          />
          <button
            type="button"
            onClick={() => void send(input)}
            disabled={loading || !input.trim()}
            className="shrink-0 rounded-2xl bg-[var(--fo-accent)] px-6 py-3 text-sm font-semibold text-white shadow-sm transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? "…" : "Ask Prospera"}
          </button>
        </div>
        <p className="mt-2 text-[0.7rem] text-[var(--fo-ink-faint)]">
          AI can make mistakes. Verify deadlines and amounts on the official notice.
        </p>

        {!hasConversation ? (
          <div className="mt-3 flex flex-wrap gap-2">
            {EXAMPLE_PROMPTS.map((prompt) => (
              <button
                key={prompt}
                type="button"
                onClick={() => void send(prompt)}
                disabled={loading}
                className="rounded-full border border-[var(--fo-border)] bg-[var(--fo-paper)] px-3 py-1.5 text-xs font-medium text-[var(--fo-ink-body)] transition-colors hover:border-[var(--fo-line-hover)] hover:text-[var(--fo-title)] disabled:opacity-50"
              >
                {prompt}
              </button>
            ))}
          </div>
        ) : null}
      </div>
    </section>
  );
}
