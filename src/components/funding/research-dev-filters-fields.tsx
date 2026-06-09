"use client";

import type { RdListFilterState } from "@/lib/funding-opportunities/rd-list-filters";
import { normalizeClinicalTrialQueryValue } from "@/lib/funding-opportunities/rd-list-filters";
import { TOP_LEVEL_DEPARTMENTS } from "@/lib/funding-opportunities/agency-taxonomy";
import type { DepartmentSubsSelection } from "@/lib/funding-opportunities/agency-filter";
import { getSubcomponentsForDepartment } from "@/lib/funding-opportunities/department-subcomponents";
import type { FundingListScope } from "@/lib/funding-opportunities/funding-list-url";

const ACT = ["R", "K", "F", "T", "P", "U", "X", "DP", "SBIR", "STTR", "SC", "RM", "TL", "UL", "G"] as const;

const IC = [
  "NCI",
  "NHLBI",
  "NIAID",
  "NINDS",
  "NIDDK",
  "NICHD",
  "NIMH",
  "NIA",
  "NEI",
  "NIEHS",
  "NHGRI",
  "NIBIB",
  "NCATS",
  "NLM",
  "NCCIH",
  "NIMHD",
  "NINR",
  "NIAMS",
  "NIDCR",
  "NIDA",
  "NIDCD",
] as const;

function toggleMember(arr: string[], v: string, on: boolean): string[] {
  if (on) return arr.includes(v) ? arr : [...arr, v];
  return arr.filter((x) => x !== v);
}

/** Right → down chevron when <details> opens (styled in app-editorial.css). */
function FilterDisclosureChevron() {
  return (
    <svg
      className="fo-filter-summary-chevron h-4 w-4"
      viewBox="0 0 20 20"
      fill="currentColor"
      aria-hidden
    >
      <path
        fillRule="evenodd"
        d="M7.21 14.77a.75.75 0 01.02-1.06L11.168 10 7.23 6.29a.75.75 0 111.04-1.08l4.5 4.25a.75.75 0 010 1.08l-4.5 4.25a.75.75 0 01-1.06-.02z"
        clipRule="evenodd"
      />
    </svg>
  );
}

function FilterDisclosureSummary({
  editorial,
  children,
}: {
  editorial: boolean;
  children: React.ReactNode;
}) {
  return (
    <summary
      className={
        editorial
          ? "flex w-full min-w-0 items-center justify-between gap-2 [&::-webkit-details-marker]:hidden"
          : "flex w-full min-w-0 cursor-pointer list-none items-center justify-between gap-2 text-xs font-medium text-slate-700 [&::-webkit-details-marker]:hidden"
      }
    >
      <span className="min-w-0 flex-1 text-left leading-snug">{children}</span>
      <FilterDisclosureChevron />
    </summary>
  );
}

function chk(
  group: string,
  value: string,
  checked: boolean,
  onToggle: (on: boolean) => void,
  editorial: boolean
) {
  return (
    <label
      key={`${group}-${value}`}
      className={`flex cursor-pointer items-center gap-1.5 text-xs ${
        editorial ? "text-[var(--fo-ink)]" : "text-slate-800"
      }`}
    >
      <input type="checkbox" checked={checked} onChange={(e) => onToggle(e.target.checked)} className="shrink-0" />
      <span>{value}</span>
    </label>
  );
}

/** First row: checked when no specific filters; choosing it clears the group. */
function MultiGroupAnyRow({
  empty,
  onAny,
  editorial,
}: {
  empty: boolean;
  onAny: () => void;
  editorial: boolean;
}) {
  return (
    <label
      className={`mb-1 flex cursor-pointer items-center gap-2 text-xs ${
        editorial ? "text-[var(--fo-ink)]" : "text-slate-800"
      }`}
    >
      <input
        type="checkbox"
        checked={empty}
        readOnly={empty}
        onChange={(e) => {
          if (e.target.checked) onAny();
        }}
      />
      All
    </label>
  );
}

export function ResearchDevFiltersFields({
  scope,
  onScopeChange,
  rd,
  patchRd,
  departments,
  departmentSubs,
  legacyAgencies,
  toggleDepartment,
  toggleDepartmentSub,
  clearDepartmentFilter,
  noDepartmentFilter,
  editorial = false,
}: {
  scope: FundingListScope;
  onScopeChange: (next: FundingListScope) => void;
  rd: RdListFilterState;
  patchRd: (fn: (prev: RdListFilterState) => RdListFilterState) => void;
  departments: string[];
  departmentSubs: DepartmentSubsSelection;
  legacyAgencies: string[];
  toggleDepartment: (id: string, checked: boolean) => void;
  toggleDepartmentSub: (deptId: string, subId: string, checked: boolean) => void;
  clearDepartmentFilter: () => void;
  noDepartmentFilter: boolean;
  editorial?: boolean;
}) {
  const dBox = editorial
    ? "fo-filter-details fo-filter-disclosure"
    : "fo-filter-disclosure rounded-md border border-slate-200 bg-white px-2 py-1.5";
  const rowLab = editorial
    ? "flex cursor-pointer items-center gap-2 text-xs text-[var(--fo-ink)]"
    : "flex cursor-pointer items-center gap-2 text-xs text-slate-800";
  const sectionTop = editorial
    ? "space-y-4 border-t border-[var(--fo-divider)] pt-5"
    : "space-y-3 border-t border-slate-200 pt-3";
  /** Match `sortLabel` in `funding-opportunities-filters-panel.tsx` */
  const filterSectionLabel = editorial
    ? "block text-[0.65rem] font-bold uppercase tracking-[0.14em] text-[var(--fo-title)]"
    : "block text-slate-600";
  const upperMuted = editorial
    ? "text-[0.65rem] font-bold uppercase tracking-[0.08em] text-[var(--fo-ink-body)]"
    : "text-[0.65rem] font-medium uppercase text-slate-500";
  const selectCls = editorial ? "fo-filter-input" : "mt-2 w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm";

  return (
    <div className={sectionTop}>
      <div className={filterSectionLabel}>Filter</div>

      <details className={dBox}>
        <FilterDisclosureSummary editorial={editorial}>Opportunity scope</FilterDisclosureSummary>
        <select
          id="funding-scope"
          value={scope}
          onChange={(e) => onScopeChange(e.target.value as FundingListScope)}
          className={selectCls}
        >
          <option value="all">Open + forecasted (default)</option>
          <option value="any">All statuses</option>
          <option value="open">Open</option>
          <option value="forecasted">Forecasted</option>
          <option value="closed">Closed / past closed opportunities</option>
        </select>
      </details>

      <details className={dBox} open>
        <FilterDisclosureSummary editorial={editorial}>Department</FilterDisclosureSummary>
        <div className="mt-2 max-h-[min(58vh,28rem)] space-y-2 overflow-y-auto pr-0.5">
          <MultiGroupAnyRow
            empty={noDepartmentFilter}
            onAny={clearDepartmentFilter}
            editorial={editorial}
          />
          {legacyAgencies.length > 0 ? (
            <p
              className={
                editorial ? "text-[0.7rem] leading-snug text-[var(--fo-ink-muted)]" : "text-[0.7rem] text-slate-500"
              }
            >
              Legacy URL agency filters are active ({legacyAgencies.length} value
              {legacyAgencies.length === 1 ? "" : "s"}). Use &quot;All&quot; to clear and switch to departments.
            </p>
          ) : null}
          {TOP_LEVEL_DEPARTMENTS.map((d) => {
            const subs = getSubcomponentsForDepartment(d.id);
            const selected = departmentSubs[d.id] ?? [];
            return (
              <div key={d.id} className="space-y-1">
                <label className={rowLab}>
                  <input
                    type="checkbox"
                    checked={departments.includes(d.id)}
                    onChange={(e) => toggleDepartment(d.id, e.target.checked)}
                    className="shrink-0"
                  />
                  <span className="leading-snug">{d.label}</span>
                </label>
                {subs.length > 0 && departments.includes(d.id) ? (
                  <div
                    className={
                      editorial
                        ? "ml-3 space-y-1 border-l-2 border-[var(--fo-divider)] pl-3"
                        : "ml-3 space-y-1 border-l-2 border-slate-200 pl-3"
                    }
                  >
                    <div className={upperMuted}>
                      {d.id === "hhs" ? "HHS components" : "Subcategories"}
                    </div>
                    <div className="grid grid-cols-1 gap-1">
                      {subs.map((c) => (
                        <label key={c.id} className={rowLab}>
                          <input
                            type="checkbox"
                            checked={selected.includes(c.id)}
                            onChange={(e) => toggleDepartmentSub(d.id, c.id, e.target.checked)}
                            className="shrink-0"
                          />
                          <span className="leading-snug">{c.label}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </details>

      <details className={dBox}>
        <FilterDisclosureSummary editorial={editorial}>NIH institute / center</FilterDisclosureSummary>
        <div className="mt-2 max-h-40 space-y-1 overflow-y-auto">
          <MultiGroupAnyRow
            empty={rd.nihIc.length === 0}
            onAny={() => patchRd((p) => ({ ...p, nihIc: [] }))}
            editorial={editorial}
          />
          <div className="grid grid-cols-2 gap-1">
            {IC.map((v) =>
              chk("ic", v, rd.nihIc.includes(v), (on) =>
                patchRd((p) => ({ ...p, nihIc: toggleMember(p.nihIc, v, on) })),
                editorial
              )
            )}
          </div>
        </div>
      </details>

      <details className={dBox}>
        <FilterDisclosureSummary editorial={editorial}>Activity code family</FilterDisclosureSummary>
        <div className="mt-2 space-y-1">
          <MultiGroupAnyRow
            empty={rd.activityFamilies.length === 0}
            onAny={() => patchRd((p) => ({ ...p, activityFamilies: [] }))}
            editorial={editorial}
          />
          <div className="grid grid-cols-3 gap-1 sm:grid-cols-4">
            {ACT.map((v) =>
              chk("act", v, rd.activityFamilies.includes(v), (on) =>
                patchRd((p) => ({ ...p, activityFamilies: toggleMember(p.activityFamilies, v, on) })),
                editorial
              )
            )}
          </div>
        </div>
      </details>

      <details className={dBox}>
        <FilterDisclosureSummary editorial={editorial}>Clinical trial (text heuristic)</FilterDisclosureSummary>
        <select
          value={rd.clinicalTrialMode ?? ""}
          onChange={(e) => {
            const v = e.target.value;
            patchRd((p) => ({
              ...p,
              clinicalTrialMode: normalizeClinicalTrialQueryValue(v),
            }));
          }}
          className={selectCls}
        >
          <option value="">No filter</option>
          <option value="required">Required / must conduct</option>
          <option value="allowed">Allowed / permitted</option>
          <option value="not_allowed">Not allowed / non-clinical</option>
          <option value="unknown">Unknown / not detected</option>
        </select>
      </details>

      <details className={dBox}>
        <FilterDisclosureSummary editorial={editorial}>Announcement shape</FilterDisclosureSummary>
        <div className="mt-2 flex flex-col gap-1">
          <MultiGroupAnyRow
            empty={rd.announcement.length === 0}
            onAny={() => patchRd((p) => ({ ...p, announcement: [] }))}
            editorial={editorial}
          />
          {(
            [
              ["parent_notice", "Parent (PA-/PAR-)"],
              ["targeted_rfa", "Targeted (RFA-)"],
              ["nos", "Notice of special interest (NOT-)"],
              ["other", "Other NOFO id"],
              ["unknown", "Unknown / no id match"],
            ] as const
          ).map(([v, lab]) => (
            <label key={v} className={rowLab}>
              <input
                type="checkbox"
                checked={rd.announcement.includes(v)}
                onChange={(e) =>
                  patchRd((p) => ({
                    ...p,
                    announcement: toggleMember(p.announcement, v, e.target.checked),
                  }))
                }
              />
              {lab}
            </label>
          ))}
        </div>
      </details>

      <details className={dBox}>
        <FilterDisclosureSummary editorial={editorial}>Research pathway (keyword)</FilterDisclosureSummary>
        <div className="mt-2 flex flex-col gap-1">
          <MultiGroupAnyRow
            empty={rd.pathway.length === 0}
            onAny={() => patchRd((p) => ({ ...p, pathway: [] }))}
            editorial={editorial}
          />
          {(
            [
              ["basic", "Basic / mechanistic"],
              ["translational", "Translational"],
              ["clinical", "Clinical / trials"],
              ["population", "Population / epidemiology"],
              ["health_services", "Health services / implementation"],
              ["computational", "Computational / data science"],
              ["mixed", "Mixed / tied signals"],
              ["unknown", "Unknown"],
            ] as const
          ).map(([v, lab]) => (
            <label key={v} className={rowLab}>
              <input
                type="checkbox"
                checked={rd.pathway.includes(v)}
                onChange={(e) =>
                  patchRd((p) => ({
                    ...p,
                    pathway: toggleMember(p.pathway, v, e.target.checked),
                  }))
                }
              />
              {lab}
            </label>
          ))}
        </div>
      </details>

      <details className={dBox}>
        <FilterDisclosureSummary editorial={editorial}>
          Investigator eligibility language
        </FilterDisclosureSummary>
        <div className="mt-2 flex flex-col gap-1">
          <MultiGroupAnyRow
            empty={rd.investigatorTags.length === 0}
            onAny={() => patchRd((p) => ({ ...p, investigatorTags: [] }))}
            editorial={editorial}
          />
          {(
            [
              ["early_stage_investigator", "Early-stage investigator (ESI)"],
              ["new_investigator", "New / first-time PD/PI"],
              ["established_pi", "Established PD/PI"],
              ["career_stage", "Career development / mentored"],
            ] as const
          ).map(([v, lab]) => (
            <label key={v} className={rowLab}>
              <input
                type="checkbox"
                checked={rd.investigatorTags.includes(v)}
                onChange={(e) =>
                  patchRd((p) => ({
                    ...p,
                    investigatorTags: toggleMember(p.investigatorTags, v, e.target.checked),
                  }))
                }
              />
              {lab}
            </label>
          ))}
        </div>
      </details>

      <details className={dBox}>
        <FilterDisclosureSummary editorial={editorial}>Mechanism & collaboration</FilterDisclosureSummary>
        <div className="mt-2 space-y-2">
          <div className={upperMuted}>Mechanism</div>
          <div className="flex flex-col gap-1">
            <MultiGroupAnyRow
              empty={rd.mechanismTypes.length === 0}
              onAny={() => patchRd((p) => ({ ...p, mechanismTypes: [] }))}
              editorial={editorial}
            />
            {(
              [
                ["small_grant", "Small / pilot"],
                ["large_grant", "Large / R01-class"],
                ["center_like", "Center / program / hub"],
                ["training", "Training / career (K, T, F)"],
                ["unknown", "Unknown"],
              ] as const
            ).map(([v, lab]) => (
              <label key={v} className={rowLab}>
                <input
                  type="checkbox"
                  checked={rd.mechanismTypes.includes(v)}
                  onChange={(e) =>
                    patchRd((p) => ({
                      ...p,
                      mechanismTypes: toggleMember(p.mechanismTypes, v, e.target.checked),
                    }))
                  }
                />
                {lab}
              </label>
            ))}
          </div>
          <div className={upperMuted}>Collaboration</div>
          <div className="flex flex-col gap-1">
            <MultiGroupAnyRow
              empty={rd.collaborations.length === 0}
              onAny={() => patchRd((p) => ({ ...p, collaborations: [] }))}
              editorial={editorial}
            />
            {(
              [
                ["single_pi", "Single PI"],
                ["multi_pi", "Multi-PI / team"],
                ["center_like", "Consortium / center-like"],
                ["unknown", "Unknown"],
              ] as const
            ).map(([v, lab]) => (
              <label key={v} className={rowLab}>
                <input
                  type="checkbox"
                  checked={rd.collaborations.includes(v)}
                  onChange={(e) =>
                    patchRd((p) => ({
                      ...p,
                      collaborations: toggleMember(p.collaborations, v, e.target.checked),
                    }))
                  }
                />
                {lab}
              </label>
            ))}
          </div>
        </div>
      </details>

      <details className={dBox}>
        <FilterDisclosureSummary editorial={editorial}>Human subjects signal</FilterDisclosureSummary>
        <div className="mt-2 flex flex-col gap-1">
          <MultiGroupAnyRow
            empty={rd.humanSubjects.length === 0}
            onAny={() => patchRd((p) => ({ ...p, humanSubjects: [] }))}
            editorial={editorial}
          />
          {(
            [
              ["true", "Likely human subjects"],
              ["false", "Likely not"],
              ["unknown", "Unknown"],
            ] as const
          ).map(([v, lab]) => (
            <label key={v} className={rowLab}>
              <input
                type="checkbox"
                checked={rd.humanSubjects.includes(v)}
                onChange={(e) =>
                  patchRd((p) => ({
                    ...p,
                    humanSubjects: toggleMember(p.humanSubjects, v, e.target.checked),
                  }))
                }
              />
              {lab}
            </label>
          ))}
        </div>
      </details>
    </div>
  );
}
