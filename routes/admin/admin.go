package admin

import (
	"context"
	"os"
	"strconv"
	"strings"
	"time"

	"Stream-StrictMode/config"

	"github.com/gofiber/fiber/v3"
)

func Admin(service *Service) fiber.Handler {
	return func(c fiber.Ctx) error {
		switch c.Method() {
		case fiber.MethodGet:
			return handleAdminGet(c, service)
		case fiber.MethodPost:
			return handleAdminPost(c, service)
		case fiber.MethodOptions:
			return c.SendStatus(fiber.StatusNoContent)
		default:
			return config.WriteError(c, config.NewAppError("Method tidak diizinkan untuk admin.", fiber.StatusMethodNotAllowed), "Gagal memproses admin.")
		}
	}
}

func handleAdminGet(c fiber.Ctx, service *Service) error {
	ctx, cancel, _, err := resolveAdminContext(c, service)
	if err != nil {
		return config.WriteError(c, err, "Gagal mengambil data admin.")
	}
	defer cancel()

	if isAdminDisputePath(c) {
		return handleAdminDisputeGet(c, service, ctx)
	}

	verificationID := strings.TrimSpace(c.Params("id"))
	if verificationID != "" {
		return handleAdminVerificationDetailGet(c, service, ctx, verificationID)
	}

	records, err := service.ListVerificationProfiles(ctx)
	if err != nil {
		return config.WriteError(c, config.MapSupabaseError(err, "Gagal mengambil daftar verification cloud."), "Gagal mengambil data admin.")
	}

	statusFilter := normalizeStatusFilter(c.Query("status"))
	items := make([]fiber.Map, 0, len(records))
	for _, record := range records {
		if statusFilter != "" && !matchesVerificationStatusFilter(record.VerificationStatus, statusFilter) {
			continue
		}

		payload, err := buildAdminVerificationPayload(ctx, service, &record, false)
		if err != nil {
			return config.WriteError(c, err, "Gagal mengambil data admin.")
		}
		items = append(items, payload)
	}

	return c.JSON(fiber.Map{
		"success": true,
		"message": "Daftar verification admin berhasil diambil.",
		"data": fiber.Map{
			"items": items,
			"total": len(items),
		},
	})
}

func handleAdminVerificationDetailGet(c fiber.Ctx, service *Service, ctx context.Context, verificationID string) error {
	record, err := service.FindVerificationProfileByID(ctx, verificationID)
	if err != nil {
		return config.WriteError(c, config.MapSupabaseError(err, "Gagal mengambil detail verification cloud."), "Gagal mengambil detail verification.")
	}
	if record == nil {
		return config.WriteError(c, config.NewAppError("Verification tidak ditemukan.", fiber.StatusNotFound), "Gagal mengambil detail verification.")
	}

	payload, err := buildAdminVerificationPayload(ctx, service, record, true)
	if err != nil {
		return config.WriteError(c, err, "Gagal mengambil detail verification.")
	}

	return c.JSON(fiber.Map{
		"success": true,
		"message": "Detail verification admin berhasil diambil.",
		"data":    payload,
	})
}

func handleAdminDisputeGet(c fiber.Ctx, service *Service, ctx context.Context) error {
	disputeID := strings.TrimSpace(c.Params("id"))
	if disputeID != "" {
		record, err := service.FindDisputeCaseByID(ctx, disputeID)
		if err != nil {
			return config.WriteError(c, config.MapSupabaseError(err, "Gagal mengambil detail dispute admin cloud."), "Gagal mengambil detail dispute admin.")
		}
		if record == nil {
			return config.WriteError(c, config.NewAppError("Dispute tidak ditemukan.", fiber.StatusNotFound), "Gagal mengambil detail dispute admin.")
		}
		payload, err := buildAdminDisputePayload(ctx, service, record, true)
		if err != nil {
			return config.WriteError(c, err, "Gagal mengambil detail dispute admin.")
		}
		return c.JSON(fiber.Map{
			"success": true,
			"message": "Detail dispute admin berhasil diambil.",
			"data":    payload,
		})
	}

	records, err := service.ListDisputeCases(ctx)
	if err != nil {
		return config.WriteError(c, config.MapSupabaseError(err, "Gagal mengambil daftar dispute cloud."), "Gagal mengambil dispute admin.")
	}

	statusFilter := normalizeAdminDisputeStatusFilter(c.Query("status"))
	items := make([]fiber.Map, 0, len(records))
	for _, record := range records {
		if statusFilter == "open" && isAdminDisputeResolved(record.Status) {
			continue
		}
		if statusFilter != "" && statusFilter != "open" && !strings.EqualFold(record.Status, statusFilter) {
			continue
		}
		payload, err := buildAdminDisputePayload(ctx, service, &record, false)
		if err != nil {
			return config.WriteError(c, err, "Gagal mengambil dispute admin.")
		}
		items = append(items, payload)
	}

	return c.JSON(fiber.Map{
		"success": true,
		"message": "Daftar dispute admin berhasil diambil.",
		"data": fiber.Map{
			"items": items,
			"total": len(items),
		},
	})
}

func handleAdminDisputeMediatePost(c fiber.Ctx, service *Service, ctx context.Context, adminRecord *authSessionRecord, body map[string]any) error {
	disputeID := strings.TrimSpace(c.Params("id"))
	if disputeID == "" {
		return config.WriteError(c, config.NewAppError("Dispute ID wajib dikirim.", fiber.StatusBadRequest), "Gagal memediasi dispute admin.")
	}

	record, err := service.FindDisputeCaseByID(ctx, disputeID)
	if err != nil {
		return config.WriteError(c, config.MapSupabaseError(err, "Gagal mengambil dispute cloud."), "Gagal memediasi dispute admin.")
	}
	if record == nil {
		return config.WriteError(c, config.NewAppError("Dispute tidak ditemukan.", fiber.StatusNotFound), "Gagal memediasi dispute admin.")
	}
	if isAdminDisputeResolved(record.Status) {
		return config.WriteError(c, config.NewAppError("Dispute sudah punya keputusan final.", fiber.StatusConflict), "Gagal memediasi dispute admin.")
	}

	nextStatus := normalizeAdminDisputeResolution(config.NormalizeString(body["resolution"]))
	if nextStatus == "" {
		return config.WriteError(c, config.NewAppError("Resolution dispute tidak valid.", fiber.StatusBadRequest), "Gagal memediasi dispute admin.")
	}

	escrowAmount := parseFloatOrZero(record.EscrowAmount)
	giverSettlementAmount, runnerSettlementAmount, mediationFeeAmount := resolveAdminMediationAmounts(nextStatus, escrowAmount)
	mediatorNote := strings.TrimSpace(config.NormalizeString(body["mediator_note"]))

	if err := service.UpdateDisputeCaseForMediation(ctx, adminDisputeMediationPayload{
		DisputeID:              disputeID,
		NextStatus:             nextStatus,
		MediatorNote:           mediatorNote,
		GiverSettlementAmount:  giverSettlementAmount,
		RunnerSettlementAmount: runnerSettlementAmount,
		MediationFeeAmount:     mediationFeeAmount,
	}); err != nil {
		return config.WriteError(c, config.MapSupabaseError(err, "Gagal memperbarui dispute cloud."), "Gagal memediasi dispute admin.")
	}

	nextQuestStatus, nextAssignmentStatus, nextEscrowStatus, escrowTimestampField := resolveAdminMediationLifecycle(nextStatus)
	if err := service.UpdateQuestStatus(ctx, record.QuestID, nextQuestStatus); err != nil {
		return config.WriteError(c, config.MapSupabaseError(err, "Gagal memperbarui quest cloud."), "Gagal memediasi dispute admin.")
	}
	if err := service.UpdateQuestAssignmentStatus(ctx, record.AssignmentID, nextAssignmentStatus); err != nil {
		return config.WriteError(c, config.MapSupabaseError(err, "Gagal memperbarui assignment cloud."), "Gagal memediasi dispute admin.")
	}
	if err := service.UpdateQuestEscrowState(ctx, record.QuestID, nextEscrowStatus, escrowTimestampField); err != nil {
		return config.WriteError(c, config.MapSupabaseError(err, "Gagal memperbarui escrow cloud."), "Gagal memediasi dispute admin.")
	}

	if err := service.CreateDisputeEvent(ctx, disputeID, "mediator", nextStatus, buildAdminMediationDescription(nextStatus, mediatorNote, adminRecord)); err != nil {
		return config.WriteError(c, config.MapSupabaseError(err, "Gagal membuat event mediasi cloud."), "Gagal memediasi dispute admin.")
	}

	updatedRecord, err := service.FindDisputeCaseByID(ctx, disputeID)
	if err != nil {
		return config.WriteError(c, config.MapSupabaseError(err, "Gagal mengambil ulang dispute cloud."), "Gagal memediasi dispute admin.")
	}
	payload, err := buildAdminDisputePayload(ctx, service, updatedRecord, true)
	if err != nil {
		return config.WriteError(c, err, "Gagal memediasi dispute admin.")
	}

	return c.JSON(fiber.Map{
		"success": true,
		"message": "Keputusan mediasi admin berhasil disimpan.",
		"data":    payload,
	})
}

func handleAdminAutoReleasePost(c fiber.Ctx, service *Service, ctx context.Context, body map[string]any) error {
	timeoutHours := resolveAutoReleaseTimeoutHours(body)
	assignments, err := service.ListFinishedAssignments(ctx)
	if err != nil {
		return config.WriteError(c, config.MapSupabaseError(err, "Gagal mengambil assignment pending release cloud."), "Gagal menjalankan auto-release.")
	}

	now := time.Now().UTC()
	results := make([]fiber.Map, 0)
	releasedCount := 0
	for _, assignment := range assignments {
		result, err := processAutoReleaseCandidate(ctx, service, assignment, now, timeoutHours)
		if err != nil {
			return config.WriteError(c, err, "Gagal menjalankan auto-release.")
		}
		if result.Released {
			releasedCount++
		}
		results = append(results, toAutoReleaseResultPayload(result))
	}

	return c.JSON(fiber.Map{
		"success": true,
		"message": "Sweep auto-release selesai.",
		"data": fiber.Map{
			"timeout_hours":  timeoutHours,
			"checked_total":  len(assignments),
			"released_total": releasedCount,
			"items":          results,
		},
	})
}

func handleAdminPost(c fiber.Ctx, service *Service) error {
	body, err := config.ParseJSONBody(c)
	if err != nil {
		return config.WriteError(c, err, "Gagal memproses keputusan admin.")
	}

	ctx, cancel, adminRecord, err := resolveAdminContext(c, service)
	if err != nil {
		return config.WriteError(c, err, "Gagal memproses keputusan admin.")
	}
	defer cancel()

	if isAdminAutoReleasePath(c) {
		return handleAdminAutoReleasePost(c, service, ctx, body)
	}
	if isAdminDisputePath(c) {
		return handleAdminDisputeMediatePost(c, service, ctx, adminRecord, body)
	}

	verificationID := strings.TrimSpace(c.Params("id"))
	if verificationID == "" {
		return config.WriteError(c, config.NewAppError("Verification ID wajib dikirim.", fiber.StatusBadRequest), "Gagal memproses keputusan admin.")
	}

	record, err := service.FindVerificationProfileByID(ctx, verificationID)
	if err != nil {
		return config.WriteError(c, config.MapSupabaseError(err, "Gagal mengambil verification cloud."), "Gagal memproses keputusan admin.")
	}
	if record == nil {
		return config.WriteError(c, config.NewAppError("Verification tidak ditemukan.", fiber.StatusNotFound), "Gagal memproses keputusan admin.")
	}

	payload, err := collectVerificationDecisionRequest(resolveAdminAction(c), adminRecord, body)
	if err != nil {
		return config.WriteError(c, err, "Gagal memproses keputusan admin.")
	}

	if err := ensureDecisionAllowed(record, payload); err != nil {
		return config.WriteError(c, err, "Gagal memproses keputusan admin.")
	}

	if err := service.ApplyVerificationDecision(ctx, record, adminRecord, payload); err != nil {
		return config.WriteError(c, config.MapSupabaseError(err, "Gagal menyimpan keputusan verification cloud."), "Gagal memproses keputusan admin.")
	}

	updatedRecord, err := service.FindVerificationProfileByID(ctx, verificationID)
	if err != nil {
		return config.WriteError(c, config.MapSupabaseError(err, "Gagal mengambil ulang verification cloud."), "Gagal memproses keputusan admin.")
	}

	responsePayload, err := buildAdminVerificationPayload(ctx, service, updatedRecord, true)
	if err != nil {
		return config.WriteError(c, err, "Gagal memproses keputusan admin.")
	}

	return c.JSON(fiber.Map{
		"success": true,
		"message": "Keputusan verification admin berhasil disimpan.",
		"data":    responsePayload,
	})
}

func resolveAdminContext(c fiber.Ctx, service *Service) (context.Context, context.CancelFunc, *authSessionRecord, error) {
	sessionToken := config.ResolveSessionToken(c, service.cfg.SessionCookieName)
	if sessionToken == "" {
		return nil, nil, nil, config.NewAppError("Token sesi admin tidak ditemukan. Kirim bearer token atau cookie sesi.", fiber.StatusUnauthorized)
	}

	ctx, cancel := context.WithTimeout(context.Background(), 20*time.Second)
	authRecord, err := service.FindAuthBySessionToken(ctx, sessionToken)
	if err != nil {
		cancel()
		return nil, nil, nil, config.MapSupabaseError(err, "Gagal mengambil data auth admin cloud.")
	}
	if authRecord == nil {
		cancel()
		return nil, nil, nil, config.NewAppError("Token sesi admin tidak valid atau sudah kadaluarsa.", fiber.StatusUnauthorized)
	}
	if !isAdminAuthorization(authRecord.Authorization) {
		cancel()
		return nil, nil, nil, config.NewAppError("Akun ini tidak punya akses admin.", fiber.StatusForbidden)
	}

	return ctx, cancel, authRecord, nil
}

func buildAdminVerificationPayload(ctx context.Context, service *Service, record *verificationProfileRecord, includeDetail bool) (fiber.Map, error) {
	if record == nil {
		return fiber.Map{}, nil
	}

	user, err := service.FindUserByAuthUserID(ctx, record.AuthUserID)
	if err != nil {
		return nil, config.MapSupabaseError(err, "Gagal mengambil user verification cloud.")
	}

	documents, err := service.ListVerificationDocuments(ctx, record.ID)
	if err != nil {
		return nil, config.MapSupabaseError(err, "Gagal mengambil dokumen verification cloud.")
	}

	payload := fiber.Map{
		"verification_profile_id": record.ID,
		"auth_user_id":            record.AuthUserID,
		"user":                    toAdminUserPayload(user, record.AuthUserID),
		"full_legal_name":         record.FullLegalName,
		"nik":                     maskNIK(record.NIK),
		"birth_place":             record.BirthPlace,
		"birth_date":              formatRFC3339Date(record.BirthDate),
		"gender":                  record.Gender,
		"occupation":              record.Occupation,
		"province":                record.Province,
		"city":                    record.City,
		"district":                record.District,
		"sub_district":            record.SubDistrict,
		"postal_code":             record.PostalCode,
		"full_address":            record.FullAddress,
		"domicile_same_as_ktp":    record.DomicileSameAsKTP,
		"verification_status":     record.VerificationStatus,
		"verification_stage":      record.VerificationStage,
		"risk_score":              record.RiskScore,
		"risk_flags":              record.RiskFlags,
		"submitted_at":            formatRFC3339Time(record.SubmittedAt),
		"reviewed_at":             formatRFC3339Time(record.ReviewedAt),
		"approved_at":             formatRFC3339Time(record.ApprovedAt),
		"rejected_at":             formatRFC3339Time(record.RejectedAt),
		"rejection_reason_code":   record.RejectionReasonCode,
		"rejection_reason_detail": record.RejectionReasonDetail,
		"needs_resubmission":      record.NeedsResubmission,
		"created_at":              formatRFC3339Time(record.CreatedAt),
		"updated_at":              formatRFC3339Time(record.UpdatedAt),
		"document_summary":        summarizeDocuments(documents),
		"documents":               toAdminDocumentsPayload(documents),
	}

	if includeDetail {
		reviews, err := service.ListVerificationReviews(ctx, record.ID)
		if err != nil {
			return nil, config.MapSupabaseError(err, "Gagal mengambil review verification cloud.")
		}
		payload["reviews"] = toAdminReviewsPayload(reviews)
	}

	return payload, nil
}

func collectVerificationDecisionRequest(action string, adminRecord *authSessionRecord, body map[string]any) (verificationDecisionPayload, error) {
	reviewNotes := strings.TrimSpace(config.NormalizeString(body["review_notes"]))
	reasonCode := strings.TrimSpace(config.NormalizeString(body["decision_reason_code"]))
	reasonDetail := strings.TrimSpace(config.NormalizeString(body["decision_reason_detail"]))
	reviewerRole := normalizeReviewerRole(adminRecord.Authorization)

	switch action {
	case "approve":
		if reviewNotes == "" {
			reviewNotes = "Verification approved by admin."
		}
		return verificationDecisionPayload{
			ReviewResult:      "approved",
			NextStatus:        "approved",
			NextStage:         "done",
			ReviewerRole:      reviewerRole,
			ReviewNotes:       reviewNotes,
			NeedsResubmission: false,
		}, nil
	case "reject":
		if reasonCode == "" {
			reasonCode = "manual_reject"
		}
		if reasonDetail == "" {
			reasonDetail = "Admin menolak verification. User perlu mengirim data ulang dari awal."
		}
		return verificationDecisionPayload{
			ReviewResult:         "rejected",
			NextStatus:           "rejected",
			NextStage:            "review",
			ReviewerRole:         reviewerRole,
			ReviewNotes:          firstNonEmpty(reviewNotes, reasonDetail),
			DecisionReasonCode:   reasonCode,
			DecisionReasonDetail: reasonDetail,
			NeedsResubmission:    false,
		}, nil
	case "resubmission":
		if reasonCode == "" {
			reasonCode = "needs_resubmission"
		}
		if reasonDetail == "" {
			reasonDetail = "Admin meminta user memperbaiki data atau dokumen verification."
		}
		return verificationDecisionPayload{
			ReviewResult:         "needs_resubmission",
			NextStatus:           "resubmission_required",
			NextStage:            "identity_form",
			ReviewerRole:         reviewerRole,
			ReviewNotes:          firstNonEmpty(reviewNotes, reasonDetail),
			DecisionReasonCode:   reasonCode,
			DecisionReasonDetail: reasonDetail,
			NeedsResubmission:    true,
		}, nil
	default:
		return verificationDecisionPayload{}, config.NewAppError("Aksi admin verification tidak dikenal.", fiber.StatusNotFound)
	}
}

func ensureDecisionAllowed(record *verificationProfileRecord, payload verificationDecisionPayload) error {
	if record == nil {
		return config.NewAppError("Verification tidak ditemukan.", fiber.StatusNotFound)
	}
	if record.VerificationStatus == "approved" && payload.NextStatus != "approved" {
		return config.NewAppError("Verification yang sudah approved tidak bisa diturunkan dari panel MVP.", fiber.StatusConflict)
	}
	if record.VerificationStatus == "approved" && payload.NextStatus == "approved" {
		return config.NewAppError("Verification ini sudah approved.", fiber.StatusConflict)
	}
	return nil
}

func isAdminAuthorization(value string) bool {
	switch strings.ToLower(strings.TrimSpace(value)) {
	case "admin", "root", "compliance":
		return true
	default:
		return false
	}
}

func normalizeReviewerRole(value string) string {
	switch strings.ToLower(strings.TrimSpace(value)) {
	case "root", "admin":
		return "admin"
	case "compliance":
		return "compliance"
	default:
		return "admin"
	}
}

func normalizeStatusFilter(value string) string {
	switch strings.ToLower(strings.TrimSpace(value)) {
	case "review", "queue", "review_queue":
		return "review_queue"
	case "all":
		return ""
	default:
		return strings.ToLower(strings.TrimSpace(value))
	}
}

func matchesVerificationStatusFilter(status string, filter string) bool {
	normalized := strings.ToLower(strings.TrimSpace(status))
	if filter == "review_queue" {
		switch normalized {
		case "submitted", "document_check", "face_check", "risk_review", "manual_review":
			return true
		default:
			return false
		}
	}
	return normalized == filter
}

func resolveAdminAction(c fiber.Ctx) string {
	path := strings.TrimSuffix(strings.ToLower(c.Path()), "/")
	if strings.HasSuffix(path, "/approve") {
		return "approve"
	}
	if strings.HasSuffix(path, "/reject") {
		return "reject"
	}
	if strings.HasSuffix(path, "/resubmission") {
		return "resubmission"
	}
	return ""
}

func buildAdminDisputePayload(ctx context.Context, service *Service, record *adminDisputeCaseRecord, includeDetail bool) (fiber.Map, error) {
	if record == nil {
		return fiber.Map{}, nil
	}

	quest, err := service.FindQuestByID(ctx, record.QuestID)
	if err != nil {
		return nil, config.MapSupabaseError(err, "Gagal mengambil quest dispute cloud.")
	}

	evidences, err := service.ListDisputeEvidences(ctx, record.ID)
	if err != nil {
		return nil, config.MapSupabaseError(err, "Gagal mengambil evidence dispute cloud.")
	}

	giverEvidence := make([]fiber.Map, 0)
	runnerEvidence := make([]fiber.Map, 0)
	for _, evidence := range evidences {
		payload := toAdminDisputeEvidencePayload(evidence)
		if normalizeAdminDisputePartyPayload(evidence.UploaderParty) == "GIVER" {
			giverEvidence = append(giverEvidence, payload)
		} else {
			runnerEvidence = append(runnerEvidence, payload)
		}
	}

	payload := fiber.Map{
		"id":               record.ID,
		"questId":          record.QuestID,
		"questTitle":       resolveAdminQuestTitle(quest),
		"questStatus":      resolveAdminQuestStatus(quest),
		"assignmentId":     record.AssignmentID,
		"giverAuthUserId":  record.GiverAuthUserID,
		"runnerAuthUserId": record.RunnerAuthUserID,
		"raisedBy":         normalizeAdminDisputePartyPayload(record.RaisedBy),
		"raisedAt":         formatRFC3339Time(record.CreatedAt),
		"status":           normalizeAdminDisputeStatusPayload(record.Status),
		"status_raw":       record.Status,
		"reason":           record.Reason,
		"amount":           buildAdminCurrencyDisplay(record.EscrowAmount),
		"evidenceDeadline": formatRFC3339Time(record.EvidenceDeadlineAt),
		"mediatorNote":     record.MediatorNote,
		"resolvedAt":       formatRFC3339Time(record.ResolvedAt),
		"giverEvidence":    giverEvidence,
		"runnerEvidence":   runnerEvidence,
		"evidence_total":   len(evidences),
		"settlement": fiber.Map{
			"giver_amount":  buildAdminCurrencyDisplay(record.GiverSettlementAmount),
			"runner_amount": buildAdminCurrencyDisplay(record.RunnerSettlementAmount),
			"mediation_fee": buildAdminCurrencyDisplay(record.MediationFeeAmount),
		},
		"updatedAt": formatRFC3339Time(record.UpdatedAt),
	}

	if includeDetail {
		events, err := service.ListDisputeEvents(ctx, record.ID)
		if err != nil {
			return nil, config.MapSupabaseError(err, "Gagal mengambil timeline dispute cloud.")
		}
		timeline := make([]fiber.Map, 0, len(events))
		for _, event := range events {
			timeline = append(timeline, fiber.Map{
				"id":          event.ID,
				"actor":       normalizeAdminDisputePartyPayload(event.ActorParty),
				"status":      normalizeAdminDisputeStatusPayload(event.Status),
				"description": event.Description,
				"time":        formatRFC3339Time(event.EventTime),
			})
		}
		payload["timeline"] = timeline
	}

	return payload, nil
}

func processAutoReleaseCandidate(ctx context.Context, service *Service, assignment adminAssignmentRecord, now time.Time, timeoutHours int) (adminAutoReleaseResult, error) {
	result := adminAutoReleaseResult{
		AssignmentID: assignment.ID,
		QuestID:      assignment.QuestID,
		RunnerAuthID: assignment.RunnerAuthUserID,
		FinishedAt:   assignment.FinishedAt,
	}

	if assignment.FinishedAt == nil || assignment.FinishedAt.IsZero() {
		result.SkippedReason = "finished_at kosong"
		return result, nil
	}
	autoReleaseAt := assignment.FinishedAt.UTC().Add(time.Duration(timeoutHours) * time.Hour)
	result.AutoReleaseAt = &autoReleaseAt
	if now.Before(autoReleaseAt) {
		result.SkippedReason = "belum melewati timeout"
		return result, nil
	}

	quest, err := service.FindQuestByID(ctx, assignment.QuestID)
	if err != nil {
		return result, config.MapSupabaseError(err, "Gagal mengambil quest auto-release cloud.")
	}
	if quest == nil {
		result.SkippedReason = "quest tidak ditemukan"
		return result, nil
	}
	result.QuestTitle = quest.Title
	if !strings.EqualFold(quest.Status, "pending_review") {
		result.SkippedReason = "quest bukan pending_review"
		return result, nil
	}

	escrow, err := service.FindQuestEscrowByQuestID(ctx, assignment.QuestID)
	if err != nil {
		return result, config.MapSupabaseError(err, "Gagal mengambil escrow auto-release cloud.")
	}
	if escrow == nil {
		result.SkippedReason = "escrow tidak ditemukan"
		return result, nil
	}
	if !strings.EqualFold(escrow.EscrowState, "pending") {
		result.SkippedReason = "escrow bukan pending"
		return result, nil
	}

	if err := service.UpdateQuestStatus(ctx, assignment.QuestID, "completed"); err != nil {
		return result, config.MapSupabaseError(err, "Gagal update quest auto-release cloud.")
	}
	if err := service.TouchQuestAssignment(ctx, assignment.ID); err != nil {
		return result, config.MapSupabaseError(err, "Gagal update assignment auto-release cloud.")
	}
	if err := service.UpdateQuestEscrowState(ctx, assignment.QuestID, "released", "released_at"); err != nil {
		return result, config.MapSupabaseError(err, "Gagal release escrow auto-release cloud.")
	}

	result.Released = true
	result.SkippedReason = ""
	return result, nil
}

func toAutoReleaseResultPayload(record adminAutoReleaseResult) fiber.Map {
	return fiber.Map{
		"assignment_id":   record.AssignmentID,
		"quest_id":        record.QuestID,
		"quest_title":     record.QuestTitle,
		"runner_auth_id":  record.RunnerAuthID,
		"finished_at":     formatRFC3339Time(record.FinishedAt),
		"auto_release_at": formatRFC3339Time(record.AutoReleaseAt),
		"released":        record.Released,
		"skipped_reason":  record.SkippedReason,
	}
}

func toAdminDisputeEvidencePayload(record adminDisputeEvidenceRecord) fiber.Map {
	return fiber.Map{
		"id":         record.ID,
		"uploader":   normalizeAdminDisputePartyPayload(record.UploaderParty),
		"type":       strings.ToUpper(strings.TrimSpace(record.EvidenceType)),
		"label":      record.Label,
		"note_text":  record.NoteText,
		"file_name":  record.FileName,
		"url":        record.FileURL,
		"metadata":   record.Metadata,
		"uploadedAt": formatRFC3339Time(record.UploadedAt),
	}
}

func isAdminDisputePath(c fiber.Ctx) bool {
	return strings.Contains(strings.ToLower(c.Path()), "/admin/disputes")
}

func isAdminAutoReleasePath(c fiber.Ctx) bool {
	return strings.Contains(strings.ToLower(c.Path()), "/admin/escrows/auto-release")
}

func normalizeAdminDisputeStatusFilter(value string) string {
	normalized := strings.ToLower(strings.TrimSpace(value))
	switch normalized {
	case "active", "queue", "open":
		return "open"
	case "all":
		return ""
	default:
		return normalized
	}
}

func normalizeAdminDisputeResolution(value string) string {
	switch strings.ToLower(strings.TrimSpace(value)) {
	case "resolved_runner":
		return "resolved_runner"
	case "resolved_giver":
		return "resolved_giver"
	case "resolved_partial":
		return "resolved_partial"
	default:
		return ""
	}
}

func normalizeAdminDisputeStatusPayload(value string) string {
	switch strings.ToLower(strings.TrimSpace(value)) {
	case "under_review":
		return "UNDER_REVIEW"
	case "resolved_runner":
		return "RESOLVED_RUNNER"
	case "resolved_giver":
		return "RESOLVED_GIVER"
	case "resolved_partial":
		return "RESOLVED_PARTIAL"
	case "dismissed":
		return "DISMISSED"
	default:
		return "EVIDENCE_SUBMISSION"
	}
}

func normalizeAdminDisputePartyPayload(value string) string {
	switch strings.ToLower(strings.TrimSpace(value)) {
	case "giver":
		return "GIVER"
	case "mediator":
		return "MEDIATOR"
	default:
		return "RUNNER"
	}
}

func isAdminDisputeResolved(status string) bool {
	switch strings.ToLower(strings.TrimSpace(status)) {
	case "resolved_runner", "resolved_giver", "resolved_partial", "dismissed":
		return true
	default:
		return false
	}
}

func resolveAdminMediationAmounts(nextStatus string, escrowAmount float64) (float64, float64, float64) {
	switch nextStatus {
	case "resolved_giver":
		return escrowAmount, 0, 0
	case "resolved_partial":
		half := escrowAmount / 2
		return half, half, 0
	default:
		return 0, escrowAmount, 0
	}
}

func resolveAdminMediationLifecycle(nextStatus string) (string, string, string, string) {
	switch nextStatus {
	case "resolved_giver":
		return "cancelled", "cancelled", "refund", "refunded_at"
	case "resolved_partial":
		return "completed", "finished", "released", "released_at"
	default:
		return "completed", "finished", "released", "released_at"
	}
}

func buildAdminMediationDescription(nextStatus string, mediatorNote string, adminRecord *authSessionRecord) string {
	actor := "Admin mediator"
	if adminRecord != nil && strings.TrimSpace(adminRecord.Email) != "" {
		actor = adminRecord.Email
	}
	base := actor + " menyelesaikan dispute dengan hasil " + strings.ToUpper(nextStatus) + "."
	if strings.TrimSpace(mediatorNote) == "" {
		return base
	}
	return base + " Catatan: " + strings.TrimSpace(mediatorNote)
}

func resolveAutoReleaseTimeoutHours(body map[string]any) int {
	candidates := []string{
		config.NormalizeString(body["timeout_hours"]),
		strings.TrimSpace(os.Getenv("QQM_AUTO_RELEASE_HOURS")),
	}
	for _, candidate := range candidates {
		if parsed, err := strconv.Atoi(candidate); err == nil && parsed > 0 {
			if parsed > 168 {
				return 168
			}
			return parsed
		}
	}
	return 24
}

func parseFloatOrZero(value string) float64 {
	normalized := strings.ReplaceAll(strings.TrimSpace(value), ",", "")
	parsed, err := strconv.ParseFloat(normalized, 64)
	if err != nil {
		return 0
	}
	return parsed
}

func buildAdminCurrencyDisplay(value string) string {
	return "Rp " + formatAdminNumberID(parseFloatOrZero(value))
}

func formatAdminNumberID(value float64) string {
	text := strconv.FormatFloat(value, 'f', 0, 64)
	parts := strings.Split(text, ".")
	whole := parts[0]
	sign := ""
	if strings.HasPrefix(whole, "-") {
		sign = "-"
		whole = strings.TrimPrefix(whole, "-")
	}
	if whole == "" {
		whole = "0"
	}
	chunks := make([]string, 0)
	for len(whole) > 3 {
		chunks = append([]string{whole[len(whole)-3:]}, chunks...)
		whole = whole[:len(whole)-3]
	}
	chunks = append([]string{whole}, chunks...)
	return sign + strings.Join(chunks, ".")
}

func resolveAdminQuestTitle(record *adminQuestRecord) string {
	if record == nil || strings.TrimSpace(record.Title) == "" {
		return "Quest dispute"
	}
	return record.Title
}

func resolveAdminQuestStatus(record *adminQuestRecord) string {
	if record == nil {
		return ""
	}
	return record.Status
}

func toAdminUserPayload(user *userRecord, fallbackAuthUserID string) fiber.Map {
	if user == nil {
		return fiber.Map{
			"auth_user_id": fallbackAuthUserID,
		}
	}

	return fiber.Map{
		"auth_user_id":   user.AuthUserID,
		"fullname":       user.Fullname,
		"username":       user.Username,
		"email":          user.Email,
		"phone":          user.Phone,
		"user_role":      config.NormalizeUserRole(user.UserRole),
		"authorization":  firstNonEmpty(user.Authorization, "user"),
		"can_post_quest": config.IsRoleSwitchEnabled(user.UserRole),
	}
}

func toAdminDocumentsPayload(records []verificationDocumentRecord) []fiber.Map {
	items := make([]fiber.Map, 0, len(records))
	for _, record := range records {
		items = append(items, fiber.Map{
			"id":                record.ID,
			"document_type":     record.DocumentType,
			"file_key":          record.FileKey,
			"file_url":          record.FileURL,
			"mime_type":         record.MimeType,
			"file_size":         record.FileSize,
			"validation_status": record.ValidationStatus,
			"uploaded_at":       formatRFC3339Time(record.UploadedAt),
		})
	}
	return items
}

func toAdminReviewsPayload(records []verificationReviewRecord) []fiber.Map {
	items := make([]fiber.Map, 0, len(records))
	for _, record := range records {
		items = append(items, fiber.Map{
			"id":                     record.ID,
			"review_type":            record.ReviewType,
			"review_result":          record.ReviewResult,
			"reviewer_id":            record.ReviewerID,
			"reviewer_role":          record.ReviewerRole,
			"review_notes":           record.ReviewNotes,
			"decision_reason_code":   record.DecisionReasonCode,
			"decision_reason_detail": record.DecisionReasonDetail,
			"created_at":             formatRFC3339Time(record.CreatedAt),
		})
	}
	return items
}

func summarizeDocuments(records []verificationDocumentRecord) fiber.Map {
	required := map[string]bool{
		"ktp_front":       false,
		"selfie":          false,
		"selfie_with_ktp": false,
	}
	for _, record := range records {
		if _, ok := required[record.DocumentType]; ok && strings.TrimSpace(record.FileKey) != "" {
			required[record.DocumentType] = true
		}
	}

	readyCount := 0
	for _, ready := range required {
		if ready {
			readyCount++
		}
	}

	return fiber.Map{
		"required_ready":  readyCount,
		"required_total":  len(required),
		"ktp_front":       required["ktp_front"],
		"selfie":          required["selfie"],
		"selfie_with_ktp": required["selfie_with_ktp"],
		"total_documents": len(records),
	}
}

func maskNIK(value string) string {
	trimmed := strings.TrimSpace(value)
	if len(trimmed) <= 4 {
		return trimmed
	}
	return strings.Repeat("*", len(trimmed)-4) + trimmed[len(trimmed)-4:]
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

func firstNonEmpty(values ...string) string {
	for _, value := range values {
		trimmed := strings.TrimSpace(value)
		if trimmed != "" {
			return trimmed
		}
	}
	return ""
}
