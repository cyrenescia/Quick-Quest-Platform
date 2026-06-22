package rating

import (
	"context"
	"math"
	"strconv"
	"strings"
	"time"

	"Stream-StrictMode/config"
	questclassification "Stream-StrictMode/routes/quest-classification"
	runnertier "Stream-StrictMode/routes/runner-tier"

	"github.com/gofiber/fiber/v3"
	"github.com/google/uuid"
)

const MinPPDelta = 5.0

type ratingRequestPayload struct {
	AssignmentID string
	RatingScore  float64
	RatingNote   string
}

type ratingPartyContext struct {
	RaterRole       string
	RateeAuthUserID string
}

type ppWeightedInput struct {
	RatingScore  float64
	QuestTier    string
	RunnerTier   string
	RewardAmount float64
	FinishedAt   *time.Time
}

type ppWeightedResult struct {
	PPDelta           float64
	BasePP            float64
	TierMultiplier    float64
	ChallengeBonus    float64
	ValueMultiplier   float64
	TimeDecay         float64
	MinPPFloorApplied bool
}

func Rating(service *Service) fiber.Handler {
	return func(c fiber.Ctx) error {
		switch c.Method() {
		case fiber.MethodPost:
			return handleRatingPost(c, service)
		case fiber.MethodOptions:
			return c.SendStatus(fiber.StatusNoContent)
		default:
			return config.WriteError(c, config.NewAppError("Method tidak diizinkan untuk rating.", fiber.StatusMethodNotAllowed), "Gagal memproses rating.")
		}
	}
}

func handleRatingPost(c fiber.Ctx, service *Service) error {
	body, err := config.ParseJSONBody(c)
	if err != nil {
		return config.WriteError(c, err, "Gagal menyimpan rating.")
	}

	payload, err := collectRatingRequest(body)
	if err != nil {
		return config.WriteError(c, err, "Gagal menyimpan rating.")
	}

	ctx, cancel, authRecord, err := resolveRatingContext(c, service)
	if err != nil {
		return config.WriteError(c, err, "Gagal menyimpan rating.")
	}
	defer cancel()

	assignment, err := service.FindAssignmentByID(ctx, payload.AssignmentID)
	if err != nil {
		return config.WriteError(c, config.MapSupabaseError(err, "Gagal mengambil assignment rating cloud."), "Gagal menyimpan rating.")
	}
	if assignment == nil {
		return config.WriteError(c, config.NewAppError("Assignment rating tidak ditemukan.", fiber.StatusNotFound), "Gagal menyimpan rating.")
	}

	questRecord, err := service.FindQuestByID(ctx, assignment.QuestID)
	if err != nil {
		return config.WriteError(c, config.MapSupabaseError(err, "Gagal mengambil quest rating cloud."), "Gagal menyimpan rating.")
	}
	if questRecord == nil {
		return config.WriteError(c, config.NewAppError("Quest rating tidak ditemukan.", fiber.StatusNotFound), "Gagal menyimpan rating.")
	}

	partyContext, err := resolveRatingPartyContext(authRecord, questRecord, assignment)
	if err != nil {
		return config.WriteError(c, err, "Gagal menyimpan rating.")
	}

	if err := ensureRatingLifecycleReady(ctx, service, questRecord, assignment); err != nil {
		return config.WriteError(c, err, "Gagal menyimpan rating.")
	}

	existingRating, err := service.FindRatingByAssignmentAndRater(ctx, assignment.ID, authRecord.AuthUserID)
	if err != nil {
		return config.WriteError(c, config.MapSupabaseError(err, "Gagal mengecek rating existing cloud."), "Gagal menyimpan rating.")
	}
	if existingRating != nil {
		return config.WriteError(c, config.NewAppError("Akun ini sudah memberi rating untuk assignment tersebut.", fiber.StatusConflict), "Gagal menyimpan rating.")
	}

	ratingID := uuid.NewString()
	skillScope := resolveSkillScope(questRecord)
	runnerTier, err := service.FindRunnerTier(ctx, assignment.RunnerAuthUserID)
	if err != nil {
		return config.WriteError(c, config.MapSupabaseError(err, "Gagal mengambil tier runner untuk PP cloud."), "Gagal menyimpan rating.")
	}
	ppResult := computeWeightedPP(ppWeightedInput{
		RatingScore:  payload.RatingScore,
		QuestTier:    questRecord.QuestTier,
		RunnerTier:   runnerTier,
		RewardAmount: questRecord.RewardAmount,
		FinishedAt:   assignment.FinishedAt,
	})
	ppDelta := ppResult.PPDelta
	createPayload := createRatingPayload{
		RatingID:        ratingID,
		QuestID:         questRecord.ID,
		AssignmentID:    assignment.ID,
		RaterAuthUserID: authRecord.AuthUserID,
		RateeAuthUserID: partyContext.RateeAuthUserID,
		RaterRole:       partyContext.RaterRole,
		RatingScore:     payload.RatingScore,
		RatingNote:      payload.RatingNote,
		SkillScope:      skillScope,
		PPDelta:         ppDelta,
		QuestTier:       questclassification.NormalizeTier(questRecord.QuestTier),
		TierScore:       questRecord.TierScore,
		RunnerTier:      questclassification.NormalizeTier(runnerTier),
		RewardAmount:    questRecord.RewardAmount,
		FinishedAt:      assignment.FinishedAt,
	}
	if err := service.CreateRatingWithPPLedger(ctx, createPayload, ppResult); err != nil {
		return config.WriteError(c, config.MapSupabaseError(err, "Gagal menyimpan rating dan PP ledger cloud."), "Gagal menyimpan rating.")
	}

	var tierProgression *runnertier.ProgressionResult
	var tierProgressionWarning string
	if partyContext.RateeAuthUserID == assignment.RunnerAuthUserID {
		tierProgression, err = service.ApplyRunnerRatingProgression(ctx, assignment.RunnerAuthUserID, ppDelta)
		if err != nil {
			tierProgressionWarning = strings.TrimSpace(err.Error())
		}
	}

	ratingSummary, err := service.CountUniqueRatingsByAssignment(ctx, assignment.ID)
	if err != nil {
		return config.WriteError(c, config.MapSupabaseError(err, "Gagal menghitung rating assignment cloud."), "Gagal menyimpan rating.")
	}

	return c.Status(fiber.StatusCreated).JSON(fiber.Map{
		"success": true,
		"message": "Rating transaksi berhasil disimpan.",
		"data": fiber.Map{
			"rating_id":           ratingID,
			"quest_id":            questRecord.ID,
			"assignment_id":       assignment.ID,
			"rater_auth_user_id":  authRecord.AuthUserID,
			"ratee_auth_user_id":  partyContext.RateeAuthUserID,
			"rater_role":          partyContext.RaterRole,
			"rating_score":        payload.RatingScore,
			"skill_scope":         skillScope,
			"pp_delta":            ppDelta,
			"pp_breakdown":        toPPBreakdownPayload(ppResult),
			"rating_count":        ratingSummary.RatingCount,
			"unique_rating_count": ratingSummary.UniqueRatingCount,
			"giver_rated":         ratingSummary.GiverRated,
			"runner_rated":        ratingSummary.RunnerRated,
			"both_rated":          ratingSummary.BothRated,
			"tier_progression":    toRunnerTierProgressionPayload(tierProgression),
			"tier_warning":        nullIfEmptyString(tierProgressionWarning),
		},
	})
}

func resolveRatingContext(c fiber.Ctx, service *Service) (context.Context, context.CancelFunc, *authSessionRecord, error) {
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

func collectRatingRequest(body map[string]any) (ratingRequestPayload, error) {
	payload := ratingRequestPayload{
		AssignmentID: strings.TrimSpace(config.NormalizeString(body["assignment_id"])),
		RatingNote:   strings.TrimSpace(config.NormalizeString(body["rating_note"])),
	}
	if payload.AssignmentID == "" {
		return ratingRequestPayload{}, config.NewAppError("Assignment ID wajib dikirim untuk rating.", fiber.StatusBadRequest)
	}

	score, err := extractRatingScore(body)
	if err != nil {
		return ratingRequestPayload{}, err
	}
	payload.RatingScore = score

	if len(payload.RatingNote) > 500 {
		return ratingRequestPayload{}, config.NewAppError("Catatan rating maksimal 500 karakter.", fiber.StatusBadRequest)
	}

	return payload, nil
}

func extractRatingScore(body map[string]any) (float64, error) {
	rawValue, ok := body["rating_score"]
	if !ok {
		rawValue = body["score"]
	}

	var score float64
	switch typed := rawValue.(type) {
	case float64:
		score = typed
	case float32:
		score = float64(typed)
	case int:
		score = float64(typed)
	case int64:
		score = float64(typed)
	case string:
		parsed, err := strconv.ParseFloat(strings.TrimSpace(typed), 64)
		if err != nil {
			return 0, config.NewAppError("Rating score harus berupa angka 1 sampai 5.", fiber.StatusBadRequest)
		}
		score = parsed
	default:
		return 0, config.NewAppError("Rating score wajib dikirim.", fiber.StatusBadRequest)
	}

	if score < 1 || score > 5 {
		return 0, config.NewAppError("Rating score harus berada di antara 1 sampai 5.", fiber.StatusBadRequest)
	}

	return math.Round(score*10) / 10, nil
}

func resolveRatingPartyContext(authRecord *authSessionRecord, quest *questRecord, assignment *assignmentRecord) (ratingPartyContext, error) {
	if authRecord == nil || quest == nil || assignment == nil {
		return ratingPartyContext{}, config.NewAppError("Context rating tidak lengkap.", fiber.StatusBadRequest)
	}

	if authRecord.AuthUserID == quest.GiverAuthUserID {
		return ratingPartyContext{
			RaterRole:       "giver",
			RateeAuthUserID: assignment.RunnerAuthUserID,
		}, nil
	}

	if authRecord.AuthUserID == assignment.RunnerAuthUserID {
		return ratingPartyContext{
			RaterRole:       "runner",
			RateeAuthUserID: quest.GiverAuthUserID,
		}, nil
	}

	return ratingPartyContext{}, config.NewAppError("Akun login bukan giver atau runner untuk assignment ini.", fiber.StatusForbidden)
}

func ensureRatingLifecycleReady(ctx context.Context, service *Service, quest *questRecord, assignment *assignmentRecord) error {
	if assignment.AssignmentStatus != "finished" {
		return config.NewAppError("Rating hanya bisa diberikan setelah assignment finished.", fiber.StatusConflict)
	}
	if quest.Status != "completed" {
		return config.NewAppError("Rating hanya bisa diberikan setelah quest completed.", fiber.StatusConflict)
	}

	escrow, err := service.FindQuestEscrowByQuestID(ctx, quest.ID)
	if err != nil {
		return config.MapSupabaseError(err, "Gagal mengambil escrow rating cloud.")
	}
	if escrow == nil {
		return config.NewAppError("Escrow rating tidak ditemukan.", fiber.StatusNotFound)
	}
	if escrow.EscrowState != "released" {
		return config.NewAppError("Rating hanya bisa diberikan setelah escrow released.", fiber.StatusConflict)
	}

	return nil
}

func computeWeightedPP(input ppWeightedInput) ppWeightedResult {
	basePP := roundPP(input.RatingScore * 20)
	tier := tierMultiplier(input.QuestTier)
	bonus := challengeBonus(input.RunnerTier, input.QuestTier)
	value := valueMultiplier(input.RewardAmount)
	decay := timeDecayFactor(input.FinishedAt)
	final := roundPP(basePP * tier * bonus * value * decay)
	floorApplied := false
	if final < MinPPDelta {
		final = MinPPDelta
		floorApplied = true
	}

	return ppWeightedResult{
		PPDelta:           final,
		BasePP:            basePP,
		TierMultiplier:    tier,
		ChallengeBonus:    bonus,
		ValueMultiplier:   value,
		TimeDecay:         decay,
		MinPPFloorApplied: floorApplied,
	}
}

func tierMultiplier(questTier string) float64 {
	switch questclassification.NormalizeTier(questTier) {
	case questclassification.TierQ3:
		return 2.5
	case questclassification.TierQ2:
		return 1.5
	default:
		return 1.0
	}
}

func challengeBonus(runnerTier string, questTier string) float64 {
	runnerRank := questclassification.TierRank(runnerTier)
	questRank := questclassification.TierRank(questTier)
	diff := questRank - runnerRank

	switch {
	case diff >= 2:
		return 1.5
	case diff == 1:
		return 1.2
	case diff == 0:
		return 1.0
	default:
		return 0.6
	}
}

func valueMultiplier(rewardAmount float64) float64 {
	switch {
	case rewardAmount >= 5000000:
		return 1.5
	case rewardAmount >= 2000000:
		return 1.3
	case rewardAmount >= 500000:
		return 1.1
	case rewardAmount >= 100000:
		return 1.0
	default:
		return 0.8
	}
}

func timeDecayFactor(finishedAt *time.Time) float64 {
	if finishedAt == nil || finishedAt.IsZero() {
		return 1.0
	}

	elapsed := time.Since(finishedAt.UTC())
	if elapsed < 0 {
		return 1.0
	}
	daysSince := elapsed.Hours() / 24
	switch {
	case daysSince <= 3:
		return 1.0
	case daysSince <= 7:
		return 0.97
	case daysSince <= 14:
		return 0.93
	case daysSince <= 30:
		return 0.88
	default:
		return 0.80
	}
}

func roundPP(value float64) float64 {
	return math.Round(value*100) / 100
}

func toPPBreakdownPayload(record ppWeightedResult) fiber.Map {
	return fiber.Map{
		"base_pp":              record.BasePP,
		"tier_multiplier":      record.TierMultiplier,
		"challenge_bonus":      record.ChallengeBonus,
		"value_multiplier":     record.ValueMultiplier,
		"time_decay":           record.TimeDecay,
		"pp_delta_final":       record.PPDelta,
		"min_pp_floor_applied": record.MinPPFloorApplied,
	}
}

func toRunnerTierProgressionPayload(record *runnertier.ProgressionResult) any {
	if record == nil {
		return nil
	}

	return fiber.Map{
		"auth_user_id":     record.AuthUserID,
		"previous_tier":    record.PreviousTier,
		"current_tier":     record.CurrentTier,
		"tier_changed":     record.TierChanged,
		"pp_delta_applied": record.PPDeltaApplied,
		"progression_note": record.ProgressionNote,
		"status":           record.Status,
	}
}

func nullIfEmptyString(value string) any {
	trimmed := strings.TrimSpace(value)
	if trimmed == "" {
		return nil
	}
	return trimmed
}
