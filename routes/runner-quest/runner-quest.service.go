package runnerquest

import (
	"context"
	"encoding/json"
	"strings"
	"time"

	"Stream-StrictMode/config"
	runnertier "Stream-StrictMode/routes/runner-tier"
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
	ID                 string
	GiverAuthUserID    string
	Title              string
	Description        string
	Category           string
	SkillTags          []string
	Mode               string
	Status             string
	RewardAmount       string
	RewardCurrency     string
	QuestTier          string
	TierScore          string
	TierStatus         string
	Province           string
	City               string
	District           string
	SubDistrict        string
	FullAddress        string
	PostalCode         string
	Lat                string
	Lng                string
	MaxRunner          string
	CurrentRunnerCount string
	StartsAt           *time.Time
	EndsAt             *time.Time
	PublishedAt        *time.Time
	CreatedAt          *time.Time
	UpdatedAt          *time.Time
}

type questAssignmentRecord struct {
	ID               string
	QuestID          string
	RunnerAuthUserID string
	AssignmentStatus string
	JoinedAt         *time.Time
	StartedAt        *time.Time
	FinishedAt       *time.Time
	WorkLocation     map[string]any
	LocationSharedAt *time.Time
	CreatedAt        *time.Time
	UpdatedAt        *time.Time
}

type escrowRecord struct {
	QuestID     string
	EscrowState string
}

type giverSummaryRecord struct {
	AuthUserID string
	Fullname   string
	Username   string
}

type runnerLocationProfile struct {
	AuthUserID  string
	RunnerTier  string
	Province    string
	City        string
	District    string
	SubDistrict string
	PostalCode  string
	FullAddress string
}

const runnerQuestSelectColumns = "id,giver_auth_user_id,title,description,category,skill_tags,mode,status,reward_amount,reward_currency,quest_tier,tier_score,tier_status,province,city,district,sub_district,full_address,postal_code,lat,lng,max_runner,current_runner_count,starts_at,ends_at,published_at,created_at,updated_at"

type ratingStateRecord struct {
	RatingCount       int
	UniqueRatingCount int
	GiverRated        bool
	RunnerRated       bool
	ViewerHasRated    bool
	BothRated         bool
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

func (s *Service) FindQuestByID(ctx context.Context, questID string) (*questRecord, error) {
	row, err := s.client.SelectFirst(
		ctx,
		"quests",
		runnerQuestSelectColumns,
		map[string]string{"id": questID},
	)
	if err != nil {
		return nil, err
	}
	if row == nil {
		return nil, nil
	}
	record := mapQuestRecord(row)
	return &record, nil
}

func (s *Service) FindQuestAssignment(ctx context.Context, questID string, runnerAuthUserID string) (*questAssignmentRecord, error) {
	row, err := s.client.SelectFirst(
		ctx,
		"quest_assignments",
		"id,quest_id,runner_auth_user_id,assignment_status,joined_at,started_at,finished_at,work_location,location_shared_at,created_at,updated_at",
		map[string]string{
			"quest_id":            questID,
			"runner_auth_user_id": runnerAuthUserID,
		},
	)
	if err != nil {
		return nil, err
	}
	if row == nil {
		return nil, nil
	}
	record := mapQuestAssignmentRecord(row)
	return &record, nil
}

func (s *Service) CreateQuestAssignment(ctx context.Context, questID string, runnerAuthUserID string, assignmentStatus string) error {
	now := time.Now().UTC()
	return s.client.Insert(ctx, "quest_assignments", map[string]any{
		"quest_id":            questID,
		"runner_auth_user_id": runnerAuthUserID,
		"assignment_status":   assignmentStatus,
		"joined_at":           now,
		"created_at":          now,
		"updated_at":          now,
	})
}

func (s *Service) UpdateQuestAfterTake(ctx context.Context, quest *questRecord, nextStatus string, nextRunnerCount int) error {
	return s.client.Update(ctx, "quests", map[string]string{
		"id": quest.ID,
	}, map[string]any{
		"status":               nextStatus,
		"current_runner_count": nextRunnerCount,
		"updated_at":           time.Now().UTC(),
	})
}

func (s *Service) UpdateQuestAssignmentLifecycle(ctx context.Context, assignmentID string, nextStatus string, updates map[string]any) error {
	payload := map[string]any{
		"assignment_status": nextStatus,
		"updated_at":        time.Now().UTC(),
	}
	for key, value := range updates {
		payload[key] = value
	}

	return s.client.Update(ctx, "quest_assignments", map[string]string{
		"id": assignmentID,
	}, payload)
}

func (s *Service) UpdateQuestStatus(ctx context.Context, questID string, nextStatus string) error {
	return s.client.Update(ctx, "quests", map[string]string{
		"id": questID,
	}, map[string]any{
		"status":     nextStatus,
		"updated_at": time.Now().UTC(),
	})
}

func (s *Service) ListRunnerAssignments(ctx context.Context, runnerAuthUserID string) ([]questAssignmentRecord, error) {
	rows, err := s.client.SelectMany(
		ctx,
		"quest_assignments",
		"id,quest_id,runner_auth_user_id,assignment_status,joined_at,started_at,finished_at,work_location,location_shared_at,created_at,updated_at",
		map[string]string{"runner_auth_user_id": runnerAuthUserID},
		&config.SelectOptions{OrderBy: "created_at", Desc: true, Limit: 100},
	)
	if err != nil {
		return nil, err
	}

	items := make([]questAssignmentRecord, 0, len(rows))
	for _, row := range rows {
		items = append(items, mapQuestAssignmentRecord(row))
	}
	return items, nil
}

func (s *Service) FindGiverSummary(ctx context.Context, authUserID string) (*giverSummaryRecord, error) {
	row, err := s.client.SelectFirst(ctx, "user_identification", "auth_user_id,fullname,username", map[string]string{
		"auth_user_id": authUserID,
	})
	if err != nil {
		return nil, err
	}
	if row == nil {
		return nil, nil
	}

	return &giverSummaryRecord{
		AuthUserID: config.NormalizeString(row["auth_user_id"]),
		Fullname:   config.NormalizeString(row["fullname"]),
		Username:   config.NormalizeString(row["username"]),
	}, nil
}

func (s *Service) FindRunnerLocationProfile(ctx context.Context, authUserID string) (*runnerLocationProfile, error) {
	row, err := s.client.SelectFirst(
		ctx,
		"user_identification",
		"auth_user_id,runner_tier,province,city,district,sub_district,postal_code,full_address",
		map[string]string{"auth_user_id": authUserID},
	)
	if err != nil {
		return nil, err
	}
	if row == nil {
		return nil, nil
	}

	return &runnerLocationProfile{
		AuthUserID:  config.NormalizeString(row["auth_user_id"]),
		RunnerTier:  config.NormalizeString(row["runner_tier"]),
		Province:    config.NormalizeString(row["province"]),
		City:        config.NormalizeString(row["city"]),
		District:    config.NormalizeString(row["district"]),
		SubDistrict: config.NormalizeString(row["sub_district"]),
		PostalCode:  config.NormalizeString(row["postal_code"]),
		FullAddress: config.NormalizeString(row["full_address"]),
	}, nil
}

func (s *Service) GetRunnerTierStatus(ctx context.Context, authUserID string) (*runnertier.TierStatus, error) {
	return s.tierService.GetTierStatus(ctx, authUserID)
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

func (s *Service) FindRatingStateByAssignment(ctx context.Context, assignmentID string, viewerAuthUserID string) (*ratingStateRecord, error) {
	rows, err := s.client.SelectMany(ctx, "quest_ratings", "rater_auth_user_id,rater_role", map[string]string{
		"assignment_id": assignmentID,
	}, &config.SelectOptions{Limit: 10})
	if err != nil {
		return nil, err
	}

	uniqueRaters := map[string]bool{}
	state := &ratingStateRecord{
		RatingCount: len(rows),
	}

	for _, row := range rows {
		raterID := config.NormalizeString(row["rater_auth_user_id"])
		if raterID != "" {
			uniqueRaters[raterID] = true
		}
		if raterID == viewerAuthUserID {
			state.ViewerHasRated = true
		}

		switch strings.ToLower(strings.TrimSpace(config.NormalizeString(row["rater_role"]))) {
		case "giver":
			state.GiverRated = true
		case "runner":
			state.RunnerRated = true
		}
	}

	state.UniqueRatingCount = len(uniqueRaters)
	state.BothRated = state.GiverRated && state.RunnerRated && state.UniqueRatingCount >= 2
	return state, nil
}

func (s *Service) UpdateQuestEscrowState(ctx context.Context, questID string, nextState string, timestampField string) error {
	payload := map[string]any{
		"escrow_state": nextState,
		"updated_at":   time.Now().UTC(),
	}
	if timestampField != "" {
		payload[timestampField] = time.Now().UTC()
	}

	return s.client.Update(ctx, "quest_escrows", map[string]string{
		"quest_id": questID,
	}, payload)
}

func mapQuestRecord(row map[string]any) questRecord {
	return questRecord{
		ID:                 config.NormalizeString(row["id"]),
		GiverAuthUserID:    config.NormalizeString(row["giver_auth_user_id"]),
		Title:              config.NormalizeString(row["title"]),
		Description:        config.NormalizeString(row["description"]),
		Category:           config.NormalizeString(row["category"]),
		SkillTags:          parseStringArray(row["skill_tags"]),
		Mode:               config.NormalizeString(row["mode"]),
		Status:             config.NormalizeString(row["status"]),
		RewardAmount:       config.NormalizeString(row["reward_amount"]),
		RewardCurrency:     config.NormalizeString(row["reward_currency"]),
		QuestTier:          config.NormalizeString(row["quest_tier"]),
		TierScore:          config.NormalizeString(row["tier_score"]),
		TierStatus:         config.NormalizeString(row["tier_status"]),
		Province:           config.NormalizeString(row["province"]),
		City:               config.NormalizeString(row["city"]),
		District:           config.NormalizeString(row["district"]),
		SubDistrict:        config.NormalizeString(row["sub_district"]),
		FullAddress:        config.NormalizeString(row["full_address"]),
		PostalCode:         config.NormalizeString(row["postal_code"]),
		Lat:                config.NormalizeString(row["lat"]),
		Lng:                config.NormalizeString(row["lng"]),
		MaxRunner:          config.NormalizeString(row["max_runner"]),
		CurrentRunnerCount: config.NormalizeString(row["current_runner_count"]),
		StartsAt:           parseOptionalTime(row["starts_at"]),
		EndsAt:             parseOptionalTime(row["ends_at"]),
		PublishedAt:        parseOptionalTime(row["published_at"]),
		CreatedAt:          parseOptionalTime(row["created_at"]),
		UpdatedAt:          parseOptionalTime(row["updated_at"]),
	}
}

func mapQuestAssignmentRecord(row map[string]any) questAssignmentRecord {
	return questAssignmentRecord{
		ID:               config.NormalizeString(row["id"]),
		QuestID:          config.NormalizeString(row["quest_id"]),
		RunnerAuthUserID: config.NormalizeString(row["runner_auth_user_id"]),
		AssignmentStatus: config.NormalizeString(row["assignment_status"]),
		JoinedAt:         parseOptionalTime(row["joined_at"]),
		StartedAt:        parseOptionalTime(row["started_at"]),
		FinishedAt:       parseOptionalTime(row["finished_at"]),
		WorkLocation:     parseWorkLocation(row["work_location"]),
		LocationSharedAt: parseOptionalTime(row["location_shared_at"]),
		CreatedAt:        parseOptionalTime(row["created_at"]),
		UpdatedAt:        parseOptionalTime(row["updated_at"]),
	}
}

func parseWorkLocation(value any) map[string]any {
	switch typed := value.(type) {
	case nil:
		return nil
	case map[string]any:
		return typed
	case string:
		trimmed := strings.TrimSpace(typed)
		if trimmed == "" {
			return nil
		}
		out := map[string]any{}
		if err := json.Unmarshal([]byte(trimmed), &out); err == nil {
			return out
		}
		return nil
	default:
		return nil
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
	case string:
		trimmed := strings.TrimSpace(typed)
		if trimmed == "" {
			return []string{}
		}
		return []string{trimmed}
	default:
		return []string{}
	}
}
