package performance

import (
	"context"
	"strings"
	"time"

	"Stream-StrictMode/config"
	runnertier "Stream-StrictMode/routes/runner-tier"

	"github.com/gofiber/fiber/v3"
)

func Performance(service *Service) fiber.Handler {
	return func(c fiber.Ctx) error {
		switch c.Method() {
		case fiber.MethodGet:
			return handlePerformanceGet(c, service)
		case fiber.MethodOptions:
			return c.SendStatus(fiber.StatusNoContent)
		default:
			return config.WriteError(c, config.NewAppError("Method tidak diizinkan untuk performance.", fiber.StatusMethodNotAllowed), "Gagal memproses performance.")
		}
	}
}

func handlePerformanceGet(c fiber.Ctx, service *Service) error {
	path := strings.TrimSuffix(c.Path(), "/")
	switch {
	case strings.HasSuffix(path, "/summary"):
		return handlePerformanceSummaryGet(c, service)
	case strings.HasSuffix(path, "/ledger"):
		return handlePerformanceLedgerGet(c, service)
	case strings.HasSuffix(path, "/skills"):
		return handlePerformanceSkillsGet(c, service)
	case strings.HasSuffix(path, "/ratings"):
		return handlePerformanceRatingsGet(c, service)
	default:
		return config.WriteError(c, config.NewAppError("Endpoint performance tidak ditemukan.", fiber.StatusNotFound), "Gagal memproses performance.")
	}
}

func handlePerformanceSummaryGet(c fiber.Ctx, service *Service) error {
	ctx, cancel, authRecord, err := resolvePerformanceContext(c, service)
	if err != nil {
		return config.WriteError(c, err, "Gagal mengambil performance summary.")
	}
	defer cancel()

	tierStatus, err := service.GetRunnerTierStatus(ctx, authRecord.AuthUserID)
	if err != nil {
		return config.WriteError(c, config.MapSupabaseError(err, "Gagal mengambil status tier performance cloud."), "Gagal mengambil performance summary.")
	}

	stats, err := service.BuildSummaryStats(ctx, authRecord.AuthUserID)
	if err != nil {
		return config.WriteError(c, config.MapSupabaseError(err, "Gagal mengambil statistik performance cloud."), "Gagal mengambil performance summary.")
	}

	return c.JSON(fiber.Map{
		"success": true,
		"message": "Performance summary berhasil diambil.",
		"data":    toPerformanceSummaryPayload(tierStatus, stats, authRecord.AuthUserID),
	})
}

func handlePerformanceLedgerGet(c fiber.Ctx, service *Service) error {
	ctx, cancel, authRecord, err := resolvePerformanceContext(c, service)
	if err != nil {
		return config.WriteError(c, err, "Gagal mengambil PP ledger.")
	}
	defer cancel()

	page, limit := collectPerformancePagination(c)
	skillScope := strings.TrimSpace(c.Query("skill_scope"))
	records, err := service.ListPerformanceLedgers(ctx, authRecord.AuthUserID, skillScope)
	if err != nil {
		return config.WriteError(c, config.MapSupabaseError(err, "Gagal mengambil PP ledger cloud."), "Gagal mengambil PP ledger.")
	}

	paged := paginateLedgerRecords(records, page, limit)
	questMap, err := service.FindQuestSummaries(ctx, collectLedgerQuestIDs(paged))
	if err != nil {
		return config.WriteError(c, config.MapSupabaseError(err, "Gagal mengambil detail quest ledger cloud."), "Gagal mengambil PP ledger.")
	}

	items := make([]fiber.Map, 0, len(paged))
	for _, record := range paged {
		items = append(items, toLedgerPayload(record, questMap[record.QuestID]))
	}

	return c.JSON(fiber.Map{
		"success": true,
		"message": "PP ledger berhasil diambil.",
		"data": fiber.Map{
			"auth_user_id": authRecord.AuthUserID,
			"page":         page,
			"limit":        limit,
			"total":        len(records),
			"items":        items,
		},
	})
}

func handlePerformanceSkillsGet(c fiber.Ctx, service *Service) error {
	ctx, cancel, authRecord, err := resolvePerformanceContext(c, service)
	if err != nil {
		return config.WriteError(c, err, "Gagal mengambil skill breakdown.")
	}
	defer cancel()

	ledgers, err := service.ListPerformanceLedgers(ctx, authRecord.AuthUserID, "")
	if err != nil {
		return config.WriteError(c, config.MapSupabaseError(err, "Gagal mengambil PP skill cloud."), "Gagal mengambil skill breakdown.")
	}
	ratings, err := service.ListPerformanceRatings(ctx, authRecord.AuthUserID, "")
	if err != nil {
		return config.WriteError(c, config.MapSupabaseError(err, "Gagal mengambil rating skill cloud."), "Gagal mengambil skill breakdown.")
	}

	breakdown := buildSkillBreakdown(ledgers, ratings)
	items := make([]fiber.Map, 0, len(breakdown.Skills))
	for _, item := range breakdown.Skills {
		items = append(items, toSkillPayload(item))
	}

	return c.JSON(fiber.Map{
		"success": true,
		"message": "Skill breakdown berhasil diambil.",
		"data": fiber.Map{
			"auth_user_id": authRecord.AuthUserID,
			"total_pp":     breakdown.TotalPP,
			"top_skill":    breakdown.TopSkill,
			"skills":       items,
		},
	})
}

func handlePerformanceRatingsGet(c fiber.Ctx, service *Service) error {
	ctx, cancel, authRecord, err := resolvePerformanceContext(c, service)
	if err != nil {
		return config.WriteError(c, err, "Gagal mengambil rating history.")
	}
	defer cancel()

	page, limit := collectPerformancePagination(c)
	raterRole := strings.TrimSpace(c.Query("rater_role"))
	ratings, err := service.ListPerformanceRatings(ctx, authRecord.AuthUserID, raterRole)
	if err != nil {
		return config.WriteError(c, config.MapSupabaseError(err, "Gagal mengambil rating history cloud."), "Gagal mengambil rating history.")
	}

	paged := paginateRatingRecords(ratings, page, limit)
	questMap, err := service.FindQuestSummaries(ctx, collectRatingQuestIDs(paged))
	if err != nil {
		return config.WriteError(c, config.MapSupabaseError(err, "Gagal mengambil detail quest rating cloud."), "Gagal mengambil rating history.")
	}

	items := make([]fiber.Map, 0, len(paged))
	for _, record := range paged {
		items = append(items, toRatingPayload(record, questMap[record.QuestID]))
	}

	return c.JSON(fiber.Map{
		"success": true,
		"message": "Rating history berhasil diambil.",
		"data": fiber.Map{
			"auth_user_id": authRecord.AuthUserID,
			"page":         page,
			"limit":        limit,
			"total":        len(ratings),
			"summary":      toRatingSummaryPayload(buildRatingSummary(ratings)),
			"items":        items,
		},
	})
}

func resolvePerformanceContext(c fiber.Ctx, service *Service) (context.Context, context.CancelFunc, *authSessionRecord, error) {
	sessionToken := config.ResolveSessionToken(c, service.cfg.SessionCookieName)
	if sessionToken == "" {
		return nil, nil, nil, config.NewAppError("Token sesi tidak ditemukan. Kirim bearer token atau cookie sesi.", fiber.StatusUnauthorized)
	}

	ctx, cancel := context.WithTimeout(context.Background(), 20*time.Second)
	authRecord, err := service.FindAuthBySessionToken(ctx, sessionToken)
	if err != nil {
		cancel()
		return nil, nil, nil, config.MapSupabaseError(err, "Gagal mengambil data auth performance cloud.")
	}
	if authRecord == nil {
		cancel()
		return nil, nil, nil, config.NewAppError("Token sesi tidak valid atau sudah kadaluarsa.", fiber.StatusUnauthorized)
	}

	return ctx, cancel, authRecord, nil
}

func collectPerformancePagination(c fiber.Ctx) (int, int) {
	return normalizePagination(c.Query("page"), c.Query("limit"))
}

func toPerformanceSummaryPayload(status *runnertier.TierStatus, stats performanceSummaryStats, authUserID string) fiber.Map {
	if status == nil {
		return fiber.Map{
			"auth_user_id": authUserID,
			"stats":        toSummaryStatsPayload(stats),
		}
	}

	return fiber.Map{
		"auth_user_id":                 firstNonEmpty(status.AuthUserID, authUserID),
		"runner_tier":                  status.RunnerTier,
		"runner_pp":                    status.RunnerPP,
		"runner_sr":                    status.RunnerSR,
		"runner_risk_score":            status.RunnerRiskScore,
		"risk_band":                    status.RiskBand,
		"identity_approved":            status.IdentityApproved,
		"verification_status":          status.VerificationStatus,
		"eligible_tier":                status.EligibleTier,
		"next_tier":                    status.NextTier,
		"can_upgrade_q2":               status.CanUpgradeQ2,
		"can_upgrade_q3":               status.CanUpgradeQ3,
		"blocked_reason":               status.BlockedReason,
		"required_stable_quest_count":  status.RequiredStableQuestCount,
		"total_runner_ratings":         status.TotalRunnerRatings,
		"total_runner_assignments":     status.TotalRunnerAssignments,
		"completed_runner_assignments": status.CompletedRunnerAssignment,
		"thresholds":                   status.Thresholds,
		"stats":                        toSummaryStatsPayload(stats),
	}
}

func toSummaryStatsPayload(stats performanceSummaryStats) fiber.Map {
	return fiber.Map{
		"total_ratings_received": stats.TotalRatingsReceived,
		"avg_rating_received":    stats.AvgRatingReceived,
		"total_quests_completed": stats.TotalQuestsCompleted,
		"total_pp_earned":        stats.TotalPPEarned,
		"top_skill_scope":        stats.TopSkillScope,
	}
}

func toLedgerPayload(record ledgerRecord, quest *questSummaryRecord) fiber.Map {
	return fiber.Map{
		"id":            record.ID,
		"quest_id":      record.QuestID,
		"quest_title":   resolveQuestTitle(quest),
		"quest_tier":    resolveQuestTier(quest),
		"assignment_id": record.AssignmentID,
		"source_type":   record.SourceType,
		"skill_scope":   record.SkillScope,
		"pp_delta":      record.PPDelta,
		"reason":        record.Reason,
		"breakdown":     record.Metadata,
		"created_at":    optionalTimeValue(record.CreatedAt),
	}
}

func toSkillPayload(record skillBreakdownRecord) fiber.Map {
	return fiber.Map{
		"skill_scope":    record.SkillScope,
		"total_pp":       record.TotalPP,
		"percentage":     record.Percentage,
		"quest_count":    record.QuestCount,
		"avg_rating":     record.AvgRating,
		"last_earned_at": optionalTimeValue(record.LastEarnedAt),
	}
}

func toRatingPayload(record ratingRecord, quest *questSummaryRecord) fiber.Map {
	return fiber.Map{
		"rating_id":     record.ID,
		"quest_id":      record.QuestID,
		"quest_title":   resolveQuestTitle(quest),
		"quest_tier":    resolveQuestTier(quest),
		"assignment_id": record.AssignmentID,
		"rater_role":    record.RaterRole,
		"rating_score":  record.RatingScore,
		"rating_note":   record.RatingNote,
		"skill_scope":   record.SkillScope,
		"pp_delta":      record.PPDelta,
		"created_at":    optionalTimeValue(record.CreatedAt),
	}
}

func toRatingSummaryPayload(summary ratingSummaryStats) fiber.Map {
	return fiber.Map{
		"avg_rating":    summary.AvgRating,
		"total_ratings": summary.TotalRatings,
		"rating_distribution": fiber.Map{
			"5": summary.RatingDistribution[5],
			"4": summary.RatingDistribution[4],
			"3": summary.RatingDistribution[3],
			"2": summary.RatingDistribution[2],
			"1": summary.RatingDistribution[1],
		},
	}
}

func optionalTimeValue(value *time.Time) any {
	if value == nil || value.IsZero() {
		return nil
	}
	return value.UTC()
}

func resolveQuestTitle(record *questSummaryRecord) string {
	if record == nil {
		return ""
	}
	return record.Title
}

func resolveQuestTier(record *questSummaryRecord) string {
	if record == nil {
		return ""
	}
	return record.QuestTier
}

func firstNonEmpty(values ...string) string {
	for _, value := range values {
		if strings.TrimSpace(value) != "" {
			return strings.TrimSpace(value)
		}
	}
	return ""
}
