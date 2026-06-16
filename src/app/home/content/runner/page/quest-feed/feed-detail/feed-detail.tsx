import { ArrowLeftIcon } from "../../../../../home.icons";
import { Surface, cn } from "../../../../../home.ui";
import { getRunnerQuestFeedDetailSeed } from "./feed-detail";

export function RunnerQuestFeedDetailPage({
  questId,
  onBack,
  onTakeQuest,
  onJoinPartyLobby,
}: {
  questId: string;
  onBack: () => void;
  onTakeQuest: () => void | Promise<void>;
  onJoinPartyLobby: () => void | Promise<void>;
}) {
  const quest = getRunnerQuestFeedDetailSeed(questId);

  if (!quest) {
    return (
      <div className="space-y-4">
        <button
          type="button"
          onClick={onBack}
          className="btn btn-sm h-10 rounded-[10px] border-base-300 bg-base-100/50 px-4 text-base-content/80 shadow-sm"
        >
          <ArrowLeftIcon className="size-4" />
          Kembali
        </button>
        <Surface className="p-5 sm:p-6 border border-base-300">
          <p className="text-sm text-base-content/70">Detail quest tidak ditemukan.</p>
        </Surface>
      </div>
    );
  }

  return (
    <div className="space-y-5 animate-in fade-in slide-in-from-bottom-4 duration-300">
      <button
        type="button"
        onClick={onBack}
        className="btn btn-sm h-10 self-start gap-2 rounded-[10px] border-base-300 bg-base-100/50 px-4 text-base-content/80 shadow-sm"
      >
        <ArrowLeftIcon className="size-4" />
        Kembali ke Feed Quest
      </button>

      <Surface className="overflow-hidden border border-base-300 p-0 shadow-md">
        <div className="bg-linear-to-tr from-primary/80 to-info/50 px-5 py-6 sm:px-8 sm:py-8">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="max-w-3xl">
              <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-white/80">
                {quest.id} • {quest.category}
              </p>
              <h1 className="mt-2 text-2xl font-extrabold tracking-tight text-white sm:text-3xl">
                {quest.title}
              </h1>
              <p className="mt-3 max-w-2xl text-sm leading-relaxed text-white/85">
                {quest.briefSummary}
              </p>
            </div>
            <div className="flex flex-col items-start gap-2 rounded-[14px] bg-white/10 px-4 py-3 backdrop-blur sm:items-end">
              <span
                className={cn(
                  "rounded-[8px] px-2 py-0.5 text-[11px] font-bold",
                  quest.mode === "group"
                    ? "bg-secondary/90 text-secondary-content"
                    : "bg-info/90 text-info-content",
                )}
              >
                {quest.mode}
              </span>
              <p className="text-lg font-extrabold text-white">{quest.reward}</p>
              <p className="text-xs font-semibold text-white/75">
                Match {quest.matchScore}% • {quest.distanceKm} km
              </p>
            </div>
          </div>
        </div>

        <div className="grid gap-5 p-5 sm:grid-cols-[1.15fr_0.85fr] sm:p-8">
          <div className="space-y-5">
            <Surface className="border border-base-300/70 p-5">
              <h3 className="text-xs font-bold uppercase tracking-[0.15em] text-base-content/50">
                Deskripsi Pekerjaan
              </h3>
              <p className="mt-4 text-sm leading-relaxed text-base-content/80">
                {quest.description}
              </p>
            </Surface>

            <Surface className="border border-base-300/70 p-5">
              <h3 className="text-xs font-bold uppercase tracking-[0.15em] text-base-content/50">
                Target Penyelesaian
              </h3>
              <div className="mt-4 space-y-2.5">
                {quest.targetChecklist.map((item) => (
                  <div
                    key={item}
                    className="rounded-[10px] border border-base-300/70 bg-base-100 px-4 py-3"
                  >
                    <p className="text-sm font-medium text-base-content/80">{item}</p>
                  </div>
                ))}
              </div>
            </Surface>
          </div>

          <div className="space-y-5">
            <Surface className="border border-base-300/70 p-5">
              <h3 className="text-xs font-bold uppercase tracking-[0.15em] text-base-content/50">
                Informasi Giver
              </h3>
              <div className="mt-4 flex items-start gap-3">
                <div className="flex size-12 items-center justify-center rounded-full bg-base-200 text-lg font-bold text-base-content/70">
                  {quest.giver.charAt(0)}
                </div>
                <div>
                  <p className="text-base font-bold text-base-content">{quest.giver}</p>
                  <span className="mt-1 inline-flex rounded-[8px] bg-base-200 px-2 py-0.5 text-[11px] font-semibold text-base-content/70">
                    {quest.giverBadge}
                  </span>
                </div>
              </div>
              <div className="mt-4 grid gap-2 text-sm">
                <div className="rounded-[10px] bg-base-200/60 px-3 py-2">
                  <p className="text-[10px] font-semibold uppercase text-base-content/50">
                    Diposting
                  </p>
                  <p className="mt-1 font-medium text-base-content">{quest.postedAt}</p>
                </div>
                <div className="rounded-[10px] bg-base-200/60 px-3 py-2">
                  <p className="text-[10px] font-semibold uppercase text-base-content/50">
                    Estimasi Durasi
                  </p>
                  <p className="mt-1 font-medium text-base-content">
                    {quest.estimatedDuration}
                  </p>
                </div>
              </div>
            </Surface>

            <Surface className="border border-base-300/70 p-5">
              <h3 className="text-xs font-bold uppercase tracking-[0.15em] text-base-content/50">
                Lokasi & Upah
              </h3>
              <div className="mt-4 space-y-3">
                <div className="rounded-[10px] bg-base-200/60 px-3 py-2">
                  <p className="text-[10px] font-semibold uppercase text-base-content/50">
                    Lokasi Singkat
                  </p>
                  <p className="mt-1 font-medium text-base-content">{quest.locationLabel}</p>
                </div>
                <div className="rounded-[10px] bg-base-200/60 px-3 py-2">
                  <p className="text-[10px] font-semibold uppercase text-base-content/50">
                    Alamat Lengkap
                  </p>
                  <p className="mt-1 font-medium text-base-content">
                    {quest.locationAddress}
                  </p>
                </div>
                <div className="rounded-[10px] bg-success/10 px-3 py-2">
                  <p className="text-[10px] font-semibold uppercase text-success/70">
                    Upah
                  </p>
                  <p className="mt-1 text-lg font-extrabold text-success">
                    {quest.reward}
                  </p>
                </div>
              </div>

              <div className="mt-5 flex flex-col gap-2">
                {quest.mode === "group" ? (
                  <button
                    type="button"
                    onClick={onJoinPartyLobby}
                    className="btn h-11 min-h-11 rounded-[10px] border-none bg-secondary text-secondary-content font-bold"
                  >
                    Apply Group Quest
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={onTakeQuest}
                    className="btn h-11 min-h-11 rounded-[10px] border-none bg-primary text-primary-content font-bold"
                  >
                    Apply Quest Ini
                  </button>
                )}
              </div>
            </Surface>
          </div>
        </div>
      </Surface>
    </div>
  );
}
