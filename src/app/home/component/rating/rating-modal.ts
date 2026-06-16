// ─── Types ────────────────────────────────────────────────────────────────────

export type RatingTarget = {
  name: string;
  role: "runner" | "giver";
  questTitle: string;
  questId: string;
  assignmentId: string;
};

export type RatingSubmitPayload = {
  questId: string;
  assignmentId: string;
  targetRole: "runner" | "giver";
  score: number;
  tags: string[];
  comment: string;
};

// ─── Re-exports (ESVMC) ───────────────────────────────────────────────────────

export {
  ratingModalCopy,
  ratingTagsByRole,
  estimatePPGain,
  resolveScoreColor,
  submitRating,
} from "./rating-modal.service";
