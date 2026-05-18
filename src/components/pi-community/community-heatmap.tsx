"use client";

import type { HeatmapGrid } from "@/lib/community/community-snapshot-builders";

function cellColor(value: number, max: number): string {
  if (value <= 0) return "rgb(241 245 249)"; // slate-100
  const t = Math.min(1, value / max);
  const r = Math.round(239 - t * 120);
  const g = Math.round(246 - t * 80);
  const b = Math.round(255 - t * 40);
  return `rgb(${r} ${g} ${b})`;
}

export function CommunityHeatmap({
  title,
  description,
  rowAxisLabel,
  colAxisLabel,
  grid,
  emptyMessage,
}: {
  title: string;
  description?: string;
  rowAxisLabel: string;
  colAxisLabel: string;
  grid: HeatmapGrid;
  emptyMessage: string;
}) {
  const hasData = grid.rowLabels.length > 0 && grid.colLabels.length > 0 && grid.max > 0;

  if (!hasData) {
    return (
      <div className="rounded-lg border border-slate-200 bg-white p-4">
        <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
        {description ? <p className="mt-1 text-xs text-slate-600">{description}</p> : null}
        <p className="mt-3 text-sm text-slate-500">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white p-4">
      <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
      {description ? <p className="mt-1 text-xs text-slate-600">{description}</p> : null}
      <div className="mt-3 overflow-x-auto">
        <table className="min-w-max border-collapse text-xs">
          <thead>
            <tr>
              <th className="sticky left-0 z-10 bg-white px-1 py-1 text-left font-medium text-slate-500">
                {rowAxisLabel} × {colAxisLabel}
              </th>
              {grid.colLabels.map((c) => (
                <th
                  key={c}
                  className="max-w-[7rem] px-1 py-1 text-center font-medium leading-tight text-slate-700"
                  title={c}
                >
                  <span className="line-clamp-3">{c}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {grid.rowLabels.map((row, ri) => (
              <tr key={row}>
                <th
                  className="sticky left-0 z-10 max-w-[10rem] bg-white px-1 py-0.5 text-left font-normal text-slate-800"
                  title={row}
                >
                  <span className="line-clamp-2">{row}</span>
                </th>
                {grid.colLabels.map((_, ci) => {
                  const v = grid.values[ri]?.[ci] ?? 0;
                  return (
                    <td
                      key={`${ri}-${ci}`}
                      className="border border-slate-100 px-0 py-0 text-center tabular-nums text-slate-800"
                      style={{ backgroundColor: cellColor(v, grid.max) }}
                      title={`${row} × ${grid.colLabels[ci]}: ${v}`}
                    >
                      <span className="inline-block min-w-[1.75rem] py-1">{v}</span>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-[11px] text-slate-500">
        Darker cells = higher counts. Matrix is limited to top rows/columns by volume.
      </p>
    </div>
  );
}
