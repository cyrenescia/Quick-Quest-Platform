import { useEffect, useState } from "react";
import { cn, Surface } from "../../../../home.ui";
import { RunnerQuestFeedDetailPage } from "./feed-detail/feed-detail.tsx";
import {
  canTakeQuestFromFeed,
  resolveInitialRunnerQuestFeedSubView,
  resolveQuestFeedActionLabel,
  resolveQuestFeedMatchReason,
  resolveQuestFeedModeClass,
  syncRunnerQuestFeedSubViewStorage,
  useRunnerQuestFeedVM,
  type RunnerQuestFeedSubView,
} from "./quest-feed";

export function RunnerQuestFeedPage({
  onBack,
  onOpenActiveQuest,
}: {
  onBack: () => void;
  onOpenActiveQuest: () => void;
  onOpenPartyLobby: (partyId: string) => void;
}) {
  const vm = useRunnerQuestFeedVM();
  const [subView, setSubView] = useState<RunnerQuestFeedSubView>(
    resolveInitialRunnerQuestFeedSubView,
  );

  useEffect(() => {
    syncRunnerQuestFeedSubViewStorage(subView);
  }, [subView]);

  if (subView?.view === "Detail") {
    return (
      <RunnerQuestFeedDetailPage
        questId={subView.questId}
        onBack={() => setSubView(null)}
        onTakeQuest={async () => {
          await vm.takeQuest(subView.questId);
          onOpenActiveQuest();
        }}
        onJoinPartyLobby={async () => {
          await vm.takeQuest(subView.questId);
          onOpenActiveQuest();
        }}
      />
    );
  }

  return (
    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-300">
      <Surface className="p-5 sm:p-6 border border-base-300">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary/70">
              Runner Quest Feed
            </p>
            <h2 className="mt-1 text-xl font-bold text-base-content">
              Semua Quest terbuka untuk runner
            </h2>
            {vm.isLoading ? (
              <p className="mt-1 text-xs font-semibold text-primary">Sinkronisasi feed quest...</p>
            ) : vm.errorMessage ? (
              <p className="mt-1 text-xs font-semibold text-warning">Mode fallback seed: {vm.errorMessage}</p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onBack}
            className="btn h-10 min-h-10 rounded-[10px] border-none bg-base-200 px-5 text-sm font-bold text-base-content/70 shadow-none"
          >
            Kembali
          </button>
        </div>
      </Surface>

      <div className="grid gap-4 xl:grid-cols-2">
        {vm.quests.map((quest) => (
          <Surface key={quest.id} className="p-4 sm:p-5 border border-base-300/70">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-base-content/50">
                  {quest.id}
                </p>
                <h3 className="mt-1 text-base font-bold text-base-content">
                  {quest.title}
                </h3>
                <p className="text-xs text-base-content/60">
                  {quest.giver} • {quest.locationLabel}
                </p>
              </div>
              <div className="flex flex-col items-end gap-1.5">
                <span
                  className={cn(
                    "rounded-[8px] px-2 py-0.5 text-[11px] font-semibold",
                    resolveQuestFeedModeClass(quest.mode),
                  )}
                >
                  {quest.mode}
                </span>
                <span className="rounded-[8px] bg-success/10 px-2 py-0.5 text-[11px] font-bold text-success">
                  {quest.reward}
                </span>
              </div>
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              <span className="rounded-[8px] bg-base-200 px-2 py-1 text-[11px] font-semibold text-base-content/70">
                {quest.category}
              </span>
              <span className="rounded-[8px] bg-base-200 px-2 py-1 text-[11px] font-semibold text-base-content/70">
                {quest.distanceKm} km
              </span>
              <span className="rounded-[8px] bg-info/10 px-2 py-1 text-[11px] font-semibold text-info">
                Radius {quest.activeRadiusKm ?? Math.max(1, quest.distanceKm)} km
              </span>
              <span className="rounded-[8px] bg-base-200 px-2 py-1 text-[11px] font-semibold text-base-content/70">
                Match {quest.matchScore}%
              </span>
              {quest.mode === "group" ? (
                <span className="rounded-[8px] bg-base-200 px-2 py-1 text-[11px] font-semibold text-base-content/70">
                  Slot {quest.slotFilled}/{quest.slotTotal}
                </span>
              ) : null}
            </div>

            <p className="mt-3 text-sm text-base-content/70">
              {quest.briefSummary}
            </p>
            <div className="mt-3 rounded-[10px] border border-info/20 bg-info/5 px-3 py-2">
              <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-info/80">
                Alasan Match
              </p>
              <p className="mt-1 text-xs leading-relaxed text-base-content/70">
                {resolveQuestFeedMatchReason(quest)}
              </p>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setSubView({ view: "Detail", questId: quest.id })}
                className="btn h-10 min-h-10 rounded-[10px] border-none bg-base-200 px-5 text-sm font-bold text-base-content/80 shadow-none hover:bg-base-300"
              >
                Lihat Detail
              </button>

              {quest.mode === "group" ? (
                <button
                  type="button"
                  onClick={() =>
                    void vm.takeQuest(quest.id).then(onOpenActiveQuest)
                  }
                  disabled={vm.actionQuestId === quest.id || !canTakeQuestFromFeed(quest)}
                  className="btn h-10 min-h-10 rounded-[10px] border-none bg-secondary px-5 text-sm font-bold text-secondary-content"
                >
                  {resolveQuestFeedActionLabel(quest, vm.actionQuestId === quest.id)}
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => void vm.takeQuest(quest.id).then(onOpenActiveQuest)}
                  disabled={vm.actionQuestId === quest.id || !canTakeQuestFromFeed(quest)}
                  className="btn h-10 min-h-10 rounded-[10px] border-none bg-primary px-5 text-sm font-bold text-primary-content"
                >
                  {resolveQuestFeedActionLabel(quest, vm.actionQuestId === quest.id)}
                </button>
              )}
            </div>
          </Surface>
        ))}
      </div>
    </div>
  );
}
