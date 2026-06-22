import { useEffect, useMemo, useState } from "react";
import { cn, Surface } from "../../home.ui";
import {
  resolveInitialRunnerSubView,
  runnerActiveQuests,
  runnerOpenParties,
  runnerSubViewStorageKey,
  runnerViewText,
  syncRunnerSubViewStorage,
  type RunnerSubView,
} from "./runner";
import { RunnerHomePage } from "./page/home/home.tsx";
import { RunnerQuestFeedPage } from "./page/quest-feed/quest-feed.tsx";
import { RunnerActiveQuestPage } from "./page/active-quest/active-quest.tsx";
import { PartyLobbyRoomPage } from "./page/party-lobby-room/party-lobby-room.tsx";
import { RunnerMapsLivePage } from "./page/maps-live/maps-live.tsx";
import { RunnerInsightsPage } from "./page/insights/insights.tsx";
import { RunnerHistoryPage } from "./page/history/history.tsx";
import { MetricCenterPage } from "./page/metric-center/metric-center.tsx";
import { SkillInventoryPage } from "./page/skill-inventory/skill-inventory.tsx";

const runnerNavigatorViews: RunnerSubView["view"][] = [
  "Home",
  "QuestFeed",
  "ActiveQuest",
  "PartyLobbyRoom",
  "Insights",
  "History",
  "MetricCenter",
  "SkillInventory",
  "MapsLive",
];

function resolveRunnerNavigatorLabel(view: RunnerSubView["view"]): string {
  switch (view) {
    case "Home":
      return runnerViewText.navigator.home;
    case "QuestFeed":
      return runnerViewText.navigator.questFeed;
    case "ActiveQuest":
      return runnerViewText.navigator.activeQuest;
    case "PartyLobbyRoom":
      return runnerViewText.navigator.partyLobby;
    case "Insights":
      return runnerViewText.navigator.insights;
    case "History":
      return "Riwayat";
    case "MetricCenter":
      return "Metric Center";
    case "SkillInventory":
      return "Skill Inventory";
    case "MapsLive":
      return "Radar Live";
    default:
      return view;
  }
}

function createRunnerView(view: RunnerSubView["view"]): RunnerSubView {
  if (view === "PartyLobbyRoom") {
    return {
      view: "PartyLobbyRoom",
      payload: { partyId: runnerOpenParties[0]?.id ?? "P-101" },
    };
  }
  return { view };
}

function RunnerNestedNavigator({
  currentView,
  onNavigate,
}: {
  currentView: RunnerSubView;
  onNavigate: (view: RunnerSubView) => void;
}) {
  return (
    <Surface className="p-3 sm:p-4 border border-base-300/70">
      <div className="flex flex-wrap items-center gap-2">
        {runnerNavigatorViews.map((view) => {
          const active = currentView.view === view;
          return (
            <button
              key={view}
              type="button"
              onClick={() => onNavigate(createRunnerView(view))}
              className={cn(
                "btn h-9 min-h-9 rounded-[999px] border-none px-4 text-xs font-bold shadow-none",
                active
                  ? "bg-primary text-primary-content"
                  : "bg-base-200 text-base-content/75 hover:bg-base-300",
              )}
            >
              {resolveRunnerNavigatorLabel(view)}
            </button>
          );
        })}
      </div>
      <p className="mt-2 text-[11px] text-base-content/50">
        Storage key aktif: <span className="font-mono">{runnerSubViewStorageKey}</span>
      </p>
    </Surface>
  );
}

function RunnerShellSummary() {
  const summary = useMemo(
    () => ({
      activeQuests: runnerActiveQuests.length,
      openLobbies: runnerOpenParties.length,
    }),
    [],
  );

  return (
    <Surface className="p-4 sm:p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-base-content/45">
            {runnerViewText.hero.eyebrow}
          </p>
          <h1 className="mt-1 text-xl font-bold text-base-content sm:text-2xl">
            Nested SPA Runner Layout
          </h1>
        </div>
        <div className="flex flex-wrap gap-2">
          <span className="rounded-[8px] bg-base-200 px-3 py-1 text-xs font-semibold text-base-content/70">
            Quest Aktif {summary.activeQuests}
          </span>
          <span className="rounded-[8px] bg-base-200 px-3 py-1 text-xs font-semibold text-base-content/70">
            Lobby {summary.openLobbies}
          </span>
          <span className="hidden rounded-[8px] bg-base-200 px-2.5 py-1 text-xs font-semibold text-base-content/70 sm:inline-block">
            {runnerViewText.hero.simulationBadge}
          </span>
        </div>
      </div>
    </Surface>
  );
}

function RunnerComponent() {
  const [subView, setSubView] = useState<RunnerSubView>(resolveInitialRunnerSubView);

  useEffect(() => {
    syncRunnerSubViewStorage(subView);
  }, [subView]);

  return (
    <div className="min-w-0 space-y-4">
      <RunnerShellSummary />
      <RunnerNestedNavigator currentView={subView} onNavigate={setSubView} />

      {subView.view === "QuestFeed" ? (
        <RunnerQuestFeedPage
          onBack={() => setSubView({ view: "Home" })}
          onOpenActiveQuest={() => setSubView({ view: "ActiveQuest" })}
          onOpenPartyLobby={(partyId) =>
            setSubView({ view: "PartyLobbyRoom", payload: { partyId } })
          }
        />
      ) : null}

      {subView.view === "ActiveQuest" ? (
        <RunnerActiveQuestPage onBack={() => setSubView({ view: "Home" })} />
      ) : null}

      {subView.view === "PartyLobbyRoom" ? (
        <PartyLobbyRoomPage
          partyId={subView.payload.partyId}
          onBack={() => setSubView({ view: "Home" })}
        />
      ) : null}

      {subView.view === "MapsLive" ? (
        <RunnerMapsLivePage onBack={() => setSubView({ view: "Home" })} />
      ) : null}

      {subView.view === "Insights" ? (
        <RunnerInsightsPage onBack={() => setSubView({ view: "Home" })} />
      ) : null}

      {subView.view === "History" ? (
        <RunnerHistoryPage onBack={() => setSubView({ view: "Home" })} />
      ) : null}

      {subView.view === "MetricCenter" ? (
        <MetricCenterPage onBack={() => setSubView({ view: "Home" })} />
      ) : null}

      {subView.view === "SkillInventory" ? (
        <SkillInventoryPage onBack={() => setSubView({ view: "Home" })} />
      ) : null}

      {subView.view === "Home" ? (
        <RunnerHomePage onNavigate={setSubView} />
      ) : null}
    </div>
  );
}

export default RunnerComponent;
