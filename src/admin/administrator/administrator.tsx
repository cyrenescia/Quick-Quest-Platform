import { useEffect, useMemo, useState } from "react";
import { useAdminRoute } from "../route.context.tsx";
import {
  buildAdminStatCards,
  buildAdminDisputeStatCards,
  exitAdministratorToUserLogin,
  formatAdminDate,
  formatDisputeEvidenceProgress,
  formatDocumentProgress,
  getAdminDisputeCopy,
  getAdministratorCopy,
  isPreviewableDisputeImage,
  isPreviewableVerificationImage,
  loadAdminDisputeDetail,
  loadAdminDisputeQueue,
  loadAdminVerificationDetail,
  loadAdminVerificationQueue,
  mergeUpdatedDispute,
  mergeUpdatedVerification,
  normalizeDecisionPayload,
  resolveDisputeDisplayName,
  resolveDisputeMeta,
  resolveDisputeStatusTone,
  resolveInitialSelectedDispute,
  resolveInitialSelectedVerification,
  resolveStatusTone,
  resolveVerificationDisplayName,
  resolveVerificationMeta,
  runAdminAutoRelease,
  submitAdminDisputeAction,
  submitAdminVerificationAction,
  type AdminConsoleQueue,
  type AdminDisputeItem,
  type AdminDisputeResolution,
  type AdminVerificationAction,
  type AdminVerificationItem,
} from "./administrator";

export default function AdministratorComponent() {
  const { navigate } = useAdminRoute();
  const copy = getAdministratorCopy();
  const disputeCopy = getAdminDisputeCopy();
  const [activeQueue, setActiveQueue] = useState<AdminConsoleQueue>("verification");
  const [items, setItems] = useState<AdminVerificationItem[]>([]);
  const [selectedItem, setSelectedItem] = useState<AdminVerificationItem | null>(null);
  const [disputeItems, setDisputeItems] = useState<AdminDisputeItem[]>([]);
  const [selectedDispute, setSelectedDispute] = useState<AdminDisputeItem | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [workingAction, setWorkingAction] = useState<AdminVerificationAction | null>(null);
  const [workingDisputeAction, setWorkingDisputeAction] = useState<AdminDisputeResolution | "auto-release" | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [actionNote, setActionNote] = useState("");
  const [mediatorNote, setMediatorNote] = useState("");
  const [autoReleaseMessage, setAutoReleaseMessage] = useState("");

  const statCards = useMemo(
    () =>
      activeQueue === "dispute"
        ? buildAdminDisputeStatCards(disputeItems)
        : buildAdminStatCards(items),
    [activeQueue, disputeItems, items],
  );

  async function reloadQueue() {
    setIsLoading(true);
    setErrorMessage("");
    try {
      const nextItems = await loadAdminVerificationQueue();
      setItems(nextItems);
      const active = resolveInitialSelectedVerification(nextItems);
      if (!active) {
        setSelectedItem(null);
        return;
      }
      const detail = await loadAdminVerificationDetail(active.verification_profile_id);
      setSelectedItem(detail);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Admin verification queue gagal dimuat.",
      );
      setItems([]);
      setSelectedItem(null);
    } finally {
      setIsLoading(false);
    }
  }

  async function reloadDisputeQueue() {
    setIsLoading(true);
    setErrorMessage("");
    setAutoReleaseMessage("");
    try {
      const nextItems = await loadAdminDisputeQueue();
      setDisputeItems(nextItems);
      const active = resolveInitialSelectedDispute(nextItems);
      if (!active) {
        setSelectedDispute(null);
        return;
      }
      const detail = await loadAdminDisputeDetail(active.id);
      setSelectedDispute(detail);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Admin dispute queue gagal dimuat.",
      );
      setDisputeItems([]);
      setSelectedDispute(null);
    } finally {
      setIsLoading(false);
    }
  }

  async function selectVerification(item: AdminVerificationItem) {
    setErrorMessage("");
    try {
      const detail = await loadAdminVerificationDetail(item.verification_profile_id);
      setSelectedItem(detail);
      setActionNote("");
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Detail verification gagal dimuat.",
      );
    }
  }

  async function selectDispute(item: AdminDisputeItem) {
    setErrorMessage("");
    try {
      const detail = await loadAdminDisputeDetail(item.id);
      setSelectedDispute(detail);
      setMediatorNote("");
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Detail dispute gagal dimuat.",
      );
    }
  }

  async function submitAction(action: AdminVerificationAction) {
    if (!selectedItem) return;

    setWorkingAction(action);
    setErrorMessage("");
    try {
      const payload = normalizeDecisionPayload(action, actionNote);
      const updatedItem = await submitAdminVerificationAction(action, selectedItem, payload);
      const nextItems = mergeUpdatedVerification(items, updatedItem);
      setItems(nextItems);
      setSelectedItem(resolveInitialSelectedVerification(nextItems));
      setActionNote("");
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Keputusan verification gagal dikirim.",
      );
    } finally {
      setWorkingAction(null);
    }
  }

  async function submitDisputeResolution(resolution: AdminDisputeResolution) {
    if (!selectedDispute) return;

    setWorkingDisputeAction(resolution);
    setErrorMessage("");
    try {
      const updatedItem = await submitAdminDisputeAction(selectedDispute, {
        resolution,
        mediator_note: mediatorNote.trim(),
      });
      const nextItems = mergeUpdatedDispute(disputeItems, updatedItem);
      setDisputeItems(nextItems);
      setSelectedDispute(resolveInitialSelectedDispute(nextItems));
      setMediatorNote("");
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Keputusan dispute gagal dikirim.",
      );
    } finally {
      setWorkingDisputeAction(null);
    }
  }

  async function runAutoReleaseSweep() {
    setWorkingDisputeAction("auto-release");
    setErrorMessage("");
    setAutoReleaseMessage("");
    try {
      const result = await runAdminAutoRelease(24);
      setAutoReleaseMessage(
        `Auto-release selesai: ${result?.released_total ?? 0}/${result?.checked_total ?? 0} assignment dirilis.`,
      );
      if (activeQueue === "dispute") {
        await reloadDisputeQueue();
      }
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Auto-release sweep gagal dijalankan.",
      );
    } finally {
      setWorkingDisputeAction(null);
    }
  }

  useEffect(() => {
    if (activeQueue === "dispute") {
      void reloadDisputeQueue();
      return;
    }
    void reloadQueue();
  }, [activeQueue]);

  return (
    <div className="theme-bg min-h-screen bg-base-100 px-4 py-5 text-base-content sm:px-6 lg:px-8">
      <div className="mx-auto flex max-w-7xl flex-col gap-5">
        <header className="flex flex-col gap-4 border-b border-base-300 pb-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-error">
              Admin Side
            </p>
            <h1 className="mt-2 text-2xl font-black tracking-normal sm:text-3xl">
              {activeQueue === "dispute" ? disputeCopy.title : copy.title}
            </h1>
            <p className="mt-2 max-w-3xl text-sm leading-relaxed text-base-content/65">
              {activeQueue === "dispute" ? disputeCopy.subtitle : copy.subtitle}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setActiveQueue("verification")}
              className={`btn h-10 min-h-10 rounded-lg border px-4 text-sm shadow-none ${
                activeQueue === "verification"
                  ? "border-error/30 bg-error/10 text-error"
                  : "border-base-300 bg-base-100 hover:bg-base-200"
              }`}
            >
              Verification
            </button>
            <button
              type="button"
              onClick={() => setActiveQueue("dispute")}
              className={`btn h-10 min-h-10 rounded-lg border px-4 text-sm shadow-none ${
                activeQueue === "dispute"
                  ? "border-error/30 bg-error/10 text-error"
                  : "border-base-300 bg-base-100 hover:bg-base-200"
              }`}
            >
              Disputes
            </button>
            {activeQueue === "dispute" ? (
              <button
                type="button"
                onClick={() => void runAutoReleaseSweep()}
                disabled={Boolean(workingDisputeAction)}
                className="btn h-10 min-h-10 rounded-lg border border-emerald-500/25 bg-emerald-500/10 px-4 text-sm text-emerald-700 shadow-none hover:bg-emerald-500/15"
              >
                {workingDisputeAction === "auto-release" ? "Sweeping..." : "Auto-Release Sweep"}
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => (activeQueue === "dispute" ? void reloadDisputeQueue() : void reloadQueue())}
              className="btn h-10 min-h-10 rounded-lg border border-base-300 bg-base-100 px-4 text-sm shadow-none hover:bg-base-200"
            >
              {activeQueue === "dispute" ? disputeCopy.refresh : copy.refresh}
            </button>
            <button
              type="button"
              onClick={() => navigate("login")}
              className="btn h-10 min-h-10 rounded-lg border border-error/25 bg-error/10 px-4 text-sm text-error shadow-none hover:bg-error/15"
            >
              Admin Login
            </button>
            <button
              type="button"
              onClick={exitAdministratorToUserLogin}
              className="btn h-10 min-h-10 rounded-lg border border-base-300 bg-base-100 px-4 text-sm shadow-none hover:bg-base-200"
            >
              Login User
            </button>
          </div>
        </header>

        <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {statCards.map((card) => (
            <article
              key={card.label}
              className="rounded-lg border border-base-300 bg-base-100 p-4 shadow-sm"
            >
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-base-content/45">
                {card.label}
              </p>
              <p className="mt-2 text-2xl font-black">{card.value}</p>
              <p className="mt-1 text-xs text-base-content/55">{card.hint}</p>
            </article>
          ))}
        </section>

        {errorMessage && (
          <div className="rounded-lg border border-error/25 bg-error/10 px-4 py-3 text-sm font-semibold text-error">
            {errorMessage}
          </div>
        )}
        {autoReleaseMessage && (
          <div className="rounded-lg border border-emerald-500/25 bg-emerald-500/10 px-4 py-3 text-sm font-semibold text-emerald-700">
            {autoReleaseMessage}
          </div>
        )}

        <main className="grid min-h-[620px] gap-4 lg:grid-cols-[minmax(20rem,24rem)_1fr]">
          <section className="rounded-lg border border-base-300 bg-base-100 shadow-sm">
            <div className="border-b border-base-300 px-4 py-3">
              <p className="text-sm font-black">
                {activeQueue === "dispute" ? "Dispute Queue" : "Verification Queue"}
              </p>
              <p className="text-xs text-base-content/55">
                {activeQueue === "dispute"
                  ? "Evidence, settlement, dan mediasi escrow."
                  : "Submitted, risk review, dan manual review."}
              </p>
            </div>

            <div className="max-h-[560px] overflow-y-auto p-3">
              {activeQueue === "dispute" ? (
                isLoading ? (
                  <p className="rounded-lg bg-base-200 p-4 text-sm text-base-content/60">
                    {disputeCopy.loading}
                  </p>
                ) : disputeItems.length === 0 ? (
                  <div className="rounded-lg bg-base-200 p-4">
                    <p className="text-sm font-bold">{disputeCopy.emptyTitle}</p>
                    <p className="mt-1 text-xs leading-relaxed text-base-content/60">
                      {disputeCopy.emptyDescription}
                    </p>
                  </div>
                ) : (
                  <div className="flex flex-col gap-2">
                    {disputeItems.map((item) => {
                      const active = selectedDispute?.id === item.id;
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => void selectDispute(item)}
                          className={`rounded-lg border p-3 text-left transition ${
                            active
                              ? "border-error/40 bg-error/10"
                              : "border-base-300 bg-base-100 hover:bg-base-200"
                          }`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="truncate text-sm font-black">
                                {resolveDisputeDisplayName(item)}
                              </p>
                              <p className="mt-1 truncate text-xs text-base-content/55">
                                {resolveDisputeMeta(item)}
                              </p>
                            </div>
                            <span
                              className={`shrink-0 rounded-full border px-2 py-1 text-[10px] font-black uppercase ${resolveDisputeStatusTone(
                                item.status,
                              )}`}
                            >
                              {item.status}
                            </span>
                          </div>
                          <p className="mt-3 text-xs font-semibold text-base-content/60">
                            {formatDisputeEvidenceProgress(item)}
                          </p>
                        </button>
                      );
                    })}
                  </div>
                )
              ) : isLoading ? (
                <p className="rounded-lg bg-base-200 p-4 text-sm text-base-content/60">
                  {copy.loading}
                </p>
              ) : items.length === 0 ? (
                <div className="rounded-lg bg-base-200 p-4">
                  <p className="text-sm font-bold">{copy.emptyTitle}</p>
                  <p className="mt-1 text-xs leading-relaxed text-base-content/60">
                    {copy.emptyDescription}
                  </p>
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  {items.map((item) => {
                    const active =
                      selectedItem?.verification_profile_id === item.verification_profile_id;
                    return (
                      <button
                        key={item.verification_profile_id}
                        type="button"
                        onClick={() => void selectVerification(item)}
                        className={`rounded-lg border p-3 text-left transition ${
                          active
                            ? "border-error/40 bg-error/10"
                            : "border-base-300 bg-base-100 hover:bg-base-200"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-black">
                              {resolveVerificationDisplayName(item)}
                            </p>
                            <p className="mt-1 truncate text-xs text-base-content/55">
                              {resolveVerificationMeta(item)}
                            </p>
                          </div>
                          <span
                            className={`shrink-0 rounded-full border px-2 py-1 text-[10px] font-black uppercase ${resolveStatusTone(
                              item.verification_status,
                            )}`}
                          >
                            {item.verification_status}
                          </span>
                        </div>
                        <p className="mt-3 text-xs font-semibold text-base-content/60">
                          {formatDocumentProgress(item)}
                        </p>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </section>

          <section className="rounded-lg border border-base-300 bg-base-100 shadow-sm">
            {activeQueue === "dispute" ? (
              <AdminDisputeDetailPanel
                selectedDispute={selectedDispute}
                mediatorNote={mediatorNote}
                setMediatorNote={setMediatorNote}
                workingDisputeAction={workingDisputeAction}
                onResolve={(resolution) => void submitDisputeResolution(resolution)}
              />
            ) : !selectedItem ? (
              <div className="flex min-h-[520px] items-center justify-center p-6 text-center">
                <div>
                  <p className="text-lg font-black">{copy.emptyTitle}</p>
                  <p className="mt-2 max-w-md text-sm text-base-content/60">
                    {copy.emptyDescription}
                  </p>
                </div>
              </div>
            ) : (
              <div className="flex flex-col">
                <div className="border-b border-base-300 p-5">
                  <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
                    <div className="min-w-0">
                      <p className="text-xs font-bold uppercase tracking-[0.14em] text-base-content/45">
                        Verification Detail
                      </p>
                      <h2 className="mt-2 text-2xl font-black">
                        {resolveVerificationDisplayName(selectedItem)}
                      </h2>
                      <p className="mt-1 text-sm text-base-content/60">
                        {resolveVerificationMeta(selectedItem)}
                      </p>
                    </div>
                    <span
                      className={`w-fit rounded-full border px-3 py-1 text-xs font-black uppercase ${resolveStatusTone(
                        selectedItem.verification_status,
                      )}`}
                    >
                      {selectedItem.verification_status}
                    </span>
                  </div>
                </div>

                <div className="grid gap-4 p-5 xl:grid-cols-[1fr_minmax(18rem,22rem)]">
                  <div className="flex flex-col gap-4">
                    <section className="rounded-lg border border-base-300 p-4">
                      <p className="text-sm font-black">Identity Snapshot</p>
                      <dl className="mt-4 grid gap-3 sm:grid-cols-2">
                        <DetailItem label="NIK" value={selectedItem.nik} />
                        <DetailItem label="Birth" value={selectedItem.birth_date} />
                        <DetailItem label="Gender" value={selectedItem.gender} />
                        <DetailItem label="Occupation" value={selectedItem.occupation} />
                        <DetailItem label="Address" value={selectedItem.full_address} wide />
                      </dl>
                    </section>

                    <section className="rounded-lg border border-base-300 p-4">
                      <p className="text-sm font-black">Documents</p>
                      <div className="mt-3 grid gap-3">
                        {(selectedItem.documents ?? []).map((document) => (
                          <div
                            key={document.id ?? document.document_type}
                            className="rounded-lg bg-base-200 p-3"
                          >
                            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                              <div className="min-w-0">
                                <p className="text-sm font-bold">{document.document_type}</p>
                                <p className="truncate text-xs text-base-content/55">
                                  {document.file_key}
                                </p>
                                <p className="mt-1 text-[11px] text-base-content/45">
                                  {[document.mime_type, document.file_size]
                                    .filter(Boolean)
                                    .join(" | ") || "metadata dokumen"}
                                </p>
                              </div>
                              <div className="flex shrink-0 flex-wrap items-center gap-2">
                                <span className="w-fit rounded-full bg-base-100 px-2 py-1 text-xs font-bold">
                                  {document.validation_status}
                                </span>
                                {document.file_url ? (
                                  <a
                                    href={document.file_url}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="btn h-8 min-h-8 rounded-lg border border-base-300 bg-base-100 px-3 text-xs shadow-none hover:bg-base-300"
                                  >
                                    Buka Dokumen
                                  </a>
                                ) : null}
                              </div>
                            </div>
                            {document.file_url && isPreviewableVerificationImage(document) ? (
                              <a
                                href={document.file_url}
                                target="_blank"
                                rel="noreferrer"
                                className="mt-3 block overflow-hidden rounded-lg border border-base-300 bg-base-100"
                              >
                                <img
                                  src={document.file_url}
                                  alt={`${document.document_type ?? "Dokumen"} verification`}
                                  className="max-h-80 w-full object-contain"
                                />
                              </a>
                            ) : document.file_url ? (
                              <div className="mt-3 rounded-lg border border-base-300 bg-base-100 px-3 py-2 text-xs text-base-content/60">
                                Preview inline belum tersedia untuk tipe dokumen ini. Gunakan tombol Buka Dokumen.
                              </div>
                            ) : (
                              <div className="mt-3 rounded-lg border border-warning/30 bg-warning/10 px-3 py-2 text-xs text-warning">
                                File preview belum tersedia karena upload lama hanya menyimpan nama file.
                              </div>
                            )}
                          </div>
                        ))}
                        {(selectedItem.documents ?? []).length === 0 && (
                          <p className="rounded-lg bg-base-200 p-3 text-sm text-base-content/60">
                            Belum ada dokumen metadata.
                          </p>
                        )}
                      </div>
                    </section>

                    <section className="rounded-lg border border-base-300 p-4">
                      <p className="text-sm font-black">Review History</p>
                      <div className="mt-3 grid gap-2">
                        {(selectedItem.reviews ?? []).map((review) => (
                          <div key={review.id} className="rounded-lg bg-base-200 p-3">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <p className="text-sm font-bold">{review.review_result}</p>
                              <p className="text-xs text-base-content/55">
                                {formatAdminDate(review.created_at)}
                              </p>
                            </div>
                            <p className="mt-1 text-xs leading-relaxed text-base-content/65">
                              {review.review_notes || review.decision_reason_detail || "-"}
                            </p>
                          </div>
                        ))}
                        {(selectedItem.reviews ?? []).length === 0 && (
                          <p className="rounded-lg bg-base-200 p-3 text-sm text-base-content/60">
                            Belum ada review manual.
                          </p>
                        )}
                      </div>
                    </section>
                  </div>

                  <aside className="flex flex-col gap-4">
                    <section className="rounded-lg border border-base-300 p-4">
                      <p className="text-sm font-black">Ops Summary</p>
                      <dl className="mt-4 grid gap-3">
                        <DetailItem label="Stage" value={selectedItem.verification_stage} />
                        <DetailItem label="Risk Score" value={selectedItem.risk_score} />
                        <DetailItem
                          label="Submitted"
                          value={formatAdminDate(selectedItem.submitted_at)}
                        />
                        <DetailItem
                          label="Updated"
                          value={formatAdminDate(selectedItem.updated_at)}
                        />
                        <DetailItem
                          label="Document Progress"
                          value={formatDocumentProgress(selectedItem)}
                        />
                      </dl>
                    </section>

                    <section className="rounded-lg border border-error/20 bg-error/5 p-4">
                      <p className="text-sm font-black">Decision Console</p>
                      <label className="mt-4 block text-xs font-bold uppercase tracking-[0.12em] text-base-content/50">
                        Admin Note
                      </label>
                      <textarea
                        value={actionNote}
                        onChange={(event) => setActionNote(event.target.value)}
                        className="textarea textarea-bordered mt-2 min-h-28 w-full rounded-lg bg-base-100 text-sm"
                        placeholder="Catatan review, alasan reject, atau instruksi revisi..."
                      />
                      <div className="mt-3 grid gap-2">
                        <button
                          type="button"
                          disabled={Boolean(workingAction)}
                          onClick={() => void submitAction("approve")}
                          className="btn h-10 min-h-10 rounded-lg border-none bg-emerald-600 px-4 text-sm text-white shadow-none hover:bg-emerald-700 disabled:opacity-60"
                        >
                          {workingAction === "approve" ? "Approving..." : copy.approve}
                        </button>
                        <button
                          type="button"
                          disabled={Boolean(workingAction)}
                          onClick={() => void submitAction("resubmission")}
                          className="btn h-10 min-h-10 rounded-lg border-none bg-amber-500 px-4 text-sm text-white shadow-none hover:bg-amber-600 disabled:opacity-60"
                        >
                          {workingAction === "resubmission"
                            ? "Sending..."
                            : copy.resubmission}
                        </button>
                        <button
                          type="button"
                          disabled={Boolean(workingAction)}
                          onClick={() => void submitAction("reject")}
                          className="btn h-10 min-h-10 rounded-lg border-none bg-error px-4 text-sm text-error-content shadow-none hover:opacity-90 disabled:opacity-60"
                        >
                          {workingAction === "reject" ? "Rejecting..." : copy.reject}
                        </button>
                      </div>
                    </section>
                  </aside>
                </div>
              </div>
            )}
          </section>
        </main>
      </div>
    </div>
  );
}

function DetailItem({
  label,
  value,
  wide = false,
}: {
  label: string;
  value?: string | null;
  wide?: boolean;
}) {
  return (
    <div className={wide ? "sm:col-span-2" : undefined}>
      <dt className="text-xs font-bold uppercase tracking-[0.12em] text-base-content/45">
        {label}
      </dt>
      <dd className="mt-1 break-words text-sm font-semibold text-base-content/80">
        {value || "-"}
      </dd>
    </div>
  );
}

function AdminDisputeDetailPanel({
  selectedDispute,
  mediatorNote,
  setMediatorNote,
  workingDisputeAction,
  onResolve,
}: {
  selectedDispute: AdminDisputeItem | null;
  mediatorNote: string;
  setMediatorNote: (value: string) => void;
  workingDisputeAction: AdminDisputeResolution | "auto-release" | null;
  onResolve: (resolution: AdminDisputeResolution) => void;
}) {
  if (!selectedDispute) {
    return (
      <div className="flex min-h-[520px] items-center justify-center p-6 text-center">
        <div>
          <p className="text-lg font-black">Belum ada dispute aktif.</p>
          <p className="mt-2 max-w-md text-sm text-base-content/60">
            Kasus dispute aktif akan muncul setelah Giver atau Runner membuka sengketa.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      <div className="border-b border-base-300 p-5">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-base-content/45">
              Dispute Detail
            </p>
            <h2 className="mt-2 text-2xl font-black">
              {resolveDisputeDisplayName(selectedDispute)}
            </h2>
            <p className="mt-1 text-sm text-base-content/60">
              {resolveDisputeMeta(selectedDispute)}
            </p>
          </div>
          <span
            className={`w-fit rounded-full border px-3 py-1 text-xs font-black uppercase ${resolveDisputeStatusTone(
              selectedDispute.status,
            )}`}
          >
            {selectedDispute.status}
          </span>
        </div>
      </div>

      <div className="grid gap-4 p-5 xl:grid-cols-[1fr_minmax(18rem,22rem)]">
        <div className="flex flex-col gap-4">
          <section className="rounded-lg border border-base-300 p-4">
            <p className="text-sm font-black">Case Snapshot</p>
            <dl className="mt-4 grid gap-3 sm:grid-cols-2">
              <DetailItem label="Quest ID" value={selectedDispute.questId} />
              <DetailItem label="Assignment ID" value={selectedDispute.assignmentId} />
              <DetailItem label="Raised By" value={selectedDispute.raisedBy} />
              <DetailItem label="Escrow Amount" value={selectedDispute.amount} />
              <DetailItem label="Raised At" value={formatAdminDate(selectedDispute.raisedAt)} />
              <DetailItem label="Evidence Deadline" value={formatAdminDate(selectedDispute.evidenceDeadline)} />
              <DetailItem label="Reason" value={selectedDispute.reason} wide />
            </dl>
          </section>

          <section className="rounded-lg border border-base-300 p-4">
            <p className="text-sm font-black">Evidence</p>
            <div className="mt-3 grid gap-3 lg:grid-cols-2">
              <AdminEvidenceList title="Giver Evidence" items={selectedDispute.giverEvidence ?? []} />
              <AdminEvidenceList title="Runner Evidence" items={selectedDispute.runnerEvidence ?? []} />
            </div>
          </section>

          <section className="rounded-lg border border-base-300 p-4">
            <p className="text-sm font-black">Timeline</p>
            <div className="mt-3 grid gap-2">
              {(selectedDispute.timeline ?? []).map((event) => (
                <div key={event.id ?? `${event.status}-${event.time}`} className="rounded-lg bg-base-200 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-bold">{event.status}</p>
                    <p className="text-xs text-base-content/55">{formatAdminDate(event.time)}</p>
                  </div>
                  <p className="mt-1 text-xs leading-relaxed text-base-content/65">
                    {event.description || "-"}
                  </p>
                </div>
              ))}
              {(selectedDispute.timeline ?? []).length === 0 && (
                <p className="rounded-lg bg-base-200 p-3 text-sm text-base-content/60">
                  Timeline belum tersedia.
                </p>
              )}
            </div>
          </section>
        </div>

        <aside className="flex flex-col gap-4">
          <section className="rounded-lg border border-base-300 p-4">
            <p className="text-sm font-black">Settlement</p>
            <dl className="mt-4 grid gap-3">
              <DetailItem label="Giver" value={selectedDispute.settlement?.giver_amount} />
              <DetailItem label="Runner" value={selectedDispute.settlement?.runner_amount} />
              <DetailItem label="Mediation Fee" value={selectedDispute.settlement?.mediation_fee} />
              <DetailItem label="Mediator Note" value={selectedDispute.mediatorNote} />
            </dl>
          </section>

          <section className="rounded-lg border border-error/20 bg-error/5 p-4">
            <p className="text-sm font-black">Mediator Decision</p>
            <label className="mt-4 block text-xs font-bold uppercase tracking-[0.12em] text-base-content/50">
              Mediator Note
            </label>
            <textarea
              value={mediatorNote}
              onChange={(event) => setMediatorNote(event.target.value)}
              className="textarea textarea-bordered mt-2 min-h-28 w-full rounded-lg bg-base-100 text-sm"
              placeholder="Ringkasan bukti, alasan keputusan, dan catatan settlement..."
            />
            <div className="mt-3 grid gap-2">
              <button
                type="button"
                disabled={Boolean(workingDisputeAction)}
                onClick={() => onResolve("resolved_runner")}
                className="btn h-10 min-h-10 rounded-lg border-none bg-emerald-600 px-4 text-sm text-white shadow-none hover:bg-emerald-700 disabled:opacity-60"
              >
                {workingDisputeAction === "resolved_runner" ? "Resolving..." : "Resolved Runner"}
              </button>
              <button
                type="button"
                disabled={Boolean(workingDisputeAction)}
                onClick={() => onResolve("resolved_giver")}
                className="btn h-10 min-h-10 rounded-lg border-none bg-sky-600 px-4 text-sm text-white shadow-none hover:bg-sky-700 disabled:opacity-60"
              >
                {workingDisputeAction === "resolved_giver" ? "Resolving..." : "Resolved Giver"}
              </button>
              <button
                type="button"
                disabled={Boolean(workingDisputeAction)}
                onClick={() => onResolve("resolved_partial")}
                className="btn h-10 min-h-10 rounded-lg border-none bg-amber-500 px-4 text-sm text-white shadow-none hover:bg-amber-600 disabled:opacity-60"
              >
                {workingDisputeAction === "resolved_partial" ? "Resolving..." : "Resolved Partial"}
              </button>
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}

function AdminEvidenceList({
  title,
  items,
}: {
  title: string;
  items: AdminDisputeItem["giverEvidence"];
}) {
  const evidenceItems = items ?? [];
  return (
    <div className="rounded-lg bg-base-200 p-3">
      <p className="text-xs font-black uppercase tracking-[0.12em] text-base-content/45">
        {title}
      </p>
      <div className="mt-3 grid gap-2">
        {evidenceItems.length === 0 ? (
          <p className="rounded-lg bg-base-100 p-3 text-xs text-base-content/60">
            Belum ada evidence.
          </p>
        ) : (
          evidenceItems.map((evidence) => (
            <div key={evidence.id ?? `${evidence.label}-${evidence.uploadedAt}`} className="rounded-lg bg-base-100 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-bold">{evidence.label || evidence.file_name || "Evidence"}</p>
                <span className="rounded-full bg-base-200 px-2 py-1 text-[10px] font-black">
                  {evidence.type}
                </span>
              </div>
              {evidence.note_text ? (
                <p className="mt-1 text-xs leading-relaxed text-base-content/65">
                  {evidence.note_text}
                </p>
              ) : null}
              {evidence.url && isPreviewableDisputeImage(evidence) ? (
                <a
                  href={evidence.url}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-3 block overflow-hidden rounded-lg border border-base-300"
                >
                  <img
                    src={evidence.url}
                    alt={`${evidence.label ?? "Evidence"} dispute`}
                    className="max-h-56 w-full object-contain"
                  />
                </a>
              ) : evidence.url ? (
                <a
                  href={evidence.url}
                  target="_blank"
                  rel="noreferrer"
                  className="btn mt-3 h-8 min-h-8 rounded-lg border border-base-300 bg-base-100 px-3 text-xs shadow-none hover:bg-base-300"
                >
                  Buka Evidence
                </a>
              ) : null}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
