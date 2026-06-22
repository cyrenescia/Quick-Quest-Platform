import { useEffect, useState } from "react";
import { Surface } from "../../../../home.ui";
import { fetchMetricLedger, fetchMetricSummary } from "./metric-center.service";
import type { MetricLedgerVM, MetricSummaryVM } from "./metric-center";

export function MetricCenterPage({ onBack }: { onBack: () => void }) {
  const [summary, setSummary] = useState<MetricSummaryVM | null>(null);
  const [ledger, setLedger] = useState<MetricLedgerVM[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchMetricSummary().then((res) => {
      if (res) {
        setSummary({
          runnerTier: res.runner_tier || "Q1",
          runnerPP: res.runner_pp || 0,
          runnerSR: res.runner_sr || 0,
          topSkill: res.stats?.top_skill_scope || "-",
        });
      }
    });
  }, []);

  useEffect(() => {
    setIsLoading(true);
    fetchMetricLedger(page, 10).then((res) => {
      if (res && res.items) {
        setLedger(
          res.items.map((item: any) => ({
            id: item.id || String(Math.random()),
            questId: item.quest_id || "-",
            skillScope: item.skill_scope || "General",
            basePP: item.base_pp || 0,
            multiplier: item.tier_multiplier || 1,
            bonus: item.challenge_bonus || 1,
            decay: item.decay_factor || 1,
            finalPP: item.final_pp_delta || 0,
            createdAt: item.created_at ? new Date(item.created_at).toLocaleDateString() : "-",
          }))
        );
        setTotalPages(res.total_pages || 1);
      }
      setIsLoading(false);
    }).catch(() => setIsLoading(false));
  }, [page]);

  return (
    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-300">
      <Surface className="p-5 sm:p-6 border border-base-300">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary/70">
              Metric Center
            </p>
            <h2 className="mt-1 text-xl font-bold text-base-content">
              Pusat Data Performa
            </h2>
          </div>
          <button
            type="button"
            onClick={onBack}
            className="btn h-10 min-h-10 rounded-[10px] border-none bg-base-200 px-5 text-sm font-bold text-base-content/70 shadow-none hover:bg-base-300 transition-colors"
          >
            Kembali
          </button>
        </div>
      </Surface>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Surface className="p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-base-content/50">Total PP</p>
          <p className="mt-1 text-2xl font-bold text-primary">{summary?.runnerPP ?? "-"}</p>
        </Surface>
        <Surface className="p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-base-content/50">Success Rate</p>
          <p className="mt-1 text-2xl font-bold text-base-content">{summary?.runnerSR ?? "-"}%</p>
        </Surface>
        <Surface className="p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-base-content/50">Runner Tier</p>
          <p className="mt-1 text-2xl font-bold text-base-content">{summary?.runnerTier ?? "-"}</p>
        </Surface>
        <Surface className="p-4">
          <p className="text-xs font-semibold uppercase tracking-wider text-base-content/50">Top Skill</p>
          <p className="mt-1 text-2xl font-bold text-base-content">{summary?.topSkill ?? "-"}</p>
        </Surface>
      </div>

      <Surface className="p-4 sm:p-5">
        <h3 className="text-lg font-bold text-base-content mb-4">PP Ledger History</h3>
        
        {isLoading ? (
          <div className="p-8 text-center text-sm text-base-content/50">Loading ledger...</div>
        ) : ledger.length === 0 ? (
          <div className="p-8 text-center text-sm text-base-content/50">Belum ada riwayat PP.</div>
        ) : (
          <div className="space-y-3">
            {ledger.map((entry) => (
              <div key={entry.id} className="rounded-[10px] border border-base-300/70 bg-base-100 p-4 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-base-content/60">{entry.questId}</span>
                  <span className="text-xs font-medium text-base-content/50">{entry.createdAt}</span>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold text-base-content">{entry.skillScope}</p>
                    <p className="text-[11px] text-base-content/60 mt-0.5">
                      Base: {entry.basePP} × Mult: {entry.multiplier} × Bonus: {entry.bonus} × Decay: {entry.decay}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold text-success">+{entry.finalPP.toFixed(1)} PP</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="mt-5 flex items-center justify-between">
          <button
            type="button"
            disabled={page <= 1}
            onClick={() => setPage(p => p - 1)}
            className="btn btn-sm"
          >
            Prev
          </button>
          <span className="text-xs font-semibold text-base-content/70">
            Page {page} dari {totalPages}
          </span>
          <button
            type="button"
            disabled={page >= totalPages}
            onClick={() => setPage(p => p + 1)}
            className="btn btn-sm"
          >
            Next
          </button>
        </div>
      </Surface>
    </div>
  );
}
