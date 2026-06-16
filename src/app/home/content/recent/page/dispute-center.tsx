import { useEffect, useState } from "react";
import { ArrowLeftIcon } from "../../../home.icons";
import { Surface } from "../../../home.ui";
import {
  fetchRecentDisputeDetailFromApi,
  fetchRecentDisputesFromApi,
  submitRecentDisputeEvidenceFromApi,
  type RecentDisputeCase,
  type RecentDisputeEvidence,
} from "../recent.service";
import { type QuestHistoryRow, type RecentViewText } from "../recent";

type DisputeCenterProps = {
  questId: string;
  viewText: RecentViewText;
  historyRows: QuestHistoryRow[];
  onBack: () => void;
};

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : "");
    reader.onerror = () => reject(reader.error ?? new Error("File evidence gagal dibaca."));
    reader.readAsDataURL(file);
  });
}

function resolveEvidenceType(file: File | null): "photo" | "video" | "file" | "note" {
  if (!file) return "note";
  if (file.type.startsWith("image/")) return "photo";
  if (file.type.startsWith("video/")) return "video";
  return "file";
}

function isPreviewableEvidenceImage(evidence: RecentDisputeEvidence): boolean {
  const url = evidence.url?.trim().toLowerCase() ?? "";
  return url.startsWith("data:image/") && !url.startsWith("data:image/svg+xml");
}

function EvidenceList({ title, items }: { title: string; items: RecentDisputeEvidence[] }) {
  return (
    <div className="rounded-[10px] border border-base-300 bg-base-100 p-3">
      <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-base-content/50">
        {title}
      </p>
      <div className="mt-2 space-y-2">
        {items.length === 0 ? (
          <p className="text-xs text-base-content/55">Belum ada evidence.</p>
        ) : (
          items.map((item) => (
            <div key={item.id ?? `${item.label}-${item.uploadedAt}`} className="rounded-[9px] bg-base-200 p-2">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-bold text-base-content">{item.label || item.file_name || "Evidence"}</p>
                <span className="rounded-[7px] bg-base-100 px-2 py-0.5 text-[10px] font-bold text-base-content/60">
                  {item.type || "NOTE"}
                </span>
              </div>
              {item.note_text ? (
                <p className="mt-1 text-xs leading-relaxed text-base-content/65">{item.note_text}</p>
              ) : null}
              {isPreviewableEvidenceImage(item) ? (
                <img
                  src={item.url}
                  alt={item.label || "Evidence dispute"}
                  className="mt-2 max-h-44 w-full rounded-[8px] object-cover"
                />
              ) : item.url ? (
                <a
                  href={item.url}
                  target="_blank"
                  rel="noreferrer"
                  className="btn mt-2 h-8 min-h-8 rounded-[8px] border-none bg-base-100 px-3 text-[11px] font-bold text-primary"
                >
                  Buka File
                </a>
              ) : null}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export function DisputeCenter({ questId, viewText, historyRows, onBack }: DisputeCenterProps) {
  const quest = historyRows.find((q) => q.questId === questId) || historyRows[0];
  const [dispute, setDispute] = useState<RecentDisputeCase | null>(null);
  const [reason, setReason] = useState(viewText.disputeCenter.reasonOptions[0] ?? "Evidence dispute");
  const [note, setNote] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState("");

  async function loadDispute() {
    setIsLoading(true);
    setMessage("");
    try {
      const cases = await fetchRecentDisputesFromApi();
      const match = cases.find(
        (item) => item.id === questId || item.questId === questId || item.assignmentId === questId,
      );
      if (!match) {
        setDispute(null);
        setMessage("Kasus dispute belum ditemukan untuk quest ini.");
        return;
      }
      setDispute(await fetchRecentDisputeDetailFromApi(match.id));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Dispute gagal dimuat.");
      setDispute(null);
    } finally {
      setIsLoading(false);
    }
  }

  async function submitEvidence() {
    if (!dispute?.id) return;
    if (!file && note.trim() === "") {
      setMessage("Isi catatan atau pilih file evidence dulu.");
      return;
    }

    setIsSubmitting(true);
    setMessage("");
    try {
      const fileUrl = file ? await readFileAsDataUrl(file) : "";
      const updated = await submitRecentDisputeEvidenceFromApi(dispute.id, {
        type: resolveEvidenceType(file),
        label: reason.trim() || file?.name || "Evidence dispute",
        note_text: note.trim(),
        file_name: file?.name,
        file_url: fileUrl,
        metadata: file
          ? {
              mime_type: file.type,
              file_size: file.size,
            }
          : undefined,
      });
      setDispute(updated);
      setNote("");
      setFile(null);
      setMessage("Evidence berhasil dikirim.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Evidence gagal dikirim.");
    } finally {
      setIsSubmitting(false);
    }
  }

  useEffect(() => {
    void loadDispute();
  }, [questId]);

  return (
    <div className="flex flex-col gap-4 animate-in fade-in slide-in-from-bottom-4 duration-300">
      <button
        type="button"
        onClick={onBack}
        className="btn btn-sm h-10 self-start rounded-[10px] border-error/30 bg-base-100/50 px-4 text-base-content/80 shadow-sm hover:bg-error/10"
      >
        <ArrowLeftIcon className="size-4" />
        {viewText.disputeCenter.backButton}
      </button>

      <Surface className="relative overflow-hidden border border-error/30 p-5 sm:p-7">
        <div className="relative z-10 grid gap-6 lg:grid-cols-[1fr_23rem]">
          <div>
            <span className="inline-flex items-center gap-1.5 rounded-[8px] bg-error/10 px-2.5 py-1 text-[10px] font-bold text-error">
              <span className="size-2 rounded-full bg-error" />
              {dispute?.status ?? viewText.disputeCenter.frozenBadge}
            </span>
            <h1 className="mt-3 text-2xl font-bold text-base-content">
              {viewText.disputeCenter.pageTitle}
            </h1>
            <p className="mt-1 text-sm text-base-content/60">
              Ref ID: {dispute?.id ?? quest?.questId ?? questId} | {dispute?.questTitle ?? quest?.title}
            </p>

            <div className="mt-6 rounded-[12px] border border-base-300 bg-base-200 p-4">
              <p className="text-xs font-bold text-base-content/70">{viewText.disputeCenter.reasonLabel}</p>
              <select
                className="select select-bordered mt-2 w-full bg-base-100 font-medium"
                value={reason}
                onChange={(event) => setReason(event.target.value)}
              >
                {viewText.disputeCenter.reasonOptions.map((option) => (
                  <option key={option}>{option}</option>
                ))}
              </select>

              <p className="mt-4 text-xs font-bold text-base-content/70">
                {viewText.disputeCenter.descriptionLabel}
              </p>
              <textarea
                className="textarea textarea-bordered mt-2 h-24 w-full bg-base-100 focus:border-error"
                placeholder={viewText.disputeCenter.descriptionPlaceholder}
                value={note}
                onChange={(event) => setNote(event.target.value)}
              />

              <label className="mt-3 flex cursor-pointer items-center justify-center rounded-[10px] border-2 border-dashed border-base-300 bg-base-100/50 p-6 hover:bg-base-200">
                <input
                  type="file"
                  className="hidden"
                  accept="image/*,video/*,.pdf,.doc,.docx,.txt"
                  onChange={(event) => setFile(event.target.files?.[0] ?? null)}
                />
                <span className="text-xs font-bold text-base-content/55">
                  {file ? file.name : viewText.disputeCenter.uploadLabel}
                </span>
              </label>
            </div>

            {message ? (
              <p className="mt-3 rounded-[9px] border border-base-300 bg-base-100 px-3 py-2 text-xs font-semibold text-base-content/70">
                {message}
              </p>
            ) : null}

            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <button
                type="button"
                disabled={isLoading || isSubmitting || !dispute}
                onClick={() => void submitEvidence()}
                className="btn h-12 flex-1 rounded-[10px] border-none bg-error font-bold text-white shadow-lg shadow-error/20 hover:bg-error/90 disabled:bg-base-200 disabled:text-base-content/45"
              >
                {isSubmitting ? "Mengirim..." : viewText.disputeCenter.submitButton}
              </button>
            </div>
          </div>

          <div className="space-y-4">
            <div className="rounded-[12px] border border-[#F59E0B]/30 bg-[#FEF3C7] p-4 text-[#92400E]">
              <p className="text-sm font-bold">{viewText.disputeCenter.policyTitle}</p>
              <ul className="mt-2 list-disc space-y-1.5 pl-4 text-xs opacity-80">
                {viewText.disputeCenter.policyRules.map((rule) => (
                  <li key={rule}>{rule}</li>
                ))}
              </ul>
            </div>

            <EvidenceList title="Evidence Giver" items={dispute?.giverEvidence ?? []} />
            <EvidenceList title="Evidence Runner" items={dispute?.runnerEvidence ?? []} />

            <div className="rounded-[12px] border border-base-300 bg-base-100 p-4">
              <p className="text-[10px] font-bold uppercase tracking-wider text-base-content/50">
                {viewText.disputeCenter.historyTitle}
              </p>
              <div className="mt-3 space-y-3">
                {(dispute?.timeline ?? []).length === 0 ? (
                  <div className="border-l-2 border-base-300 pl-2 text-[11px] text-base-content/70">
                    <p className="font-bold text-base-content">{viewText.disputeCenter.historyEmptyStatus}</p>
                    <p>{viewText.disputeCenter.historyEmptyDesc}</p>
                  </div>
                ) : (
                  dispute?.timeline?.map((item) => (
                    <div key={`${item.status}-${item.time}`} className="border-l-2 border-base-300 pl-2 text-[11px] text-base-content/70">
                      <p className="font-bold text-base-content">{item.status}</p>
                      <p>{item.description}</p>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </Surface>
    </div>
  );
}
