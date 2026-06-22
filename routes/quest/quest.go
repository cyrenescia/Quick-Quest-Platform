package quest

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

type questMatchingContext struct {
	RunnerAuthUserID string
	RunnerTier       string
	RunnerLat        *float64
	RunnerLng        *float64
	Province         string
	City             string
	District         string
	SubDistrict      string
}

type questTierAccessMeta struct {
	RunnerTier string
	QuestTier  string
	TierScore  int
	Accessible bool
	Reason     string
}

type questMatchMeta struct {
	DistanceKM          *float64
	ActiveRadiusKM      float64
	NextRadiusKM        float64
	NextExpandInSeconds int
	Scope               string
	Matched             bool
}

func Quest(service *Service) fiber.Handler {
	return func(c fiber.Ctx) error {
		switch c.Method() {
		case fiber.MethodGet:
			return handleQuestGet(c, service)
		case fiber.MethodOptions:
			return c.SendStatus(fiber.StatusNoContent)
		default:
			return config.WriteError(c, config.NewAppError("Method tidak diizinkan untuk quest.", fiber.StatusMethodNotAllowed), "Gagal memproses quest.")
		}
	}
}

func handleQuestGet(c fiber.Ctx, service *Service) error {
	ctx, cancel, authRecord, err := resolveQuestContext(c, service)
	if err != nil {
		return config.WriteError(c, err, "Gagal mengambil quest.")
	}
	defer cancel()

	matchContext, err := buildQuestMatchingContext(c, service, ctx, authRecord)
	if err != nil {
		return config.WriteError(c, err, "Gagal mengambil quest.")
	}

	questID := strings.TrimSpace(c.Params("id"))
	if questID != "" {
		return handleQuestDetailGet(c, service, ctx, questID, matchContext)
	}

	quests, err := service.ListOpenQuests(ctx)
	if err != nil {
		return config.WriteError(c, config.MapSupabaseError(err, "Gagal mengambil daftar quest cloud."), "Gagal mengambil quest.")
	}

	items := make([]fiber.Map, 0, len(quests))
	for _, record := range quests {
		tierAccess := evaluateQuestTierAccess(record, matchContext)
		if !tierAccess.Accessible {
			continue
		}

		matchMeta := evaluateQuestMatch(record, matchContext)
		if !matchMeta.Matched {
			continue
		}

		giver, err := service.FindGiverSummary(ctx, record.GiverAuthUserID)
		if err != nil {
			return config.WriteError(c, config.MapSupabaseError(err, "Gagal mengambil ringkasan giver cloud."), "Gagal mengambil quest.")
		}
		items = append(items, toQuestListItem(record, giver, matchMeta, tierAccess))
	}

	return c.JSON(fiber.Map{
		"success": true,
		"message": "Daftar quest berhasil diambil.",
		"data": fiber.Map{
			"items": items,
			"total": len(items),
		},
	})
}

func handleQuestDetailGet(c fiber.Ctx, service *Service, ctx context.Context, questID string, matchContext *questMatchingContext) error {
	record, err := service.FindQuestByID(ctx, questID)
	if err != nil {
		return config.WriteError(c, config.MapSupabaseError(err, "Gagal mengambil detail quest cloud."), "Gagal mengambil detail quest.")
	}
	if record == nil {
		return config.WriteError(c, config.NewAppError("Quest tidak ditemukan.", fiber.StatusNotFound), "Gagal mengambil detail quest.")
	}

	giver, err := service.FindGiverSummary(ctx, record.GiverAuthUserID)
	if err != nil {
		return config.WriteError(c, config.MapSupabaseError(err, "Gagal mengambil ringkasan giver cloud."), "Gagal mengambil detail quest.")
	}

	tierAccess := evaluateQuestTierAccess(*record, matchContext)
	var matchMeta *questMatchMeta
	if strings.TrimSpace(record.Status) == "open" {
		matchMeta = evaluateQuestMatch(*record, matchContext)
	}

	return c.JSON(fiber.Map{
		"success": true,
		"message": "Detail quest berhasil diambil.",
		"data":    toQuestDetailItem(*record, giver, matchMeta, tierAccess),
	})
}

func resolveQuestContext(c fiber.Ctx, service *Service) (context.Context, context.CancelFunc, *authSessionRecord, error) {
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

func toQuestListItem(record questRecord, giver *giverSummaryRecord, matchMeta *questMatchMeta, tierAccess questTierAccessMeta) fiber.Map {
	distanceValue := any(nil)
	matchingPayload := fiber.Map{}
	if matchMeta != nil {
		if matchMeta.DistanceKM != nil {
			distanceValue = *matchMeta.DistanceKM
		}
		matchingPayload = fiber.Map{
			"within_match_radius":    matchMeta.Matched,
			"matching_scope":         matchMeta.Scope,
			"active_radius_km":       matchMeta.ActiveRadiusKM,
			"next_radius_km":         matchMeta.NextRadiusKM,
			"next_expand_in_seconds": matchMeta.NextExpandInSeconds,
		}
	}

	return fiber.Map{
		"id":            record.ID,
		"title":         record.Title,
		"category":      record.Category,
		"mode":          record.Mode,
		"status":        record.Status,
		"skill_tags":    record.SkillTags,
		"reward_amount": record.RewardAmount,
		"reward_currency": firstNonEmpty(
			record.RewardCurrency,
			"IDR",
		),
		"reward_display":       buildRewardDisplay(record.RewardAmount, record.RewardCurrency),
		"quest_tier":           tierAccess.QuestTier,
		"tier_score":           tierAccess.TierScore,
		"tier_status":          firstNonEmpty(record.TierStatus, questclassification.StatusAutoClassified),
		"runner_tier":          tierAccess.RunnerTier,
		"is_accessible":        tierAccess.Accessible,
		"accessibility_reason": tierAccess.Reason,
		"distance_km":          distanceValue,
		"matching":             matchingPayload,
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
			"label":        buildLocationLabel(record),
			"lat":          parseOptionalFloat(record.Lat),
			"lng":          parseOptionalFloat(record.Lng),
		},
		"capacity": fiber.Map{
			"max_runner":           parseOptionalInt(record.MaxRunner),
			"current_runner_count": parseOptionalInt(record.CurrentRunnerCount),
		},
		"created_at":   optionalTimeValue(record.CreatedAt),
		"published_at": optionalTimeValue(record.PublishedAt),
		"starts_at":    optionalTimeValue(record.StartsAt),
		"ends_at":      optionalTimeValue(record.EndsAt),
	}
}

func toQuestDetailItem(record questRecord, giver *giverSummaryRecord, matchMeta *questMatchMeta, tierAccess questTierAccessMeta) fiber.Map {
	item := toQuestListItem(record, giver, matchMeta, tierAccess)
	item["description"] = record.Description
	return item
}

func buildQuestMatchingContext(c fiber.Ctx, service *Service, ctx context.Context, authRecord *authSessionRecord) (*questMatchingContext, error) {
	matchContext := &questMatchingContext{
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

func evaluateQuestTierAccess(record questRecord, matchContext *questMatchingContext) questTierAccessMeta {
	runnerTier := questclassification.TierQ1
	if matchContext != nil {
		runnerTier = questclassification.NormalizeTier(matchContext.RunnerTier)
	}

	questTier := questclassification.NormalizeTier(record.QuestTier)
	tierScore := parseOptionalIntValue(record.TierScore)
	accessible := questclassification.CanRunnerAccessQuestTier(runnerTier, questTier)
	reason := questclassification.BuildTierAccessReason(runnerTier, questTier, accessible)
	if strings.EqualFold(strings.TrimSpace(record.TierStatus), questclassification.StatusPendingReview) {
		accessible = false
		reason = "Quest menunggu review admin Q-Tier sebelum bisa diakses Runner."
	}

	return questTierAccessMeta{
		RunnerTier: runnerTier,
		QuestTier:  questTier,
		TierScore:  tierScore,
		Accessible: accessible,
		Reason:     reason,
	}
}

func evaluateQuestMatch(record questRecord, matchContext *questMatchingContext) *questMatchMeta {
	activeRadiusKM, nextRadiusKM, nextExpandInSeconds := resolveQuestBroadcastRadius(record)
	meta := &questMatchMeta{
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

	meta.Matched, meta.Scope = matchQuestByAdministrativeArea(record, matchContext, activeRadiusKM)
	return meta
}

func resolveQuestBroadcastRadius(record questRecord) (float64, float64, int) {
	seedTime := resolveQuestBroadcastSeedTime(record)
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

func resolveQuestBroadcastSeedTime(record questRecord) *time.Time {
	if record.PublishedAt != nil && !record.PublishedAt.IsZero() {
		return record.PublishedAt
	}
	if record.CreatedAt != nil && !record.CreatedAt.IsZero() {
		return record.CreatedAt
	}
	return nil
}

func matchQuestByAdministrativeArea(record questRecord, matchContext *questMatchingContext, activeRadiusKM float64) (bool, string) {
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

func buildRewardDisplay(amount string, currency string) string {
	normalizedAmount := strings.TrimSpace(amount)
	if normalizedAmount == "" {
		return ""
	}
	return firstNonEmpty(strings.TrimSpace(currency), "IDR") + " " + normalizedAmount
}

func buildLocationLabel(record questRecord) string {
	parts := make([]string, 0, 3)
	if record.SubDistrict != "" {
		parts = append(parts, record.SubDistrict)
	}
	if record.District != "" {
		parts = append(parts, record.District)
	}
	if record.City != "" {
		parts = append(parts, record.City)
	}
	return strings.Join(parts, ", ")
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

func parseOptionalInt(value string) any {
	trimmed := strings.TrimSpace(value)
	if trimmed == "" {
		return nil
	}
	parsed, err := strconv.Atoi(trimmed)
	if err != nil {
		return nil
	}
	return parsed
}

func parseOptionalIntValue(value string) int {
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

func firstNonEmpty(values ...string) string {
	for _, value := range values {
		if strings.TrimSpace(value) != "" {
			return strings.TrimSpace(value)
		}
	}
	return ""
}
