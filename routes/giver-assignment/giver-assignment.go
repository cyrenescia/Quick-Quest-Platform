package giverassignment

import (
	"context"
	"strconv"
	"strings"
	"time"

	"Stream-StrictMode/config"

	"github.com/gofiber/fiber/v3"
)

func GiverAssignment(service *Service) fiber.Handler {
	return func(c fiber.Ctx) error {
		switch c.Method() {
		case fiber.MethodGet:
			return handleGiverAssignmentGet(c, service)
		case fiber.MethodPost:
			return handleGiverAssignmentPost(c, service)
		case fiber.MethodOptions:
			return c.SendStatus(fiber.StatusNoContent)
		default:
			return config.WriteError(c, config.NewAppError("Method tidak diizinkan untuk giver assignment.", fiber.StatusMethodNotAllowed), "Gagal memproses giver assignment.")
		}
	}
}

func handleGiverAssignmentGet(c fiber.Ctx, service *Service) error {
	ctx, cancel, authRecord, err := resolveGiverAssignmentContext(c, service)
	if err != nil {
		return config.WriteError(c, err, "Gagal mengambil assignment giver.")
	}
	defer cancel()

	questID := strings.TrimSpace(c.Params("id"))
	if questID == "" {
		return config.WriteError(c, config.NewAppError("Quest ID wajib dikirim.", fiber.StatusBadRequest), "Gagal mengambil assignment giver.")
	}

	questRecord, err := service.FindQuestByID(ctx, questID)
	if err != nil {
		return config.WriteError(c, config.MapSupabaseError(err, "Gagal mengambil quest giver cloud."), "Gagal mengambil assignment giver.")
	}
	if questRecord == nil {
		return config.WriteError(c, config.NewAppError("Quest tidak ditemukan.", fiber.StatusNotFound), "Gagal mengambil assignment giver.")
	}
	if questRecord.GiverAuthUserID != authRecord.AuthUserID {
		return config.WriteError(c, config.NewAppError("Quest ini bukan milik giver login.", fiber.StatusForbidden), "Gagal mengambil assignment giver.")
	}

	assignments, err := service.ListQuestAssignments(ctx, questID)
	if err != nil {
		return config.WriteError(c, config.MapSupabaseError(err, "Gagal mengambil assignment quest cloud."), "Gagal mengambil assignment giver.")
	}

	items := make([]fiber.Map, 0, len(assignments))
	for _, assignment := range assignments {
		runner, err := service.FindRunnerSummary(ctx, assignment.RunnerAuthUserID)
		if err != nil {
			return config.WriteError(c, config.MapSupabaseError(err, "Gagal mengambil ringkasan runner cloud."), "Gagal mengambil assignment giver.")
		}

		ratingState, err := service.FindRatingStateByAssignment(ctx, assignment.ID, authRecord.AuthUserID)
		if err != nil {
			return config.WriteError(c, config.MapSupabaseError(err, "Gagal mengambil rating state assignment cloud."), "Gagal mengambil assignment giver.")
		}

		items = append(items, toAssignmentItem(assignment, runner, ratingState))
	}

	return c.JSON(fiber.Map{
		"success": true,
		"message": "Assignment quest giver berhasil diambil.",
		"data": fiber.Map{
			"quest": fiber.Map{
				"id":     questRecord.ID,
				"title":  questRecord.Title,
				"status": questRecord.Status,
				"mode":   questRecord.Mode,
			},
			"items": items,
			"total": len(items),
		},
	})
}

func handleGiverAssignmentPost(c fiber.Ctx, service *Service) error {
	body, err := config.ParseJSONBody(c)
	if err != nil {
		return config.WriteError(c, err, "Gagal memproses audit assignment.")
	}

	ctx, cancel, authRecord, err := resolveGiverAssignmentContext(c, service)
	if err != nil {
		return config.WriteError(c, err, "Gagal memproses audit assignment.")
	}
	defer cancel()

	assignmentID := strings.TrimSpace(c.Params("id"))
	if assignmentID == "" {
		return config.WriteError(c, config.NewAppError("Assignment ID wajib dikirim.", fiber.StatusBadRequest), "Gagal memproses audit assignment.")
	}

	action := resolveGiverAssignmentAction(c)
	if action == "" {
		return config.WriteError(c, config.NewAppError("Aksi audit assignment tidak dikenal.", fiber.StatusNotFound), "Gagal memproses audit assignment.")
	}

	assignment, err := service.FindQuestAssignmentByID(ctx, assignmentID)
	if err != nil {
		return config.WriteError(c, config.MapSupabaseError(err, "Gagal mengambil assignment cloud."), "Gagal memproses audit assignment.")
	}
	if assignment == nil {
		return config.WriteError(c, config.NewAppError("Assignment tidak ditemukan.", fiber.StatusNotFound), "Gagal memproses audit assignment.")
	}

	questRecord, err := service.FindQuestByID(ctx, assignment.QuestID)
	if err != nil {
		return config.WriteError(c, config.MapSupabaseError(err, "Gagal mengambil quest cloud."), "Gagal memproses audit assignment.")
	}
	if questRecord == nil {
		return config.WriteError(c, config.NewAppError("Quest assignment tidak ditemukan.", fiber.StatusNotFound), "Gagal memproses audit assignment.")
	}
	if questRecord.GiverAuthUserID != authRecord.AuthUserID {
		return config.WriteError(c, config.NewAppError("Assignment ini bukan milik quest giver login.", fiber.StatusForbidden), "Gagal memproses audit assignment.")
	}

	if action == "confirm_candidate" || action == "reject_candidate" {
		return handleGiverCandidateDecision(c, service, ctx, assignment, questRecord, action)
	}
	if action == "share_location" {
		return handleGiverAssignmentShareLocation(c, service, ctx, assignment, questRecord, body)
	}

	nextAssignmentStatus, nextQuestStatus, err := resolveAuditTransition(action, assignment.AssignmentStatus)
	if err != nil {
		return config.WriteError(c, err, "Gagal memproses audit assignment.")
	}
	nextEscrowStatus, escrowTimestampField := resolveAuditEscrowTransition(action)

	escrow, err := service.FindQuestEscrowByQuestID(ctx, assignment.QuestID)
	if err != nil {
		return config.WriteError(c, config.MapSupabaseError(err, "Gagal mengambil escrow quest cloud."), "Gagal memproses audit assignment.")
	}
	if escrow == nil {
		return config.WriteError(c, config.NewAppError("Escrow quest tidak ditemukan.", fiber.StatusNotFound), "Gagal memproses audit assignment.")
	}
	if escrow.EscrowState != "pending" {
		return config.WriteError(c, config.NewAppError("Audit hanya bisa diproses saat escrow berada di status pending.", fiber.StatusConflict), "Gagal memproses audit assignment.")
	}

	if err := service.UpdateQuestAssignmentAudit(ctx, assignment.ID, nextAssignmentStatus); err != nil {
		return config.WriteError(c, config.MapSupabaseError(err, "Gagal memperbarui assignment cloud."), "Gagal memproses audit assignment.")
	}

	if err := service.UpdateQuestAfterAudit(ctx, assignment.QuestID, nextQuestStatus); err != nil {
		return config.WriteError(c, config.MapSupabaseError(err, "Gagal memperbarui quest cloud."), "Gagal memproses audit assignment.")
	}
	if err := service.UpdateQuestEscrowState(ctx, assignment.QuestID, nextEscrowStatus, escrowTimestampField); err != nil {
		return config.WriteError(c, config.MapSupabaseError(err, "Gagal memperbarui escrow quest cloud."), "Gagal memproses audit assignment.")
	}

	disputeID := ""
	if action == "dispute" {
		existingDispute, err := service.FindDisputeByAssignmentID(ctx, assignment.ID)
		if err != nil {
			return config.WriteError(c, config.MapSupabaseError(err, "Gagal mengambil dispute assignment cloud."), "Gagal memproses audit assignment.")
		}
		if existingDispute == nil {
			disputeID, err = service.CreateDisputeCaseFromAssignment(
				ctx,
				questRecord,
				assignment,
				escrow,
				authRecord.AuthUserID,
				config.NormalizeString(body["reason"]),
			)
			if err != nil {
				return config.WriteError(c, config.MapSupabaseError(err, "Gagal membuat dispute case cloud."), "Gagal memproses audit assignment.")
			}
		} else {
			disputeID = config.NormalizeString(existingDispute["id"])
		}
	}

	return c.JSON(fiber.Map{
		"success": true,
		"message": resolveAuditMessage(action),
		"data": fiber.Map{
			"assignment_id":     assignment.ID,
			"quest_id":          assignment.QuestID,
			"action":            action,
			"previous_status":   assignment.AssignmentStatus,
			"assignment_status": nextAssignmentStatus,
			"quest_status":      nextQuestStatus,
			"escrow_status":     nextEscrowStatus,
			"dispute_id":        disputeID,
		},
	})
}

func handleGiverAssignmentShareLocation(c fiber.Ctx, service *Service, ctx context.Context, assignment *questAssignmentRecord, questRecord *questRecord, body map[string]any) error {
	if !isShareLocationAllowed(assignment.AssignmentStatus) {
		return config.WriteError(c, config.NewAppError("Lokasi detail hanya bisa dibagikan setelah kandidat accepted atau pekerjaan active.", fiber.StatusConflict), "Gagal share lokasi detail.")
	}

	sharedAt := time.Now().UTC()
	workLocation := buildWorkLocationPayload(questRecord, body, sharedAt)
	if strings.TrimSpace(config.NormalizeString(workLocation["full_address"])) == "" {
		return config.WriteError(c, config.NewAppError("Alamat lokasi kerja belum tersedia untuk dibagikan.", fiber.StatusBadRequest), "Gagal share lokasi detail.")
	}

	if err := service.ShareQuestAssignmentLocation(ctx, assignment.ID, workLocation, sharedAt); err != nil {
		return config.WriteError(c, config.MapSupabaseError(err, "Gagal menyimpan lokasi detail assignment cloud."), "Gagal share lokasi detail.")
	}

	return c.JSON(fiber.Map{
		"success": true,
		"message": "Lokasi detail berhasil dibagikan ke Runner.",
		"data": fiber.Map{
			"assignment_id":      assignment.ID,
			"quest_id":           assignment.QuestID,
			"assignment_status":  assignment.AssignmentStatus,
			"work_location":      workLocation,
			"location_shared_at": sharedAt,
		},
	})
}

func handleGiverCandidateDecision(c fiber.Ctx, service *Service, ctx context.Context, assignment *questAssignmentRecord, questRecord *questRecord, action string) error {
	if !strings.EqualFold(assignment.AssignmentStatus, "pending") {
		return config.WriteError(c, config.NewAppError("Candidate decision hanya bisa diproses untuk assignment pending.", fiber.StatusConflict), "Gagal memproses kandidat runner.")
	}

	if action == "reject_candidate" {
		if err := service.UpdateQuestAssignmentCandidate(ctx, assignment.ID, "rejected"); err != nil {
			return config.WriteError(c, config.MapSupabaseError(err, "Gagal menolak kandidat runner cloud."), "Gagal memproses kandidat runner.")
		}

		return c.JSON(fiber.Map{
			"success": true,
			"message": "Kandidat runner ditolak.",
			"data": fiber.Map{
				"assignment_id":     assignment.ID,
				"quest_id":          assignment.QuestID,
				"action":            action,
				"previous_status":   assignment.AssignmentStatus,
				"assignment_status": "rejected",
				"quest_status":      questRecord.Status,
				"current_runner_count": parseOrZeroInt(
					questRecord.CurrentRunnerCount,
				),
				"max_runner": parseOrZeroInt(questRecord.MaxRunner),
			},
		})
	}

	if !strings.EqualFold(questRecord.Status, "open") {
		return config.WriteError(c, config.NewAppError("Quest tidak sedang open untuk konfirmasi kandidat.", fiber.StatusConflict), "Gagal memproses kandidat runner.")
	}

	currentCount := parseOrZeroInt(questRecord.CurrentRunnerCount)
	maxRunner := parseOrZeroInt(questRecord.MaxRunner)
	if maxRunner <= 0 {
		maxRunner = 1
	}
	if currentCount >= maxRunner {
		return config.WriteError(c, config.NewAppError("Slot runner quest sudah penuh.", fiber.StatusConflict), "Gagal memproses kandidat runner.")
	}

	nextCount := currentCount + 1
	nextQuestStatus := "open"
	if strings.EqualFold(questRecord.Mode, "solo") || nextCount >= maxRunner {
		nextQuestStatus = "matched"
	}

	if err := service.UpdateQuestAssignmentCandidate(ctx, assignment.ID, "accepted"); err != nil {
		return config.WriteError(c, config.MapSupabaseError(err, "Gagal mengonfirmasi kandidat runner cloud."), "Gagal memproses kandidat runner.")
	}
	if err := service.UpdateQuestAfterCandidateConfirm(ctx, questRecord.ID, nextQuestStatus, nextCount); err != nil {
		return config.WriteError(c, config.MapSupabaseError(err, "Gagal memperbarui slot quest cloud."), "Gagal memproses kandidat runner.")
	}

	cancelledPending := 0
	if strings.EqualFold(questRecord.Mode, "solo") {
		var err error
		cancelledPending, err = service.CancelOtherPendingAssignments(ctx, questRecord.ID, assignment.ID)
		if err != nil {
			return config.WriteError(c, config.MapSupabaseError(err, "Gagal menutup kandidat solo lain cloud."), "Gagal memproses kandidat runner.")
		}
	}

	return c.JSON(fiber.Map{
		"success": true,
		"message": "Kandidat runner dikonfirmasi.",
		"data": fiber.Map{
			"assignment_id":           assignment.ID,
			"quest_id":                assignment.QuestID,
			"action":                  action,
			"previous_status":         assignment.AssignmentStatus,
			"assignment_status":       "accepted",
			"previous_quest_status":   questRecord.Status,
			"quest_status":            nextQuestStatus,
			"current_runner_count":    nextCount,
			"max_runner":              maxRunner,
			"cancelled_pending_count": cancelledPending,
		},
	})
}

func resolveGiverAssignmentContext(c fiber.Ctx, service *Service) (context.Context, context.CancelFunc, *authSessionRecord, error) {
	sessionToken := config.ResolveSessionToken(c, service.cfg.SessionCookieName)
	if sessionToken == "" {
		return nil, nil, nil, config.NewAppError("Token sesi tidak ditemukan. Kirim bearer token atau cookie sesi.", fiber.StatusUnauthorized)
	}

	ctx, cancel := context.WithTimeout(context.Background(), 20*time.Second)
	authRecord, err := service.FindAuthBySessionToken(ctx, sessionToken)
	if err != nil {
		cancel()
		return nil, nil, nil, config.MapSupabaseError(err, "Gagal mengambil data auth cloud.")
	}
	if authRecord == nil {
		cancel()
		return nil, nil, nil, config.NewAppError("Token sesi tidak valid atau sudah kadaluarsa.", fiber.StatusUnauthorized)
	}

	return ctx, cancel, authRecord, nil
}

func resolveGiverAssignmentAction(c fiber.Ctx) string {
	path := strings.TrimSuffix(strings.ToLower(c.Path()), "/")
	if strings.HasSuffix(path, "/share-location") {
		return "share_location"
	}
	if strings.HasSuffix(path, "/confirm") {
		return "confirm_candidate"
	}
	if strings.HasSuffix(path, "/reject") {
		return "reject_candidate"
	}
	if strings.HasSuffix(path, "/accept") {
		return "accept"
	}
	if strings.HasSuffix(path, "/request-revision") {
		return "request_revision"
	}
	if strings.HasSuffix(path, "/dispute") {
		return "dispute"
	}
	return ""
}

func isShareLocationAllowed(status string) bool {
	switch strings.ToLower(strings.TrimSpace(status)) {
	case "accepted", "active":
		return true
	default:
		return false
	}
}

func buildWorkLocationPayload(quest *questRecord, body map[string]any, sharedAt time.Time) map[string]any {
	payload := map[string]any{
		"label":        firstNonEmpty(config.NormalizeString(body["label"]), quest.SubDistrict, quest.District, quest.City, quest.FullAddress),
		"full_address": firstNonEmpty(config.NormalizeString(body["full_address"]), quest.FullAddress),
		"province":     firstNonEmpty(config.NormalizeString(body["province"]), quest.Province),
		"city":         firstNonEmpty(config.NormalizeString(body["city"]), quest.City),
		"district":     firstNonEmpty(config.NormalizeString(body["district"]), quest.District),
		"sub_district": firstNonEmpty(config.NormalizeString(body["sub_district"]), quest.SubDistrict),
		"postal_code":  firstNonEmpty(config.NormalizeString(body["postal_code"]), quest.PostalCode),
		"note":         config.NormalizeString(body["note"]),
		"shared_at":    sharedAt,
		"shared_by":    "giver",
	}

	if lat := parseOptionalFloatFromAny(body["lat"]); lat != nil {
		payload["lat"] = *lat
	} else if lat := parseOptionalFloatText(quest.Lat); lat != nil {
		payload["lat"] = *lat
	}

	if lng := parseOptionalFloatFromAny(body["lng"]); lng != nil {
		payload["lng"] = *lng
	} else if lng := parseOptionalFloatText(quest.Lng); lng != nil {
		payload["lng"] = *lng
	}

	return payload
}

func resolveAuditTransition(action string, currentStatus string) (string, string, error) {
	normalizedStatus := strings.ToLower(strings.TrimSpace(currentStatus))
	if normalizedStatus != "finished" {
		return "", "", config.NewAppError("Audit hanya bisa diproses untuk assignment yang sudah finished.", fiber.StatusConflict)
	}

	switch action {
	case "accept":
		return "finished", "completed", nil
	case "request_revision":
		return "active", "in_progress", nil
	case "dispute":
		return "disputed", "disputed", nil
	default:
		return "", "", config.NewAppError("Aksi audit assignment tidak dikenal.", fiber.StatusBadRequest)
	}
}

func resolveAuditMessage(action string) string {
	switch action {
	case "accept":
		return "Hasil kerja runner diterima. Quest ditandai completed."
	case "request_revision":
		return "Revision diminta. Assignment dikembalikan ke active."
	case "dispute":
		return "Dispute dibuka. Quest dan assignment ditandai disputed."
	default:
		return "Audit assignment berhasil diproses."
	}
}

func resolveAuditEscrowTransition(action string) (string, string) {
	switch action {
	case "accept":
		return "released", "released_at"
	case "request_revision":
		return "in_progress", ""
	case "dispute":
		return "disputed", "disputed_at"
	default:
		return "pending", ""
	}
}

func toAssignmentItem(record questAssignmentRecord, runner *runnerSummaryRecord, ratingState *ratingStateRecord) fiber.Map {
	return fiber.Map{
		"id":                  record.ID,
		"quest_id":            record.QuestID,
		"runner_auth_user_id": record.RunnerAuthUserID,
		"assignment_status":   record.AssignmentStatus,
		"joined_at":           optionalTimeValue(record.JoinedAt),
		"started_at":          optionalTimeValue(record.StartedAt),
		"finished_at":         optionalTimeValue(record.FinishedAt),
		"work_location":       optionalWorkLocationValue(record.WorkLocation),
		"location_shared_at":  optionalTimeValue(record.LocationSharedAt),
		"runner": fiber.Map{
			"auth_user_id": resolveRunnerAuthUserID(runner, record.RunnerAuthUserID),
			"fullname":     resolveRunnerFullname(runner),
			"username":     resolveRunnerUsername(runner),
			"email":        resolveRunnerEmail(runner),
			"phone":        resolveRunnerPhone(runner),
		},
		"rating_state": toAssignmentRatingStatePayload(ratingState),
	}
}

func toAssignmentRatingStatePayload(record *ratingStateRecord) fiber.Map {
	if record == nil {
		record = &ratingStateRecord{}
	}
	return fiber.Map{
		"rating_count":        record.RatingCount,
		"unique_rating_count": record.UniqueRatingCount,
		"giver_rated":         record.GiverRated,
		"runner_rated":        record.RunnerRated,
		"viewer_has_rated":    record.ViewerHasRated,
		"both_rated":          record.BothRated,
	}
}

func resolveRunnerAuthUserID(runner *runnerSummaryRecord, fallback string) string {
	if runner == nil || strings.TrimSpace(runner.AuthUserID) == "" {
		return fallback
	}
	return runner.AuthUserID
}

func resolveRunnerFullname(runner *runnerSummaryRecord) string {
	if runner == nil {
		return ""
	}
	return runner.Fullname
}

func resolveRunnerUsername(runner *runnerSummaryRecord) string {
	if runner == nil {
		return ""
	}
	return runner.Username
}

func resolveRunnerEmail(runner *runnerSummaryRecord) string {
	if runner == nil {
		return ""
	}
	return runner.Email
}

func resolveRunnerPhone(runner *runnerSummaryRecord) string {
	if runner == nil {
		return ""
	}
	return runner.Phone
}

func optionalTimeValue(value *time.Time) any {
	if value == nil || value.IsZero() {
		return nil
	}
	return value.UTC()
}

func optionalWorkLocationValue(value map[string]any) any {
	if len(value) == 0 {
		return nil
	}
	return value
}

func parseOrZeroInt(value string) int {
	trimmed := strings.TrimSpace(value)
	if trimmed == "" {
		return 0
	}
	parsed, err := strconv.Atoi(trimmed)
	if err != nil {
		return 0
	}
	return parsed
}

func parseOptionalFloatFromAny(value any) *float64 {
	normalized := strings.TrimSpace(config.NormalizeString(value))
	return parseOptionalFloatText(normalized)
}

func parseOptionalFloatText(value string) *float64 {
	trimmed := strings.TrimSpace(value)
	if trimmed == "" {
		return nil
	}
	parsed, err := strconv.ParseFloat(trimmed, 64)
	if err != nil {
		return nil
	}
	return &parsed
}

func firstNonEmpty(values ...string) string {
	for _, value := range values {
		if strings.TrimSpace(value) != "" {
			return strings.TrimSpace(value)
		}
	}
	return ""
}
