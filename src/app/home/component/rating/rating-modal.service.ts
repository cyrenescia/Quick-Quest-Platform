import GlobalEndpoint, { postJson } from "../../../global.service";
import type { RatingTarget, RatingSubmitPayload } from "./rating-modal";

export const ratingModalCopy = {
  headerLabel: "Beri Rating",
  subLabel: "untuk",
  questLabel: "Quest",
  scoreLabels: ["", "Sangat Buruk", "Kurang Baik", "Cukup Baik", "Baik Sekali", "Luar Biasa!"],
  tagSectionLabel: "Apa yang paling berkesan?",
  commentPlaceholder: "Tambah komentar... (opsional)",
  commentMaxLength: 180,
  ppPreviewPrefix: "Sekitar +",
  ppPreviewSuffix: " PP diterima",
  submitButton: "Kirim Rating",
  skipButton: "Lewati",
  successTitle: "Rating Terkirim!",
  successPpText: "PP diberikan ke",
  loadingText: "Mengirim...",
};

export const ratingTagsByRole: Record<RatingTarget["role"], string[]> = {
  runner: [
    "Kerja Cepat",
    "Rapi & Bersih",
    "Tepat Waktu",
    "Profesional",
    "Ramah",
    "Melebihi Ekspektasi",
    "Komunikatif",
  ],
  giver: [
    "Instruksi Jelas",
    "Responsif",
    "Lokasi Tepat",
    "Bayar Cepat",
    "Ramah",
    "Amanat Transparan",
    "Tidak Ribet",
  ],
};

export function estimatePPGain(score: number): number {
  if (score === 0) return 0;
  const baseGain = [0, 10, 25, 50, 85, 130][score] ?? 0;
  return baseGain;
}

export function resolveScoreColor(score: number): string {
  if (score >= 5) return "#16a34a";
  if (score >= 4) return "#2563EB";
  if (score >= 3) return "#f59e0b";
  if (score >= 2) return "#ea580c";
  if (score >= 1) return "#dc2626";
  return "#9ca3af";
}

type RatingApiRequest = {
  assignment_id: string;
  rating_score: number;
  rating_note?: string;
};

type RatingApiResponse = {
  success?: boolean;
  message?: string;
  data?: {
    rating_id?: string;
    quest_id?: string;
    assignment_id?: string;
    rater_role?: "giver" | "runner" | string;
    rating_score?: number;
    skill_scope?: string;
    pp_delta?: number;
    rating_count?: number;
    unique_rating_count?: number;
    giver_rated?: boolean;
    runner_rated?: boolean;
    both_rated?: boolean;
    tier_progression?: {
      tier_changed?: boolean;
      current_tier?: string;
    };
  };
};

function buildRatingNote(payload: RatingSubmitPayload): string {
  const tags = payload.tags.map((tag) => tag.trim()).filter(Boolean);
  const comment = payload.comment.trim();
  const parts: string[] = [];

  if (tags.length > 0) {
    parts.push(`Tags: ${tags.join(", ")}`);
  }
  if (comment) {
    parts.push(comment);
  }

  return parts.join("\n").slice(0, 500);
}

export async function submitRating(
  payload: RatingSubmitPayload,
): Promise<RatingApiResponse["data"]> {
  const response = await postJson<RatingApiRequest, RatingApiResponse>(
    GlobalEndpoint().rating.create,
    {
      assignment_id: payload.assignmentId,
      rating_score: payload.score,
      rating_note: buildRatingNote(payload),
    },
  );

  return response.data;
}
