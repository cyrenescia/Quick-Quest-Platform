import { useState } from "react";
import { Surface } from "../../../../home.ui";
import { questHistoryRows } from "../../../recent/recent.service";
import RatingModal from "../../../../component/rating/rating-modal.tsx";
import type { RatingTarget } from "../../../../component/rating/rating-modal";

export function GiverHistoryPage({ onBack }: { onBack: () => void }) {
  const [ratingTarget, setRatingTarget] = useState<RatingTarget | null>(null);
  const [historyItems, setHistoryItems] = useState(questHistoryRows.filter(r => r.status === "Completed" || r.status === "Pending Confirmation"));

  return (
    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-300">
      <Surface className="p-5 sm:p-6 border border-base-300">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary/70">
              Riwayat Publikasi
            </p>
            <h2 className="mt-1 text-xl font-bold text-base-content">
              Daftar Quest yang Telah Selesai
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

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {historyItems.map((item, index) => {
          const isUnrated = index % 2 === 1; // Simulate some unrated quests for UI demo
          return (
            <div
              key={item.questId}
              className="group relative overflow-hidden rounded-[14px] border border-base-300/50 bg-base-100/40 p-5 shadow-sm backdrop-blur-xl transition-all duration-300 hover:-translate-y-1 hover:border-primary/30 hover:shadow-lg"
            >
              <div className="mb-3 flex items-start justify-between gap-2">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-base-content/50">
                    {item.questId}
                  </p>
                  <p className="mt-1 font-bold text-base-content line-clamp-1">
                    {item.title}
                  </p>
                  <p className="text-xs text-base-content/60">{item.category}</p>
                </div>
                <span className="rounded-full bg-success/10 px-2.5 py-0.5 text-[10px] font-bold text-success">
                  {item.status}
                </span>
              </div>

              <div className="mt-4 flex items-center justify-between text-xs font-semibold text-base-content/60">
                <span>{item.updatedAt}</span>
                <span className="text-primary">{item.progress}</span>
              </div>

              {/* Beri Rating Trigger */}
              <div className="mt-4 border-t border-base-300/50 pt-4">
                {isUnrated ? (
                  <button
                    type="button"
                    onClick={() =>
                      setRatingTarget({
                        name: "Runner User",
                        role: "runner",
                        questTitle: item.title,
                        questId: item.questId,
                        assignmentId: "ASSIGN-" + item.questId,
                      })
                    }
                    className="btn h-9 min-h-9 w-full rounded-[8px] border-none bg-primary text-xs font-bold text-primary-content shadow-none transition-transform active:scale-95 hover:bg-primary/90"
                  >
                    Beri Rating Runner
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled
                    className="btn h-9 min-h-9 w-full rounded-[8px] border-none bg-base-200 text-xs font-bold text-base-content/50 shadow-none"
                  >
                    Telah Dinilai
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {ratingTarget && (
        <RatingModal
          isOpen={true}
          target={ratingTarget}
          onClose={() => setRatingTarget(null)}
          onSubmit={() => {
            setHistoryItems(prev => prev.map(p => p));
          }}
        />
      )}
    </div>
  );
}
