import { useEffect, useMemo, useState } from "react";
import { cn, Surface } from "../../home.ui";
import {
  buildInitialGiverBriefState,
  filterGiverBroadcastQuests,
  formatGiverCountdown,
  giverBriefChecklistItems,
  giverBroadcastFilters,
  giverBudgetCards,
  giverCandidateSortOptions,
  giverEscrowEntries,
  giverKpiCards,
  giverPostQuestInsights,
  giverViewText,
  persistGiverSubView,
  resolveGiverBriefScore,
  resolveGiverBroadcastStatusClass,
  resolveGiverCandidateStatusClass,
  resolveGiverEscrowStateClass,
  resolveGiverEscrowTypeClass,
  resolveGiverPartyLobbyWaitingText,
  resolveGiverRadiusRuntime,
  resolveGiverSlotProgress,
  resolveInitialGiverSubView,
  sortGiverCandidates,
  type BroadcastFilter,
  type CandidateSort,
  type GiverCandidate,
  type GiverBroadcastStatus,
  type GiverSubView,
  useGiverDashboardVM,
} from "./giver";
import { QuestEditor } from "./page/quest-editor";
import { CandidateReview } from "./page/candidate-review";
import BorderGlow from "../../../../Animation/BorderGlow";
import { useAnimationTheme } from "../../../global.theme";
import RatingModal from "../../component/rating/rating-modal.tsx";
import type { RatingTarget } from "../../component/rating/rating-modal";

function PartyLobbyWidget({
  slotFilled,
  slotTotal,
  status,
  candidates,
}: {
  slotFilled: number;
  slotTotal: number;
  status: GiverBroadcastStatus;
  candidates: number;
}) {
  const slots = Array.from(
    { length: slotTotal },
    (_, index) => index < slotFilled,
  );
  const canStart = slotFilled >= slotTotal;

  return (
    <div className="mt-3 rounded-[9px] border border-[#A046FF]/30 bg-linear-to-br from-[#A046FF]/5 to-transparent p-3 ring-1 ring-inset ring-white/10 shadow-inner">
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <span className="flex size-4 items-center justify-center rounded-full bg-[#A046FF] text-[8px] text-white shadow-sm shadow-[#A046FF]/40">
            🎉
          </span>
          <p className="text-[11px] font-bold uppercase tracking-wider text-[#A046FF]">
            {giverViewText.broadcast.partyLobby.title}
          </p>
        </div>
        <span className="rounded-full bg-base-100 px-2 py-0.5 text-[10px] font-bold text-base-content/70 shadow-sm">
          {slotFilled}/{slotTotal}{" "}
          {giverViewText.broadcast.partyLobby.readySuffix}
        </span>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {slots.map((filled, index) => (
          <div
            key={index}
            className="relative transition-all hover:-translate-y-0.5"
          >
            {filled ? (
              <div className="flex size-9 sm:size-10 items-center justify-center rounded-full bg-linear-to-tr from-[#A046FF] to-[#38BDF8] text-white shadow-md ring-2 ring-base-100 animate-in zoom-in duration-300">
                <span className="text-xs font-bold">R{index + 1}</span>
                {index === slotFilled - 1 && status === "LIVE" ? (
                  <span className="absolute -top-1 -right-1 flex size-3">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-75" />
                    <span className="relative inline-flex size-3 rounded-full bg-success ring-1 ring-white" />
                  </span>
                ) : null}
              </div>
            ) : (
              <div className="flex size-9 sm:size-10 items-center justify-center rounded-full border border-dashed border-base-300 bg-base-100/50 text-base-content/20">
                +
              </div>
            )}
          </div>
        ))}
      </div>

      {canStart ? (
        <button
          type="button"
          className="btn btn-sm mt-4 h-9 min-h-9 w-full rounded-[8px] border-none bg-linear-to-r from-[#A046FF] to-[#38BDF8] px-4 font-bold text-white shadow-lg shadow-[#A046FF]/20 hover:opacity-90"
        >
          {giverViewText.broadcast.partyLobby.startButton}
        </button>
      ) : (
        <div className="mt-3 flex items-center justify-between gap-2 border-t border-base-300/50 pt-2">
          <p className="text-[10px] font-medium text-base-content/50">
            {resolveGiverPartyLobbyWaitingText(candidates)}
          </p>
          <button
            type="button"
            className="btn btn-xs rounded bg-base-200 text-[10px] text-base-content/70 hover:bg-base-300 border-none shadow-none"
          >
            {giverViewText.broadcast.partyLobby.forceStartButton}
          </button>
        </div>
      )}
    </div>
  );
}

function GiverComponent() {
  const [tickSeconds, setTickSeconds] = useState(0);
  const [broadcastFilter, setBroadcastFilter] =
    useState<BroadcastFilter>("ALL");
  const [candidateSort, setCandidateSort] = useState<CandidateSort>("MATCH");
  const [briefState, setBriefState] = useState<Record<string, boolean>>(() =>
    buildInitialGiverBriefState(giverBriefChecklistItems),
  );
  const [subView, setSubView] = useState<GiverSubView | null>(
    resolveInitialGiverSubView,
  );
  const { animationsEnabled } = useAnimationTheme();
  const dashboardVM = useGiverDashboardVM();
  const [ratingTarget, setRatingTarget] = useState<RatingTarget | null>(null);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setTickSeconds((prev) => prev + 1);
    }, 1000);

    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    persistGiverSubView(subView);
  }, [subView]);

  const filteredBroadcasts = useMemo(
    () => filterGiverBroadcastQuests(dashboardVM.publishedQuests, broadcastFilter),
    [broadcastFilter, dashboardVM.publishedQuests],
  );

  const sortedCandidates = useMemo(
    () => sortGiverCandidates(dashboardVM.candidates, candidateSort),
    [candidateSort, dashboardVM.candidates],
  );

  const briefSummary = useMemo(
    () => resolveGiverBriefScore(giverBriefChecklistItems, briefState),
    [briefState],
  );

  function toggleBriefItem(itemId: string) {
    setBriefState((prev) => ({
      ...prev,
      [itemId]: !prev[itemId],
    }));
  }

  if (subView?.view === "QuestEditor") {
    return (
      <QuestEditor
        draft={subView.payload?.draft}
        onBack={() => {
          void dashboardVM.refresh();
          setSubView(null);
        }}
        onPublished={() => {
          void dashboardVM.refresh();
          setSubView(null);
        }}
      />
    );
  }

  if (subView?.view === "CandidateReview") {
    const selectedCandidate = dashboardVM.candidates.find(
      (candidate: GiverCandidate) => candidate.id === subView.payload.id,
    );
    return (
      <CandidateReview
        candidateId={subView.payload.id}
        candidate={selectedCandidate}
        isWorking={dashboardVM.candidateActionId === selectedCandidate?.assignmentId}
        onConfirm={(assignmentId) =>
          dashboardVM.confirmCandidate(assignmentId).then((success) => {
            if (success) setSubView(null);
          })
        }
        onReject={(assignmentId) =>
          dashboardVM.rejectCandidate(assignmentId).then((success) => {
            if (success) setSubView(null);
          })
        }
        onBack={() => setSubView(null)}
      />
    );
  }

  return (
    <div className="min-w-0 space-y-4">
      <Surface className="p-4 sm:p-5 flex flex-col gap-3 sm:flex-row justify-between items-start sm:items-center">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-base-content/45">
              {giverViewText.hero.eyebrow}
            </p>
            <span className="rounded-[8px] bg-base-200 px-2.5 py-1 text-[10px] font-semibold text-base-content/70 hidden sm:inline-block">
              {giverViewText.hero.badge}
            </span>
          </div>
          <h1 className="mt-1.5 text-xl font-bold text-base-content sm:text-2xl">
            {giverViewText.hero.title}
          </h1>
          {dashboardVM.errorMessage ? (
            <p className="mt-1 text-xs font-semibold text-warning">
              Mode fallback seed: {dashboardVM.errorMessage}
            </p>
          ) : null}
        </div>
        <button
          type="button"
          onClick={() => setSubView({ view: "QuestEditor" })}
          className="btn h-10 w-full sm:w-auto px-6 rounded-[10px] bg-[#6B21FF] hover:bg-[#6B21FF]/90 text-white border-none font-bold shadow-lg shadow-[#6B21FF]/30 transition-transform active:scale-95 text-sm"
        >
          {giverViewText.hero.createQuestButton}
        </button>
      </Surface>

      {dashboardVM.draftQuests.length ? (
        <Surface className="p-4 sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-base-content/45">
                Draft Privat
              </p>
              <h2 className="mt-1 text-lg font-bold text-base-content">
                Quest yang belum dirilis ke Runner
              </h2>
            </div>
            <span className="rounded-[8px] bg-base-200 px-2.5 py-1 text-[11px] font-bold text-base-content/70">
              {dashboardVM.draftQuests.length} draft
            </span>
          </div>

          <div className="mt-3 grid gap-3 xl:grid-cols-2">
            {dashboardVM.draftQuests.map((quest) => (
              <div
                key={quest.id}
                className="rounded-[10px] border border-base-300/70 bg-base-100 p-3.5"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.06em] text-base-content/55">
                      {quest.id}
                    </p>
                    <h3 className="text-base font-bold text-base-content">
                      {quest.title}
                    </h3>
                    <p className="text-xs text-base-content/65">
                      {quest.location} • {quest.mode} • {quest.skillTag}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    <span
                      className={cn(
                        "rounded-[8px] px-2 py-0.5 text-[11px] font-semibold",
                        resolveGiverBroadcastStatusClass(quest.status),
                      )}
                    >
                      DRAFT
                    </span>
                    <span
                      className={cn(
                        "rounded-[8px] px-2 py-0.5 text-[11px] font-semibold",
                        resolveGiverEscrowStateClass(quest.escrowState),
                      )}
                    >
                      {quest.escrowState}
                    </span>
                  </div>
                </div>

                <div className="mt-3 grid gap-2 sm:grid-cols-3">
                  <div className="rounded-[9px] border border-base-300/70 bg-base-100 px-3 py-2">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-base-content/55">
                      Upah
                    </p>
                    <p className="text-sm font-bold text-base-content">
                      {quest.wageBand}
                    </p>
                  </div>
                  <div className="rounded-[9px] border border-base-300/70 bg-base-100 px-3 py-2">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-base-content/55">
                      Slot
                    </p>
                    <p className="text-sm font-bold text-base-content">
                      {quest.slotTotal} runner
                    </p>
                  </div>
                  <div className="rounded-[9px] border border-base-300/70 bg-base-100 px-3 py-2">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-base-content/55">
                      Deadline
                    </p>
                    <p className="text-sm font-bold text-base-content">
                      {quest.deadline}
                    </p>
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      setSubView({
                        view: "QuestEditor",
                        payload: { draft: quest },
                      })
                    }
                    className="btn h-9 min-h-9 rounded-[8px] border-none bg-primary px-4 text-xs font-bold text-primary-content"
                  >
                    Edit Draft
                  </button>
                  <button
                    type="button"
                    disabled={dashboardVM.draftActionId === quest.id}
                    onClick={() => void dashboardVM.deleteDraft(quest.id)}
                    className="btn h-9 min-h-9 rounded-[8px] border-none bg-error/10 px-4 text-xs font-bold text-error hover:bg-error/20"
                  >
                    {dashboardVM.draftActionId === quest.id ? "Menghapus..." : "Delete"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </Surface>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {giverKpiCards.map((item) => (
          <Surface key={item.label} className="p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.06em] text-base-content/55">
              {item.label}
            </p>
            <p className="mt-2 text-xl font-bold text-base-content">
              {item.value}
            </p>
            <span
              className={cn(
                "mt-2 inline-flex rounded-[8px] px-2.5 py-1 text-[11px] font-semibold text-black",
                item.tone,
              )}
            >
              {item.hint}
            </span>
          </Surface>
        ))}
      </div>

      <Surface className="p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-base-content/45">
              {giverViewText.broadcast.eyebrow}
            </p>
            <h2 className="mt-1 text-lg font-bold text-base-content">
              {giverViewText.broadcast.title}
            </h2>
            {dashboardVM.isLoading ? (
              <p className="mt-1 text-xs font-semibold text-primary">
                Sinkronisasi quest giver...
              </p>
            ) : null}
          </div>
          <div className="flex flex-wrap gap-2">
            {giverBroadcastFilters.map((filter) => (
              <button
                key={filter}
                type="button"
                onClick={() => setBroadcastFilter(filter)}
                className={cn(
                  "btn h-8 min-h-8 rounded-[999px] border-none px-3 text-xs shadow-none",
                  broadcastFilter === filter
                    ? "bg-primary text-primary-content"
                    : "bg-base-200 text-base-content/75 hover:bg-base-300",
                )}
              >
                {filter}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-3 grid gap-3 xl:grid-cols-2">
          {filteredBroadcasts.map((quest) => {
            const slotProgress = resolveGiverSlotProgress(quest);
            const runtime = resolveGiverRadiusRuntime(quest, tickSeconds);

            const InnerQuestCard = () => (
              <div className="flex flex-col p-3.5 h-full">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.06em] text-base-content/55">
                      {quest.id}
                    </p>
                    <h3 className="text-base font-bold text-base-content">
                      {quest.title}
                    </h3>
                    <p className="text-xs text-base-content/65">
                      {quest.location} • {quest.mode} • {quest.skillTag}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    <span
                      className={cn(
                        "rounded-[8px] px-2 py-0.5 text-[11px] font-semibold",
                        resolveGiverBroadcastStatusClass(quest.status),
                      )}
                    >
                      {quest.status}
                    </span>
                    <span
                      className={cn(
                        "rounded-[8px] px-2 py-0.5 text-[11px] font-semibold",
                        resolveGiverEscrowStateClass(quest.escrowState),
                      )}
                    >
                      {quest.escrowState}
                    </span>
                  </div>
                </div>

                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  <div className="rounded-[9px] border border-base-300/70 bg-base-100 px-3 py-2">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-base-content/55">
                      {giverViewText.broadcast.labels.wageBand}
                    </p>
                    <p className="text-sm font-bold text-base-content">
                      {quest.wageBand}
                    </p>
                  </div>
                  <div className="rounded-[9px] border border-base-300/70 bg-base-100 px-3 py-2">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-base-content/55">
                      {giverViewText.broadcast.labels.deadline}
                    </p>
                    <p className="text-sm font-bold text-base-content">
                      {quest.deadline}
                    </p>
                  </div>
                </div>

                {quest.slotTotal > 1 ? (
                  <PartyLobbyWidget
                    slotFilled={quest.slotFilled}
                    slotTotal={quest.slotTotal}
                    status={quest.status}
                    candidates={quest.estimatedCandidates}
                  />
                ) : (
                  <div className="mt-3 rounded-[9px] border border-base-300/70 bg-base-100 px-3 py-2.5">
                    <div className="mb-1.5 flex items-center justify-between gap-2 text-xs font-semibold">
                      <span className="text-base-content/70">
                        {giverViewText.broadcast.labels.slotFilled}{" "}
                        {quest.slotFilled}/{quest.slotTotal}
                      </span>
                      <span className="text-base-content">{slotProgress}%</span>
                    </div>
                    <div className="h-2 rounded-full bg-base-200">
                      <div
                        className="h-2 rounded-full bg-[#6B21FF]"
                        style={{ width: `${slotProgress}%` }}
                      />
                    </div>
                    <p className="mt-1.5 text-[11px] text-base-content/65">
                      {giverViewText.broadcast.labels.estimatedCandidates}{" "}
                      {quest.estimatedCandidates} runner
                    </p>
                  </div>
                )}

                {dashboardVM.assignmentsByQuest[quest.id]
                  ?.filter((assignment) => assignment.status === "accepted" || assignment.status === "active")
                  .map((assignment) => (
                    <div
                      key={assignment.id}
                      className="mt-3 rounded-[10px] border border-info/30 bg-info/10 p-3"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-info">
                            Runner Accepted
                          </p>
                          <p className="mt-0.5 text-xs font-semibold text-base-content">
                            {assignment.runnerName}
                          </p>
                          {assignment.hasSharedLocation ? (
                            <p className="mt-0.5 text-[11px] font-semibold text-success">
                              Lokasi detail terkirim {assignment.locationSharedAt || ""}
                            </p>
                          ) : (
                            <p className="mt-0.5 text-[11px] text-base-content/60">
                              Share pin detail sebelum Runner mulai kerja.
                            </p>
                          )}
                        </div>
                        <button
                          type="button"
                          disabled={dashboardVM.locationActionId === assignment.id}
                          onClick={() => void dashboardVM.shareAssignmentLocation(assignment.id)}
                          className="btn h-8 min-h-8 rounded-[8px] border-none bg-info px-3 text-[11px] font-bold text-info-content"
                        >
                          {dashboardVM.locationActionId === assignment.id
                            ? "Mengirim..."
                            : assignment.hasSharedLocation
                              ? "Share Ulang Lokasi"
                              : "Share Lokasi Detail"}
                        </button>
                      </div>
                    </div>
                  ))}

                {dashboardVM.assignmentsByQuest[quest.id]
                  ?.filter((assignment) => assignment.status === "finished")
                  .map((assignment) => {
                    const isReleased = quest.escrowState === "RELEASED";
                    const canRate = isReleased && assignment.viewerHasRated !== true;
                    return (
                    <div
                      key={assignment.id}
                      className={cn(
                        "mt-3 rounded-[10px] border p-3",
                        isReleased
                          ? "border-success/30 bg-success/10"
                          : "border-warning/30 bg-warning/10",
                      )}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <p
                            className={cn(
                              "text-[10px] font-bold uppercase tracking-[0.12em]",
                              isReleased ? "text-success" : "text-warning",
                            )}
                          >
                            {isReleased ? "Menunggu Rating" : "Pending Audit"}
                          </p>
                          <p className="mt-0.5 text-xs font-semibold text-base-content">
                            {assignment.runnerName} selesai pada{" "}
                            {assignment.finishedAt}
                          </p>
                        </div>
                        <div className="flex flex-wrap gap-1.5">
                          <button
                            type="button"
                            disabled={
                              dashboardVM.auditActionId === assignment.id ||
                              (isReleased && !canRate)
                            }
                            onClick={() => {
                              if (isReleased) {
                                if (canRate) {
                                  setRatingTarget({
                                    name: assignment.runnerName,
                                    role: "runner",
                                    questTitle: quest.title,
                                    questId: quest.id,
                                    assignmentId: assignment.id,
                                  });
                                }
                                return;
                              }
                              void dashboardVM
                                .auditAssignment(assignment.id, "accept")
                                .then(() => {
                                  // Trigger rating modal — giver rates the runner
                                  setRatingTarget({
                                    name: assignment.runnerName,
                                    role: "runner",
                                    questTitle: quest.title,
                                    questId: quest.id,
                                    assignmentId: assignment.id,
                                  });
                                });
                            }}
                            className={cn(
                              "btn h-8 min-h-8 rounded-[8px] border-none px-3 text-[11px] font-bold",
                              isReleased
                                ? "bg-primary text-primary-content disabled:bg-base-200 disabled:text-base-content/55"
                                : "bg-success text-success-content",
                            )}
                          >
                            {isReleased ? (canRate ? "Beri Rating" : "Rating Terkirim") : "Terima"}
                          </button>
                          <button
                            type="button"
                            disabled={
                              dashboardVM.auditActionId === assignment.id
                            }
                            onClick={() =>
                              void dashboardVM.auditAssignment(
                                assignment.id,
                                "revision",
                              )
                            }
                            className={cn(
                              "btn h-8 min-h-8 rounded-[8px] border-none bg-warning px-3 text-[11px] font-bold text-warning-content",
                              isReleased ? "hidden" : "",
                            )}
                          >
                            Revisi
                          </button>
                          <button
                            type="button"
                            disabled={
                              dashboardVM.auditActionId === assignment.id
                            }
                            onClick={() =>
                              void dashboardVM.auditAssignment(
                                assignment.id,
                                "dispute",
                              )
                            }
                            className={cn(
                              "btn h-8 min-h-8 rounded-[8px] border-none bg-error px-3 text-[11px] font-bold text-error-content",
                              isReleased ? "hidden" : "",
                            )}
                          >
                            Dispute
                          </button>
                        </div>
                      </div>
                    </div>
                    );
                  })}

                <div className="mt-3 grid gap-2 sm:grid-cols-3">
                  <div className="rounded-[9px] border border-base-300/70 bg-base-100 px-3 py-2">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-base-content/55">
                      {giverViewText.broadcast.labels.radiusActive}
                    </p>
                    <p className="text-sm font-bold text-base-content">
                      {runtime.currentRadius} km
                    </p>
                  </div>
                  <div className="rounded-[9px] border border-base-300/70 bg-base-100 px-3 py-2">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-base-content/55">
                      {giverViewText.broadcast.labels.nextRadius}
                    </p>
                    <p className="text-sm font-bold text-base-content">
                      {runtime.nextRadius} km
                    </p>
                  </div>
                  <div className="rounded-[9px] border border-base-300/70 bg-base-100 px-3 py-2">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-base-content/55">
                      {giverViewText.broadcast.labels.autoExpand}
                    </p>
                    <p className="text-sm font-bold text-base-content">
                      {runtime.maxReached
                        ? giverViewText.broadcast.labels.maxRadius
                        : formatGiverCountdown(runtime.nextExpandIn)}
                    </p>
                  </div>
                </div>
              </div>
            );

            return animationsEnabled ? (
              <BorderGlow
                key={quest.id}
                className="rounded-[12px] w-full bg-base-100/90 hover:-translate-y-1 transition-transform group"
                edgeSensitivity={20}
                glowRadius={20}
                glowIntensity={0.7}
                animated={false}
              >
                <div className="relative z-1 w-full h-full">
                  <InnerQuestCard />
                </div>
              </BorderGlow>
            ) : (
              <div
                key={quest.id}
                className="rounded-[12px] border border-base-300/70 bg-base-100 p-0"
              >
                <InnerQuestCard />
              </div>
            );
          })}
        </div>
      </Surface>

      <div className="grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
        <Surface className="p-4 sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-base-content/45">
                {giverViewText.candidate.eyebrow}
              </p>
              <h2 className="mt-1 text-lg font-bold text-base-content">
                {giverViewText.candidate.title}
              </h2>
            </div>
            <div className="inline-flex rounded-[10px] bg-base-200 p-1">
              {giverCandidateSortOptions.map((sort) => (
                <button
                  key={sort}
                  type="button"
                  onClick={() => setCandidateSort(sort)}
                  className={cn(
                    "btn h-8 min-h-8 rounded-[8px] border-none px-3 text-xs shadow-none",
                    candidateSort === sort
                      ? "bg-primary text-primary-content"
                      : "bg-transparent text-base-content/75 hover:bg-base-100",
                  )}
                >
                  {sort}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-3 grid gap-2.5 sm:grid-cols-2">
            {sortedCandidates.map((candidate) => (
              <div
                key={candidate.id}
                className="rounded-[10px] border border-base-300/70 bg-base-100 p-3"
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-base-content">
                    {candidate.name}
                  </p>
                  <span
                    className={cn(
                      "rounded-[8px] px-2 py-0.5 text-[11px] font-semibold",
                      resolveGiverCandidateStatusClass(candidate.status),
                    )}
                  >
                    {candidate.status}
                  </span>
                </div>
                <p className="mt-1 text-xs text-base-content/65">
                  {candidate.skill}
                </p>
                {candidate.questTitle ? (
                  <p className="mt-1 text-[11px] font-semibold text-base-content/55">
                    {candidate.questTitle}
                    {candidate.appliedAt ? ` • ${candidate.appliedAt}` : ""}
                  </p>
                ) : null}
                <div className="mt-2 grid grid-cols-3 gap-1.5 text-[11px]">
                  <span className="rounded-[8px] bg-base-200 px-2 py-1 text-center font-semibold text-base-content/70">
                    {candidate.distanceKm}{" "}
                    {giverViewText.candidate.distanceSuffix}
                  </span>
                  <span className="rounded-[8px] bg-base-200 px-2 py-1 text-center font-semibold text-base-content/70">
                    {candidate.etaMinutes}
                    {giverViewText.candidate.etaSuffix}
                  </span>
                  <span className="rounded-[8px] bg-base-200 px-2 py-1 text-center font-semibold text-base-content/70">
                    {candidate.matchScore}
                    {giverViewText.candidate.matchSuffix}
                  </span>
                </div>
                <div className="mt-2 h-2 rounded-full bg-base-200">
                  <div
                    className="h-2 rounded-full bg-[#2563EB]"
                    style={{ width: `${candidate.matchScore}%` }}
                  />
                </div>
                <p className="mt-1.5 text-[11px] text-base-content/65">
                  {giverViewText.candidate.completionPrefix}{" "}
                  {candidate.completionRate} •{" "}
                  {giverViewText.candidate.disputePrefix}{" "}
                  {candidate.disputeRatio}
                </p>
                <div className="mt-3 border-t border-base-200 pt-3 flex items-center justify-between">
                  <span className="inline-flex rounded-[8px] bg-[#E0F2FE] px-2 py-0.5 text-[10px] font-bold text-[#0369A1]">
                    {candidate.reliabilityBadge}
                  </span>
                  <button
                    type="button"
                    onClick={() =>
                      setSubView({
                        view: "CandidateReview",
                        payload: { id: candidate.id },
                      })
                    }
                    className="btn btn-xs rounded bg-base-200 text-[10px] font-bold text-base-content/80 hover:bg-base-300 border-none shadow-none"
                  >
                    {giverViewText.candidate.reviewButton}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </Surface>

        <Surface className="p-4 sm:p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-base-content/45">
            {giverViewText.budget.eyebrow}
          </p>
          <h2 className="mt-1 text-lg font-bold text-base-content">
            {giverViewText.budget.title}
          </h2>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {giverBudgetCards.map((item) => (
              <div
                key={item.label}
                className="rounded-[10px] border border-base-300/70 bg-base-100 p-3"
              >
                <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-base-content/55">
                  {item.label}
                </p>
                <p className="mt-1 text-lg font-bold text-base-content">
                  {item.value}
                </p>
                <span
                  className={cn(
                    "mt-2 inline-flex rounded-[8px] px-2 py-0.5 text-[11px] font-semibold text-black",
                    item.tone,
                  )}
                >
                  {item.hint}
                </span>
              </div>
            ))}
          </div>

          <div className="mt-3 space-y-2">
            {giverEscrowEntries.map((entry) => {
              const InnerEscrow = () => (
                <div className="p-3 w-full">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-base-content">
                      {entry.questId}
                    </p>
                    <span
                      className={cn(
                        "rounded-[8px] px-2 py-0.5 text-[11px] font-semibold",
                        resolveGiverEscrowTypeClass(entry.type),
                      )}
                    >
                      {entry.type}
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-base-content/65">
                    {entry.note}
                  </p>
                  <div className="mt-1.5 flex items-center justify-between text-xs">
                    <span className="font-bold text-base-content">
                      {entry.amount}
                    </span>
                    <span className="font-medium text-base-content/60">
                      {entry.time}
                    </span>
                  </div>
                </div>
              );

              return animationsEnabled ? (
                <BorderGlow
                  key={entry.id}
                  className="rounded-[10px] w-full bg-base-100"
                  edgeSensitivity={15}
                  glowRadius={10}
                  glowIntensity={0.6}
                  animated={false}
                >
                  <div className="relative z-1 w-full">
                    <InnerEscrow />
                  </div>
                </BorderGlow>
              ) : (
                <div
                  key={entry.id}
                  className="rounded-[10px] border border-base-300/70 bg-base-100 p-0"
                >
                  <InnerEscrow />
                </div>
              );
            })}
          </div>
        </Surface>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1fr_1fr]">
        <Surface className="p-4 sm:p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-base-content/45">
            {giverViewText.brief.eyebrow}
          </p>
          <h2 className="mt-1 text-lg font-bold text-base-content">
            {giverViewText.brief.title}
          </h2>
          <div className="mt-3 rounded-[10px] border border-base-300/70 bg-base-100 p-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-semibold text-base-content">
                {giverViewText.brief.scoreTitle}
              </p>
              <span
                className={cn(
                  "rounded-[8px] px-2 py-0.5 text-xs font-bold",
                  briefSummary.ready
                    ? "bg-[#DCFCE7] text-[#166534]"
                    : "bg-[#FEF3C7] text-[#92400E]",
                )}
              >
                {briefSummary.score}%
              </span>
            </div>
            <div className="mt-2 h-2.5 rounded-full bg-base-200">
              <div
                className={cn(
                  "h-2.5 rounded-full",
                  briefSummary.ready ? "bg-[#16A34A]" : "bg-[#D97706]",
                )}
                style={{ width: `${briefSummary.score}%` }}
              />
            </div>
            <p className="mt-1.5 text-xs text-base-content/65">
              {briefSummary.ready
                ? giverViewText.brief.readyHint
                : giverViewText.brief.notReadyHint}
            </p>
          </div>

          <div className="mt-3 space-y-2">
            {giverBriefChecklistItems.map((item) => (
              <label
                key={item.id}
                className="flex items-start gap-3 rounded-[10px] border border-base-300/70 bg-base-100 p-3"
              >
                <input
                  type="checkbox"
                  className="checkbox checkbox-sm mt-0.5"
                  checked={briefState[item.id]}
                  onChange={() => toggleBriefItem(item.id)}
                />
                <div>
                  <p className="text-sm font-semibold text-base-content">
                    {item.label}{" "}
                    {item.required ? (
                      <span className="rounded-[6px] bg-[#FEE2E2] px-1.5 py-0.5 text-[10px] font-bold text-[#991B1B]">
                        {giverViewText.brief.requiredBadge}
                      </span>
                    ) : null}
                  </p>
                  <p className="text-xs text-base-content/65">
                    {item.description}
                  </p>
                  <p className="mt-1 text-[11px] font-semibold text-base-content/55">
                    {giverViewText.brief.weightPrefix} {item.weight}%
                  </p>
                </div>
              </label>
            ))}
          </div>

          {briefSummary.missingRequired.length ? (
            <div className="mt-3 rounded-[10px] border border-[#FCA5A5] bg-[#FFF1F2] p-3">
              <p className="text-xs font-semibold uppercase tracking-[0.06em] text-[#991B1B]">
                {giverViewText.brief.requiredMissingTitle}
              </p>
              <p className="mt-1 text-sm text-[#7F1D1D]">
                {briefSummary.missingRequired
                  .map((item) => item.label)
                  .join(", ")}
              </p>
            </div>
          ) : null}
        </Surface>

        <Surface className="p-4 sm:p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-base-content/45">
            {giverViewText.insight.eyebrow}
          </p>
          <h2 className="mt-1 text-lg font-bold text-base-content">
            {giverViewText.insight.title}
          </h2>
          <div className="mt-3 space-y-2.5">
            {giverPostQuestInsights.map((insight) => (
              <div
                key={insight.id}
                className="rounded-[10px] border border-base-300/70 bg-base-100 p-3"
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-semibold text-base-content">
                    {insight.title}
                  </p>
                  <span
                    className={cn(
                      "rounded-[8px] px-2 py-0.5 text-[11px] font-semibold",
                      insight.tone,
                    )}
                  >
                    {insight.impact}
                  </span>
                </div>
                <p className="mt-1 text-xs text-base-content/65">
                  {insight.recommendation}
                </p>
                <p className="mt-1.5 text-[11px] font-semibold text-base-content/55">
                  {giverViewText.insight.confidencePrefix} {insight.confidence}
                </p>
              </div>
            ))}
          </div>
        </Surface>
      </div>

      {/* Rating Modal — muncul setelah giver terima hasil kerja runner */}
      {ratingTarget && (
        <RatingModal
          isOpen={true}
          target={ratingTarget}
          onSubmit={() => {
            void dashboardVM.refresh();
          }}
          onClose={() => setRatingTarget(null)}
        />
      )}
    </div>
  );
}

export default GiverComponent;
