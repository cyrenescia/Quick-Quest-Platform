package runnerquest

import (
	"context"
	"math"
	"strconv"
	"strings"
	"time"

	"Stream-StrictMode/config"
	questclassification "Stream-StrictMode/routes/quest-classification"

	"github.com/gofiber/fiber/v3"
)

const (
	initialBroadcastRadiusKM = 1.0
	initialBroadcastWindow   = 15 * time.Minute
	broadcastExpandStep      = 5 * time.Minute
	maxBroadcastRadiusKM     = 10.0
)

type runnerQuestMatchingContext struct {
	RunnerAuthUserID string
	RunnerTier       string
	RunnerLat        *float64
	RunnerLng        *float64
	Province         string
	City             string
	District         string
	SubDistrict      string
}

type runnerQuestTierAccessMeta struct {
	RunnerTier string
	QuestTier  string
	TierScore  int
	Accessible bool
	Reason     string
}

type runnerQuestMatchMeta struct {
	DistanceKM          *float64
	ActiveRadiusKM      float64
	NextRadiusKM        float64
	NextExpandInSeconds int
	Scope               string
	Matched             bool
}

func RunnerQuest(service *Service) fiber.Handler {
	return func(c fiber.Ctx) error {
		switch c.Method() {
		case fiber.MethodGet:
			return handleRunnerQuestGet(c, service)
		case fiber.MethodPost:
			return handleRunnerQuestPost(c, service)
		case fiber.MethodOptions:
			return c.SendStatus(fiber.StatusNoContent)
		default:
			return config.WriteError(c, config.NewAppError("Method tidak diizinkan untuk runner quest.", fiber.StatusMethodNotAllowed), "Gagal memproses runner quest.")
		}
	}
}

func handleRunnerQuestGet(c fiber.Ctx, service *Service) error {
	if strings.HasSuffix(c.Path(), "/tier-status") {
		return handleRunnerTierStatusGet(c, service)
	}
	if strings.HasSuffix(c.Path(), "/history") {
		return handleRunnerQuestHistoryGet(c, service)
	}

	ctx, cancel, authRecord, err := resolveRunnerQuestContext(c, service)
	if err != nil {
		return config.WriteError(c, err, "Gagal mengambil quest runner.")
	}
	defer cancel()

	assignments, err := service.ListRunnerAssignments(ctx, authRecord.AuthUserID)
	if err != nil {
		return config.WriteError(c, config.MapSupabaseError(err, "Gagal mengambil assignment runner cloud."), "Gagal mengambil quest runner.")
	}

	items := make([]fiber.Map, 0)
	for _, assignment := range assignments {
		if !isRunnerActiveAssignment(assignment.AssignmentStatus) {
			continue
		}

		questRecord, err := service.FindQuestByID(ctx, assignment.QuestID)
		if err != nil {
			return config.WriteError(c, config.MapSupabaseError(err, "Gagal mengambil detail quest active cloud."), "Gagal mengambil quest runner.")
		}
		if questRecord == nil {
			continue
		}

		escrow, err := service.FindQuestEscrowByQuestID(ctx, assignment.QuestID)
		if err != nil {
			return config.WriteError(c, config.MapSupabaseError(err, "Gagal mengambil escrow active quest cloud."), "Gagal mengambil quest runner.")
		}

		ratingState, err := service.FindRatingStateByAssignment(ctx, assignment.ID, authRecord.AuthUserID)
		if err != nil {
			return config.WriteError(c, config.MapSupabaseError(err, "Gagal mengambil rating state quest runner cloud."), "Gagal mengambil quest runner.")
		}
		if isRunnerClosedAssignment(&assignment, questRecord, escrow, ratingState) {
			continue
		}

		giver, err := service.FindGiverSummary(ctx, questRecord.GiverAuthUserID)
		if err != nil {
			return config.WriteError(c, config.MapSupabaseError(err, "Gagal mengambil ringkasan giver cloud."), "Gagal mengambil quest runner.")
		}

		items = append(items, fiber.Map{
			"assignment_id":      assignment.ID,
			"assignment_status":  assignment.AssignmentStatus,
			"joined_at":          optionalTimeValue(assignment.JoinedAt),
			"started_at":         optionalTimeValue(assignment.StartedAt),
			"finished_at":        optionalTimeValue(assignment.FinishedAt),
			"work_location":      optionalWorkLocationValue(assignment.WorkLocation),
			"location_shared_at": optionalTimeValue(assignment.LocationSharedAt),
			"quest":              toRunnerQuestItem(*questRecord, giver),
			"escrow":             toRunnerEscrowItem(escrow),
			"rating_state":       toRunnerRatingStatePayload(ratingState),
		})
	}

	return c.JSON(fiber.Map{
		"success": true,
		"message": "Quest aktif runner berhasil diambil.",
		"data": fiber.Map{
			"runner_auth_user_id": authRecord.AuthUserID,
			"items":               items,
			"total":               len(items),
		},
	})
}

func handleRunnerTierStatusGet(c fiber.Ctx, service *Service) error {
	ctx, cancel, authRecord, err := resolveRunnerQuestContext(c, service)
	if err != nil {
		return config.WriteError(c, err, "Gagal mengambil status tier runner.")
	}
	defer cancel()

	tierStatus, err := service.GetRunnerTierStatus(ctx, authRecord.AuthUserID)
	if err != nil {
		return config.WriteError(c, config.MapSupabaseError(err, "Gagal mengambil status tier runner cloud."), "Gagal mengambil status tier runner.")
	}

	return c.JSON(fiber.Map{
		"success": true,
		"message": "Status tier runner berhasil diambil.",
		"data": fiber.Map{
			"runner_auth_user_id": authRecord.AuthUserID,
			"tier_status":         tierStatus,
		},
	})
}

func handleRunnerQuestHistoryGet(c fiber.Ctx, service *Service) error {
	ctx, cancel, authRecord, err := resolveRunnerQuestContext(c, service)
	if err != nil {
		return config.WriteError(c, err, "Gagal mengambil riwayat quest runner.")
	}
	defer cancel()

	assignments, err := service.ListRunnerAssignments(ctx, authRecord.AuthUserID)
	if err != nil {
		return config.WriteError(c, config.MapSupabaseError(err, "Gagal mengambil assignment runner cloud."), "Gagal mengambil riwayat quest runner.")
	}

	items := make([]fiber.Map, 0)
	for _, assignment := range assignments {
		questRecord, err := service.FindQuestByID(ctx, assignment.QuestID)
		if err != nil {
			return config.WriteError(c, config.MapSupabaseError(err, "Gagal mengambil detail riwayat quest runner cloud."), "Gagal mengambil riwayat quest runner.")
		}
		if questRecord == nil {
			continue
		}

		escrow, err := service.FindQuestEscrowByQuestID(ctx, assignment.QuestID)
		if err != nil {
			return config.WriteError(c, config.MapSupabaseError(err, "Gagal mengambil escrow riwayat quest runner cloud."), "Gagal mengambil riwayat quest runner.")
		}

		ratingState, err := service.FindRatingStateByAssignment(ctx, assignment.ID, authRecord.AuthUserID)
		if err != nil {
			return config.WriteError(c, config.MapSupabaseError(err, "Gagal mengambil rating state riwayat runner cloud."), "Gagal mengambil riwayat quest runner.")
		}
		if !isRunnerHistoryAssignment(&assignment, questRecord, escrow, ratingState) {
			continue
		}

		giver, err := service.FindGiverSummary(ctx, questRecord.GiverAuthUserID)
		if err != nil {
			return config.WriteError(c, config.MapSupabaseError(err, "Gagal mengambil ringkasan giver cloud."), "Gagal mengambil riwayat quest runner.")
		}

		items = append(items, fiber.Map{
			"assignment_id":      assignment.ID,
			"assignment_status":  assignment.AssignmentStatus,
			"joined_at":          optionalTimeValue(assignment.JoinedAt),
			"started_at":         optionalTimeValue(assignment.StartedAt),
			"finished_at":        optionalTimeValue(assignment.FinishedAt),
			"work_location":      optionalWorkLocationValue(assignment.WorkLocation),
			"location_shared_at": optionalTimeValue(assignment.LocationSharedAt),
			"quest":              toRunnerQuestItem(*questRecord, giver),
			"escrow":             toRunnerEscrowItem(escrow),
			"rating_state":       toRunnerRatingStatePayload(ratingState),
		})
	}

	return c.JSON(fiber.Map{
		"success": true,
		"message": "Riwayat quest runner berhasil diambil.",
		"data": fiber.Map{
			"runner_auth_user_id": authRecord.AuthUserID,
			"items":               items,
			"total":               len(items),
		},
	})
}

func handleRunnerQuestPost(c fiber.Ctx, service *Service) error {
	ctx, cancel, authRecord, err := resolveRunnerQuestContext(c, service)
	if err != nil {
		return config.WriteError(c, err, "Gagal mengambil quest runner.")
	}
	defer cancel()

	questID := strings.TrimSpace(c.Params("id"))
	if questID == "" {
		return config.WriteError(c, config.NewAppError("Route runner quest belum valid.", fiber.StatusNotFound), "Gagal memproses runner quest.")
	}

	action := resolveRunnerQuestAction(c)
	if action == "start" {
		return handleRunnerQuestStart(c, service, ctx, authRecord, questID)
	}
	if action == "finish" {
		return handleRunnerQuestFinish(c, service, ctx, authRecord, questID)
	}

	existingAssignment, err := service.FindQuestAssignment(ctx, questID, authRecord.AuthUserID)
	if err != nil {
		return config.WriteError(c, config.MapSupabaseError(err, "Gagal mengambil assignment runner cloud."), "Gagal mengambil quest runner.")
	}
	if existingAssignment != nil {
		return config.WriteError(c, config.NewAppError("Runner sudah pernah mengambil atau join quest ini.", fiber.StatusConflict), "Gagal mengambil quest runner.")
	}

	questRecord, err := service.FindQuestByID(ctx, questID)
	if err != nil {
		return config.WriteError(c, config.MapSupabaseError(err, "Gagal mengambil detail quest cloud."), "Gagal mengambil quest runner.")
	}
	if questRecord == nil {
		return config.WriteError(c, config.NewAppError("Quest tidak ditemukan.", fiber.StatusNotFound), "Gagal mengambil quest runner.")
	}
	if questRecord.Status != "open" {
		return config.WriteError(c, config.NewAppError("Quest ini belum tersedia untuk diambil.", fiber.StatusConflict), "Gagal mengambil quest runner.")
	}
	if questRecord.GiverAuthUserID == authRecord.AuthUserID {
		return config.WriteError(c, config.NewAppError("Giver tidak bisa mengambil quest miliknya sendiri.", fiber.StatusForbidden), "Gagal mengambil quest runner.")
	}

	matchContext, err := buildRunnerQuestMatchingContext(c, service, ctx, authRecord)
	if err != nil {
		return config.WriteError(c, err, "Gagal mengambil quest runner.")
	}
	tierAccess := evaluateRunnerQuestTierAccess(*questRecord, matchContext)
	if !tierAccess.Accessible {
		return config.WriteError(c, config.NewAppError(tierAccess.Reason, fiber.StatusForbidden), "Gagal mengambil quest runner.")
	}

	matchMeta := evaluateRunnerQuestMatch(*questRecord, matchContext)
	if !matchMeta.Matched {
		return config.WriteError(c, config.NewAppError(buildRunnerQuestRadiusRejectMessage(matchMeta), fiber.StatusConflict), "Gagal mengambil quest runner.")
	}

	currentCount := parseOrZeroInt(questRecord.CurrentRunnerCount)
	maxRunner := parseOrZeroInt(questRecord.MaxRunner)
	if maxRunner <= 0 {
		maxRunner = 1
	}
	if currentCount >= maxRunner {
		return config.WriteError(c, config.NewAppError("Quest ini sudah penuh.", fiber.StatusConflict), "Gagal mengambil quest runner.")
	}

	if err := service.CreateQuestAssignment(ctx, questID, authRecord.AuthUserID, "pending"); err != nil {
		return config.WriteError(c, config.MapSupabaseError(err, "Gagal membuat assignment runner cloud."), "Gagal mengambil quest runner.")
	}

	return c.Status(fiber.StatusCreated).JSON(fiber.Map{
		"success": true,
		"message": "Lamaran quest berhasil dikirim ke Giver.",
		"data": fiber.Map{
			"quest_id":             questID,
			"mode":                 questRecord.Mode,
			"previous_status":      questRecord.Status,
			"next_status":          questRecord.Status,
			"current_runner_count": currentCount,
			"max_runner":           maxRunner,
			"assignment_status":    "pending",
			"quest_tier":           tierAccess.QuestTier,
			"tier_score":           tierAccess.TierScore,
			"runner_tier":          tierAccess.RunnerTier,
			"is_accessible":        tierAccess.Accessible,
			"accessibility_reason": tierAccess.Reason,
			"matching": fiber.Map{
				"within_match_radius":    matchMeta.Matched,
				"matching_scope":         matchMeta.Scope,
				"active_radius_km":       matchMeta.ActiveRadiusKM,
				"next_radius_km":         matchMeta.NextRadiusKM,
				"next_expand_in_seconds": matchMeta.NextExpandInSeconds,
				"distance_km":            optionalRunnerQuestDistance(matchMeta.DistanceKM),
			},
		},
	})
}

func handleRunnerQuestStart(c fiber.Ctx, service *Service, ctx context.Context, authRecord *authSessionRecord, questID string) error {
	assignment, err := service.FindQuestAssignment(ctx, questID, authRecord.AuthUserID)
	if err != nil {
		return config.WriteError(c, config.MapSupabaseError(err, "Gagal mengambil assignment runner cloud."), "Gagal memulai quest runner.")
	}
	if assignment == nil {
		return config.WriteError(c, config.NewAppError("Assignment runner untuk quest ini tidak ditemukan.", fiber.StatusNotFound), "Gagal memulai quest runner.")
	}
	if assignment.AssignmentStatus != "accepted" {
		return config.WriteError(c, config.NewAppError("Quest hanya bisa dimulai dari status accepted.", fiber.StatusConflict), "Gagal memulai quest runner.")
	}
	if assignment.LocationSharedAt == nil || len(assignment.WorkLocation) == 0 {
		return config.WriteError(c, config.NewAppError("Menunggu Giver share lokasi detail sebelum Runner mulai kerja.", fiber.StatusConflict), "Gagal memulai quest runner.")
	}

	questRecord, err := service.FindQuestByID(ctx, questID)
	if err != nil {
		return config.WriteError(c, config.MapSupabaseError(err, "Gagal mengambil detail quest cloud."), "Gagal memulai quest runner.")
	}
	if questRecord == nil {
		return config.WriteError(c, config.NewAppError("Quest tidak ditemukan.", fiber.StatusNotFound), "Gagal memulai quest runner.")
	}

	escrow, err := service.FindQuestEscrowByQuestID(ctx, questID)
	if err != nil {
		return config.WriteError(c, config.MapSupabaseError(err, "Gagal mengambil escrow quest cloud."), "Gagal memulai quest runner.")
	}
	if escrow == nil {
		return config.WriteError(c, config.NewAppError("Escrow quest tidak ditemukan.", fiber.StatusNotFound), "Gagal memulai quest runner.")
	}
	if escrow.EscrowState != "locked" && escrow.EscrowState != "in_progress" {
		return config.WriteError(c, config.NewAppError("Quest belum siap dimulai karena escrow belum locked.", fiber.StatusConflict), "Gagal memulai quest runner.")
	}

	now := time.Now().UTC()
	if err := service.UpdateQuestAssignmentLifecycle(ctx, assignment.ID, "active", map[string]any{
		"started_at": now,
	}); err != nil {
		return config.WriteError(c, config.MapSupabaseError(err, "Gagal memperbarui assignment runner cloud."), "Gagal memulai quest runner.")
	}

	if err := service.UpdateQuestStatus(ctx, questID, "in_progress"); err != nil {
		return config.WriteError(c, config.MapSupabaseError(err, "Gagal memperbarui status quest cloud."), "Gagal memulai quest runner.")
	}
	if err := service.UpdateQuestEscrowState(ctx, questID, "in_progress", ""); err != nil {
		return config.WriteError(c, config.MapSupabaseError(err, "Gagal memperbarui escrow quest cloud."), "Gagal memulai quest runner.")
	}

	return c.JSON(fiber.Map{
		"success": true,
		"message": "Quest runner berhasil dimulai.",
		"data": fiber.Map{
			"quest_id":          questID,
			"previous_status":   assignment.AssignmentStatus,
			"assignment_status": "active",
			"quest_status":      "in_progress",
			"escrow_status":     "in_progress",
			"started_at":        now,
		},
	})
}

func handleRunnerQuestFinish(c fiber.Ctx, service *Service, ctx context.Context, authRecord *authSessionRecord, questID string) error {
	assignment, err := service.FindQuestAssignment(ctx, questID, authRecord.AuthUserID)
	if err != nil {
		return config.WriteError(c, config.MapSupabaseError(err, "Gagal mengambil assignment runner cloud."), "Gagal menyelesaikan quest runner.")
	}
	if assignment == nil {
		return config.WriteError(c, config.NewAppError("Assignment runner untuk quest ini tidak ditemukan.", fiber.StatusNotFound), "Gagal menyelesaikan quest runner.")
	}
	if assignment.AssignmentStatus != "active" {
		return config.WriteError(c, config.NewAppError("Quest hanya bisa diselesaikan dari status active.", fiber.StatusConflict), "Gagal menyelesaikan quest runner.")
	}

	questRecord, err := service.FindQuestByID(ctx, questID)
	if err != nil {
		return config.WriteError(c, config.MapSupabaseError(err, "Gagal mengambil detail quest cloud."), "Gagal menyelesaikan quest runner.")
	}
	if questRecord == nil {
		return config.WriteError(c, config.NewAppError("Quest tidak ditemukan.", fiber.StatusNotFound), "Gagal menyelesaikan quest runner.")
	}

	escrow, err := service.FindQuestEscrowByQuestID(ctx, questID)
	if err != nil {
		return config.WriteError(c, config.MapSupabaseError(err, "Gagal mengambil escrow quest cloud."), "Gagal menyelesaikan quest runner.")
	}
	if escrow == nil {
		return config.WriteError(c, config.NewAppError("Escrow quest tidak ditemukan.", fiber.StatusNotFound), "Gagal menyelesaikan quest runner.")
	}
	if escrow.EscrowState != "in_progress" {
		return config.WriteError(c, config.NewAppError("Quest belum bisa selesai karena escrow belum in_progress.", fiber.StatusConflict), "Gagal menyelesaikan quest runner.")
	}

	now := time.Now().UTC()
	updates := map[string]any{
		"finished_at": now,
	}
	if assignment.StartedAt == nil {
		updates["started_at"] = now
	}

	if err := service.UpdateQuestAssignmentLifecycle(ctx, assignment.ID, "finished", updates); err != nil {
		return config.WriteError(c, config.MapSupabaseError(err, "Gagal memperbarui assignment runner cloud."), "Gagal menyelesaikan quest runner.")
	}

	if err := service.UpdateQuestStatus(ctx, questID, "pending_review"); err != nil {
		return config.WriteError(c, config.MapSupabaseError(err, "Gagal memperbarui status quest cloud."), "Gagal menyelesaikan quest runner.")
	}
	if err := service.UpdateQuestEscrowState(ctx, questID, "pending", ""); err != nil {
		return config.WriteError(c, config.MapSupabaseError(err, "Gagal memperbarui escrow quest cloud."), "Gagal menyelesaikan quest runner.")
	}

	return c.JSON(fiber.Map{
		"success": true,
		"message": "Quest runner berhasil ditandai selesai.",
		"data": fiber.Map{
			"quest_id":          questID,
			"previous_status":   assignment.AssignmentStatus,
			"assignment_status": "finished",
			"quest_status":      "pending_review",
			"escrow_status":     "pending",
			"started_at":        optionalTimeValue(assignment.StartedAt),
			"finished_at":       now,
		},
	})
}

func resolveRunnerQuestAction(c fiber.Ctx) string {
	path := strings.TrimSuffix(strings.ToLower(c.Path()), "/")
	if strings.HasSuffix(path, "/start") {
		return "start"
	}
	if strings.HasSuffix(path, "/finish") {
		return "finish"
	}
	return "take"
}

func resolveRunnerQuestContext(c fiber.Ctx, service *Service) (context.Context, context.CancelFunc, *authSessionRecord, error) {
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

func buildRunnerQuestMatchingContext(c fiber.Ctx, service *Service, ctx context.Context, authRecord *authSessionRecord) (*runnerQuestMatchingContext, error) {
	matchContext := &runnerQuestMatchingContext{
		RunnerAuthUserID: authRecord.AuthUserID,
		RunnerTier:       questclassification.TierQ1,
	}

	if runnerLat := strings.TrimSpace(c.Query("runner_lat")); runnerLat != "" {
		parsed, err := strconv.ParseFloat(runnerLat, 64)
		if err != nil {
			return nil, config.NewAppError("Query runner_lat tidak valid.", fiber.StatusBadRequest)
		}
		matchContext.RunnerLat = &parsed
	}

	if runnerLng := strings.TrimSpace(c.Query("runner_lng")); runnerLng != "" {
		parsed, err := strconv.ParseFloat(runnerLng, 64)
		if err != nil {
			return nil, config.NewAppError("Query runner_lng tidak valid.", fiber.StatusBadRequest)
		}
		matchContext.RunnerLng = &parsed
	}

	locationProfile, err := service.FindRunnerLocationProfile(ctx, authRecord.AuthUserID)
	if err != nil {
		return nil, config.MapSupabaseError(err, "Gagal mengambil profil lokasi runner cloud.")
	}
	if locationProfile != nil {
		matchContext.RunnerTier = questclassification.NormalizeTier(locationProfile.RunnerTier)
		matchContext.Province = locationProfile.Province
		matchContext.City = locationProfile.City
		matchContext.District = locationProfile.District
		matchContext.SubDistrict = locationProfile.SubDistrict
	}

	return matchContext, nil
}

func evaluateRunnerQuestTierAccess(record questRecord, matchContext *runnerQuestMatchingContext) runnerQuestTierAccessMeta {
	runnerTier := questclassification.TierQ1
	if matchContext != nil {
		runnerTier = questclassification.NormalizeTier(matchContext.RunnerTier)
	}

	questTier := questclassification.NormalizeTier(record.QuestTier)
	tierScore := parseOrZeroInt(record.TierScore)
	accessible := questclassification.CanRunnerAccessQuestTier(runnerTier, questTier)
	reason := questclassification.BuildTierAccessReason(runnerTier, questTier, accessible)
	if strings.EqualFold(strings.TrimSpace(record.TierStatus), questclassification.StatusPendingReview) {
		accessible = false
		reason = "Quest menunggu review admin Q-Tier sebelum bisa diakses Runner."
	}

	return runnerQuestTierAccessMeta{
		RunnerTier: runnerTier,
		QuestTier:  questTier,
		TierScore:  tierScore,
		Accessible: accessible,
		Reason:     reason,
	}
}

func evaluateRunnerQuestMatch(record questRecord, matchContext *runnerQuestMatchingContext) *runnerQuestMatchMeta {
	activeRadiusKM, nextRadiusKM, nextExpandInSeconds := resolveRunnerQuestBroadcastRadius(record)
	meta := &runnerQuestMatchMeta{
		ActiveRadiusKM:      activeRadiusKM,
		NextRadiusKM:        nextRadiusKM,
		NextExpandInSeconds: nextExpandInSeconds,
		Scope:               "global_fallback",
		Matched:             true,
	}

	questLat := parseOptionalFloat64(record.Lat)
	questLng := parseOptionalFloat64(record.Lng)
	if matchContext != nil && matchContext.RunnerLat != nil && matchContext.RunnerLng != nil && questLat != nil && questLng != nil {
		distanceKM := roundFloat(haversineKM(*matchContext.RunnerLat, *matchContext.RunnerLng, *questLat, *questLng), 2)
		meta.DistanceKM = &distanceKM
		meta.Scope = "coordinate_radius"
		meta.Matched = distanceKM <= activeRadiusKM
		return meta
	}

	meta.Matched, meta.Scope = matchRunnerQuestByAdministrativeArea(record, matchContext, activeRadiusKM)
	return meta
}

func resolveRunnerQuestBroadcastRadius(record questRecord) (float64, float64, int) {
	seedTime := resolveRunnerQuestBroadcastSeedTime(record)
	if seedTime == nil {
		return initialBroadcastRadiusKM, initialBroadcastRadiusKM + 1, int(initialBroadcastWindow.Seconds())
	}

	elapsed := time.Since(seedTime.UTC())
	if elapsed < 0 {
		elapsed = 0
	}

	activeRadiusKM := initialBroadcastRadiusKM
	if elapsed >= initialBroadcastWindow {
		expansionCount := 1 + int((elapsed-initialBroadcastWindow)/broadcastExpandStep)
		activeRadiusKM = math.Min(maxBroadcastRadiusKM, initialBroadcastRadiusKM+float64(expansionCount))
	}

	if activeRadiusKM >= maxBroadcastRadiusKM {
		return activeRadiusKM, maxBroadcastRadiusKM, 0
	}

	nextRadiusKM := math.Min(maxBroadcastRadiusKM, activeRadiusKM+1)
	if elapsed < initialBroadcastWindow {
		return activeRadiusKM, nextRadiusKM, int((initialBroadcastWindow - elapsed).Seconds())
	}

	remaining := broadcastExpandStep - ((elapsed - initialBroadcastWindow) % broadcastExpandStep)
	return activeRadiusKM, nextRadiusKM, int(remaining.Seconds())
}

func resolveRunnerQuestBroadcastSeedTime(record questRecord) *time.Time {
	if record.PublishedAt != nil && !record.PublishedAt.IsZero() {
		return record.PublishedAt
	}
	if record.CreatedAt != nil && !record.CreatedAt.IsZero() {
		return record.CreatedAt
	}
	return nil
}

func matchRunnerQuestByAdministrativeArea(record questRecord, matchContext *runnerQuestMatchingContext, activeRadiusKM float64) (bool, string) {
	if matchContext == nil {
		return true, "global_fallback"
	}

	questProvince := normalizeAreaName(record.Province)
	questCity := normalizeAreaName(record.City)
	questDistrict := normalizeAreaName(record.District)
	questSubDistrict := normalizeAreaName(record.SubDistrict)
	runnerProvince := normalizeAreaName(matchContext.Province)
	runnerCity := normalizeAreaName(matchContext.City)
	runnerDistrict := normalizeAreaName(matchContext.District)
	runnerSubDistrict := normalizeAreaName(matchContext.SubDistrict)

	if questProvince == "" && questCity == "" && questDistrict == "" && questSubDistrict == "" {
		return true, "location_unknown"
	}
	if runnerSubDistrict != "" && runnerSubDistrict == questSubDistrict && questSubDistrict != "" {
		return true, "same_sub_district"
	}
	if runnerDistrict != "" && runnerDistrict == questDistrict && questDistrict != "" {
		return activeRadiusKM >= 2, "same_district"
	}
	if runnerCity != "" && runnerCity == questCity && questCity != "" {
		return activeRadiusKM >= 4, "same_city"
	}
	if runnerProvince != "" && runnerProvince == questProvince && questProvince != "" {
		return activeRadiusKM >= 8, "same_province"
	}
	if runnerProvince == "" && runnerCity == "" && runnerDistrict == "" && runnerSubDistrict == "" {
		return true, "global_fallback"
	}
	return false, "out_of_scope"
}

func buildRunnerQuestRadiusRejectMessage(matchMeta *runnerQuestMatchMeta) string {
	if matchMeta == nil {
		return "Quest belum masuk radius broadcast aktif runner."
	}
	if matchMeta.DistanceKM != nil {
		return "Quest belum masuk radius broadcast aktif. Radius aktif " + formatFloatText(matchMeta.ActiveRadiusKM) + " km, jarak runner " + formatFloatText(*matchMeta.DistanceKM) + " km."
	}
	return "Quest belum masuk area broadcast aktif. Radius aktif " + formatFloatText(matchMeta.ActiveRadiusKM) + " km, scope " + matchMeta.Scope + "."
}

func normalizeAreaName(value string) string {
	return strings.ToLower(strings.TrimSpace(value))
}

func parseOptionalFloat64(value string) *float64 {
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

func haversineKM(lat1 float64, lng1 float64, lat2 float64, lng2 float64) float64 {
	const earthRadiusKM = 6371.0

	dLat := degreesToRadians(lat2 - lat1)
	dLng := degreesToRadians(lng2 - lng1)
	originLat := degreesToRadians(lat1)
	targetLat := degreesToRadians(lat2)

	a := math.Sin(dLat/2)*math.Sin(dLat/2) +
		math.Cos(originLat)*math.Cos(targetLat)*
			math.Sin(dLng/2)*math.Sin(dLng/2)
	c := 2 * math.Atan2(math.Sqrt(a), math.Sqrt(1-a))
	return earthRadiusKM * c
}

func degreesToRadians(value float64) float64 {
	return value * math.Pi / 180
}

func roundFloat(value float64, precision int) float64 {
	multiplier := math.Pow(10, float64(precision))
	return math.Round(value*multiplier) / multiplier
}

func optionalRunnerQuestDistance(value *float64) any {
	if value == nil {
		return nil
	}
	return *value
}

func formatFloatText(value float64) string {
	return strconv.FormatFloat(value, 'f', -1, 64)
}

func isRunnerActiveAssignment(status string) bool {
	switch strings.ToLower(strings.TrimSpace(status)) {
	case "pending", "accepted", "active", "finished":
		return true
	default:
		return false
	}
}

func isRunnerClosedAssignment(assignment *questAssignmentRecord, quest *questRecord, escrow *escrowRecord, ratingState *ratingStateRecord) bool {
	if assignment == nil || quest == nil || ratingState == nil {
		return false
	}
	escrowState := ""
	if escrow != nil {
		escrowState = escrow.EscrowState
	}
	return strings.EqualFold(assignment.AssignmentStatus, "finished") &&
		strings.EqualFold(quest.Status, "completed") &&
		strings.EqualFold(escrowState, "released") &&
		ratingState.BothRated
}

func isRunnerHistoryAssignment(assignment *questAssignmentRecord, quest *questRecord, escrow *escrowRecord, ratingState *ratingStateRecord) bool {
	if isRunnerClosedAssignment(assignment, quest, escrow, ratingState) {
		return true
	}
	if assignment != nil {
		switch strings.ToLower(strings.TrimSpace(assignment.AssignmentStatus)) {
		case "disputed", "cancelled", "rejected":
			return true
		}
	}
	if quest != nil {
		switch strings.ToLower(strings.TrimSpace(quest.Status)) {
		case "disputed", "cancelled":
			return true
		}
	}
	return false
}

func toRunnerQuestItem(record questRecord, giver *giverSummaryRecord) fiber.Map {
	return fiber.Map{
		"id":              record.ID,
		"title":           record.Title,
		"description":     record.Description,
		"category":        record.Category,
		"skill_tags":      record.SkillTags,
		"mode":            record.Mode,
		"status":          record.Status,
		"reward_amount":   record.RewardAmount,
		"reward_currency": firstNonEmpty(record.RewardCurrency, "IDR"),
		"reward_display":  buildRewardDisplay(record.RewardAmount, record.RewardCurrency),
		"quest_tier":      questclassification.NormalizeTier(record.QuestTier),
		"tier_score":      parseOrZeroInt(record.TierScore),
		"tier_status":     firstNonEmpty(record.TierStatus, questclassification.StatusAutoClassified),
		"giver": fiber.Map{
			"auth_user_id": record.GiverAuthUserID,
			"fullname":     resolveDisplayName(giver),
			"username":     resolveUsername(giver),
		},
		"location": fiber.Map{
			"province":     record.Province,
			"city":         record.City,
			"district":     record.District,
			"sub_district": record.SubDistrict,
			"full_address": record.FullAddress,
			"postal_code":  record.PostalCode,
			"lat":          parseOptionalFloat(record.Lat),
			"lng":          parseOptionalFloat(record.Lng),
		},
		"capacity": fiber.Map{
			"max_runner":           parseOrZeroInt(record.MaxRunner),
			"current_runner_count": parseOrZeroInt(record.CurrentRunnerCount),
		},
		"starts_at": optionalTimeValue(record.StartsAt),
		"ends_at":   optionalTimeValue(record.EndsAt),
	}
}

func toRunnerRatingStatePayload(record *ratingStateRecord) fiber.Map {
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

func toRunnerEscrowItem(record *escrowRecord) fiber.Map {
	if record == nil {
		return fiber.Map{}
	}

	return fiber.Map{
		"quest_id":     record.QuestID,
		"escrow_state": record.EscrowState,
	}
}

func resolveDisplayName(giver *giverSummaryRecord) string {
	if giver == nil {
		return ""
	}
	if strings.TrimSpace(giver.Fullname) != "" {
		return giver.Fullname
	}
	return giver.Username
}

func resolveUsername(giver *giverSummaryRecord) string {
	if giver == nil {
		return ""
	}
	return giver.Username
}

func buildRewardDisplay(amount string, currency string) string {
	normalizedAmount := strings.TrimSpace(amount)
	if normalizedAmount == "" {
		return ""
	}
	return firstNonEmpty(strings.TrimSpace(currency), "IDR") + " " + normalizedAmount
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

func parseOptionalFloat(value string) any {
	trimmed := strings.TrimSpace(value)
	if trimmed == "" {
		return nil
	}
	parsed, err := strconv.ParseFloat(trimmed, 64)
	if err != nil {
		return nil
	}
	return parsed
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

func firstNonEmpty(values ...string) string {
	for _, value := range values {
		if strings.TrimSpace(value) != "" {
			return strings.TrimSpace(value)
		}
	}
	return ""
}
