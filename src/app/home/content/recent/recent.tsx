import { useEffect, useState } from "react";
import { cn, Surface } from "../../home.ui";
import {
  resolveEscrowPipelineSteps,
  resolveInitialRecentSubView,
  resolveRecentPpChangeTone,
  resolveRecentRoleContext,
  resolveRecentRoleData,
  resolveRecentStatusTone,
  resolveRecentTransactionTone,
  syncRecentSubViewStorage,
  isRecentQuestCompleted,
  isRecentQuestDisputed,
  type ContractArchiveRow,
  type QuestHistoryRow,
  type RecentSubView,
  type RecentViewText,
} from "./recent";
import { fetchRecentHistoryFromApi } from "./recent.service";
import { DisputeCenter } from "./page/dispute-center";
import { ContractInvoice } from "./page/contract-invoice";
import { useRole } from "../../role.context";

function EscrowTrackerPipeline({
  status,
  questId,
  viewText,
  onDispute,
}: {
  status: QuestHistoryRow["status"];
  questId: string;
  viewText: RecentViewText;
  onDispute?: (id: string) => void;
}) {
  const isDone = isRecentQuestCompleted(status);
  const isDisputed = isRecentQuestDisputed(status);
  const steps = resolveEscrowPipelineSteps(status);

  return (
    <div className="mt-3 w-full border-t border-base-300/50 pt-2">
      <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-base-content/50">
        {viewText.escrowPipeline.title}
      </p>

      {isDisputed ? (
        <div className="flex w-full items-center justify-between rounded bg-error/10 px-3 py-2 text-xs text-error">
          <span className="font-semibold">
            ⚠️ {viewText.escrowPipeline.frozenLabel}
          </span>
          <button
            type="button"
            onClick={() => onDispute?.(questId)}
            className="btn btn-xs h-6 min-h-6 border-none bg-error px-2 text-[10px] text-error-content shadow-none hover:bg-error/80"
          >
            {viewText.escrowPipeline.detailCaseButton}
          </button>
        </div>
      ) : (
        <div className="flex w-full flex-col gap-3">
          <div className="flex w-full items-center justify-between gap-1">
            {steps.map((step) => (
              <div
                key={step.label}
                className="flex flex-1 flex-col items-center text-center"
              >
                <div
                  className={cn(
                    "flex size-6 sm:size-7 items-center justify-center rounded-full text-xs shadow-sm transition-colors",
                    step.active
                      ? "bg-linear-to-tr from-[#A046FF] to-[#38BDF8] text-white"
                      : "bg-base-200 text-base-content/40",
                  )}
                >
                  {step.icon}
                </div>
                <p
                  className={cn(
                    "mt-1.5 text-[9px] sm:text-[10px] font-semibold leading-tight",
                    step.active ? "text-base-content" : "text-base-content/40",
                  )}
                >
                  {step.label}
                </p>
              </div>
            ))}
          </div>

          {!isDone && (
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => onDispute?.(questId)}
                className="btn btn-xs h-6 min-h-6 border-none bg-error/20 px-3 text-[10px] font-bold text-error shadow-none hover:bg-error hover:text-white transition-colors"
              >
                🚩 {viewText.escrowPipeline.disputeButton}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function RecentComponent() {
  const [subView, setSubView] = useState<RecentSubView | null>(
    resolveInitialRecentSubView,
  );
  const [liveHistory, setLiveHistory] = useState<{
    contractArchiveRows: ContractArchiveRow[];
    questHistoryRows: QuestHistoryRow[];
  } | null>(null);

  // Role-aware data resolution — semua derived dari role context, bukan static import
  const { role, isGiverVerified } = useRole();
  const roleContext = resolveRecentRoleContext(role, isGiverVerified);
  const recentRoleData = resolveRecentRoleData(roleContext);
  const recentViewText = recentRoleData.viewCopy;
  const recentSummaryMetrics = recentRoleData.summaryMetrics;
  const contractArchiveRows = liveHistory?.contractArchiveRows.length
    ? liveHistory.contractArchiveRows
    : recentRoleData.contractArchiveRows;
  const questHistoryRows = liveHistory?.questHistoryRows.length
    ? liveHistory.questHistoryRows
    : recentRoleData.questHistoryRows;
  const transactionHistoryRows = recentRoleData.transactionHistoryRows;
  const ppLedgerRows = recentRoleData.ppLedgerRows;

  useEffect(() => {
    let mounted = true;
    fetchRecentHistoryFromApi(roleContext)
      .then((history) => {
        if (mounted) setLiveHistory(history);
      })
      .catch(() => {
        if (mounted) setLiveHistory(null);
      });
    return () => {
      mounted = false;
    };
  }, [roleContext]);

  useEffect(() => {
    syncRecentSubViewStorage(subView);
  }, [subView]);

  if (subView?.view === "DisputeCenter") {
    return (
      <DisputeCenter
        questId={subView.payload.questId}
        viewText={recentViewText}
        historyRows={questHistoryRows}
        onBack={() => setSubView(null)}
      />
    );
  }
  if (subView?.view === "ContractInvoice") {
    return (
      <ContractInvoice
        contractId={subView.payload.contractId}
        onBack={() => setSubView(null)}
      />
    );
  }

  return (
    <div className="min-w-0 space-y-4">
      <Surface className="p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-base-content/45">
              {recentViewText.hero.eyebrow}
            </p>
            <h1 className="mt-1 text-xl font-bold text-base-content sm:text-2xl">
              {recentViewText.hero.title}
            </h1>
          </div>
          <span className="rounded-[8px] bg-base-200 px-2.5 py-1 text-xs font-semibold text-base-content/70">
            {recentViewText.hero.simulationBadge}
          </span>
        </div>
      </Surface>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {recentSummaryMetrics.map((metric) => (
          <Surface key={metric.label} className="p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.06em] text-base-content/55">
              {metric.label}
            </p>
            <p className="mt-2 text-xl font-bold text-base-content">
              {metric.value}
            </p>
            <span
              className={cn(
                "mt-2 inline-flex rounded-[8px] px-2.5 py-1 text-[11px] font-semibold text-black",
                metric.tone,
              )}
            >
              {metric.hint}
            </span>
          </Surface>
        ))}
      </div>

      <Surface className="p-4 sm:p-5">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-base-content/45">
          {recentViewText.contractArchive.eyebrow}
        </p>
        <h2 className="mt-1 text-lg font-bold text-base-content">
          {recentViewText.contractArchive.title}
        </h2>
        <div className="mt-3 overflow-x-auto">
          <table className="table table-zebra table-sm min-w-[980px]">
            <thead>
              <tr>
                {recentViewText.contractArchive.tableHeaders.map((header) => (
                  <th key={header}>{header}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {contractArchiveRows.map((row) => (
                <tr key={row.contractId}>
                  <td
                    className="font-bold text-[#A046FF] cursor-pointer hover:underline"
                    onClick={() =>
                      setSubView({
                        view: "ContractInvoice",
                        payload: { contractId: row.contractId },
                      })
                    }
                  >
                    {row.contractId}
                  </td>
                  <td>{row.questTitle}</td>
                  <td>{row.giver}</td>
                  <td>{row.runner}</td>
                  <td>{row.type}</td>
                  <td>
                    <span
                      className={cn(
                        "rounded-[8px] px-2 py-0.5 text-[11px] font-semibold",
                        resolveRecentStatusTone(row.status),
                      )}
                    >
                      {row.status}
                    </span>
                  </td>
                  <td>{row.startDate}</td>
                  <td>{row.endDate}</td>
                  <td className="font-semibold">{row.value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Surface>

      <div className="grid gap-4">
        <Surface className="min-w-0 p-4 sm:p-5">
          <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-base-content/45">
            <span className="text-xl">🛡️</span>{" "}
            {recentViewText.questHistory.eyebrow}
          </p>
          <h2 className="mt-1 text-lg font-bold text-base-content">
            {recentViewText.questHistory.title}
          </h2>

          <div className="mt-3 space-y-3">
            {questHistoryRows.map((row) => (
              <div
                key={row.questId}
                className="rounded-[10px] border border-base-300/70 bg-base-100 p-3 shadow-sm hover:border-primary/30 transition-colors"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold text-base-content">
                      {row.questId}
                    </p>
                    <p className="text-xs text-base-content/60">
                      {row.category}
                    </p>
                  </div>
                  <span
                    className={cn(
                      "rounded-[8px] px-2 py-0.5 text-[11px] font-semibold",
                      resolveRecentStatusTone(row.status),
                    )}
                  >
                    {row.status}
                  </span>
                </div>
                <p className="mt-1.5 text-sm font-medium text-base-content">
                  {row.title}
                </p>
                <div className="mt-2 flex items-center justify-between text-xs text-base-content/65">
                  <span className="font-semibold text-primary">
                    {recentViewText.questHistory.progressPrefix} {row.progress}
                  </span>
                  <span>{row.updatedAt}</span>
                </div>

                {/* Escrow Tracker Injection */}
                <EscrowTrackerPipeline
                  status={row.status}
                  questId={row.questId}
                  viewText={recentViewText}
                  onDispute={(id) =>
                    setSubView({
                      view: "DisputeCenter",
                      payload: { questId: id },
                    })
                  }
                />
              </div>
            ))}
          </div>
        </Surface>

        <Surface className="min-w-0 p-4 sm:p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-base-content/45">
            {recentViewText.transactionHistory.eyebrow}
          </p>
          <h2 className="mt-1 text-lg font-bold text-base-content">
            {recentViewText.transactionHistory.title}
          </h2>

          <div className="mt-3 md:hidden space-y-2.5">
            {transactionHistoryRows.map((row) => (
              <div
                key={row.transactionId}
                className="rounded-[10px] border border-base-300/70 bg-base-100 p-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold text-base-content">
                      {row.transactionId}
                    </p>
                    <p className="text-xs text-base-content/60">{row.type}</p>
                  </div>
                  <span
                    className={cn(
                      "rounded-[8px] px-2 py-0.5 text-[11px] font-semibold",
                      resolveRecentTransactionTone(row.status),
                    )}
                  >
                    {row.status}
                  </span>
                </div>
                <p className="mt-1.5 text-sm font-medium text-base-content">
                  {row.questTitle}
                </p>
                <div className="mt-2 flex items-center justify-between text-xs text-base-content/65">
                  <span className="font-semibold">{row.amount}</span>
                  <span>{row.createdAt}</span>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-3 hidden overflow-x-auto md:block">
            <table className="table table-zebra table-sm min-w-[660px]">
              <thead>
                <tr>
                  {recentViewText.transactionHistory.tableHeaders.map(
                    (header) => (
                      <th key={header}>{header}</th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody>
                {transactionHistoryRows.map((row) => (
                  <tr key={row.transactionId}>
                    <td className="font-semibold">{row.transactionId}</td>
                    <td>{row.questTitle}</td>
                    <td>{row.type}</td>
                    <td className="font-semibold">{row.amount}</td>
                    <td>
                      <span
                        className={cn(
                          "rounded-[8px] px-2 py-0.5 text-[11px] font-semibold",
                          resolveRecentTransactionTone(row.status),
                        )}
                      >
                        {row.status}
                      </span>
                    </td>
                    <td>{row.createdAt}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Surface>
      </div>

      <Surface className="p-4 sm:p-5">
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-base-content/45">
          {recentViewText.ppLedger.eyebrow}
        </p>
        <h2 className="mt-1 text-lg font-bold text-base-content">
          {recentViewText.ppLedger.title}
        </h2>
        <div className="mt-3 overflow-x-auto">
          <table className="table table-zebra table-sm min-w-[900px]">
            <thead>
              <tr>
                {recentViewText.ppLedger.tableHeaders.map((header) => (
                  <th key={header}>{header}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {ppLedgerRows.map((row) => (
                <tr key={row.ledgerId}>
                  <td className="font-semibold">{row.ledgerId}</td>
                  <td>{row.skill}</td>
                  <td
                    className={cn(
                      "font-bold",
                      resolveRecentPpChangeTone(row.change),
                    )}
                  >
                    {row.change}
                  </td>
                  <td>{row.reason}</td>
                  <td>{row.balanceAfter}</td>
                  <td>{row.createdAt}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Surface>
    </div>
  );
}

export default RecentComponent;
