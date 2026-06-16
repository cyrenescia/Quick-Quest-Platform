package userverification

import (
	"context"
	"regexp"
	"strconv"
	"strings"
	"time"

	"Stream-StrictMode/config"

	"github.com/gofiber/fiber/v3"
)

var (
	verificationNIKPattern        = regexp.MustCompile(`^[0-9]{16}$`)
	verificationPostalCodePattern = regexp.MustCompile(`^[0-9]{5}$`)
)

type draftPayload struct {
	FullLegalName     string
	NIK               string
	BirthPlace        string
	BirthDate         *time.Time
	Gender            string
	Occupation        string
	Province          string
	City              string
	District          string
	SubDistrict       string
	PostalCode        string
	FullAddress       string
	DomicileSameAsKTP bool
}

type documentPayload struct {
	DocumentType     string
	FileKey          string
	FileURL          string
	MimeType         string
	FileSize         *int64
	DocumentNumber   string
	OCRName          string
	OCRNIK           string
	OCRBirthDate     *time.Time
	OCRAddress       string
	OCRConfidence    *float64
	IsPrimary        bool
	ValidationStatus string
}

func Verification(service *Service) fiber.Handler {
	return func(c fiber.Ctx) error {
		switch c.Method() {
		case fiber.MethodGet:
			return handleVerificationGet(c, service)
		case fiber.MethodOptions:
			return c.SendStatus(fiber.StatusNoContent)
		default:
			return config.WriteError(c, config.NewAppError("Method tidak diizinkan untuk verification profile.", fiber.StatusMethodNotAllowed), "Gagal memproses verification profile.")
		}
	}
}

func VerificationDraft(service *Service) fiber.Handler {
	return func(c fiber.Ctx) error {
		switch c.Method() {
		case fiber.MethodPost:
			return handleVerificationDraftPost(c, service)
		case fiber.MethodOptions:
			return c.SendStatus(fiber.StatusNoContent)
		default:
			return config.WriteError(c, config.NewAppError("Method tidak diizinkan untuk draft verification.", fiber.StatusMethodNotAllowed), "Gagal memproses draft verification.")
		}
	}
}

func VerificationDocuments(service *Service) fiber.Handler {
	return func(c fiber.Ctx) error {
		switch c.Method() {
		case fiber.MethodPost:
			return handleVerificationDocumentsPost(c, service)
		case fiber.MethodOptions:
			return c.SendStatus(fiber.StatusNoContent)
		default:
			return config.WriteError(c, config.NewAppError("Method tidak diizinkan untuk dokumen verification.", fiber.StatusMethodNotAllowed), "Gagal memproses dokumen verification.")
		}
	}
}

func VerificationSubmit(service *Service) fiber.Handler {
	return func(c fiber.Ctx) error {
		switch c.Method() {
		case fiber.MethodPost:
			return handleVerificationSubmitPost(c, service, false)
		case fiber.MethodOptions:
			return c.SendStatus(fiber.StatusNoContent)
		default:
			return config.WriteError(c, config.NewAppError("Method tidak diizinkan untuk submit verification.", fiber.StatusMethodNotAllowed), "Gagal memproses submit verification.")
		}
	}
}

func VerificationResubmit(service *Service) fiber.Handler {
	return func(c fiber.Ctx) error {
		switch c.Method() {
		case fiber.MethodPost:
			return handleVerificationSubmitPost(c, service, true)
		case fiber.MethodOptions:
			return c.SendStatus(fiber.StatusNoContent)
		default:
			return config.WriteError(c, config.NewAppError("Method tidak diizinkan untuk resubmit verification.", fiber.StatusMethodNotAllowed), "Gagal memproses resubmit verification.")
		}
	}
}

func VerificationHistory(service *Service) fiber.Handler {
	return func(c fiber.Ctx) error {
		switch c.Method() {
		case fiber.MethodGet:
			return handleVerificationHistoryGet(c, service)
		case fiber.MethodOptions:
			return c.SendStatus(fiber.StatusNoContent)
		default:
			return config.WriteError(c, config.NewAppError("Method tidak diizinkan untuk history verification.", fiber.StatusMethodNotAllowed), "Gagal memproses history verification.")
		}
	}
}

func handleVerificationGet(c fiber.Ctx, service *Service) error {
	ctx, cancel, authRecord, verificationRecord, userRecord, err := resolveVerificationContext(c, service)
	if err != nil {
		return config.WriteError(c, err, "Gagal mengambil verification profile.")
	}
	defer cancel()

	documents, err := service.ListVerificationDocuments(ctx, verificationRecord.ID)
	if err != nil {
		return config.WriteError(c, config.MapSupabaseError(err, "Gagal mengambil dokumen verification cloud."), "Gagal mengambil verification profile.")
	}

	reviews, err := service.ListVerificationReviews(ctx, verificationRecord.ID)
	if err != nil {
		return config.WriteError(c, config.MapSupabaseError(err, "Gagal mengambil review verification cloud."), "Gagal mengambil verification profile.")
	}

	return c.JSON(fiber.Map{
		"success": true,
		"message": "Verification profile berhasil diambil.",
		"data":    toVerificationResponse(authRecord, userRecord, verificationRecord, documents, reviews),
	})
}

func handleVerificationDraftPost(c fiber.Ctx, service *Service) error {
	body, err := config.ParseJSONBody(c)
	if err != nil {
		return config.WriteError(c, err, "Gagal menyimpan draft verification.")
	}

	payload, err := collectVerificationDraftRequest(body)
	if err != nil {
		return config.WriteError(c, err, "Gagal menyimpan draft verification.")
	}

	ctx, cancel, authRecord, verificationRecord, userRecord, err := resolveVerificationContext(c, service)
	if err != nil {
		return config.WriteError(c, err, "Gagal menyimpan draft verification.")
	}
	defer cancel()

	if err := ensureVerificationEditable(verificationRecord, false); err != nil {
		return config.WriteError(c, err, "Gagal menyimpan draft verification.")
	}

	if err := service.UpdateVerificationDraft(ctx, verificationRecord, payload); err != nil {
		return config.WriteError(c, config.MapSupabaseError(err, "Gagal menyimpan draft verification cloud."), "Gagal menyimpan draft verification.")
	}

	verificationRecord, err = service.GetVerificationProfile(ctx, authRecord.AuthUserID)
	if err != nil {
		return config.WriteError(c, config.MapSupabaseError(err, "Gagal memuat ulang verification profile cloud."), "Gagal menyimpan draft verification.")
	}
	if verificationRecord == nil {
		return config.WriteError(c, config.NewAppError("Verification profile tidak ditemukan setelah draft disimpan.", fiber.StatusNotFound), "Gagal menyimpan draft verification.")
	}

	documents, err := service.ListVerificationDocuments(ctx, verificationRecord.ID)
	if err != nil {
		return config.WriteError(c, config.MapSupabaseError(err, "Gagal mengambil dokumen verification cloud."), "Gagal menyimpan draft verification.")
	}

	reviews, err := service.ListVerificationReviews(ctx, verificationRecord.ID)
	if err != nil {
		return config.WriteError(c, config.MapSupabaseError(err, "Gagal mengambil review verification cloud."), "Gagal menyimpan draft verification.")
	}

	return c.JSON(fiber.Map{
		"success": true,
		"message": "Draft verification berhasil disimpan.",
		"data":    toVerificationResponse(authRecord, userRecord, verificationRecord, documents, reviews),
	})
}

func handleVerificationDocumentsPost(c fiber.Ctx, service *Service) error {
	body, err := config.ParseJSONBody(c)
	if err != nil {
		return config.WriteError(c, err, "Gagal menyimpan dokumen verification.")
	}

	payload, err := collectVerificationDocumentRequest(body)
	if err != nil {
		return config.WriteError(c, err, "Gagal menyimpan dokumen verification.")
	}

	ctx, cancel, authRecord, verificationRecord, userRecord, err := resolveVerificationContext(c, service)
	if err != nil {
		return config.WriteError(c, err, "Gagal menyimpan dokumen verification.")
	}
	defer cancel()

	if err := ensureVerificationEditable(verificationRecord, false); err != nil {
		return config.WriteError(c, err, "Gagal menyimpan dokumen verification.")
	}

	if err := service.UpsertVerificationDocument(ctx, verificationRecord, payload); err != nil {
		return config.WriteError(c, config.MapSupabaseError(err, "Gagal menyimpan dokumen verification cloud."), "Gagal menyimpan dokumen verification.")
	}

	verificationRecord, err = service.GetVerificationProfile(ctx, authRecord.AuthUserID)
	if err != nil {
		return config.WriteError(c, config.MapSupabaseError(err, "Gagal memuat ulang verification profile cloud."), "Gagal menyimpan dokumen verification.")
	}
	if verificationRecord == nil {
		return config.WriteError(c, config.NewAppError("Verification profile tidak ditemukan setelah dokumen disimpan.", fiber.StatusNotFound), "Gagal menyimpan dokumen verification.")
	}

	documents, err := service.ListVerificationDocuments(ctx, verificationRecord.ID)
	if err != nil {
		return config.WriteError(c, config.MapSupabaseError(err, "Gagal mengambil dokumen verification cloud."), "Gagal menyimpan dokumen verification.")
	}

	reviews, err := service.ListVerificationReviews(ctx, verificationRecord.ID)
	if err != nil {
		return config.WriteError(c, config.MapSupabaseError(err, "Gagal mengambil review verification cloud."), "Gagal menyimpan dokumen verification.")
	}

	return c.JSON(fiber.Map{
		"success": true,
		"message": "Dokumen verification berhasil disimpan.",
		"data":    toVerificationResponse(authRecord, userRecord, verificationRecord, documents, reviews),
	})
}

func handleVerificationSubmitPost(c fiber.Ctx, service *Service, isResubmission bool) error {
	ctx, cancel, authRecord, verificationRecord, userRecord, err := resolveVerificationContext(c, service)
	if err != nil {
		return config.WriteError(c, err, "Gagal memproses submit verification.")
	}
	defer cancel()

	if err := ensureVerificationEditable(verificationRecord, isResubmission); err != nil {
		return config.WriteError(c, err, "Gagal memproses submit verification.")
	}

	documents, err := service.ListVerificationDocuments(ctx, verificationRecord.ID)
	if err != nil {
		return config.WriteError(c, config.MapSupabaseError(err, "Gagal mengambil dokumen verification cloud."), "Gagal memproses submit verification.")
	}

	if err := validateVerificationReadiness(verificationRecord, documents); err != nil {
		return config.WriteError(c, err, "Gagal memproses submit verification.")
	}

	if err := service.SubmitVerification(ctx, verificationRecord, documents, isResubmission); err != nil {
		return config.WriteError(c, config.MapSupabaseError(err, "Gagal mengirim verification cloud."), "Gagal memproses submit verification.")
	}

	verificationRecord, err = service.GetVerificationProfile(ctx, authRecord.AuthUserID)
	if err != nil {
		return config.WriteError(c, config.MapSupabaseError(err, "Gagal memuat ulang verification profile cloud."), "Gagal memproses submit verification.")
	}
	if verificationRecord == nil {
		return config.WriteError(c, config.NewAppError("Verification profile tidak ditemukan setelah submit.", fiber.StatusNotFound), "Gagal memproses submit verification.")
	}

	reviews, err := service.ListVerificationReviews(ctx, verificationRecord.ID)
	if err != nil {
		return config.WriteError(c, config.MapSupabaseError(err, "Gagal mengambil review verification cloud."), "Gagal memproses submit verification.")
	}

	return c.JSON(fiber.Map{
		"success": true,
		"message": ternaryMessage(isResubmission, "Verification berhasil dikirim ulang untuk review.", "Verification berhasil dikirim untuk review."),
		"data":    toVerificationResponse(authRecord, userRecord, verificationRecord, documents, reviews),
	})
}

func handleVerificationHistoryGet(c fiber.Ctx, service *Service) error {
	ctx, cancel, _, verificationRecord, _, err := resolveVerificationContext(c, service)
	if err != nil {
		return config.WriteError(c, err, "Gagal mengambil history verification.")
	}
	defer cancel()

	reviews, err := service.ListVerificationReviews(ctx, verificationRecord.ID)
	if err != nil {
		return config.WriteError(c, config.MapSupabaseError(err, "Gagal mengambil review verification cloud."), "Gagal mengambil history verification.")
	}

	events, err := service.ListVerificationEvents(ctx, verificationRecord.ID)
	if err != nil {
		return config.WriteError(c, config.MapSupabaseError(err, "Gagal mengambil event verification cloud."), "Gagal mengambil history verification.")
	}

	return c.JSON(fiber.Map{
		"success": true,
		"message": "History verification berhasil diambil.",
		"data": fiber.Map{
			"reviews": toVerificationReviewsResponse(reviews),
			"events":  toVerificationEventsResponse(events),
		},
	})
}

func resolveVerificationContext(c fiber.Ctx, service *Service) (context.Context, context.CancelFunc, *authSessionRecord, *verificationProfileRecord, *userProfileRecord, error) {
	sessionToken := config.ResolveSessionToken(c, service.cfg.SessionCookieName)
	if sessionToken == "" {
		return nil, nil, nil, nil, nil, config.NewAppError("Token sesi tidak ditemukan. Kirim bearer token atau cookie sesi.", fiber.StatusUnauthorized)
	}

	ctx, cancel := context.WithTimeout(context.Background(), 20*time.Second)
	authRecord, err := service.FindAuthBySessionToken(ctx, sessionToken)
	if err != nil {
		cancel()
		return nil, nil, nil, nil, nil, config.MapSupabaseError(err, "Gagal mengambil data auth cloud.")
	}
	if authRecord == nil {
		cancel()
		return nil, nil, nil, nil, nil, config.NewAppError("Token sesi tidak valid atau sudah kadaluarsa.", fiber.StatusUnauthorized)
	}

	userRecord, err := service.GetUserProfile(ctx, authRecord)
	if err != nil {
		cancel()
		return nil, nil, nil, nil, nil, config.MapSupabaseError(err, "Gagal mengambil profile cloud.")
	}
	if userRecord == nil {
		cancel()
		return nil, nil, nil, nil, nil, config.NewAppError("Data profile user tidak ditemukan.", fiber.StatusNotFound)
	}

	verificationRecord, err := service.EnsureVerificationProfile(ctx, authRecord, userRecord)
	if err != nil {
		cancel()
		return nil, nil, nil, nil, nil, config.MapSupabaseError(err, "Gagal menyiapkan verification profile cloud.")
	}
	if verificationRecord == nil {
		cancel()
		return nil, nil, nil, nil, nil, config.NewAppError("Verification profile tidak ditemukan.", fiber.StatusNotFound)
	}

	return ctx, cancel, authRecord, verificationRecord, userRecord, nil
}

func collectVerificationDraftRequest(body map[string]any) (draftPayload, error) {
	payload := draftPayload{
		FullLegalName:     config.NormalizeString(body["full_legal_name"]),
		NIK:               strings.TrimSpace(config.NormalizeString(body["nik"])),
		BirthPlace:        config.NormalizeString(body["birth_place"]),
		Gender:            normalizeGender(config.NormalizeString(body["gender"])),
		Occupation:        config.NormalizeString(body["occupation"]),
		Province:          config.NormalizeString(body["province"]),
		City:              config.NormalizeString(body["city"]),
		District:          config.NormalizeString(body["district"]),
		SubDistrict:       config.NormalizeString(body["sub_district"]),
		PostalCode:        strings.TrimSpace(config.NormalizeString(body["postal_code"])),
		FullAddress:       config.NormalizeString(body["full_address"]),
		DomicileSameAsKTP: extractBool(body["domicile_same_as_ktp"], true),
	}

	if birthDate := strings.TrimSpace(config.NormalizeString(body["birth_date"])); birthDate != "" {
		parsed, err := parseBirthdate(birthDate)
		if err != nil {
			return draftPayload{}, config.NewAppError("Birth date verification belum valid.", fiber.StatusBadRequest)
		}
		payload.BirthDate = &parsed
	}

	if payload.NIK != "" && !verificationNIKPattern.MatchString(payload.NIK) {
		return draftPayload{}, config.NewAppError("NIK verification harus 16 digit angka.", fiber.StatusBadRequest)
	}

	if payload.PostalCode != "" && !verificationPostalCodePattern.MatchString(payload.PostalCode) {
		return draftPayload{}, config.NewAppError("Kode pos verification harus 5 digit angka.", fiber.StatusBadRequest)
	}

	if payload.Gender == "__invalid__" {
		return draftPayload{}, config.NewAppError("Gender verification belum valid.", fiber.StatusBadRequest)
	}

	if payload.FullLegalName == "" && payload.NIK == "" && payload.BirthPlace == "" && payload.BirthDate == nil && payload.Gender == "" && payload.Occupation == "" && payload.Province == "" && payload.City == "" && payload.District == "" && payload.SubDistrict == "" && payload.PostalCode == "" && payload.FullAddress == "" {
		return draftPayload{}, config.NewAppError("Minimal satu field verification draft harus dikirim.", fiber.StatusBadRequest)
	}

	return payload, nil
}

func collectVerificationDocumentRequest(body map[string]any) (documentPayload, error) {
	payload := documentPayload{
		DocumentType:     strings.TrimSpace(config.NormalizeString(body["document_type"])),
		FileKey:          strings.TrimSpace(config.NormalizeString(body["file_key"])),
		FileURL:          strings.TrimSpace(config.NormalizeString(body["file_url"])),
		MimeType:         strings.TrimSpace(config.NormalizeString(body["mime_type"])),
		DocumentNumber:   strings.TrimSpace(config.NormalizeString(body["document_number"])),
		OCRName:          strings.TrimSpace(config.NormalizeString(body["ocr_name"])),
		OCRNIK:           strings.TrimSpace(config.NormalizeString(body["ocr_nik"])),
		OCRAddress:       strings.TrimSpace(config.NormalizeString(body["ocr_address"])),
		IsPrimary:        extractBool(body["is_primary"], false),
		ValidationStatus: strings.TrimSpace(config.NormalizeString(body["validation_status"])),
	}

	if payload.DocumentType == "" {
		return documentPayload{}, config.NewAppError("Field document_type wajib diisi.", fiber.StatusBadRequest)
	}
	if !isAllowedDocumentType(payload.DocumentType) {
		return documentPayload{}, config.NewAppError("Document type verification tidak dikenali.", fiber.StatusBadRequest)
	}
	if payload.FileKey == "" {
		return documentPayload{}, config.NewAppError("Field file_key wajib diisi.", fiber.StatusBadRequest)
	}

	if payload.ValidationStatus == "" {
		payload.ValidationStatus = "uploaded"
	}
	if !isAllowedValidationStatus(payload.ValidationStatus) {
		return documentPayload{}, config.NewAppError("Validation status verification tidak dikenali.", fiber.StatusBadRequest)
	}

	if fileSize := strings.TrimSpace(config.NormalizeString(body["file_size"])); fileSize != "" {
		parsed, err := strconv.ParseInt(fileSize, 10, 64)
		if err != nil || parsed < 0 {
			return documentPayload{}, config.NewAppError("File size verification belum valid.", fiber.StatusBadRequest)
		}
		payload.FileSize = &parsed
	}

	if ocrBirthDate := strings.TrimSpace(config.NormalizeString(body["ocr_birth_date"])); ocrBirthDate != "" {
		parsed, err := parseBirthdate(ocrBirthDate)
		if err != nil {
			return documentPayload{}, config.NewAppError("OCR birth date verification belum valid.", fiber.StatusBadRequest)
		}
		payload.OCRBirthDate = &parsed
	}

	if ocrConfidence := strings.TrimSpace(config.NormalizeString(body["ocr_confidence"])); ocrConfidence != "" {
		parsed, err := strconv.ParseFloat(ocrConfidence, 64)
		if err != nil || parsed < 0 || parsed > 1 {
			return documentPayload{}, config.NewAppError("OCR confidence verification harus di antara 0 sampai 1.", fiber.StatusBadRequest)
		}
		payload.OCRConfidence = &parsed
	}

	return payload, nil
}

func validateVerificationReadiness(record *verificationProfileRecord, documents []verificationDocumentRecord) error {
	if record == nil {
		return config.NewAppError("Verification profile tidak ditemukan.", fiber.StatusNotFound)
	}

	requiredFields := []string{
		record.FullLegalName,
		record.NIK,
		record.BirthPlace,
		record.Province,
		record.City,
		record.PostalCode,
		record.FullAddress,
	}
	for _, value := range requiredFields {
		if strings.TrimSpace(value) == "" {
			return config.NewAppError("Data identitas verification belum lengkap untuk submit.", fiber.StatusBadRequest)
		}
	}

	if record.BirthDate == nil || record.BirthDate.IsZero() {
		return config.NewAppError("Birth date verification wajib diisi sebelum submit.", fiber.StatusBadRequest)
	}

	requiredDocuments := map[string]bool{
		"ktp_front":       false,
		"selfie":          false,
		"selfie_with_ktp": false,
	}
	for _, item := range documents {
		if _, ok := requiredDocuments[item.DocumentType]; ok && strings.TrimSpace(item.FileKey) != "" {
			requiredDocuments[item.DocumentType] = true
		}
	}
	for key, ready := range requiredDocuments {
		if !ready {
			return config.NewAppError("Dokumen verification "+key+" belum lengkap.", fiber.StatusBadRequest)
		}
	}

	return nil
}

func ensureVerificationEditable(record *verificationProfileRecord, isResubmission bool) error {
	if record == nil {
		return config.NewAppError("Verification profile tidak ditemukan.", fiber.StatusNotFound)
	}

	status := strings.TrimSpace(record.VerificationStatus)
	if status == "approved" {
		return config.NewAppError("Verification sudah approved dan tidak bisa diubah lewat flow ini.", fiber.StatusConflict)
	}

	if isResubmission {
		if status != "rejected" && status != "resubmission_required" {
			return config.NewAppError("Verification hanya bisa dikirim ulang setelah status rejected atau resubmission_required.", fiber.StatusConflict)
		}
		return nil
	}

	switch status {
	case "submitted", "document_check", "face_check", "risk_review", "manual_review":
		return config.NewAppError("Verification sedang direview dan tidak bisa diubah dulu.", fiber.StatusConflict)
	default:
		return nil
	}
}

func toVerificationResponse(authRecord *authSessionRecord, userRecord *userProfileRecord, verificationRecord *verificationProfileRecord, documents []verificationDocumentRecord, reviews []verificationReviewRecord) fiber.Map {
	latestReviewNote := deriveLatestReviewNote(verificationRecord, reviews)
	normalizedUserRole := config.NormalizeUserRole(userRecord.UserRole)

	return fiber.Map{
		"verification_profile_id": verificationRecord.ID,
		"auth_user_id":            authRecord.AuthUserID,
		"full_legal_name":         verificationRecord.FullLegalName,
		"nik":                     verificationRecord.NIK,
		"birth_place":             verificationRecord.BirthPlace,
		"birth_date":              formatRFC3339Date(verificationRecord.BirthDate),
		"gender":                  verificationRecord.Gender,
		"occupation":              verificationRecord.Occupation,
		"province":                verificationRecord.Province,
		"city":                    verificationRecord.City,
		"district":                verificationRecord.District,
		"sub_district":            verificationRecord.SubDistrict,
		"postal_code":             verificationRecord.PostalCode,
		"full_address":            verificationRecord.FullAddress,
		"domicile_same_as_ktp":    verificationRecord.DomicileSameAsKTP,
		"verification_status":     verificationRecord.VerificationStatus,
		"verification_stage":      verificationRecord.VerificationStage,
		"risk_score":              verificationRecord.RiskScore,
		"risk_flags":              verificationRecord.RiskFlags,
		"submitted_at":            formatRFC3339Time(verificationRecord.SubmittedAt),
		"reviewed_at":             formatRFC3339Time(verificationRecord.ReviewedAt),
		"approved_at":             formatRFC3339Time(verificationRecord.ApprovedAt),
		"rejected_at":             formatRFC3339Time(verificationRecord.RejectedAt),
		"rejection_reason_code":   verificationRecord.RejectionReasonCode,
		"rejection_reason_detail": verificationRecord.RejectionReasonDetail,
		"needs_resubmission":      verificationRecord.NeedsResubmission,
		"user_role":               normalizedUserRole,
		"can_post_quest":          config.IsRoleSwitchEnabled(normalizedUserRole),
		"trust_tier":              deriveTrustTier(verificationRecord),
		"risk_band":               deriveRiskBand(verificationRecord),
		"latest_review_note":      latestReviewNote,
		"documents":               toVerificationDocumentsResponse(documents),
	}
}

func toVerificationDocumentsResponse(records []verificationDocumentRecord) []fiber.Map {
	out := make([]fiber.Map, 0, len(records))
	for _, item := range records {
		out = append(out, fiber.Map{
			"id":                item.ID,
			"document_type":     item.DocumentType,
			"file_key":          item.FileKey,
			"file_url":          item.FileURL,
			"mime_type":         item.MimeType,
			"file_size":         item.FileSize,
			"document_number":   item.DocumentNumber,
			"ocr_name":          item.OCRName,
			"ocr_nik":           item.OCRNIK,
			"ocr_birth_date":    formatRFC3339Date(item.OCRBirthDate),
			"ocr_address":       item.OCRAddress,
			"ocr_confidence":    item.OCRConfidence,
			"is_primary":        item.IsPrimary,
			"validation_status": item.ValidationStatus,
			"uploaded_at":       formatRFC3339Time(item.UploadedAt),
			"validated_at":      formatRFC3339Time(item.ValidatedAt),
		})
	}
	return out
}

func toVerificationReviewsResponse(records []verificationReviewRecord) []fiber.Map {
	out := make([]fiber.Map, 0, len(records))
	for _, item := range records {
		out = append(out, fiber.Map{
			"id":                     item.ID,
			"review_type":            item.ReviewType,
			"review_result":          item.ReviewResult,
			"reviewer_id":            item.ReviewerID,
			"reviewer_role":          item.ReviewerRole,
			"review_notes":           item.ReviewNotes,
			"decision_reason_code":   item.DecisionReasonCode,
			"decision_reason_detail": item.DecisionReasonDetail,
			"created_at":             formatRFC3339Time(item.CreatedAt),
		})
	}
	return out
}

func toVerificationEventsResponse(records []verificationEventRecord) []fiber.Map {
	out := make([]fiber.Map, 0, len(records))
	for _, item := range records {
		out = append(out, fiber.Map{
			"id":              item.ID,
			"previous_status": item.PreviousStatus,
			"new_status":      item.NewStatus,
			"actor_id":        item.ActorID,
			"actor_type":      item.ActorType,
			"notes":           item.Notes,
			"created_at":      formatRFC3339Time(item.CreatedAt),
		})
	}
	return out
}

func deriveLatestReviewNote(record *verificationProfileRecord, reviews []verificationReviewRecord) string {
	if len(reviews) > 0 && strings.TrimSpace(reviews[0].ReviewNotes) != "" {
		return reviews[0].ReviewNotes
	}

	switch record.VerificationStatus {
	case "approved":
		return "Identitas asli sudah lolos review dan siap digunakan untuk unlock role giver."
	case "submitted", "document_check", "face_check", "risk_review", "manual_review":
		return "Verification sedang direview oleh mesin dan/atau admin compliance."
	case "rejected", "resubmission_required":
		return "Ada detail verification yang perlu diperbaiki sebelum dikirim ulang."
	case "draft":
		return "Draft verification sudah tersimpan, lengkapi dokumen sebelum submit."
	default:
		return "Lengkapi identitas asli di profile untuk membuka akses giver."
	}
}

func deriveTrustTier(record *verificationProfileRecord) string {
	switch record.VerificationStatus {
	case "approved":
		return "Tier A"
	case "submitted", "document_check", "face_check", "risk_review", "manual_review":
		return "Tier Screening"
	default:
		return "Tier Pending"
	}
}

func deriveRiskBand(record *verificationProfileRecord) string {
	switch record.VerificationStatus {
	case "approved":
		return "Low Risk"
	case "submitted", "document_check", "face_check", "risk_review", "manual_review":
		return "Under Review"
	case "rejected", "resubmission_required":
		return "Review Required"
	default:
		return "Belum Dinilai"
	}
}

func resolveDraftVerificationStage(payload draftPayload, documents []verificationDocumentRecord) string {
	if strings.TrimSpace(payload.FullLegalName) == "" || strings.TrimSpace(payload.NIK) == "" || payload.BirthDate == nil {
		return "identity_form"
	}

	return resolveStageFromDocuments("document_upload", documents)
}

func resolveStageFromDocuments(defaultStage string, documents []verificationDocumentRecord) string {
	requiredDocs := map[string]bool{
		"ktp_front":       false,
		"selfie":          false,
		"selfie_with_ktp": false,
	}

	for _, item := range documents {
		if _, ok := requiredDocs[item.DocumentType]; ok && strings.TrimSpace(item.FileKey) != "" {
			requiredDocs[item.DocumentType] = true
		}
	}

	if !requiredDocs["ktp_front"] {
		return "document_upload"
	}
	if !requiredDocs["selfie"] || !requiredDocs["selfie_with_ktp"] {
		return "selfie_check"
	}
	if strings.TrimSpace(defaultStage) == "" {
		return "review"
	}
	return "review"
}

func parseBirthdate(value string) (time.Time, error) {
	normalized := strings.TrimSpace(value)
	if normalized == "" {
		return time.Time{}, config.NewAppError("Tanggal lahir belum valid.", fiber.StatusBadRequest)
	}

	layouts := []string{
		time.RFC3339,
		time.DateOnly,
		"2006-01-02T15:04:05.000Z07:00",
		"2006-01-02 15:04:05",
	}

	for _, layout := range layouts {
		if parsed, err := time.Parse(layout, normalized); err == nil {
			return parsed, nil
		}
	}

	return time.Time{}, config.NewAppError("Tanggal lahir belum valid.", fiber.StatusBadRequest)
}

func normalizeGender(value string) string {
	switch strings.ToLower(strings.TrimSpace(value)) {
	case "":
		return ""
	case "male", "female", "other":
		return strings.ToLower(strings.TrimSpace(value))
	case "others":
		return "other"
	default:
		return "__invalid__"
	}
}

func extractBool(value any, defaultValue bool) bool {
	switch typed := value.(type) {
	case nil:
		return defaultValue
	case bool:
		return typed
	default:
		normalized := strings.ToLower(strings.TrimSpace(config.NormalizeString(value)))
		if normalized == "" {
			return defaultValue
		}
		return normalized == "true" || normalized == "1" || normalized == "yes" || normalized == "on"
	}
}

func isAllowedDocumentType(value string) bool {
	switch strings.TrimSpace(value) {
	case "ktp_front", "selfie", "selfie_with_ktp", "liveness_video", "supporting_document":
		return true
	default:
		return false
	}
}

func isAllowedValidationStatus(value string) bool {
	switch strings.TrimSpace(value) {
	case "uploaded", "processing", "valid", "invalid", "reupload_required":
		return true
	default:
		return false
	}
}

func formatRFC3339Date(value *time.Time) any {
	if value == nil || value.IsZero() {
		return nil
	}
	return value.UTC().Format(time.DateOnly)
}

func formatRFC3339Time(value *time.Time) any {
	if value == nil || value.IsZero() {
		return nil
	}
	return value.UTC().Format(time.RFC3339)
}

func ternaryMessage(condition bool, truthy string, falsy string) string {
	if condition {
		return truthy
	}
	return falsy
}
