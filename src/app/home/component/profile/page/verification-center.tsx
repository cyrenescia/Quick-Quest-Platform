import { useEffect, useState } from "react";
import { ArrowLeftIcon } from "../../../home.icons";
import { Surface } from "../../../home.ui";
import type { HomeProfile } from "../../../home";
import {
  fetchVerificationFromApi,
  getProfileServiceErrorMessage,
  mapVerificationApiToState,
  profileVerificationStageFlow,
  resubmitVerificationToApi,
  resolveVerificationStageLabel,
  saveDocumentToApi,
  saveDraftToApi,
  submitVerificationToApi,
  type ProfileVerificationDocumentDraft,
  type ProfileVerificationDraft,
  type ProfileVerificationState,
} from "../profile";

type VerificationCenterProps = {
  profile: HomeProfile;
  verificationState: ProfileVerificationState;
  onBack: () => void;
  onChange: (nextState: ProfileVerificationState) => void;
};

function buildStageClass(isActive: boolean, isComplete: boolean): string {
  if (isComplete) return "border-[#22C55E] bg-[#DCFCE7] text-[#166534]";
  if (isActive) return "border-[#2563EB] bg-[#DBEAFE] text-[#1D4ED8]";
  return "border-base-300 bg-base-200 text-base-content/55";
}

function inferStageFromDraft(
  draft: ProfileVerificationDraft,
  documents: ProfileVerificationDocumentDraft[],
): ProfileVerificationState["stage"] {
  const hasIdentity =
    Boolean(draft.fullLegalName.trim()) &&
    Boolean(draft.nik.trim()) &&
    Boolean(draft.birthPlace.trim()) &&
    Boolean(draft.birthDate.trim()) &&
    Boolean(draft.fullAddress.trim()) &&
    Boolean(draft.city.trim()) &&
    Boolean(draft.province.trim());

  if (!hasIdentity) return "identity_form";

  const uploadedRequiredDocs = documents.filter((item) => item.required && item.uploaded).length;
  const requiredDocs = documents.filter((item) => item.required).length;

  if (uploadedRequiredDocs < 1) return "document_upload";
  if (uploadedRequiredDocs < requiredDocs) return "selfie_check";
  return "review";
}

function canSubmitVerification(
  draft: ProfileVerificationDraft,
  documents: ProfileVerificationDocumentDraft[],
): boolean {
  const hasIdentity =
    Boolean(draft.fullLegalName.trim()) &&
    Boolean(draft.nik.trim()) &&
    Boolean(draft.birthPlace.trim()) &&
    Boolean(draft.birthDate.trim()) &&
    Boolean(draft.fullAddress.trim()) &&
    Boolean(draft.city.trim()) &&
    Boolean(draft.province.trim()) &&
    Boolean(draft.postalCode.trim());

  const requiredReady = documents.every((item) => !item.required || item.uploaded);
  return hasIdentity && requiredReady;
}

function buildDraftRequestBody(draft: ProfileVerificationDraft) {
  return {
    full_legal_name: draft.fullLegalName || undefined,
    nik: draft.nik || undefined,
    birth_place: draft.birthPlace || undefined,
    birth_date: draft.birthDate || undefined,
    gender: draft.gender || undefined,
    occupation: draft.occupation || undefined,
    province: draft.province || undefined,
    city: draft.city || undefined,
    district: draft.district || undefined,
    sub_district: draft.subDistrict || undefined,
    postal_code: draft.postalCode || undefined,
    full_address: draft.fullAddress || undefined,
    domicile_same_as_ktp: draft.domicileSameAsKtp,
  };
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      resolve(typeof reader.result === "string" ? reader.result : "");
    };
    reader.onerror = () => {
      reject(new Error("File dokumen gagal dibaca dari browser."));
    };
    reader.readAsDataURL(file);
  });
}

export function VerificationCenter({
  profile,
  verificationState,
  onBack,
  onChange,
}: VerificationCenterProps) {
  const [isSavingDraft, setIsSavingDraft] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isHydrating, setIsHydrating] = useState(false);
  const [uploadingDocType, setUploadingDocType] = useState<string | null>(null);
  const [apiError, setApiError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function hydrate() {
      setIsHydrating(true);
      setApiError(null);
      try {
        const data = await fetchVerificationFromApi();
        if (!cancelled) {
          onChange(mapVerificationApiToState(data, profile));
        }
      } catch (error) {
        if (!cancelled) {
          setApiError(
            getProfileServiceErrorMessage(
              error,
              "Gagal memuat status verification dari backend.",
            ),
          );
        }
      } finally {
        if (!cancelled) {
          setIsHydrating(false);
        }
      }
    }

    hydrate();
    return () => {
      cancelled = true;
    };
  }, [onChange, profile]);

  const activeStageIndex = profileVerificationStageFlow.findIndex(
    (item) => item.key === verificationState.stage,
  );
  const isLockedApproved = verificationState.status === "approved";
  const isUnderReview =
    verificationState.status === "submitted" ||
    verificationState.status === "document_check" ||
    verificationState.status === "face_check" ||
    verificationState.status === "risk_review" ||
    verificationState.status === "manual_review";
  const readyToSubmit = canSubmitVerification(
    verificationState.draft,
    verificationState.documents,
  );

  function updateDraft(
    key: keyof ProfileVerificationDraft,
    value: ProfileVerificationDraft[keyof ProfileVerificationDraft],
  ) {
    const nextDraft = {
      ...verificationState.draft,
      [key]: value,
    };

    onChange({
      ...verificationState,
      status:
        verificationState.status === "not_started"
          ? "draft"
          : verificationState.status === "rejected"
            ? "resubmission_required"
            : verificationState.status,
      stage: inferStageFromDraft(nextDraft, verificationState.documents),
      draft: nextDraft,
    });
  }

  async function handleSaveDraft() {
    if (isSavingDraft || isLockedApproved || isUnderReview) return;

    setIsSavingDraft(true);
    setApiError(null);
    try {
      const data = await saveDraftToApi(buildDraftRequestBody(verificationState.draft));
      onChange(mapVerificationApiToState(data, profile));
    } catch (error) {
      setApiError(getProfileServiceErrorMessage(error, "Gagal menyimpan draft ke backend."));
    } finally {
      setIsSavingDraft(false);
    }
  }

  async function handleRegisterDocument(
    documentType: ProfileVerificationDocumentDraft["type"],
    file: File | undefined,
  ) {
    const fileName = file?.name ?? "";
    if (!fileName) return;

    setUploadingDocType(documentType);
    setApiError(null);
    try {
      const fileUrl = file ? await readFileAsDataUrl(file) : "";
      const data = await saveDocumentToApi({
        document_type: documentType,
        file_key: fileName,
        file_url: fileUrl || undefined,
        mime_type: file?.type || undefined,
        file_size: file?.size,
        validation_status: "uploaded",
        is_primary: documentType === "ktp_front",
      });
      const mappedState = mapVerificationApiToState(data, profile);
      onChange({
        ...mappedState,
        draft: verificationState.draft,
        stage: inferStageFromDraft(verificationState.draft, mappedState.documents),
      });
    } catch (error) {
      setApiError(
        getProfileServiceErrorMessage(error, "Gagal mendaftarkan dokumen ke backend."),
      );
    } finally {
      setUploadingDocType(null);
    }
  }

  async function handleSubmit() {
    if (!readyToSubmit || isLockedApproved || isSubmitting || isUnderReview) return;

    setIsSubmitting(true);
    setApiError(null);
    try {
      await saveDraftToApi(buildDraftRequestBody(verificationState.draft));

      const isResubmit =
        verificationState.status === "rejected" ||
        verificationState.status === "resubmission_required";
      const data = isResubmit
        ? await resubmitVerificationToApi()
        : await submitVerificationToApi();
      onChange(mapVerificationApiToState(data, profile));
    } catch (error) {
      setApiError(getProfileServiceErrorMessage(error, "Gagal submit verification ke backend."));
    } finally {
      setIsSubmitting(false);
    }
  }

  const isBusy = isHydrating || isSavingDraft || isSubmitting;

  return (
    <div className="flex flex-col gap-4 animate-in fade-in slide-in-from-bottom-4 duration-300">
      <button
        type="button"
        onClick={onBack}
        className="btn btn-sm h-10 self-start gap-2 rounded-[10px] border-base-300 bg-base-100/50 px-4 text-base-content/80 shadow-sm hover:bg-base-200"
      >
        <ArrowLeftIcon className="size-4" />
        Kembali ke Profile
      </button>

      {apiError ? (
        <div className="rounded-[10px] border border-error/40 bg-error/10 px-4 py-3 text-sm text-error">
          {apiError}
        </div>
      ) : null}

      {isHydrating ? (
        <div className="rounded-[10px] border border-base-300 bg-base-100 px-4 py-3 text-sm text-base-content/60">
          Memuat status verification dari backend...
        </div>
      ) : null}

      <Surface className="max-w-6xl overflow-hidden border border-base-300 p-5 shadow-xl sm:p-7">
        <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
          <div className="space-y-6">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-base-content/45">
                Verification Center
              </p>
              <h1 className="mt-2 text-2xl font-bold text-base-content sm:text-3xl">
                Unlock akses giver lewat identitas asli
              </h1>
              <p className="mt-2 max-w-3xl text-sm leading-relaxed text-base-content/65">
                Lengkapi data identitas dan dokumen di bawah, lalu submit untuk direview
                oleh backend. Status verification sekarang dibaca langsung dari server.
              </p>
            </div>

            <div className="grid gap-3 md:grid-cols-5">
              {profileVerificationStageFlow.map((item, index) => {
                const isComplete =
                  index < activeStageIndex || verificationState.stage === "done";
                const isActive = index === activeStageIndex;
                return (
                  <div
                    key={item.key}
                    className={`rounded-[14px] border px-3 py-3 ${buildStageClass(isActive, isComplete)}`}
                  >
                    <p className="text-[10px] font-bold uppercase tracking-[0.18em] opacity-70">
                      Step {index + 1}
                    </p>
                    <p className="mt-1 text-sm font-bold">{item.label}</p>
                    <p className="mt-1 text-[11px] leading-relaxed opacity-80">
                      {item.description}
                    </p>
                  </div>
                );
              })}
            </div>

            <div className="rounded-[16px] border border-base-300 bg-base-100 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-base-content/45">
                    Data Legal
                  </p>
                  <h2 className="mt-1 text-lg font-bold text-base-content">
                    Form identitas calon giver
                  </h2>
                </div>
                <span className="rounded-[999px] bg-base-200 px-3 py-1 text-xs font-semibold text-base-content/70">
                  Stage: {resolveVerificationStageLabel(verificationState.stage)}
                </span>
              </div>

              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <label className="form-control">
                  <span className="label-text text-xs font-bold uppercase tracking-[0.14em] text-base-content/55">
                    Nama Legal
                  </span>
                  <input
                    value={verificationState.draft.fullLegalName}
                    onChange={(event) => updateDraft("fullLegalName", event.target.value)}
                    type="text"
                    placeholder="Sesuai KTP"
                    className="input mt-1 h-11 border-base-300 bg-base-100"
                    disabled={isLockedApproved || isUnderReview}
                  />
                </label>

                <label className="form-control">
                  <span className="label-text text-xs font-bold uppercase tracking-[0.14em] text-base-content/55">
                    NIK
                  </span>
                  <input
                    value={verificationState.draft.nik}
                    onChange={(event) => updateDraft("nik", event.target.value)}
                    type="text"
                    inputMode="numeric"
                    placeholder="16 digit NIK"
                    className="input mt-1 h-11 border-base-300 bg-base-100"
                    disabled={isLockedApproved || isUnderReview}
                  />
                </label>

                <label className="form-control">
                  <span className="label-text text-xs font-bold uppercase tracking-[0.14em] text-base-content/55">
                    Tempat Lahir
                  </span>
                  <input
                    value={verificationState.draft.birthPlace}
                    onChange={(event) => updateDraft("birthPlace", event.target.value)}
                    type="text"
                    placeholder="Kota kelahiran"
                    className="input mt-1 h-11 border-base-300 bg-base-100"
                    disabled={isLockedApproved || isUnderReview}
                  />
                </label>

                <label className="form-control">
                  <span className="label-text text-xs font-bold uppercase tracking-[0.14em] text-base-content/55">
                    Tanggal Lahir
                  </span>
                  <input
                    value={verificationState.draft.birthDate}
                    onChange={(event) => updateDraft("birthDate", event.target.value)}
                    type="date"
                    className="input mt-1 h-11 border-base-300 bg-base-100"
                    disabled={isLockedApproved || isUnderReview}
                  />
                </label>

                <label className="form-control">
                  <span className="label-text text-xs font-bold uppercase tracking-[0.14em] text-base-content/55">
                    Gender
                  </span>
                  <select
                    value={verificationState.draft.gender}
                    onChange={(event) =>
                      updateDraft("gender", event.target.value as ProfileVerificationDraft["gender"])
                    }
                    className="select mt-1 h-11 border-base-300 bg-base-100"
                    disabled={isLockedApproved || isUnderReview}
                  >
                    <option value="">Pilih gender legal</option>
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                    <option value="other">Others</option>
                  </select>
                </label>

                <label className="form-control">
                  <span className="label-text text-xs font-bold uppercase tracking-[0.14em] text-base-content/55">
                    Pekerjaan
                  </span>
                  <input
                    value={verificationState.draft.occupation}
                    onChange={(event) => updateDraft("occupation", event.target.value)}
                    type="text"
                    placeholder="Aktivitas utama saat ini"
                    className="input mt-1 h-11 border-base-300 bg-base-100"
                    disabled={isLockedApproved || isUnderReview}
                  />
                </label>
              </div>

              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <label className="form-control">
                  <span className="label-text text-xs font-bold uppercase tracking-[0.14em] text-base-content/55">
                    Provinsi
                  </span>
                  <input
                    value={verificationState.draft.province}
                    onChange={(event) => updateDraft("province", event.target.value)}
                    type="text"
                    placeholder="Provinsi"
                    className="input mt-1 h-11 border-base-300 bg-base-100"
                    disabled={isLockedApproved || isUnderReview}
                  />
                </label>

                <label className="form-control">
                  <span className="label-text text-xs font-bold uppercase tracking-[0.14em] text-base-content/55">
                    Kota / Kabupaten
                  </span>
                  <input
                    value={verificationState.draft.city}
                    onChange={(event) => updateDraft("city", event.target.value)}
                    type="text"
                    placeholder="Kota / Kabupaten"
                    className="input mt-1 h-11 border-base-300 bg-base-100"
                    disabled={isLockedApproved || isUnderReview}
                  />
                </label>

                <label className="form-control">
                  <span className="label-text text-xs font-bold uppercase tracking-[0.14em] text-base-content/55">
                    Kecamatan
                  </span>
                  <input
                    value={verificationState.draft.district}
                    onChange={(event) => updateDraft("district", event.target.value)}
                    type="text"
                    placeholder="Kecamatan"
                    className="input mt-1 h-11 border-base-300 bg-base-100"
                    disabled={isLockedApproved || isUnderReview}
                  />
                </label>

                <label className="form-control">
                  <span className="label-text text-xs font-bold uppercase tracking-[0.14em] text-base-content/55">
                    Kelurahan / Desa
                  </span>
                  <input
                    value={verificationState.draft.subDistrict}
                    onChange={(event) => updateDraft("subDistrict", event.target.value)}
                    type="text"
                    placeholder="Kelurahan / Desa"
                    className="input mt-1 h-11 border-base-300 bg-base-100"
                    disabled={isLockedApproved || isUnderReview}
                  />
                </label>

                <label className="form-control md:col-span-2">
                  <span className="label-text text-xs font-bold uppercase tracking-[0.14em] text-base-content/55">
                    Alamat Lengkap
                  </span>
                  <textarea
                    value={verificationState.draft.fullAddress}
                    onChange={(event) => updateDraft("fullAddress", event.target.value)}
                    placeholder="Alamat sesuai KTP / domisili legal"
                    className="textarea mt-1 h-24 border-base-300 bg-base-100"
                    disabled={isLockedApproved || isUnderReview}
                  />
                </label>

                <label className="form-control">
                  <span className="label-text text-xs font-bold uppercase tracking-[0.14em] text-base-content/55">
                    Kode Pos
                  </span>
                  <input
                    value={verificationState.draft.postalCode}
                    onChange={(event) => updateDraft("postalCode", event.target.value)}
                    type="text"
                    inputMode="numeric"
                    placeholder="5 digit"
                    className="input mt-1 h-11 border-base-300 bg-base-100"
                    disabled={isLockedApproved || isUnderReview}
                  />
                </label>

                <label className="mt-7 flex items-center gap-3 rounded-[12px] border border-base-300 bg-base-200/60 px-4 py-3 text-sm text-base-content/75">
                  <input
                    type="checkbox"
                    className="checkbox checkbox-sm"
                    checked={verificationState.draft.domicileSameAsKtp}
                    onChange={(event) => updateDraft("domicileSameAsKtp", event.target.checked)}
                    disabled={isLockedApproved || isUnderReview}
                  />
                  Domisili sama dengan alamat KTP
                </label>
              </div>
            </div>

            <div className="rounded-[16px] border border-base-300 bg-base-100 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-base-content/45">
                Dokumen
              </p>
              <h2 className="mt-1 text-lg font-bold text-base-content">
                Checklist upload identity
              </h2>
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                {verificationState.documents.map((documentItem) => (
                  <label
                    key={documentItem.type}
                    className="rounded-[14px] border border-base-300 bg-base-200/50 p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-bold text-base-content">
                          {documentItem.label}
                        </p>
                        <p className="mt-1 text-xs leading-relaxed text-base-content/65">
                          {documentItem.helper}
                        </p>
                      </div>
                      <span
                        className={`rounded-[999px] px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.14em] ${
                          documentItem.uploaded
                            ? "bg-[#DCFCE7] text-[#166534]"
                            : "bg-[#FEF3C7] text-[#92400E]"
                        }`}
                      >
                        {documentItem.uploaded
                          ? "Ready"
                          : documentItem.required
                            ? "Required"
                            : "Optional"}
                      </span>
                    </div>
                    <input
                      type="file"
                      className="file-input file-input-bordered mt-4 h-11 w-full border-base-300 bg-base-100"
                      onChange={(event) =>
                        handleRegisterDocument(
                          documentItem.type,
                          event.target.files?.[0],
                        )
                      }
                      disabled={
                        isLockedApproved ||
                        isUnderReview ||
                        uploadingDocType === documentItem.type
                      }
                    />
                    <p className="mt-2 text-[11px] text-base-content/55">
                      {uploadingDocType === documentItem.type
                        ? "Mendaftarkan metadata dokumen ke backend..."
                        : documentItem.fileName || "Belum ada file dipilih"}
                    </p>
                  </label>
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <Surface className="border border-primary/20 bg-linear-to-br from-primary/8 to-base-100 p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-base-content/45">
                Verification Snapshot
              </p>
              <h2 className="mt-2 text-xl font-bold text-base-content">
                {profile.name}
              </h2>
              <p className="mt-1 text-sm text-base-content/65">
                {profile.email} • {profile.phone}
              </p>

              <div className="mt-4 space-y-2">
                <div className="flex items-center justify-between rounded-[12px] bg-base-100 px-3 py-2 text-sm">
                  <span className="text-base-content/60">Status</span>
                  <span className="font-semibold text-base-content">
                    {verificationState.status}
                  </span>
                </div>
                <div className="flex items-center justify-between rounded-[12px] bg-base-100 px-3 py-2 text-sm">
                  <span className="text-base-content/60">Stage</span>
                  <span className="font-semibold text-base-content">
                    {resolveVerificationStageLabel(verificationState.stage)}
                  </span>
                </div>
                <div className="flex items-center justify-between rounded-[12px] bg-base-100 px-3 py-2 text-sm">
                  <span className="text-base-content/60">Trust Tier</span>
                  <span className="font-semibold text-base-content">
                    {verificationState.trustTier}
                  </span>
                </div>
                <div className="flex items-center justify-between rounded-[12px] bg-base-100 px-3 py-2 text-sm">
                  <span className="text-base-content/60">Risk Band</span>
                  <span className="font-semibold text-base-content">
                    {verificationState.riskBand}
                  </span>
                </div>
              </div>

              <div className="mt-4 rounded-[12px] border border-base-300 bg-base-100 p-3">
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-base-content/45">
                  Reviewer Note
                </p>
                <p className="mt-2 text-sm leading-relaxed text-base-content/70">
                  {verificationState.reviewerNote}
                </p>
                {verificationState.rejectionReason ? (
                  <p className="mt-3 rounded-[10px] bg-error/10 px-3 py-2 text-xs text-error">
                    {verificationState.rejectionReason}
                  </p>
                ) : null}
              </div>
            </Surface>

            <Surface className="border border-base-300 p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-base-content/45">
                Wiring Checklist
              </p>
              <ul className="mt-3 space-y-2 text-sm leading-relaxed text-base-content/70">
                <li>Hydrate awal memakai `GET /api/profile/verification`.</li>
                <li>Simpan draft memakai `POST /api/profile/verification/draft`.</li>
                <li>Dokumen sekarang masih metadata JSON, belum upload binary langsung.</li>
                <li>Submit akhir memakai `submit` atau `resubmit` sesuai status backend.</li>
              </ul>
            </Surface>

            <div className="rounded-[16px] border border-base-300 bg-base-100 p-5">
              <div className="flex flex-col gap-3">
                <button
                  type="button"
                  onClick={handleSaveDraft}
                  disabled={isBusy || isLockedApproved || isUnderReview}
                  className="btn h-11 min-h-11 rounded-[12px] border-base-300 bg-base-200 px-5 text-base-content shadow-none disabled:bg-base-300 disabled:text-base-content/45"
                >
                  {isSavingDraft ? "Menyimpan Draft..." : "Simpan Draft"}
                </button>
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={!readyToSubmit || isLockedApproved || isBusy || isUnderReview}
                  className="btn h-11 min-h-11 rounded-[12px] border-none bg-primary px-5 text-primary-content shadow-md shadow-primary/20 disabled:bg-base-300 disabled:text-base-content/45"
                >
                  {isSubmitting
                    ? "Mengirim Verification..."
                    : isLockedApproved
                      ? "Sudah Approved"
                      : verificationState.status === "rejected" ||
                          verificationState.status === "resubmission_required"
                        ? "Resubmit untuk Review"
                        : "Submit untuk Review"}
                </button>
                <p className="text-xs leading-relaxed text-base-content/55">
                  Update terakhir: {verificationState.updatedAtLabel}
                </p>
              </div>
            </div>
          </div>
        </div>
      </Surface>
    </div>
  );
}
