import { useEffect, useState } from "react";
import { Surface } from "../../../../home.ui";
import RatingModal from "../../../../component/rating/rating-modal.tsx";
import type { RatingTarget } from "../../../../component/rating/rating-modal";
import { fetchRunnerHistoryRatings } from "./history.service";

export function RunnerHistoryPage({ onBack }: { onBack: () => void }) {
  const [ratingTarget, setRatingTarget] = useState<RatingTarget | null>(null);
  const [ratings, setRatings] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchRunnerHistoryRatings().then((res) => {
      if (res && res.items) {
        setRatings(res.items);
      }
      setIsLoading(false);
    }).catch(() => setIsLoading(false));
  }, []);

  return (
    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-300">
      <Surface className="p-5 sm:p-6 border border-base-300">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary/70">
              Riwayat Quest
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

      {isLoading ? (
        <Surface className="p-8 text-center text-sm text-base-content/50">
          Loading history...
        </Surface>
      ) : ratings.length === 0 ? (
        <Surface className="p-8 text-center text-sm text-base-content/50">
          Belum ada riwayat rating.
        </Surface>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {ratings.map((item) => (
            <div
              key={item.id || Math.random()}
              className="group relative overflow-hidden rounded-[14px] border border-base-300/50 bg-base-100/40 p-5 shadow-sm backdrop-blur-xl transition-all duration-300 hover:-translate-y-1 hover:border-primary/30 hover:shadow-lg"
            >
              <div className="mb-3 flex items-start justify-between gap-2">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-base-content/50">
                    {item.quest_id || "-"}
                  </p>
                  <p className="mt-1 font-bold text-base-content line-clamp-1">
                    {item.quest_title || `Quest: ${item.quest_id || "Unknown"}`}
                  </p>
                </div>
                <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-[10px] font-bold text-primary">
                  {item.quest_tier || "Q1"}
                </span>
              </div>

              <div className="mt-4 flex flex-col gap-1 text-xs text-base-content/70">
                <p>Role Rater: <span className="font-semibold text-base-content">{item.rater_role || "-"}</span></p>
                <p>Score: <span className="font-bold text-warning">★ {item.rating_score || 0}</span></p>
                {item.pp_delta && (
                  <p>PP: <span className="font-bold text-success">+{item.pp_delta} PP</span></p>
                )}
                {item.rating_note && (
                  <p className="mt-2 rounded bg-base-200 p-2 italic">"{item.rating_note}"</p>
                )}
              </div>

              <div className="mt-4 border-t border-base-300/50 pt-4 text-[10px] font-medium text-base-content/50">
                {item.created_at ? new Date(item.created_at).toLocaleDateString() : "-"}
              </div>
            </div>
          ))}
        </div>
      )}

      {ratingTarget && (
        <RatingModal
          isOpen={true}
          target={ratingTarget}
          onClose={() => setRatingTarget(null)}
          onSubmit={() => {
            fetchRunnerHistoryRatings().then((res) => {
              if (res && res.items) setRatings(res.items);
            });
          }}
        />
      )}
    </div>
  );
}
