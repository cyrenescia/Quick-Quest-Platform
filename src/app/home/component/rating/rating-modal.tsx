import { useState } from "react";
import type { RatingTarget, RatingSubmitPayload } from "./rating-modal";
import {
  estimatePPGain,
  ratingModalCopy,
  ratingTagsByRole,
  resolveScoreColor,
  submitRating,
} from "./rating-modal";

// ─── Props ────────────────────────────────────────────────────────────────────

type RatingModalProps = {
  isOpen: boolean;
  target: RatingTarget;
  onSubmit?: (payload: RatingSubmitPayload) => void;
  onClose: () => void;
};

// ─── Avatar Ring ─────────────────────────────────────────────────────────────

function AvatarRing({ name, score }: { name: string; score: number }) {
  const color = resolveScoreColor(score);
  const fillDeg = score > 0 ? (score / 5) * 360 : 0;
  return (
    <div className="relative mx-auto flex h-24 w-24 items-center justify-center">
      {/* Conic gradient ring */}
      <div
        className="absolute inset-0 rounded-full transition-all duration-500"
        style={{
          background:
            score > 0
              ? `conic-gradient(${color} ${fillDeg}deg, #e5e7eb ${fillDeg}deg)`
              : "#e5e7eb",
          padding: "3px",
          borderRadius: "9999px",
        }}
      />
      <div className="absolute inset-[3px] rounded-full bg-base-100" />
      <div
        className="absolute inset-[6px] flex items-center justify-center rounded-full text-3xl font-black transition-all duration-500"
        style={{ background: `${color}18`, color }}
      >
        {name.charAt(0).toUpperCase()}
      </div>
      {score > 0 && (
        <div
          className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full border-2 border-base-100 text-sm font-black text-white shadow-md transition-all duration-300"
          style={{ background: color }}
        >
          {score}
        </div>
      )}
    </div>
  );
}

// ─── Star Selector ───────────────────────────────────────────────────────────

function StarSelector({
  score,
  onChange,
}: {
  score: number;
  onChange: (s: number) => void;
}) {
  const [hovered, setHovered] = useState(0);
  const activeScore = hovered || score;

  return (
    <div className="flex items-center justify-center gap-2">
      {[1, 2, 3, 4, 5].map((s) => {
        const filled = s <= activeScore;
        const color = resolveScoreColor(s <= score ? score : hovered);
        return (
          <button
            key={s}
            type="button"
            id={`rating-star-${s}`}
            onMouseEnter={() => setHovered(s)}
            onMouseLeave={() => setHovered(0)}
            onClick={() => onChange(s)}
            className="focus:outline-none"
            style={{
              transform: filled ? "scale(1.3)" : "scale(1)",
              transition: "transform 0.15s cubic-bezier(0.34, 1.56, 0.64, 1)",
            }}
            aria-label={`Beri ${s} bintang`}
          >
            <svg
              viewBox="0 0 24 24"
              className="h-10 w-10"
              style={{
                fill: filled ? color : "#d1d5db",
                filter: filled
                  ? `drop-shadow(0 0 8px ${color}88)`
                  : "none",
                transition: "fill 0.15s, filter 0.15s",
              }}
            >
              <path d="M12 3.75L14.47 8.76L20 9.56L16 13.46L16.94 19L12 16.4L7.06 19L8 13.46L4 9.56L9.53 8.76L12 3.75Z" />
            </svg>
          </button>
        );
      })}
    </div>
  );
}

// ─── Quick Tag Chips ──────────────────────────────────────────────────────────

function TagChips({
  tags,
  selected,
  onToggle,
}: {
  tags: string[];
  selected: string[];
  onToggle: (tag: string) => void;
}) {
  return (
    <div className="flex flex-wrap justify-center gap-2">
      {tags.map((tag) => {
        const active = selected.includes(tag);
        return (
          <button
            key={tag}
            type="button"
            id={`rating-tag-${tag.replace(/\s+/g, "-").toLowerCase()}`}
            onClick={() => onToggle(tag)}
            className="rounded-full border px-3 py-1.5 text-xs font-semibold transition-all duration-200 focus:outline-none"
            style={
              active
                ? {
                    background:
                      "linear-gradient(135deg, #2563EB, #7c3aed)",
                    borderColor: "transparent",
                    color: "#fff",
                    transform: "scale(1.05)",
                    boxShadow: "0 2px 12px #2563EB44",
                  }
                : {
                    background: "transparent",
                    borderColor: "#e5e7eb",
                    color: "inherit",
                    opacity: 0.7,
                  }
            }
          >
            {active ? "✓ " : ""}{tag}
          </button>
        );
      })}
    </div>
  );
}

// ─── PP Gain Preview ─────────────────────────────────────────────────────────

function PpGainPreview({
  score,
  targetName,
}: {
  score: number;
  targetName: string;
}) {
  const copy = ratingModalCopy;
  const pp = estimatePPGain(score);
  if (score === 0) return null;

  return (
    <div
      className="flex items-center justify-center gap-2 rounded-2xl px-4 py-2.5 text-sm font-bold transition-all duration-300"
      style={{
        background: "linear-gradient(135deg, #2563EB11, #7c3aed11)",
        border: "1px solid #2563EB22",
      }}
    >
      <span className="text-base">⚡</span>
      <span className="text-base-content/80">
        {copy.ppPreviewPrefix}
        <span className="text-[#2563EB]">{pp}</span>
        {copy.ppPreviewSuffix}{" "}
        <span className="text-base-content">{targetName}</span>
      </span>
    </div>
  );
}

// ─── Main Modal ───────────────────────────────────────────────────────────────

export default function RatingModal({
  isOpen,
  target,
  onSubmit,
  onClose,
}: RatingModalProps) {
  const copy = ratingModalCopy;
  const [score, setScore] = useState(0);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [comment, setComment] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [submitState, setSubmitState] = useState<
    "idle" | "loading" | "success"
  >("idle");
  const [tierData, setTierData] = useState<{ changed: boolean; newTier?: string }>({ changed: false });

  const tags = ratingTagsByRole[target.role];

  function toggleTag(tag: string) {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag],
    );
  }

  function resetState() {
    setScore(0);
    setSelectedTags([]);
    setComment("");
    setErrorMessage("");
    setSubmitState("idle");
  }

  function handleClose() {
    resetState();
    onClose();
  }

  async function handleSubmit() {
    if (score === 0) return;
    setSubmitState("loading");
    setErrorMessage("");
    const payload: RatingSubmitPayload = {
      questId: target.questId,
      assignmentId: target.assignmentId,
      targetRole: target.role,
      score,
      tags: selectedTags,
      comment,
    };
    try {
      const result = await submitRating(payload);
      if (result?.tier_progression?.tier_changed) {
        setTierData({ changed: true, newTier: result.tier_progression.current_tier });
      }
      onSubmit?.(payload);
      setSubmitState("success");
      setTimeout(() => {
        resetState();
        onClose();
      }, result?.tier_progression?.tier_changed ? 4000 : 2200);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Gagal mengirim rating.");
      setSubmitState("idle");
    }
  }

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center"
      style={{ background: "rgba(0,0,0,0.6)", backdropFilter: "blur(6px)" }}
      onClick={(e) => {
        if (e.target === e.currentTarget) handleClose();
      }}
    >
      <div
        className="relative w-full max-w-sm overflow-hidden rounded-3xl bg-base-100 shadow-2xl"
        style={{
          animation: "rating-modal-in 0.3s cubic-bezier(0.34, 1.56, 0.64, 1) both",
        }}
      >
        {/* Top gradient strip */}
        <div
          className="h-1 w-full"
          style={{
            background:
              score > 0
                ? `linear-gradient(90deg, ${resolveScoreColor(score)}, #7c3aed)`
                : "linear-gradient(90deg, #e5e7eb, #e5e7eb)",
            transition: "background 0.4s",
          }}
        />

        <div className="p-6">
          {submitState === "success" ? (
            <div className="flex flex-col items-center py-6 animate-in fade-in zoom-in duration-300">
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-success/20 text-4xl text-success">
                ✓
              </div>
              <h3 className="text-xl font-black text-base-content">{copy.successTitle}</h3>
              <p className="mt-2 text-center text-sm font-medium text-base-content/60">
                {copy.successPpText} <span className="font-bold text-base-content">{target.name}</span>.
              </p>
              
              {tierData.changed && (
                <div className="mt-6 rounded-xl border border-primary/30 bg-primary/10 p-4 text-center animate-in slide-in-from-bottom-4 duration-500">
                  <p className="text-xs font-bold uppercase tracking-wider text-primary">🎉 Tier Upgraded!</p>
                  <p className="mt-1 text-sm font-semibold text-base-content/80">
                    Selamat! Kamu naik ke tier <span className="font-black text-primary">{tierData.newTier}</span>!
                  </p>
                </div>
              )}
            </div>
          ) : (
            <>
              {/* Header */}
              <div className="mb-5 flex items-start justify-between">
                <div>
                  <p className="text-xs font-bold uppercase tracking-widest text-base-content/40">
                    {copy.headerLabel}
                  </p>
                  <p className="mt-0.5 text-lg font-black text-base-content">
                    {target.name}
                  </p>
                  <span
                    className="mt-1 inline-block rounded-full px-2.5 py-0.5 text-xs font-bold text-white"
                    style={{
                      background:
                        target.role === "runner"
                          ? "linear-gradient(135deg, #2563EB, #7c3aed)"
                          : "linear-gradient(135deg, #16a34a, #0d9488)",
                    }}
                  >
                    {target.role === "runner" ? "Quest Runner" : "Quest Giver"}
                  </span>
                </div>
                <button
                  type="button"
                  id="rating-modal-close"
                  onClick={handleClose}
                  className="flex h-8 w-8 items-center justify-center rounded-full bg-base-200 text-base-content/50 transition-colors hover:bg-base-300"
                >
                  ✕
                </button>
              </div>

              {/* Quest info */}
              <div className="mb-5 rounded-xl border border-base-200 bg-base-200/50 px-3 py-2">
                <p className="text-[10px] font-semibold uppercase tracking-widest text-base-content/40">
                  {copy.questLabel}
                </p>
                <p className="mt-0.5 text-xs font-semibold text-base-content/80 line-clamp-1">
                  {target.questTitle}
                </p>
              </div>

              {/* Avatar ring */}
              <div className="mb-5">
                <AvatarRing name={target.name} score={score} />
                {score > 0 && (
                  <p className="mt-2 text-center text-xs font-bold text-base-content/60">
                    {copy.scoreLabels[score]}
                  </p>
                )}
              </div>

              {/* Star selector */}
              <div className="mb-2">
                <StarSelector score={score} onChange={setScore} />
              </div>

              {/* PP preview */}
              <div className="mb-4 mt-3 min-h-[40px]">
                <PpGainPreview score={score} targetName={target.name} />
              </div>

              {/* Quick tags */}
              {score > 0 && (
                <div className="mb-4">
                  <p className="mb-2.5 text-center text-xs font-semibold text-base-content/50">
                    {copy.tagSectionLabel}
                  </p>
                  <TagChips
                    tags={tags}
                    selected={selectedTags}
                    onToggle={toggleTag}
                  />
                </div>
              )}

              {/* Comment textarea */}
              {score > 0 && (
                <div className="mb-4 relative">
                  <textarea
                    id="rating-comment"
                    rows={3}
                    maxLength={copy.commentMaxLength}
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    placeholder={copy.commentPlaceholder}
                    className="w-full resize-none rounded-2xl border border-base-200 bg-base-200/50 px-4 py-3 text-sm text-base-content placeholder:text-base-content/30 focus:border-[#2563EB] focus:outline-none focus:ring-2 focus:ring-[#2563EB]/20 transition-all"
                  />
                  <p className="mt-1 text-right text-[10px] text-base-content/35">
                    {comment.length}/{copy.commentMaxLength}
                  </p>
                  {errorMessage ? (
                    <p className="mt-2 rounded-[8px] bg-error/10 px-3 py-2 text-xs font-semibold text-error">
                      {errorMessage}
                    </p>
                  ) : null}
                </div>
              )}

              {/* Actions */}
              <div className="flex flex-col gap-2">
                <button
                  type="button"
                  id="rating-submit-btn"
                  disabled={score === 0 || submitState === "loading"}
                  onClick={() => void handleSubmit()}
                  className="w-full rounded-2xl py-3 text-sm font-bold text-white transition-all duration-200 disabled:opacity-40"
                  style={{
                    background:
                      score > 0
                        ? `linear-gradient(135deg, ${resolveScoreColor(score)}, #7c3aed)`
                        : "#9ca3af",
                    boxShadow:
                      score > 0
                        ? `0 4px 20px ${resolveScoreColor(score)}44`
                        : "none",
                    transform: score > 0 ? "scale(1)" : "scale(0.98)",
                  }}
                >
                  {submitState === "loading"
                    ? copy.loadingText
                    : copy.submitButton}
                </button>
                <button
                  type="button"
                  id="rating-skip-btn"
                  onClick={handleClose}
                  className="w-full py-2 text-xs font-semibold text-base-content/40 hover:text-base-content/70 transition-colors"
                >
                  {copy.skipButton}
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Keyframe injection */}
      <style>{`
        @keyframes rating-modal-in {
          from { opacity: 0; transform: translateY(40px) scale(0.93); }
          to   { opacity: 1; transform: translateY(0)   scale(1);    }
        }
        @keyframes ping {
          0%   { opacity: 0.9; transform: scale(0.5); }
          100% { opacity: 0;   transform: scale(2);   }
        }
      `}</style>
    </div>
  );
}

