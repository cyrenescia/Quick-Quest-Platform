package rating

import (
	"context"
	"encoding/json"
	"math"
	"strconv"
	"strings"
	"time"

	"Stream-StrictMode/config"
	questclassification "Stream-StrictMode/routes/quest-classification"
	runnertier "Stream-StrictMode/routes/runner-tier"

	"github.com/google/uuid"
)

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

type questRecord struct {
	ID              string
	GiverAuthUserID string
	Title           string
	Category        string
	SkillTags       []string
	Status          string
	QuestTier       string
	TierScore       int
	RewardAmount    float64
}

type assignmentRecord struct {
	ID               string
	QuestID          string
	RunnerAuthUserID string
	AssignmentStatus string
	FinishedAt       *time.Time
}

type escrowRecord struct {
	QuestID     string
	EscrowState string
}

type existingRatingRecord struct {
	ID string
}

type ratingLifecycleSummary struct {
	RatingCount       int
	UniqueRatingCount int
	GiverRated        bool
	RunnerRated       bool
	BothRated         bool
}

type createRatingPayload struct {
	RatingID        string
	QuestID         string
	AssignmentID    string
	RaterAuthUserID string
	RateeAuthUserID string
	RaterRole       string
	RatingScore     float64
	RatingNote      string
	SkillScope      string
	PPDelta         float64
	QuestTier       string
	TierScore       int
	RunnerTier      string
	RewardAmount    float64
	FinishedAt      *time.Time
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

func (s *Service) FindAssignmentByID(ctx context.Context, assignmentID string) (*assignmentRecord, error) {
	row, err := s.client.SelectFirst(ctx, "quest_assignments", "id,quest_id,runner_auth_user_id,assignment_status,finished_at", map[string]string{
		"id": assignmentID,
	})
	if err != nil {
		return nil, err
	}
	if row == nil {
		return nil, nil
	}

	return &assignmentRecord{
		ID:               config.NormalizeString(row["id"]),
		QuestID:          config.NormalizeString(row["quest_id"]),
		RunnerAuthUserID: config.NormalizeString(row["runner_auth_user_id"]),
		AssignmentStatus: config.NormalizeString(row["assignment_status"]),
		FinishedAt:       parseOptionalTime(row["finished_at"]),
	}, nil
}

func (s *Service) FindQuestByID(ctx context.Context, questID string) (*questRecord, error) {
	row, err := s.client.SelectFirst(ctx, "quests", "id,giver_auth_user_id,title,category,skill_tags,status,quest_tier,tier_score,reward_amount", map[string]string{
		"id": questID,
	})
	if err != nil {
		return nil, err
	}
	if row == nil {
		return nil, nil
	}

	return &questRecord{
		ID:              config.NormalizeString(row["id"]),
		GiverAuthUserID: config.NormalizeString(row["giver_auth_user_id"]),
		Title:           config.NormalizeString(row["title"]),
		Category:        config.NormalizeString(row["category"]),
		SkillTags:       parseStringArray(row["skill_tags"]),
		Status:          config.NormalizeString(row["status"]),
		QuestTier:       questclassification.NormalizeTier(config.NormalizeString(row["quest_tier"])),
		TierScore:       parseIntValue(row["tier_score"]),
		RewardAmount:    parseFloatValue(row["reward_amount"]),
	}, nil
}

func (s *Service) FindQuestEscrowByQuestID(ctx context.Context, questID string) (*escrowRecord, error) {
	row, err := s.client.SelectFirst(ctx, "quest_escrows", "quest_id,escrow_state", map[string]string{
		"quest_id": questID,
	})
	if err != nil {
		return nil, err
	}
	if row == nil {
		return nil, nil
	}

	return &escrowRecord{
		QuestID:     config.NormalizeString(row["quest_id"]),
		EscrowState: config.NormalizeString(row["escrow_state"]),
	}, nil
}

func (s *Service) FindRatingByAssignmentAndRater(ctx context.Context, assignmentID string, raterAuthUserID string) (*existingRatingRecord, error) {
	row, err := s.client.SelectFirst(ctx, "quest_ratings", "id", map[string]string{
		"assignment_id":      assignmentID,
		"rater_auth_user_id": raterAuthUserID,
	})
	if err != nil {
		return nil, err
	}
	if row == nil {
		return nil, nil
	}

	return &existingRatingRecord{
		ID: config.NormalizeString(row["id"]),
	}, nil
}

func (s *Service) FindRunnerTier(ctx context.Context, authUserID string) (string, error) {
	row, err := s.client.SelectFirst(ctx, "user_identification", "runner_tier", map[string]string{
		"auth_user_id": authUserID,
	})
	if err != nil {
		return questclassification.TierQ1, err
	}
	if row == nil {
		return questclassification.TierQ1, nil
	}

	return questclassification.NormalizeTier(config.NormalizeString(row["runner_tier"])), nil
}

func (s *Service) CreateRatingWithPPLedger(ctx context.Context, payload createRatingPayload, ppResult ppWeightedResult) error {
	now := time.Now().UTC()
	ratingID := payload.RatingID
	if strings.TrimSpace(ratingID) == "" {
		ratingID = uuid.NewString()
	}

	if err := s.client.Insert(ctx, "quest_ratings", map[string]any{
		"id":                 ratingID,
		"quest_id":           payload.QuestID,
		"assignment_id":      payload.AssignmentID,
		"rater_auth_user_id": payload.RaterAuthUserID,
		"ratee_auth_user_id": payload.RateeAuthUserID,
		"rater_role":         payload.RaterRole,
		"rating_score":       payload.RatingScore,
		"rating_note":        nullIfEmpty(payload.RatingNote),
		"skill_scope":        payload.SkillScope,
		"pp_delta":           payload.PPDelta,
		"created_at":         now,
		"updated_at":         now,
	}); err != nil {
		return err
	}

	if err := s.client.Insert(ctx, "performance_point_ledger", map[string]any{
		"id":            uuid.NewString(),
		"auth_user_id":  payload.RateeAuthUserID,
		"quest_id":      payload.QuestID,
		"assignment_id": payload.AssignmentID,
		"rating_id":     ratingID,
		"source_type":   "rating",
		"skill_scope":   payload.SkillScope,
		"pp_delta":      payload.PPDelta,
		"reason":        buildPPReason(payload),
		"metadata": map[string]any{
			"rating_score":         payload.RatingScore,
			"rater_role":           payload.RaterRole,
			"quest_tier":           questclassification.NormalizeTier(payload.QuestTier),
			"tier_score":           payload.TierScore,
			"runner_tier":          questclassification.NormalizeTier(payload.RunnerTier),
			"tier_multiplier":      ppResult.TierMultiplier,
			"challenge_bonus":      ppResult.ChallengeBonus,
			"value_multiplier":     ppResult.ValueMultiplier,
			"time_decay":           ppResult.TimeDecay,
			"base_pp":              ppResult.BasePP,
			"pp_delta_final":       ppResult.PPDelta,
			"reward_amount":        payload.RewardAmount,
			"finished_at":          optionalTimeMetadata(payload.FinishedAt),
			"min_pp_floor_applied": ppResult.MinPPFloorApplied,
		},
		"created_at": now,
	}); err != nil {
		_ = s.client.Delete(ctx, "quest_ratings", map[string]string{"id": ratingID})
		return err
	}

	return nil
}

func (s *Service) ApplyRunnerRatingProgression(ctx context.Context, runnerAuthUserID string, ppDelta float64) (*runnertier.ProgressionResult, error) {
	return s.tierService.ApplyRatingProgression(ctx, runnerAuthUserID, ppDelta)
}

func (s *Service) CountUniqueRatingsByAssignment(ctx context.Context, assignmentID string) (*ratingLifecycleSummary, error) {
	rows, err := s.client.SelectMany(ctx, "quest_ratings", "rater_auth_user_id,rater_role", map[string]string{
		"assignment_id": assignmentID,
	}, &config.SelectOptions{Limit: 10})
	if err != nil {
		return nil, err
	}

	uniqueRaters := map[string]bool{}
	summary := &ratingLifecycleSummary{
		RatingCount: len(rows),
	}

	for _, row := range rows {
		raterID := config.NormalizeString(row["rater_auth_user_id"])
		if raterID != "" {
			uniqueRaters[raterID] = true
		}

		switch strings.ToLower(strings.TrimSpace(config.NormalizeString(row["rater_role"]))) {
		case "giver":
			summary.GiverRated = true
		case "runner":
			summary.RunnerRated = true
		}
	}

	summary.UniqueRatingCount = len(uniqueRaters)
	summary.BothRated = summary.GiverRated && summary.RunnerRated && summary.UniqueRatingCount >= 2
	return summary, nil
}

func resolveSkillScope(quest *questRecord) string {
	if quest == nil {
		return "general"
	}
	if strings.TrimSpace(quest.Category) != "" {
		return strings.ToLower(strings.TrimSpace(quest.Category))
	}
	for _, tag := range quest.SkillTags {
		if strings.TrimSpace(tag) != "" {
			return strings.ToLower(strings.TrimSpace(tag))
		}
	}
	return "general"
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

func parseStringArray(value any) []string {
	switch typed := value.(type) {
	case nil:
		return []string{}
	case []any:
		out := make([]string, 0, len(typed))
		for _, item := range typed {
			if normalized := config.NormalizeString(item); normalized != "" {
				out = append(out, normalized)
			}
		}
		return out
	case []string:
		out := make([]string, 0, len(typed))
		for _, item := range typed {
			if normalized := strings.TrimSpace(item); normalized != "" {
				out = append(out, normalized)
			}
		}
		return out
	case string:
		trimmed := strings.TrimSpace(typed)
		if trimmed == "" {
			return []string{}
		}
		var out []string
		if err := json.Unmarshal([]byte(trimmed), &out); err == nil {
			return out
		}
		return []string{trimmed}
	default:
		return []string{}
	}
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

func parseIntValue(value any) int {
	switch typed := value.(type) {
	case nil:
		return 0
	case json.Number:
		parsed, err := typed.Int64()
		if err == nil {
			return int(parsed)
		}
		fallback, fallbackErr := typed.Float64()
		if fallbackErr != nil {
			return 0
		}
		return int(math.Round(fallback))
	case float64:
		return int(math.Round(typed))
	case float32:
		return int(math.Round(float64(typed)))
	case int:
		return typed
	case int64:
		return int(typed)
	case string:
		parsed, err := strconv.Atoi(strings.TrimSpace(typed))
		if err == nil {
			return parsed
		}
		fallback, fallbackErr := strconv.ParseFloat(strings.TrimSpace(typed), 64)
		if fallbackErr != nil {
			return 0
		}
		return int(math.Round(fallback))
	default:
		return 0
	}
}

func optionalTimeMetadata(value *time.Time) any {
	if value == nil || value.IsZero() {
		return nil
	}
	return value.UTC()
}

func nullIfEmpty(value string) any {
	trimmed := strings.TrimSpace(value)
	if trimmed == "" {
		return nil
	}
	return trimmed
}

func buildPPReason(payload createRatingPayload) string {
	actor := "Giver"
	if payload.RaterRole == "runner" {
		actor = "Runner"
	}
	return actor + " memberikan rating transaksi QuickQuest."
}
