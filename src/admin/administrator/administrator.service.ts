import GlobalEndpoint, { ApiRequestError, requestJson } from "../../app/global.service";

export type AdminVerificationUser = {
  auth_user_id?: string;
  fullname?: string;
  username?: string;
  email?: string;
  phone?: string;
  user_role?: string;
  authorization?: string;
  can_post_quest?: boolean;
};

export type AdminVerificationDocumentSummary = {
  required_ready?: number;
  required_total?: number;
  ktp_front?: boolean;
  selfie?: boolean;
  selfie_with_ktp?: boolean;
  total_documents?: number;
};

export type AdminVerificationDocument = {
  id?: string;
  document_type?: string;
  file_key?: string;
  file_url?: string;
  mime_type?: string;
  file_size?: string;
  validation_status?: string;
  uploaded_at?: string;
};

export type AdminVerificationReview = {
  id?: string;
  review_type?: string;
  review_result?: string;
  reviewer_id?: string;
  reviewer_role?: string;
  review_notes?: string;
  decision_reason_code?: string;
  decision_reason_detail?: string;
  created_at?: string;
};

export type AdminVerificationItem = {
  verification_profile_id: string;
  auth_user_id: string;
  user?: AdminVerificationUser;
  full_legal_name?: string;
  nik?: string;
  birth_place?: string;
  birth_date?: string;
  gender?: string;
  occupation?: string;
  province?: string;
  city?: string;
  district?: string;
  sub_district?: string;
  postal_code?: string;
  full_address?: string;
  domicile_same_as_ktp?: boolean;
  verification_status?: string;
  verification_stage?: string;
  risk_score?: string;
  risk_flags?: string[];
  submitted_at?: string;
  reviewed_at?: string;
  approved_at?: string;
  rejected_at?: string;
  rejection_reason_code?: string;
  rejection_reason_detail?: string;
  needs_resubmission?: boolean;
  created_at?: string;
  updated_at?: string;
  document_summary?: AdminVerificationDocumentSummary;
  documents?: AdminVerificationDocument[];
  reviews?: AdminVerificationReview[];
};

export type AdminVerificationListResponse = {
  success: boolean;
  message: string;
  data?: {
    items?: AdminVerificationItem[];
    total?: number;
  };
};

export type AdminVerificationDetailResponse = {
  success: boolean;
  message: string;
  data?: AdminVerificationItem;
};

export type AdminVerificationDecisionPayload = {
  review_notes?: string;
  decision_reason_code?: string;
  decision_reason_detail?: string;
};

export type AdminDisputeEvidence = {
  id?: string;
  uploader?: "GIVER" | "RUNNER" | "MEDIATOR" | string;
  type?: string;
  label?: string;
  note_text?: string;
  file_name?: string;
  url?: string;
  uploadedAt?: string;
  metadata?: Record<string, unknown>;
};

export type AdminDisputeTimelineItem = {
  id?: string;
  actor?: string;
  status?: string;
  description?: string;
  time?: string;
};

export type AdminDisputeItem = {
  id: string;
  questId?: string;
  questTitle?: string;
  questStatus?: string;
  assignmentId?: string;
  giverAuthUserId?: string;
  runnerAuthUserId?: string;
  raisedBy?: string;
  raisedAt?: string;
  status?: string;
  status_raw?: string;
  reason?: string;
  amount?: string;
  evidenceDeadline?: string;
  mediatorNote?: string;
  resolvedAt?: string;
  giverEvidence?: AdminDisputeEvidence[];
  runnerEvidence?: AdminDisputeEvidence[];
  evidence_total?: number;
  timeline?: AdminDisputeTimelineItem[];
  settlement?: {
    giver_amount?: string;
    runner_amount?: string;
    mediation_fee?: string;
  };
  updatedAt?: string;
};

export type AdminDisputeListResponse = {
  success: boolean;
  message: string;
  data?: {
    items?: AdminDisputeItem[];
    total?: number;
  };
};

export type AdminDisputeDetailResponse = {
  success: boolean;
  message: string;
  data?: AdminDisputeItem;
};

export type AdminDisputeResolution = "resolved_runner" | "resolved_giver" | "resolved_partial";

export type AdminDisputeDecisionPayload = {
  resolution: AdminDisputeResolution;
  mediator_note?: string;
};

export type AdminAutoReleaseSweepResponse = {
  success: boolean;
  message: string;
  data?: {
    timeout_hours?: number;
    checked_total?: number;
    released_total?: number;
    items?: Array<{
      assignment_id?: string;
      quest_id?: string;
      quest_title?: string;
      released?: boolean;
      skipped_reason?: string;
      auto_release_at?: string;
    }>;
  };
};

export const adminVerificationCopy = {
  title: "Admin Verification Ops",
  subtitle:
    "Queue compliance ringan untuk approve, reject, atau minta resubmission KYC calon Quest Giver.",
  emptyTitle: "Belum ada verification yang perlu direview.",
  emptyDescription:
    "User yang submit verification akan muncul di panel ini setelah backend menerima status submitted/manual review.",
  loading: "Memuat verification queue...",
  approve: "Approve",
  reject: "Reject",
  resubmission: "Minta Revisi",
  refresh: "Refresh",
};

export const adminDisputeCopy = {
  title: "Admin Trust Ops",
  subtitle:
    "Queue dispute evidence-based untuk mediasi escrow: resolved_runner, resolved_giver, atau resolved_partial.",
  emptyTitle: "Belum ada dispute aktif.",
  emptyDescription: "Dispute dari Giver/Runner akan muncul di queue ini setelah kasus dibuat.",
  loading: "Memuat dispute queue...",
  refresh: "Refresh",
};

export async function fetchAdminVerificationQueue(): Promise<AdminVerificationItem[]> {
  const response = await requestJson<AdminVerificationListResponse>(
    `${GlobalEndpoint().admin.verifications}?status=review_queue`,
  );

  if (!response.success) {
    throw new ApiRequestError(response.message || "Daftar verification admin tidak valid.", 500);
  }

  return response.data?.items ?? [];
}

export async function fetchAdminVerificationDetail(
  verificationId: string,
): Promise<AdminVerificationItem> {
  const response = await requestJson<AdminVerificationDetailResponse>(
    GlobalEndpoint().admin.verificationDetail(verificationId),
  );

  if (!response.success || !response.data) {
    throw new ApiRequestError(response.message || "Detail verification admin tidak valid.", 500);
  }

  return response.data;
}

export async function approveAdminVerification(
  verificationId: string,
  payload: AdminVerificationDecisionPayload,
): Promise<AdminVerificationItem> {
  return submitAdminVerificationDecision(
    GlobalEndpoint().admin.approveVerification(verificationId),
    payload,
  );
}

export async function rejectAdminVerification(
  verificationId: string,
  payload: AdminVerificationDecisionPayload,
): Promise<AdminVerificationItem> {
  return submitAdminVerificationDecision(
    GlobalEndpoint().admin.rejectVerification(verificationId),
    payload,
  );
}

export async function requestAdminVerificationResubmission(
  verificationId: string,
  payload: AdminVerificationDecisionPayload,
): Promise<AdminVerificationItem> {
  return submitAdminVerificationDecision(
    GlobalEndpoint().admin.requestVerificationResubmission(verificationId),
    payload,
  );
}

async function submitAdminVerificationDecision(
  url: string,
  payload: AdminVerificationDecisionPayload,
): Promise<AdminVerificationItem> {
  const response = await requestJson<AdminVerificationDetailResponse>(url, {
    method: "POST",
    body: payload,
  });

  if (!response.success || !response.data) {
    throw new ApiRequestError(response.message || "Keputusan verification admin tidak valid.", 500);
  }

  return response.data;
}

export async function fetchAdminDisputeQueue(): Promise<AdminDisputeItem[]> {
  const response = await requestJson<AdminDisputeListResponse>(
    `${GlobalEndpoint().admin.disputes}?status=open`,
  );

  if (!response.success) {
    throw new ApiRequestError(response.message || "Daftar dispute admin tidak valid.", 500);
  }

  return response.data?.items ?? [];
}

export async function fetchAdminDisputeDetail(disputeId: string): Promise<AdminDisputeItem> {
  const response = await requestJson<AdminDisputeDetailResponse>(
    GlobalEndpoint().admin.disputeDetail(disputeId),
  );

  if (!response.success || !response.data) {
    throw new ApiRequestError(response.message || "Detail dispute admin tidak valid.", 500);
  }

  return response.data;
}

export async function submitAdminDisputeDecision(
  disputeId: string,
  payload: AdminDisputeDecisionPayload,
): Promise<AdminDisputeItem> {
  const response = await requestJson<AdminDisputeDetailResponse>(
    GlobalEndpoint().admin.mediateDispute(disputeId),
    {
      method: "POST",
      body: payload,
    },
  );

  if (!response.success || !response.data) {
    throw new ApiRequestError(response.message || "Keputusan dispute admin tidak valid.", 500);
  }

  return response.data;
}

export async function runAdminAutoReleaseSweep(timeoutHours = 24): Promise<AdminAutoReleaseSweepResponse["data"]> {
  const response = await requestJson<AdminAutoReleaseSweepResponse>(
    GlobalEndpoint().admin.autoReleaseSweep,
    {
      method: "POST",
      body: { timeout_hours: timeoutHours },
    },
  );

  if (!response.success) {
    throw new ApiRequestError(response.message || "Auto-release sweep gagal.", 500);
  }

  return response.data;
}
