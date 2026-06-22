import { Surface } from "../../../../home.ui";
import type { RunnerSubView } from "../../runner";
import { useRunnerHomeVM } from "./home";

export function RunnerHomePage({
  onNavigate,
}: {
  onNavigate: (view: RunnerSubView) => void;
}) {
  const { vm, tierStatus } = useRunnerHomeVM();

  return (
    <div className="space-y-4">
      {tierStatus && (() => {
        const currentTier = tierStatus.runner_tier || "Q1";
        const progressThreshold = currentTier === "Q2" 
          ? (tierStatus.thresholds?.q3_min_pp || 2000) 
          : (tierStatus.thresholds?.q2_min_pp || 500);
        const progressPercentage = Math.min(100, ((tierStatus.runner_pp || 0) / progressThreshold) * 100);

        return (
          <Surface className="p-4 sm:p-5 flex flex-wrap items-center justify-between gap-4 border border-primary/30 bg-primary/5">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/20 text-xl font-bold text-primary">
                {currentTier}
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-base-content/60">Current Tier</p>
                <p className="text-lg font-bold text-base-content">
                  {tierStatus.runner_pp || 0} <span className="text-sm font-medium text-base-content/50">PP</span>
                </p>
              </div>
            </div>
            <div className="flex-1 min-w-[200px]">
              <div className="flex items-center justify-between text-xs font-semibold mb-1.5">
                <span className="text-base-content/70">Progress to {tierStatus.next_tier || (currentTier === "Q1" ? "Q2" : "Q3")}</span>
                <span className="text-primary">
                  {progressPercentage.toFixed(1)}%
                </span>
              </div>
              <div className="h-2 w-full rounded-full bg-base-200 overflow-hidden">
                <div 
                  className="h-full rounded-full bg-primary transition-all duration-500" 
                  style={{ width: `${progressPercentage}%` }}
                />
              </div>
              {!tierStatus.can_upgrade_q2 && tierStatus.blocked_reason && (
                <p className="text-[10px] text-warning mt-1.5">{tierStatus.blocked_reason}</p>
              )}
            </div>
          </Surface>
        );
      })()}

      <Surface className="p-5 sm:p-6 border border-primary/20 bg-linear-to-br from-primary/5 via-transparent to-info/10">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-primary/70">
          {vm.text.eyebrow}
        </p>
        <h2 className="mt-1 text-xl font-bold text-base-content sm:text-2xl">
          {vm.text.title}
        </h2>
        <p className="mt-2 max-w-3xl text-sm text-base-content/70">
          {vm.text.description}
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => onNavigate({ view: "QuestFeed" })}
            className="btn h-10 min-h-10 rounded-[10px] border-none bg-primary px-5 text-sm font-bold text-primary-content"
          >
            {vm.text.primaryButton}
          </button>
          <button
            type="button"
            onClick={() => onNavigate({ view: "ActiveQuest" })}
            className="btn h-10 min-h-10 rounded-[10px] border border-base-300 bg-base-100 px-5 text-sm font-bold text-base-content shadow-none"
          >
            {vm.text.secondaryButton}
          </button>
        </div>
      </Surface>

      <div className="grid gap-4 sm:grid-cols-3">
        <Surface className="p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-base-content/55">
            {vm.text.activeQuestLabel}
          </p>
          <p className="mt-2 text-2xl font-bold text-base-content">
            {vm.activeQuestCount}
          </p>
        </Surface>
        <Surface className="p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-base-content/55">
            {vm.text.openQuestLabel}
          </p>
          <p className="mt-2 text-2xl font-bold text-base-content">
            {vm.openQuestCount}
          </p>
        </Surface>
        <Surface className="p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.08em] text-base-content/55">
            {vm.text.partyLobbyLabel}
          </p>
          <p className="mt-2 text-2xl font-bold text-base-content">
            {vm.partyLobbyCount}
          </p>
        </Surface>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <Surface className="p-4 sm:p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-base-content/45">
            Featured Quest
          </p>
          {vm.featuredQuest ? (
            <div className="mt-3 rounded-[12px] border border-base-300/70 bg-base-100 p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h3 className="text-base font-bold text-base-content">
                    {vm.featuredQuest.title}
                  </h3>
                  <p className="text-xs text-base-content/60">
                    {vm.featuredQuest.giver} • {vm.featuredQuest.locationLabel}
                  </p>
                </div>
                <span className="rounded-[8px] bg-success/10 px-2 py-1 text-xs font-bold text-success">
                  {vm.featuredQuest.reward}
                </span>
              </div>
              <p className="mt-3 text-sm text-base-content/70">
                {vm.featuredQuest.briefSummary}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <span className="rounded-[8px] bg-base-200 px-2 py-1 text-[11px] font-semibold text-base-content/70">
                  {vm.featuredQuest.category}
                </span>
                <span className="rounded-[8px] bg-base-200 px-2 py-1 text-[11px] font-semibold text-base-content/70">
                  Match {vm.featuredQuest.matchScore}%
                </span>
              </div>
            </div>
          ) : null}
        </Surface>

        <Surface className="p-4 sm:p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-base-content/45">
            Quick Metrics
          </p>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {vm.metrics.map((metric) => (
              <div
                key={metric.label}
                className="rounded-[10px] border border-base-300/70 bg-base-100 p-3"
              >
                <p className="text-xs font-semibold uppercase tracking-[0.06em] text-base-content/55">
                  {metric.label}
                </p>
                <p className="mt-2 text-lg font-bold text-base-content">
                  {metric.value}
                </p>
                <span className={`mt-2 inline-flex rounded-[8px] px-2 py-1 text-[11px] font-semibold text-black ${metric.tone}`}>
                  {metric.hint}
                </span>
              </div>
            ))}
          </div>
        </Surface>
      </div>
    </div>
  );
}
