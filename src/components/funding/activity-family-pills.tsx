function pillClassForFamily(f: string): string {
  const base =
    "inline-flex shrink-0 items-center whitespace-nowrap rounded-full px-2 py-0.5 text-[0.6875rem] font-semibold leading-tight tracking-[0.02em]";
  const u = f.toUpperCase();
  if (u === "R" || u === "G") {
    return `${base} bg-[#DDF2E7] text-[#1F6B4A] ring-1 ring-inset ring-[rgba(31,107,74,0.18)]`;
  }
  if (u === "K") {
    return `${base} bg-[#E4E8F7] text-[#4D5E93] ring-1 ring-inset ring-[rgba(77,94,147,0.18)]`;
  }
  if (u === "F" || u === "T") {
    return `${base} bg-[#F4E7D6] text-[#8A6038] ring-1 ring-inset ring-[rgba(138,96,56,0.18)]`;
  }
  if (u === "SBIR" || u === "STTR") {
    return `${base} bg-[#EADDE2] text-[#7C5563] ring-1 ring-inset ring-[rgba(124,85,99,0.16)]`;
  }
  if (u === "P" || u === "U" || u === "X") {
    return `${base} bg-[#DDEEF3] text-[#34697A] ring-1 ring-inset ring-[rgba(52,105,122,0.18)]`;
  }
  return `${base} bg-[#F0F6FA] text-[#26415E] ring-1 ring-inset ring-[#B3C5D4]`;
}

export function ActivityFamilyPills({ families }: { families: string[] | null | undefined }) {
  const list = Array.isArray(families)
    ? families.filter((x): x is string => typeof x === "string" && x.trim().length > 0)
    : [];
  if (list.length === 0) {
    return <span className="text-[0.6875rem] font-medium text-[#5F7387]">—</span>;
  }
  return (
    <span className="inline-flex max-w-full flex-wrap items-center gap-1.5">
      {list.map((fam) => (
        <span key={fam} className={pillClassForFamily(fam)}>
          {fam}
        </span>
      ))}
    </span>
  );
}
