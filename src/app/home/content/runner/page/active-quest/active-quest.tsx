import { useEffect, useState } from "react";
import { cn, Surface } from "../../../../home.ui";
import {
  createInitialRunnerCountdown,
  createInitialRunnerWorkState,
  fetchRunnerActiveQuestLive,
  finishRunnerActiveQuestLive,
  formatRunnerCountdown,
  getRunnerActiveQuestSeed,
  resolveRunnerActiveQuestEscrowClass,
  resolveRunnerAutoReleaseUrgency,
  resolveRunnerEscrowFlowIndex,
  startRunnerActiveQuestLive,
  tickRunnerCountdown,
} from "./active-quest";
import RatingModal from "../../../../component/rating/rating-modal.tsx";
import type { RatingTarget } from "../../../../component/rating/rating-modal";

export function RunnerActiveQuestPage({ onBack }: { onBack: () => void }) {
  const [quests, setQuests] = useState(() => getRunnerActiveQuestSeed().quests);
  const vm = { quests, escrowFlow: getRunnerActiveQuestSeed().escrowFlow };
  const [workState, setWorkState] = useState(() =>
    createInitialRunnerWorkState(vm.quests),
  );
  const [countdown, setCountdown] = useState(() =>
    createInitialRunnerCountdown(vm.quests),
  );
  const [actionQuestId, setActionQuestId] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [ratingTarget, setRatingTarget] = useState<RatingTarget | null>(null);

  const refreshActiveQuests = (isMounted?: () => boolean) =>
    fetchRunnerActiveQuestLive().then((items) => {
      if (items.length === 0 || isMounted?.() === false) return items;
      setQuests(items);
      setWorkState(createInitialRunnerWorkState(items));
      setCountdown(createInitialRunnerCountdown(items));
      return items;
    });

  useEffect(() => {
    let mounted = true;
    refreshActiveQuests(() => mounted)
      .catch((error) =>
        setErrorMessage(error instanceof Error ? error.message : "Gagal hydrate active quest."),
      );
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setCountdown((prev) => tickRunnerCountdown(prev));
    }, 1000);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-300">
      <Surface className="p-5 sm:p-6 border border-base-300">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary/70">
              Runner Active Quest
            </p>
            <h2 className="mt-1 text-xl font-bold text-base-content">
              Pantau, mulai, dan selesaikan quest aktif
            </h2>
            {errorMessage ? (
              <p className="mt-1 text-xs font-semibold text-warning">Mode fallback seed: {errorMessage}</p>
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
        {vm.quests.map((quest) => {
          const state = workState[quest.id];
          const secs = countdown[quest.id];
          const urgency = resolveRunnerAutoReleaseUrgency(secs);
          const isPendingVerification = state === "finished" && quest.escrowState === "PENDING_CONFIRMATION";
          const isEscrowReleased = quest.escrowState === "RELEASED";
          const isWaitingGiverConfirmation = quest.status === "PENDING_GIVER_CONFIRMATION";
          const isWaitingLocationShare =
            !quest.locationSharedAt && quest.status === "HEADING_TO_LOCATION";
          const escrowIndex = resolveRunnerEscrowFlowIndex(
            vm.escrowFlow,
            quest.escrowState,
          );

          return (
            <Surface key={quest.id} className="p-4 sm:p-5 border border-base-300/70">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-base-content/50">
                    {quest.id}
                  </p>
                  <h3 className="mt-1 text-base font-bold text-base-content">
                    {quest.questTitle}
                  </h3>
                  <p className="text-xs text-base-content/60">
                    {quest.giverName}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-1.5">
                  <span
                    className={cn(
                      "rounded-[8px] px-2 py-1 text-[11px] font-bold",
                      resolveRunnerActiveQuestEscrowClass(quest.escrowState),
                    )}
                  >
                    {quest.escrowState}
                  </span>
                  <span className="rounded-[8px] bg-success/10 px-2 py-0.5 text-[11px] font-bold text-success">
                    {quest.reward}
                  </span>
                  {isWaitingGiverConfirmation ? (
                    <span className="rounded-[8px] bg-warning/10 px-2 py-0.5 text-[11px] font-bold text-warning">
                      Menunggu Giver
                    </span>
                  ) : null}
                </div>
              </div>

              <div className="mt-3 flex gap-1">
                {vm.escrowFlow.map((step, index) => (
                  <div
                    key={step}
                    className={cn(
                      "flex-1 rounded-[6px] py-1 text-center text-[9px] font-bold tracking-wide",
                      index < escrowIndex
                        ? "bg-success text-success-content"
                        : index === escrowIndex
                          ? "bg-primary text-primary-content"
                          : "bg-base-200 text-base-content/40",
                    )}
                  >
                    {step.replace("_", " ")}
                  </div>
                ))}
              </div>

              <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                <div className="rounded-[9px] border border-base-300/70 bg-base-200/40 p-2">
                  <p className="text-[10px] font-semibold text-base-content/55 uppercase">
                    PP Gain
                  </p>
                  <p className="mt-0.5 font-bold text-primary">{quest.ppGain}</p>
                </div>
                <div
                  className={cn(
                    "rounded-[9px] border p-2",
                    urgency
                      ? "border-error/40 bg-error/5"
                      : "border-warning/30 bg-warning/10",
                  )}
                >
                  <p className="text-[10px] font-semibold uppercase text-base-content/70">
                    Auto-Release
                  </p>
                  <p className="mt-0.5 font-mono font-bold tracking-wider text-base-content">
                    {isWaitingGiverConfirmation ? "--:--:--" : formatRunnerCountdown(secs)}
                  </p>
                </div>
              </div>

              <div className="mt-3 rounded-[9px] border border-base-300/70 bg-base-200/40 px-3 py-2">
                <p className="text-[10px] font-semibold text-base-content/55 uppercase">
                  Lokasi Detail Giver
                </p>
                <p className="mt-0.5 text-xs text-base-content/80">
                  {quest.locationAddress}
                </p>
                {quest.workLocationLabel ? (
                  <p className="mt-1 text-[11px] font-semibold text-base-content/60">
                    {quest.workLocationLabel}
                  </p>
                ) : null}
                {quest.workLocationNote ? (
                  <p className="mt-1 text-[11px] text-base-content/60">
                    {quest.workLocationNote}
                  </p>
                ) : null}
                {quest.locationSharedAt ? (
                  <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.08em] text-info">
                    Dibagikan Giver: {quest.locationSharedAt}
                  </p>
                ) : (
                  <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.08em] text-warning">
                    Menunggu Giver share lokasi detail
                  </p>
                )}
              </div>

              <div className="mt-4 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  disabled={
                    isWaitingGiverConfirmation ||
                    isWaitingLocationShare ||
                    state !== "idle" ||
                    actionQuestId === quest.id
                  }
                  onClick={() => {
                    setActionQuestId(quest.id);
                    startRunnerActiveQuestLive(quest.id)
                      .then(() => setWorkState((prev) => ({ ...prev, [quest.id]: "started" })))
                      .catch((error) =>
                        setErrorMessage(error instanceof Error ? error.message : "Gagal mulai kerja."),
                      )
                      .finally(() => setActionQuestId(""));
                  }}
                  className="btn h-10 min-h-10 rounded-[9px] border-none bg-info text-info-content text-xs font-bold disabled:opacity-40"
                >
                  {isWaitingGiverConfirmation
                    ? "Menunggu Konfirmasi"
                    : isWaitingLocationShare
                      ? "Menunggu Lokasi"
                      : actionQuestId === quest.id
                      ? "Memulai..."
                      : state === "started"
                        ? "Sedang Kerja..."
                        : "Mulai Kerja"}
                </button>
                <button
                  type="button"
                  disabled={state !== "started" || actionQuestId === quest.id}
                  onClick={() => {
                    setActionQuestId(quest.id);
                    finishRunnerActiveQuestLive(quest.id)
                      .then(() => refreshActiveQuests())
                      .catch((error) =>
                        setErrorMessage(error instanceof Error ? error.message : "Gagal selesai kerja."),
                      )
                      .finally(() => setActionQuestId(""));
                  }}
                  className="btn h-10 min-h-10 rounded-[9px] border-none bg-success text-success-content text-xs font-bold disabled:opacity-40"
                >
                  {actionQuestId === quest.id
                    ? "Memproses..."
                    : isPendingVerification
                      ? "Pending Verifikasi"
                      : isEscrowReleased
                        ? "Escrow Released"
                        : "Selesai Kerja"}
                </button>
              </div>

              {isEscrowReleased && !quest.viewerHasRated ? (
                <button
                  type="button"
                  onClick={() =>
                    setRatingTarget({
                      name: quest.giverName,
                      role: "giver",
                      questTitle: quest.questTitle,
                      questId: quest.id,
                      assignmentId: quest.assignmentId,
                    })
                  }
                  className="btn mt-3 h-10 min-h-10 w-full rounded-[9px] border-none bg-primary text-xs font-bold text-primary-content"
                >
                  Beri Rating ke Giver
                </button>
              ) : isEscrowReleased ? (
                <button
                  type="button"
                  disabled
                  className="btn mt-3 h-10 min-h-10 w-full rounded-[9px] border-none bg-base-200 text-xs font-bold text-base-content/55"
                >
                  {quest.bothRated ? "Quest Masuk Riwayat" : "Rating Terkirim"}
                </button>
              ) : null}
            </Surface>
          );
        })}
      </div>

      {/* Rating Modal — muncul setelah escrow released */}
      {ratingTarget && (
        <RatingModal
          isOpen={true}
          target={ratingTarget}
          onSubmit={() => {
            void refreshActiveQuests();
          }}
          onClose={() => setRatingTarget(null)}
        />
      )}
    </div>
  );
}
