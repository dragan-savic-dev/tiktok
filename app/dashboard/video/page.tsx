"use client";

import { useMemo, useState, type ComponentType, type SVGProps } from "react";
import type { VideoStats } from "@/lib/types";
import { Card } from "@/app/components/card";
import {
  CommentIcon,
  EyeIcon,
  HeartIcon,
  ShareIcon,
  TrendUpIcon,
} from "@/app/components/icons";
import { useValueFlash } from "@/app/components/use-value-flash";
import { videoEngagement, videoTitle } from "@/lib/metrics";
import { useStats } from "../stats-context";
import { ErrorBanner, Loading } from "../shared";

type SortKey = "recent" | "views" | "likes" | "comments" | "shares" | "engagement";

interface Column {
  key: SortKey;
  label: string;
  pick: (v: VideoStats) => number;
  icon: ComponentType<SVGProps<SVGSVGElement>>;
  iconClass: string;
}

const COLUMNS: Column[] = [
  { key: "views", label: "Visual.", pick: (v) => v.view_count ?? 0, icon: EyeIcon, iconClass: "text-tt-cyan" },
  { key: "likes", label: "Mi piace", pick: (v) => v.like_count ?? 0, icon: HeartIcon, iconClass: "text-tt-pink" },
  { key: "comments", label: "Commenti", pick: (v) => v.comment_count ?? 0, icon: CommentIcon, iconClass: "text-tt-cyan" },
  { key: "shares", label: "Condiv.", pick: (v) => v.share_count ?? 0, icon: ShareIcon, iconClass: "text-tt-pink" },
  { key: "engagement", label: "Interaz.", pick: videoEngagement, icon: TrendUpIcon, iconClass: "text-tt-cyan" },
];

const PAGE_SIZE = 20;

function fmt(n: number): string {
  return n.toLocaleString("it-IT");
}

/**
 * Cella numerica: testo bianco di base; alla variazione lampeggia verde (su) o
 * rosso (giù) per ~1s, poi torna bianco. Nessuna freccia, come in Panoramica.
 */
function ValueCell({ value }: { value: number }) {
  const dir = useValueFlash(value);
  const color =
    dir === "up" ? "text-emerald-400" : dir === "down" ? "text-tt-pink" : "text-white";
  return (
    <td className={`px-3 py-2 text-right tabular-nums transition-colors duration-300 ${color}`}>
      {fmt(value)}
    </td>
  );
}

export default function VideoPage() {
  const { stats, error } = useStats();
  const [sortKey, setSortKey] = useState<SortKey>("recent");
  const [sortDesc, setSortDesc] = useState(true);
  const [page, setPage] = useState(0);

  const videos = useMemo(() => stats?.videos ?? [], [stats]);

  const sorted = useMemo(() => {
    if (sortKey === "recent") {
      // I video arrivano già dal più recente: "asc" inverte in più vecchio.
      return sortDesc ? videos : [...videos].reverse();
    }
    const col = COLUMNS.find((c) => c.key === sortKey)!;
    const arr = [...videos].sort((a, b) => col.pick(b) - col.pick(a));
    return sortDesc ? arr : arr.reverse();
  }, [videos, sortKey, sortDesc]);

  if (!stats) {
    return (
      <>
        {error && <ErrorBanner message={error} />}
        <Loading />
      </>
    );
  }

  const pageCount = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const current = Math.min(page, pageCount - 1);
  const rows = sorted.slice(current * PAGE_SIZE, current * PAGE_SIZE + PAGE_SIZE);

  const toggleSort = (key: SortKey) => {
    if (key === sortKey) {
      setSortDesc((d) => !d);
    } else {
      setSortKey(key);
      setSortDesc(true);
    }
    setPage(0);
  };

  const sortArrow = (key: SortKey) => (sortKey === key ? (sortDesc ? " ↓" : " ↑") : "");

  return (
    <div className="flex h-full flex-col gap-5">
      {error && <ErrorBanner message={error} />}

      <Card
        title={`Tutti i video (${fmt(videos.length)})`}
        className="min-h-0 flex-1"
        bodyClassName="flex min-h-0 flex-col p-0 sm:p-0"
      >
        <div className="min-h-0 flex-1 overflow-auto">
          <table className="w-full min-w-[640px] select-none text-sm">
            <thead>
              <tr className="text-left text-[11px] uppercase tracking-wider text-zinc-500">
                <th className="sticky top-0 z-10 border-b border-white/5 bg-[#0c0c0c] px-4 py-2.5 font-medium sm:px-5">
                  <button onClick={() => toggleSort("recent")} className="hover:text-white">
                    Video{sortArrow("recent")}
                  </button>
                </th>
                {COLUMNS.map((c) => {
                  const Icon = c.icon;
                  return (
                    <th
                      key={c.key}
                      className="sticky top-0 z-10 border-b border-white/5 bg-[#0c0c0c] px-3 py-2.5 text-right font-medium"
                    >
                      <button
                        onClick={() => toggleSort(c.key)}
                        className="inline-flex items-center gap-1.5 hover:text-white"
                      >
                        <Icon className={`h-3.5 w-3.5 ${c.iconClass}`} />
                        <span>
                          {c.label}
                          {sortArrow(c.key)}
                        </span>
                      </button>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {rows.map((v, i) => {
                const rate = v.view_count ? videoEngagement(v) / v.view_count : 0;
                return (
                  <tr key={v.id} className="transition-colors hover:bg-white/[0.02]">
                    <td className="px-4 py-2 sm:px-5">
                      <div className="flex items-center gap-3">
                        <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-white/5 text-xs font-semibold text-zinc-400">
                          {current * PAGE_SIZE + i + 1}
                        </span>
                        <div className="min-w-0">
                          {v.share_url ? (
                            <a
                              href={v.share_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="block max-w-[240px] truncate font-medium text-white hover:text-tt-cyan"
                              title={videoTitle(v)}
                            >
                              {videoTitle(v)}
                            </a>
                          ) : (
                            <span className="block max-w-[240px] truncate font-medium text-white">
                              {videoTitle(v)}
                            </span>
                          )}
                          <p className="flex items-center gap-1 text-xs text-zinc-500">
                            <EyeIcon className="h-3 w-3" />
                            {(rate * 100).toLocaleString("it-IT", {
                              maximumFractionDigits: 1,
                            })}
                            % engagement
                          </p>
                        </div>
                      </div>
                    </td>
                    <ValueCell value={v.view_count ?? 0} />
                    <ValueCell value={v.like_count ?? 0} />
                    <ValueCell value={v.comment_count ?? 0} />
                    <ValueCell value={v.share_count ?? 0} />
                    <ValueCell value={videoEngagement(v)} />
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {pageCount > 1 && (
          <div className="flex shrink-0 items-center justify-between gap-2 border-t border-white/5 px-4 py-3 sm:px-5">
            <button
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={current === 0}
              className="rounded-lg px-3 py-1.5 text-xs font-medium text-zinc-400 transition-colors hover:bg-white/5 hover:text-white disabled:opacity-30 disabled:hover:bg-transparent"
            >
              ← Prec
            </button>
            <span className="text-xs text-zinc-500">
              Pagina {current + 1} di {pageCount}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
              disabled={current >= pageCount - 1}
              className="rounded-lg px-3 py-1.5 text-xs font-medium text-zinc-400 transition-colors hover:bg-white/5 hover:text-white disabled:opacity-30 disabled:hover:bg-transparent"
            >
              Succ →
            </button>
          </div>
        )}
      </Card>
    </div>
  );
}
