import {
  adminDisputeCopy,
  adminVerificationCopy,
  type AdminDisputeDecisionPayload,
  type AdminDisputeEvidence,
  type AdminDisputeItem,
  type AdminDisputeResolution,
  type AdminVerificationDocument,
  approveAdminVerification,
  fetchAdminDisputeDetail,
  fetchAdminDisputeQueue,
  fetchAdminVerificationDetail,
  fetchAdminVerificationQueue,
  rejectAdminVerification,
  requestAdminVerificationResubmission,
  runAdminAutoReleaseSweep,
  submitAdminDisputeDecision,
  type AdminVerificationDecisionPayload,
  type AdminVerificationItem,
} from "./administrator.service";

export type AdminVerificationAction = "approve" | "reject" | "resubmission";
export type AdminConsoleQueue = "verification" | "dispute";
export type { AdminVerificationItem };
export type { AdminDisputeEvidence, AdminDisputeItem, AdminDisputeResolution };

export type AdminStatCard = {
  label: string;
  value: string;
  hint: string;
};

export function getAdministratorCopy() {
  return adminVerificationCopy;
}

export function getAdminDisputeCopy() {
  return adminDisputeCopy;
}

export async function loadAdminVerificationQueue(): Promise<AdminVerificationItem[]> {
  return fetchAdminVerificationQueue();
}

export async function loadAdminVerificationDetail(
  verificationId: string,
): Promise<AdminVerificationItem> {
  return fetchAdminVerificationDetail(verificationId);
}

export async function submitAdminVerificationAction(
  action: AdminVerificationAction,
  item: AdminVerificationItem,
  payload: AdminVerificationDecisionPayload,
): Promise<AdminVerificationItem> {
  const verificationId = item.verification_profile_id;
  if (action === "approve") {
    return approveAdminVerification(verificationId, payload);
  }
  if (action === "reject") {
    return rejectAdminVerification(verificationId, payload);
  }
  return requestAdminVerificationResubmission(verificationId, payload);
}

export async function loadAdminDisputeQueue(): Promise<AdminDisputeItem[]> {
  return fetchAdminDisputeQueue();
}

export async function loadAdminDisputeDetail(disputeId: string): Promise<AdminDisputeItem> {
  return fetchAdminDisputeDetail(disputeId);
}

export async function submitAdminDisputeAction(
  item: AdminDisputeItem,
  payload: AdminDisputeDecisionPayload,
): Promise<AdminDisputeItem> {
  return submitAdminDisputeDecision(item.id, payload);
}

export async function runAdminAutoRelease(timeoutHours = 24) {
  return runAdminAutoReleaseSweep(timeoutHours);
}

export function buildAdminStatCards(items: AdminVerificationItem[]): AdminStatCard[] {
  const submitted = items.filter((item) => item.verification_status === "submitted").length;
  const manualReview = items.filter((item) =>
    ["document_check", "face_check", "risk_review", "manual_review"].includes(
      item.verification_status ?? "",
    ),
  ).length;
  const completeDocs = items.filter((item) => {
    const summary = item.document_summary;
    return (summary?.required_ready ?? 0) >= (summary?.required_total ?? 3);
  }).length;

  return [
    {
      label: "Queue Aktif",
      value: String(items.length),
      hint: "Submitted dan review states",
    },
    {
      label: "Submitted",
      value: String(submitted),
      hint: "Menunggu sentuhan admin",
    },
    {
      label: "Manual Review",
      value: String(manualReview),
      hint: "Masuk screening lanjutan",
    },
    {
      label: "Dokumen Lengkap",
      value: String(completeDocs),
      hint: "KTP + selfie + selfie KTP",
    },
  ];
}

export function buildAdminDisputeStatCards(items: AdminDisputeItem[]): AdminStatCard[] {
  const underReview = items.filter((item) => item.status === "UNDER_REVIEW").length;
  const evidenceTotal = items.reduce((sum, item) => sum + (item.evidence_total ?? 0), 0);
  const runnerRaised = items.filter((item) => item.raisedBy === "RUNNER").length;

  return [
    {
      label: "Dispute Aktif",
      value: String(items.length),
      hint: "Evidence + mediasi",
    },
    {
      label: "Under Review",
      value: String(underReview),
      hint: "Menunggu keputusan",
    },
    {
      label: "Total Evidence",
      value: String(evidenceTotal),
      hint: "File/catatan terkumpul",
    },
    {
      label: "Raised Runner",
      value: String(runnerRaised),
      hint: "Anti ghosting signal",
    },
  ];
}

export function resolveInitialSelectedVerification(
  items: AdminVerificationItem[],
): AdminVerificationItem | null {
  return items[0] ?? null;
}

export function resolveInitialSelectedDispute(items: AdminDisputeItem[]): AdminDisputeItem | null {
  return items[0] ?? null;
}

export function mergeUpdatedVerification(
  items: AdminVerificationItem[],
  updatedItem: AdminVerificationItem,
): AdminVerificationItem[] {
  return items
    .map((item) =>
      item.verification_profile_id === updatedItem.verification_profile_id ? updatedItem : item,
    )
    .filter((item) => isReviewQueueStatus(item.verification_status));
}

export function mergeUpdatedDispute(
  items: AdminDisputeItem[],
  updatedItem: AdminDisputeItem,
): AdminDisputeItem[] {
  return items
    .map((item) => (item.id === updatedItem.id ? updatedItem : item))
    .filter((item) => !["RESOLVED_RUNNER", "RESOLVED_GIVER", "RESOLVED_PARTIAL", "DISMISSED"].includes(item.status ?? ""));
}

export function isReviewQueueStatus(status?: string): boolean {
  return ["submitted", "document_check", "face_check", "risk_review", "manual_review"].includes(
    status ?? "",
  );
}

export function resolveVerificationDisplayName(item: AdminVerificationItem | null): string {
  if (!item) return "Tanpa kandidat";
  return (
    item.full_legal_name?.trim() ||
    item.user?.fullname?.trim() ||
    item.user?.username?.trim() ||
    item.user?.email?.trim() ||
    "Kandidat verification"
  );
}

export function resolveVerificationMeta(item: AdminVerificationItem): string {
  const location = [item.city, item.province].filter(Boolean).join(", ");
  const email = item.user?.email ?? "email belum ada";
  return location ? `${email} | ${location}` : email;
}

export function resolveStatusTone(status?: string): string {
  switch (status) {
    case "approved":
      return "border-emerald-500/30 bg-emerald-500/10 text-emerald-700";
    case "rejected":
      return "border-rose-500/30 bg-rose-500/10 text-rose-700";
    case "resubmission_required":
      return "border-amber-500/30 bg-amber-500/10 text-amber-700";
    case "manual_review":
    case "risk_review":
      return "border-violet-500/30 bg-violet-500/10 text-violet-700";
    default:
      return "border-sky-500/30 bg-sky-500/10 text-sky-700";
  }
}

export function resolveDisputeStatusTone(status?: string): string {
  switch (status) {
    case "RESOLVED_RUNNER":
    case "RESOLVED_GIVER":
    case "RESOLVED_PARTIAL":
      return "border-emerald-500/30 bg-emerald-500/10 text-emerald-700";
    case "UNDER_REVIEW":
      return "border-violet-500/30 bg-violet-500/10 text-violet-700";
    case "EVIDENCE_SUBMISSION":
      return "border-amber-500/30 bg-amber-500/10 text-amber-700";
    default:
      return "border-rose-500/30 bg-rose-500/10 text-rose-700";
  }
}

export function resolveDisputeDisplayName(item: AdminDisputeItem | null): string {
  if (!item) return "Tanpa dispute";
  return item.questTitle?.trim() || item.questId?.trim() || "Dispute case";
}

export function resolveDisputeMeta(item: AdminDisputeItem): string {
  return `${item.amount ?? "Rp 0"} | ${item.raisedBy ?? "UNKNOWN"} | ${item.status ?? "EVIDENCE"}`;
}

export function formatDisputeEvidenceProgress(item: AdminDisputeItem): string {
  const giverCount = item.giverEvidence?.length ?? 0;
  const runnerCount = item.runnerEvidence?.length ?? 0;
  return `${giverCount} evidence Giver / ${runnerCount} evidence Runner`;
}

export function formatAdminDate(value?: string): string {
  if (!value) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;

  return new Intl.DateTimeFormat("id-ID", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(parsed);
}

export function formatDocumentProgress(item: AdminVerificationItem): string {
  const summary = item.document_summary;
  return `${summary?.required_ready ?? 0}/${summary?.required_total ?? 3} dokumen wajib`;
}

export function isPreviewableVerificationImage(document: AdminVerificationDocument): boolean {
  const mimeType = document.mime_type?.trim().toLowerCase() ?? "";
  const fileUrl = document.file_url?.trim().toLowerCase() ?? "";

  if (mimeType === "image/svg+xml" || fileUrl.startsWith("data:image/svg+xml")) {
    return false;
  }

  return mimeType.startsWith("image/") || fileUrl.startsWith("data:image/");
}

export function isPreviewableDisputeImage(evidence: AdminDisputeEvidence): boolean {
  const fileUrl = evidence.url?.trim().toLowerCase() ?? "";
  return fileUrl.startsWith("data:image/") && !fileUrl.startsWith("data:image/svg+xml");
}

export function normalizeDecisionPayload(
  action: AdminVerificationAction,
  note: string,
): AdminVerificationDecisionPayload {
  const trimmedNote = note.trim();
  if (action === "approve") {
    return {
      review_notes: trimmedNote || "Identity verified. Giver access unlocked.",
    };
  }

  return {
    review_notes: trimmedNote,
    decision_reason_code: action === "reject" ? "manual_reject" : "needs_resubmission",
    decision_reason_detail:
      trimmedNote ||
      (action === "reject"
        ? "Data verification belum bisa diterima oleh admin."
        : "User perlu memperbaiki data atau dokumen verification."),
  };
}

export function exitAdministratorToUserLogin(): void {
  if (typeof window === "undefined") {
    return;
  }

  window.dispatchEvent(new Event("qqm-exit-admin-panel"));
}
