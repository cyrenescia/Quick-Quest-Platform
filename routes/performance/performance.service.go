package performance

import (
	"context"
	"encoding/json"
	"math"
	"sort"
	"strconv"
	"strings"
	"time"

	"Stream-StrictMode/config"
	questclassification "Stream-StrictMode/routes/quest-classification"
	runnertier "Stream-StrictMode/routes/runner-tier"
)

const performanceFetchLimit = 500

type Service struct {
	client      *config.SupabaseClient
	cfg         config.AppConfig
	tierService *runnertier.Service
}

type authSessionRecord struct {
	AuthUserID string
	Username   string
	Email      string
	Phone      string
}

type ledgerRecord struct {
	ID           string
	QuestID      string
	AssignmentID string
	RatingID     string
	SourceType   string
	SkillScope   string
	PPDelta      float64
	Reason       string
	Metadata     map[string]any
	CreatedAt    *time.Time
}

type ratingRecord struct {
	ID              string
	QuestID         string
	AssignmentID    string
	RaterAuthUserID string
	RateeAuthUserID string
	RaterRole       string
	RatingScore     float64
	RatingNote      string
	SkillScope      string
	PPDelta         float64
	CreatedAt       *time.Time
}

type assignmentRecord struct {
	ID               string
	QuestID          string
	RunnerAuthUserID string
	AssignmentStatus string
	FinishedAt       *time.Time
	CreatedAt        *time.Time
}

type questSummaryRecord struct {
	ID        string
	Title     string
	QuestTier string
}

type performanceSummaryStats struct {
	TotalRatingsReceived int
	AvgRatingReceived    float64
	TotalQuestsCompleted int
	TotalPPEarned        float64
	TopSkillScope        string
}

type skillBreakdown struct {
	TotalPP  float64
	TopSkill string
	Skills   []skillBreakdownRecord
}

type skillBreakdownRecord struct {
	SkillScope   string
	TotalPP      float64
	Percentage   float64
	QuestCount   int
	AvgRating    float64
	LastEarnedAt *time.Time
}

type ratingSummaryStats struct {
	AvgRating          float64
	TotalRatings       int
	RatingDistribution map[int]int
}

func NewService(client *config.SupabaseClient, cfg config.AppConfig) *Service {
	return &Service{
		client:      client,
		cfg:         cfg,
		tierService: runnertier.NewService(client, cfg),
	}
}

func (s *Service) FindAuthBySessionToken(ctx context.Context, token string) (*authSessionRecord, error) {
	row, err := s.client.SelectFirst(ctx, "authentication", "auth_user_id,username,email,phone", map[string]string{
		"auth_token": token,
	})
	if err != nil {
		return nil, err
	}
	if row == nil {
		return nil, nil
	}

	return &authSessionRecord{
		AuthUserID: config.NormalizeString(row["auth_user_id"]),
		Username:   config.NormalizeString(row["username"]),
		Email:      config.NormalizeString(row["email"]),
		Phone:      config.NormalizeString(row["phone"]),
	}, nil
}

func (s *Service) GetRunnerTierStatus(ctx context.Context, authUserID string) (*runnertier.TierStatus, error) {
	return s.tierService.GetTierStatus(ctx, authUserID)
}

func (s *Service) BuildSummaryStats(ctx context.Context, authUserID string) (performanceSummaryStats, error) {
	ledgers, err := s.ListPerformanceLedgers(ctx, authUserID, "")
	if err != nil {
		return performanceSummaryStats{}, err
	}
	ratings, err := s.ListPerformanceRatings(ctx, authUserID, "")
	if err != nil {
		return performanceSummaryStats{}, err
	}
	assignments, err := s.ListRunnerAssignments(ctx, authUserID)
	if err != nil {
		return performanceSummaryStats{}, err
	}

	return buildPerformanceSummaryStats(ledgers, ratings, assignments), nil
}

func (s *Service) ListPerformanceLedgers(ctx context.Context, authUserID string, skillScope string) ([]ledgerRecord, error) {
	filters := map[string]string{"auth_user_id": authUserID}
	if strings.TrimSpace(skillScope) != "" {
		filters["skill_scope"] = normalizeSkillScope(skillScope)
	}

	rows, err := s.client.SelectMany(
		ctx,
		"performance_point_ledger",
		"id,auth_user_id,quest_id,assignment_id,rating_id,source_type,skill_scope,pp_delta,reason,metadata,created_at",
		filters,
		&config.SelectOptions{Limit: performanceFetchLimit, OrderBy: "created_at", Desc: true},
	)
	if err != nil {
		return nil, err
	}

	items := make([]ledgerRecord, 0, len(rows))
	for _, row := range rows {
		items = append(items, mapLedgerRecord(row))
	}
	return items, nil
}

func (s *Service) ListPerformanceRatings(ctx context.Context, authUserID string, raterRole string) ([]ratingRecord, error) {
	filters := map[string]string{"ratee_auth_user_id": authUserID}
	normalizedRole := strings.ToLower(strings.TrimSpace(raterRole))
	if normalizedRole == "giver" || normalizedRole == "runner" {
		filters["rater_role"] = normalizedRole
	}

	rows, err := s.client.SelectMany(
		ctx,
		"quest_ratings",
		"id,quest_id,assignment_id,rater_auth_user_id,ratee_auth_user_id,rater_role,rating_score,rating_note,skill_scope,pp_delta,created_at",
		filters,
		&config.SelectOptions{Limit: performanceFetchLimit, OrderBy: "created_at", Desc: true},
	)
	if err != nil {
		return nil, err
	}

	items := make([]ratingRecord, 0, len(rows))
	for _, row := range rows {
		items = append(items, mapRatingRecord(row))
	}
	return items, nil
}

func (s *Service) ListRunnerAssignments(ctx context.Context, authUserID string) ([]assignmentRecord, error) {
	rows, err := s.client.SelectMany(
		ctx,
		"quest_assignments",
		"id,quest_id,runner_auth_user_id,assignment_status,finished_at,created_at",
		map[string]string{"runner_auth_user_id": authUserID},
		&config.SelectOptions{Limit: performanceFetchLimit, OrderBy: "created_at", Desc: true},
	)
	if err != nil {
		return nil, err
	}

	items := make([]assignmentRecord, 0, len(rows))
	for _, row := range rows {
		items = append(items, assignmentRecord{
			ID:               config.NormalizeString(row["id"]),
			QuestID:          config.NormalizeString(row["quest_id"]),
			RunnerAuthUserID: config.NormalizeString(row["runner_auth_user_id"]),
			AssignmentStatus: strings.ToLower(strings.TrimSpace(config.NormalizeString(row["assignment_status"]))),
			FinishedAt:       parseOptionalTime(row["finished_at"]),
			CreatedAt:        parseOptionalTime(row["created_at"]),
		})
	}
	return items, nil
}

func (s *Service) FindQuestSummaries(ctx context.Context, questIDs []string) (map[string]*questSummaryRecord, error) {
	out := map[string]*questSummaryRecord{}
	for _, questID := range uniqueNonEmptyStrings(questIDs) {
		row, err := s.client.SelectFirst(ctx, "quests", "id,title,quest_tier", map[string]string{
			"id": questID,
		})
		if err != nil {
			return nil, err
		}
		if row == nil {
			continue
		}
		out[questID] = &questSummaryRecord{
			ID:        config.NormalizeString(row["id"]),
			Title:     config.NormalizeString(row["title"]),
			QuestTier: questclassification.NormalizeTier(config.NormalizeString(row["quest_tier"])),
		}
	}
	return out, nil
}

func buildPerformanceSummaryStats(ledgers []ledgerRecord, ratings []ratingRecord, assignments []assignmentRecord) performanceSummaryStats {
	skillBreakdown := buildSkillBreakdown(ledgers, ratings)
	return performanceSummaryStats{
		TotalRatingsReceived: len(ratings),
		AvgRatingReceived:    averageRatingRecords(ratings),
		TotalQuestsCompleted: countCompletedAssignments(assignments),
		TotalPPEarned:        sumLedgerPP(ledgers),
		TopSkillScope:        skillBreakdown.TopSkill,
	}
}

func buildSkillBreakdown(ledgers []ledgerRecord, ratings []ratingRecord) skillBreakdown {
	type accumulator struct {
		totalPP      float64
		questCount   int
		lastEarnedAt *time.Time
	}

	accumulators := map[string]*accumulator{}
	totalPP := 0.0
	for _, ledger := range ledgers {
		skill := normalizeSkillScope(ledger.SkillScope)
		if _, ok := accumulators[skill]; !ok {
			accumulators[skill] = &accumulator{}
		}
		acc := accumulators[skill]
		acc.totalPP += ledger.PPDelta
		acc.questCount++
		if ledger.CreatedAt != nil && (acc.lastEarnedAt == nil || ledger.CreatedAt.After(*acc.lastEarnedAt)) {
			acc.lastEarnedAt = ledger.CreatedAt
		}
		totalPP += ledger.PPDelta
	}

	ratingAverages := averageRatingsBySkill(ratings)
	items := make([]skillBreakdownRecord, 0, len(accumulators))
	for skill, acc := range accumulators {
		percentage := 0.0
		if totalPP > 0 {
			percentage = round2(acc.totalPP / totalPP * 100)
		}
		items = append(items, skillBreakdownRecord{
			SkillScope:   skill,
			TotalPP:      round2(acc.totalPP),
			Percentage:   percentage,
			QuestCount:   acc.questCount,
			AvgRating:    ratingAverages[skill],
			LastEarnedAt: acc.lastEarnedAt,
		})
	}

	sort.SliceStable(items, func(i, j int) bool {
		if items[i].TotalPP == items[j].TotalPP {
			return items[i].SkillScope < items[j].SkillScope
		}
		return items[i].TotalPP > items[j].TotalPP
	})

	topSkill := ""
	if len(items) > 0 {
		topSkill = items[0].SkillScope
	}
	return skillBreakdown{
		TotalPP:  round2(totalPP),
		TopSkill: topSkill,
		Skills:   items,
	}
}

func buildRatingSummary(ratings []ratingRecord) ratingSummaryStats {
	distribution := map[int]int{
		1: 0,
		2: 0,
		3: 0,
		4: 0,
		5: 0,
	}
	for _, rating := range ratings {
		bucket := int(math.Round(rating.RatingScore))
		if bucket < 1 {
			bucket = 1
		}
		if bucket > 5 {
			bucket = 5
		}
		distribution[bucket]++
	}

	return ratingSummaryStats{
		AvgRating:          averageRatingRecords(ratings),
		TotalRatings:       len(ratings),
		RatingDistribution: distribution,
	}
}

func normalizePagination(pageRaw string, limitRaw string) (int, int) {
	page := parsePositiveInt(pageRaw, 1)
	limit := parsePositiveInt(limitRaw, 20)
	if page < 1 {
		page = 1
	}
	if limit < 1 {
		limit = 20
	}
	if limit > 50 {
		limit = 50
	}
	return page, limit
}

func paginateLedgerRecords(records []ledgerRecord, page int, limit int) []ledgerRecord {
	start, end := paginationWindow(len(records), page, limit)
	if start >= end {
		return []ledgerRecord{}
	}
	return records[start:end]
}

func paginateRatingRecords(records []ratingRecord, page int, limit int) []ratingRecord {
	start, end := paginationWindow(len(records), page, limit)
	if start >= end {
		return []ratingRecord{}
	}
	return records[start:end]
}

func paginationWindow(total int, page int, limit int) (int, int) {
	page, limit = normalizePagination(strconv.Itoa(page), strconv.Itoa(limit))
	start := (page - 1) * limit
	if start >= total {
		return total, total
	}
	end := start + limit
	if end > total {
		end = total
	}
	return start, end
}

func collectLedgerQuestIDs(records []ledgerRecord) []string {
	ids := make([]string, 0, len(records))
	for _, record := range records {
		ids = append(ids, record.QuestID)
	}
	return ids
}

func collectRatingQuestIDs(records []ratingRecord) []string {
	ids := make([]string, 0, len(records))
	for _, record := range records {
		ids = append(ids, record.QuestID)
	}
	return ids
}

func mapLedgerRecord(row map[string]any) ledgerRecord {
	return ledgerRecord{
		ID:           config.NormalizeString(row["id"]),
		QuestID:      config.NormalizeString(row["quest_id"]),
		AssignmentID: config.NormalizeString(row["assignment_id"]),
		RatingID:     config.NormalizeString(row["rating_id"]),
		SourceType:   config.NormalizeString(row["source_type"]),
		SkillScope:   normalizeSkillScope(config.NormalizeString(row["skill_scope"])),
		PPDelta:      round2(parseFloatValue(row["pp_delta"])),
		Reason:       config.NormalizeString(row["reason"]),
		Metadata:     parseMetadata(row["metadata"]),
		CreatedAt:    parseOptionalTime(row["created_at"]),
	}
}

func mapRatingRecord(row map[string]any) ratingRecord {
	return ratingRecord{
		ID:              config.NormalizeString(row["id"]),
		QuestID:         config.NormalizeString(row["quest_id"]),
		AssignmentID:    config.NormalizeString(row["assignment_id"]),
		RaterAuthUserID: config.NormalizeString(row["rater_auth_user_id"]),
		RateeAuthUserID: config.NormalizeString(row["ratee_auth_user_id"]),
		RaterRole:       strings.ToLower(strings.TrimSpace(config.NormalizeString(row["rater_role"]))),
		RatingScore:     round2(parseFloatValue(row["rating_score"])),
		RatingNote:      config.NormalizeString(row["rating_note"]),
		SkillScope:      normalizeSkillScope(config.NormalizeString(row["skill_scope"])),
		PPDelta:         round2(parseFloatValue(row["pp_delta"])),
		CreatedAt:       parseOptionalTime(row["created_at"]),
	}
}

func averageRatingsBySkill(ratings []ratingRecord) map[string]float64 {
	type aggregate struct {
		sum   float64
		count int
	}
	aggregates := map[string]aggregate{}
	for _, rating := range ratings {
		skill := normalizeSkillScope(rating.SkillScope)
		item := aggregates[skill]
		item.sum += rating.RatingScore
		item.count++
		aggregates[skill] = item
	}

	out := map[string]float64{}
	for skill, item := range aggregates {
		if item.count > 0 {
			out[skill] = round2(item.sum / float64(item.count))
		}
	}
	return out
}

func averageRatingRecords(ratings []ratingRecord) float64 {
	total := 0.0
	count := 0
	for _, rating := range ratings {
		if rating.RatingScore <= 0 {
			continue
		}
		total += rating.RatingScore
		count++
	}
	if count == 0 {
		return 0
	}
	return round2(total / float64(count))
}

func sumLedgerPP(ledgers []ledgerRecord) float64 {
	total := 0.0
	for _, ledger := range ledgers {
		total += ledger.PPDelta
	}
	return round2(total)
}

func countCompletedAssignments(assignments []assignmentRecord) int {
	total := 0
	for _, assignment := range assignments {
		if strings.EqualFold(strings.TrimSpace(assignment.AssignmentStatus), "finished") {
			total++
		}
	}
	return total
}

func uniqueNonEmptyStrings(values []string) []string {
	seen := map[string]bool{}
	out := []string{}
	for _, value := range values {
		trimmed := strings.TrimSpace(value)
		if trimmed == "" || seen[trimmed] {
			continue
		}
		seen[trimmed] = true
		out = append(out, trimmed)
	}
	return out
}

func normalizeSkillScope(value string) string {
	normalized := strings.ToLower(strings.TrimSpace(value))
	if normalized == "" {
		return "general"
	}
	return normalized
}

func parsePositiveInt(value string, fallback int) int {
	parsed, err := strconv.Atoi(strings.TrimSpace(value))
	if err != nil || parsed <= 0 {
		return fallback
	}
	return parsed
}

func parseFloatValue(value any) float64 {
	switch typed := value.(type) {
	case nil:
		return 0
	case json.Number:
		parsed, err := typed.Float64()
		if err != nil {
			return 0
		}
		return parsed
	case float64:
		return typed
	case float32:
		return float64(typed)
	case int:
		return float64(typed)
	case int64:
		return float64(typed)
	case string:
		parsed, err := strconv.ParseFloat(strings.TrimSpace(typed), 64)
		if err != nil {
			return 0
		}
		return parsed
	default:
		parsed, err := strconv.ParseFloat(config.NormalizeString(value), 64)
		if err != nil {
			return 0
		}
		return parsed
	}
}

func parseOptionalTime(value any) *time.Time {
	normalized := strings.TrimSpace(config.NormalizeString(value))
	if normalized == "" {
		return nil
	}

	layouts := []string{
		time.RFC3339Nano,
		time.RFC3339,
		time.DateOnly,
		"2006-01-02 15:04:05-07",
		"2006-01-02 15:04:05",
	}
	for _, layout := range layouts {
		if parsed, err := time.Parse(layout, normalized); err == nil {
			return &parsed
		}
	}

	return nil
}

func parseMetadata(value any) map[string]any {
	switch typed := value.(type) {
	case nil:
		return map[string]any{}
	case map[string]any:
		return typed
	case string:
		trimmed := strings.TrimSpace(typed)
		if trimmed == "" {
			return map[string]any{}
		}
		out := map[string]any{}
		if err := json.Unmarshal([]byte(trimmed), &out); err != nil {
			return map[string]any{}
		}
		return out
	default:
		return map[string]any{}
	}
}

func round2(value float64) float64 {
	return math.Round(value*100) / 100
}
