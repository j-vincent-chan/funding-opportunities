import {
  MECHANISM_SIMILARITY_LABEL,
  type MechanismSimilarityLevel,
} from "@/lib/funding-opportunities/mechanism-taxonomy";

const PILL_BASE =
  "inline-flex shrink-0 items-center whitespace-nowrap rounded-full px-2.5 py-0.5 text-[0.625rem] font-bold uppercase leading-tight tracking-[0.1em] ring-1 ring-inset";

const MECHANISM_SIMILARITY_PILL_LABEL: Record<MechanismSimilarityLevel, string> = {
  exact: "EXACT",
  very_high: "VERY HIGH",
  high: "HIGH",
};

function pillClassForLevel(level: MechanismSimilarityLevel): string {
  if (level === "exact") {
    return `${PILL_BASE} bg-red-200 text-red-950 ring-red-400`;
  }
  if (level === "very_high") {
    return `${PILL_BASE} bg-red-100 text-red-900 ring-red-300`;
  }
  return `${PILL_BASE} bg-red-50 text-red-800 ring-red-200`;
}

export function MechanismSimilarityPill({ level }: { level: MechanismSimilarityLevel }) {
  return (
    <span className={pillClassForLevel(level)} title={MECHANISM_SIMILARITY_LABEL[level]}>
      {MECHANISM_SIMILARITY_PILL_LABEL[level]}
    </span>
  );
}
