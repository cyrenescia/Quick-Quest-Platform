import { useEffect, useState } from "react";
import { ArrowLeftIcon } from "../../../home.icons";
import { cn, Surface } from "../../../home.ui";
import { giverCandidates, type GiverCandidate } from "../giver";

type ReviewMode = "SELECTION" | "AUDIT";

function AutoReleaseCountdown({ hours }: { hours: number }) {
  const totalSeconds = hours * 3600;
  const [remaining, setRemaining] = useState(totalSeconds);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setRemaining((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, []);

  const h = Math.floor(remaining / 3600);
  const m = Math.floor((remaining % 3600) / 60);
  const s = remaining % 60;
  const pad = (n: number) => n.toString().padStart(2, "0");
  const urgency = remaining < 3600;

  return (
    <div
      className={cn(
        "rounded-[12px] border p-4 transition-colors",
        urgency
          ? "border-error/50 bg-error/5 animate-pulse"
          : "border-[#F59E0B]/40 bg-[#FEF3C7]/50",
      )}
    >
      <p
        className={cn(
          "text-[11px] font-bold uppercase tracking-wider",
          urgency ? "text-error" : "text-[#92400E]",
        )}
      >
        ⏱ Auto-Release Dana
      </p>
      <p className="mt-1 font-mono text-3xl font-bold tracking-widest text-base-content">
        {pad(h)}:{pad(m)}:{pad(s)}
      </p>
      <p className="mt-1 text-[11px] text-base-content/60">
        Jika audit tidak dilakukan, dana otomatis cair ke Runner setelah waktu habis.
      </p>
    </div>
  );
}

type AuditDecision = "TERIMA" | "TUNDA" | "DISPUTE" | null;

function AuditPanel({ onDecide }: { onDecide: (d: AuditDecision) => void }) {
  const [decision, setDecision] = useState<AuditDecision>(null);
  const [confirmed, setConfirmed] = useState(false);

  if (confirmed && decision) {
    const config = {
      TERIMA: { bg: "bg-[#F0FDF4] border-[#BBF7D0]", text: "text-[#166534]", icon: "✅", msg: "Dana escrow otomatis cair ke Runner. Transaksi selesai." },
      TUNDA:  { bg: "bg-[#FEF3C7] border-[#FDE68A]",  text: "text-[#92400E]", icon: "⏸", msg: "Runner mendapat waktu revisi 30 menit. Pastikan hasil akhir sesuai." },
      DISPUTE:{ bg: "bg-[#FFF1F2] border-[#FCA5A5]",  text: "text-[#991B1B]", icon: "⚠️", msg: "Sengketa aktif. Dana ditahan hingga mediasi selesai. Tim QQ akan menghubungi." },
    }[decision];
    return (
      <div className={cn("rounded-[12px] border p-5 animate-in fade-in duration-300", config.bg)}>
        <p className={cn("text-2xl mb-2")}>{config.icon}</p>
        <p className={cn("text-sm font-bold", config.text)}>Keputusan: {decision}</p>
        <p className={cn("text-xs mt-1", config.text + "/80")}>{config.msg}</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="text-xs font-bold uppercase tracking-wider text-base-content/55">
        Audit Hasil Pekerjaan
      </p>
      <p className="text-sm text-base-content/70">
        Runner telah menekan "Selesai Kerja". Periksa hasil pekerjaan, lalu pilih keputusan:
      </p>
      <div className="grid gap-2">
        {(
          [
            {
              d: "TERIMA" as AuditDecision,
              label: "✅ Terima — Dana Cair",
              desc: "Pekerjaan sesuai ekspektasi. Dana escrow otomatis cair ke Runner.",
              classes: "border-[#10B981]/40 bg-[#F0FDF4] hover:bg-[#DCFCE7] text-[#166534]",
            },
            {
              d: "TUNDA" as AuditDecision,
              label: "⏸ Tunda — Revisi 30 Menit",
              desc: "Ada hal yang perlu diperbaiki. Runner diberi waktu 30 menit.",
              classes: "border-[#F59E0B]/40 bg-[#FEF3C7] hover:bg-[#FDE68A]/50 text-[#92400E]",
            },
            {
              d: "DISPUTE" as AuditDecision,
              label: "⚠️ Dispute — Eskalasi Mediasi",
              desc: "Tidak sesuai dan tidak sepakat. Masuk mekanisme penyelesaian sengketa.",
              classes: "border-error/40 bg-error/5 hover:bg-error/10 text-error",
            },
          ]
        ).map((item) => (
          <button
            key={item.d}
            type="button"
            onClick={() => setDecision(item.d)}
            className={cn(
              "rounded-[10px] border p-3 text-left transition-all",
              item.classes,
              decision === item.d && "ring-2 ring-offset-1 ring-current",
            )}
          >
            <p className="text-sm font-bold">{item.label}</p>
            <p className="text-[11px] mt-0.5 opacity-80">{item.desc}</p>
          </button>
        ))}
      </div>
      {decision && (
        <button
          type="button"
          onClick={() => { setConfirmed(true); onDecide(decision); }}
          className="btn h-11 w-full rounded-[10px] border-none bg-primary text-primary-content font-bold shadow-none hover:opacity-90 active:scale-95 transition-transform"
        >
          Konfirmasi Keputusan: {decision}
        </button>
      )}
    </div>
  );
}

export function CandidateReview({
  candidateId,
  candidate: candidateOverride,
  isWorking = false,
  onConfirm,
  onReject,
  onBack,
  mode = "SELECTION",
}: {
  candidateId: string;
  candidate?: GiverCandidate;
  isWorking?: boolean;
  onConfirm?: (assignmentId: string) => void | Promise<void>;
  onReject?: (assignmentId: string) => void | Promise<void>;
  onBack: () => void;
  mode?: ReviewMode;
}) {
  const candidate = candidateOverride || giverCandidates.find((c) => c.id === candidateId) || giverCandidates[0];
  const canDecideCandidate = mode === "SELECTION" && Boolean(candidate.assignmentId);

  return (
    <div className="flex flex-col gap-4 animate-in fade-in slide-in-from-bottom-4 duration-300">
      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={onBack}
          className="btn btn-sm border-base-300 bg-base-100/50 hover:bg-base-200 self-start gap-2 h-10 px-4 rounded-[10px] text-base-content/80 shadow-sm"
        >
          <ArrowLeftIcon className="size-4" />
          {mode === "AUDIT" ? "Kembali ke Quest Monitor" : "Kembali ke Candidate Pool"}
        </button>
        <span
          className={cn(
            "rounded-[8px] px-3 py-1 text-xs font-bold",
            mode === "AUDIT"
              ? "bg-[#DBEAFE] text-[#1D4ED8]"
              : "bg-base-200 text-base-content/70",
          )}
        >
          {mode === "AUDIT" ? "Mode Audit Hasil" : "Mode Seleksi Kandidat"}
        </span>
      </div>

      <Surface className="p-5 sm:p-7 relative overflow-hidden">
        <div
          className={cn(
            "absolute top-0 right-0 h-40 w-40 rounded-bl-[100px] blur-2xl pointer-events-none",
            mode === "AUDIT" ? "bg-[#3B82F6]/10" : "bg-[#2563EB]/10",
          )}
        />
        <p
          className={cn(
            "text-xs font-semibold uppercase tracking-[0.16em]",
            mode === "AUDIT" ? "text-[#3B82F6]" : "text-[#2563EB]",
          )}
        >
          {mode === "AUDIT" ? "Audit Pekerjaan Runner" : "Candidate Examination"}
        </p>

        <div className="mt-6 flex flex-col md:flex-row gap-6 relative z-10">
          <div className="flex-shrink-0 flex flex-col items-center justify-center p-4 border border-base-300/70 rounded-[16px] bg-base-100 min-w-[160px]">
            <div className="size-24 rounded-full bg-gradient-to-br from-[#2563EB] to-[#60A5FA] p-1 shadow-lg">
              <div className="size-full rounded-full bg-base-100 flex items-center justify-center text-3xl">😎</div>
            </div>
            <h1 className="mt-4 text-xl font-bold text-base-content text-center">{candidate.name}</h1>
            <span className="mt-1.5 inline-flex rounded-[8px] bg-[#E0F2FE] px-2.5 py-0.5 text-[11px] font-bold text-[#0369A1] ring-1 ring-[#0369A1]/20">
              {candidate.reliabilityBadge}
            </span>
            {candidate.questTitle ? (
              <div className="mt-3 rounded-[8px] bg-base-200 px-2.5 py-1.5 text-center">
                <p className="text-[10px] font-bold uppercase text-base-content/50">Quest</p>
                <p className="text-xs font-bold text-base-content">{candidate.questTitle}</p>
              </div>
            ) : null}
            {mode === "AUDIT" && (
              <div className="mt-3 rounded-[8px] bg-[#DBEAFE] px-2.5 py-1.5 text-center">
                <p className="text-[10px] font-bold text-[#1D4ED8] uppercase">Status</p>
                <p className="text-xs font-bold text-[#1D4ED8]">Menunggu Audit ⏳</p>
              </div>
            )}
          </div>

          <div className="flex-1 grid sm:grid-cols-2 gap-4">
            <div className="rounded-[12px] border border-base-300/70 bg-base-100 p-4">
              <p className="text-[10px] font-bold uppercase tracking-wider text-base-content/50">
                Tracking Locator
              </p>
              <div className="mt-2 flex items-baseline gap-1.5">
                <p className="text-2xl font-bold text-base-content">{candidate.distanceKm}</p>
                <span className="text-sm font-semibold text-base-content/60">KM Jarak</span>
              </div>
              <p className="text-xs text-base-content/60 mt-1">
                <span className="text-success font-semibold px-1.5 py-0.5 text-[10px] bg-success/10 rounded">
                  {candidate.appliedAt ? "APPLIED" : "LIVE ETA"}
                </span>{" "}
                {candidate.appliedAt || `Estimasi ${candidate.etaMinutes} menit ke lokasi`}
              </p>
            </div>

            <div className="rounded-[12px] border border-base-300/70 bg-base-100 p-4">
              <p className="text-[10px] font-bold uppercase tracking-wider text-base-content/50">
                Skill Matrix Match
              </p>
              <p className="mt-2 text-2xl font-bold text-[#10B981]">{candidate.matchScore}% Valid</p>
              <p className="text-xs text-base-content/60 mt-1 font-medium">{candidate.skill}</p>
            </div>

            <div className="rounded-[12px] border border-base-300/70 bg-base-100 p-4 sm:col-span-2">
              <p className="text-[10px] font-bold uppercase tracking-wider text-base-content/50">
                Histori & Track Record Platform
              </p>
              <div className="mt-3 grid grid-cols-3 gap-3">
                <div className="p-3 bg-base-200/50 rounded-[8px] text-center">
                  <p className="text-2xl font-bold text-base-content">{candidate.completionRate}</p>
                  <p className="text-[10px] font-semibold text-base-content/60 mt-1 uppercase">Berhasil</p>
                </div>
                <div className="p-3 bg-error/5 rounded-[8px] text-center">
                  <p className="text-2xl font-bold text-error">{candidate.disputeRatio}</p>
                  <p className="text-[10px] font-semibold text-base-content/60 mt-1 uppercase">Dispute</p>
                </div>
                <div className="p-3 bg-[#DBEAFE] rounded-[8px] text-center">
                  <p className="text-2xl font-bold text-[#1D4ED8]">4.8</p>
                  <p className="text-[10px] font-semibold text-[#1D4ED8]/70 mt-1 uppercase">Rating</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ── AUTO-RELEASE COUNTDOWN (only in AUDIT mode) ── */}
        {mode === "AUDIT" && (
          <div className="mt-6 relative z-10">
            <AutoReleaseCountdown hours={24} />
          </div>
        )}

        {/* ── ACTION BUTTONS ── */}
        <div className="mt-8 border-t border-base-200 pt-6 relative z-10">
          {mode === "SELECTION" ? (
            <div className="flex flex-col sm:flex-row gap-3">
              <button
                type="button"
                disabled={!canDecideCandidate || isWorking}
                onClick={() => {
                  if (candidate.assignmentId) {
                    void onConfirm?.(candidate.assignmentId);
                  }
                }}
                className="btn h-12 flex-1 rounded-[10px] border-none bg-[#2563EB] text-white hover:bg-[#2563EB]/90 text-sm sm:text-base font-bold shadow-lg shadow-[#2563EB]/30 transition-transform active:scale-95"
              >
                {isWorking ? "Memproses..." : "Pilih & Tugaskan Kandidat"}
              </button>
              <button
                type="button"
                disabled={!canDecideCandidate || isWorking}
                onClick={() => {
                  if (candidate.assignmentId) {
                    void onReject?.(candidate.assignmentId);
                  }
                }}
                className="btn h-12 flex-1 rounded-[10px] border border-error/30 bg-error/5 text-error hover:bg-error/10 text-sm sm:text-base font-bold transition-transform active:scale-95"
              >
                Tolak Pelamar Ini
              </button>
            </div>
          ) : (
            <AuditPanel onDecide={() => {}} />
          )}
        </div>
      </Surface>
    </div>
  );
}
