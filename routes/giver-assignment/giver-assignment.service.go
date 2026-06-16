package giverassignment

import (
	"context"
	"encoding/json"
	"strings"
	"time"

	"Stream-StrictMode/config"

	"github.com/google/uuid"
)

type Service struct {
	client *config.SupabaseClient
	cfg    config.AppConfig
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
	Status             string
	Mode               string
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
	TotalAmount string
}

type runnerSummaryRecord struct {
	AuthUserID string
	Fullname   string
	Username   string
	Email      string
	Phone      string
}

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
		client: client,
		cfg:    cfg,
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
	row, err := s.client.SelectFirst(ctx, "quests", "id,giver_auth_user_id,title,status,mode,province,city,district,sub_district,full_address,postal_code,lat,lng,max_runner,current_runner_count", map[string]string{
		"id": questID,
	})
	if err != nil {
		return nil, err
	}
	if row == nil {
		return nil, nil
	}

	return &questRecord{
		ID:                 config.NormalizeString(row["id"]),
		GiverAuthUserID:    config.NormalizeString(row["giver_auth_user_id"]),
		Title:              config.NormalizeString(row["title"]),
		Status:             config.NormalizeString(row["status"]),
		Mode:               config.NormalizeString(row["mode"]),
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
	}, nil
}

func (s *Service) FindQuestAssignmentByID(ctx context.Context, assignmentID string) (*questAssignmentRecord, error) {
	row, err := s.client.SelectFirst(
		ctx,
		"quest_assignments",
		"id,quest_id,runner_auth_user_id,assignment_status,joined_at,started_at,finished_at,work_location,location_shared_at,created_at,updated_at",
		map[string]string{"id": assignmentID},
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

func (s *Service) ListQuestAssignments(ctx context.Context, questID string) ([]questAssignmentRecord, error) {
	rows, err := s.client.SelectMany(
		ctx,
		"quest_assignments",
		"id,quest_id,runner_auth_user_id,assignment_status,joined_at,started_at,finished_at,work_location,location_shared_at,created_at,updated_at",
		map[string]string{"quest_id": questID},
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

func (s *Service) FindRunnerSummary(ctx context.Context, authUserID string) (*runnerSummaryRecord, error) {
	row, err := s.client.SelectFirst(ctx, "user_identification", "auth_user_id,fullname,username,email,phone", map[string]string{
		"auth_user_id": authUserID,
	})
	if err != nil {
		return nil, err
	}
	if row == nil {
		return nil, nil
	}

	return &runnerSummaryRecord{
		AuthUserID: config.NormalizeString(row["auth_user_id"]),
		Fullname:   config.NormalizeString(row["fullname"]),
		Username:   config.NormalizeString(row["username"]),
		Email:      config.NormalizeString(row["email"]),
		Phone:      config.NormalizeString(row["phone"]),
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

func (s *Service) UpdateQuestAssignmentAudit(ctx context.Context, assignmentID string, nextStatus string) error {
	return s.client.Update(ctx, "quest_assignments", map[string]string{
		"id": assignmentID,
	}, map[string]any{
		"assignment_status": nextStatus,
		"updated_at":        time.Now().UTC(),
	})
}

func (s *Service) UpdateQuestAssignmentCandidate(ctx context.Context, assignmentID string, nextStatus string) error {
	return s.client.Update(ctx, "quest_assignments", map[string]string{
		"id": assignmentID,
	}, map[string]any{
		"assignment_status": nextStatus,
		"updated_at":        time.Now().UTC(),
	})
}

func (s *Service) ShareQuestAssignmentLocation(ctx context.Context, assignmentID string, workLocation map[string]any, sharedAt time.Time) error {
	return s.client.Update(ctx, "quest_assignments", map[string]string{
		"id": assignmentID,
	}, map[string]any{
		"work_location":      workLocation,
		"location_shared_at": sharedAt,
		"updated_at":         sharedAt,
	})
}

func (s *Service) UpdateQuestAfterCandidateConfirm(ctx context.Context, questID string, nextStatus string, nextRunnerCount int) error {
	return s.client.Update(ctx, "quests", map[string]string{
		"id": questID,
	}, map[string]any{
		"status":               nextStatus,
		"current_runner_count": nextRunnerCount,
		"updated_at":           time.Now().UTC(),
	})
}

func (s *Service) CancelOtherPendingAssignments(ctx context.Context, questID string, selectedAssignmentID string) (int, error) {
	assignments, err := s.ListQuestAssignments(ctx, questID)
	if err != nil {
		return 0, err
	}

	cancelled := 0
	for _, assignment := range assignments {
		if assignment.ID == selectedAssignmentID {
			continue
		}
		if !strings.EqualFold(assignment.AssignmentStatus, "pending") {
			continue
		}
		if err := s.UpdateQuestAssignmentCandidate(ctx, assignment.ID, "cancelled"); err != nil {
			return cancelled, err
		}
		cancelled++
	}
	return cancelled, nil
}

func (s *Service) UpdateQuestAfterAudit(ctx context.Context, questID string, nextStatus string) error {
	return s.client.Update(ctx, "quests", map[string]string{
		"id": questID,
	}, map[string]any{
		"status":     nextStatus,
		"updated_at": time.Now().UTC(),
	})
}

func (s *Service) FindQuestEscrowByQuestID(ctx context.Context, questID string) (*escrowRecord, error) {
	row, err := s.client.SelectFirst(ctx, "quest_escrows", "quest_id,escrow_state,total_amount", map[string]string{
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
		TotalAmount: config.NormalizeString(row["total_amount"]),
	}, nil
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

func (s *Service) FindDisputeByAssignmentID(ctx context.Context, assignmentID string) (map[string]any, error) {
	return s.client.SelectFirst(ctx, "dispute_cases", "id,assignment_id", map[string]string{
		"assignment_id": assignmentID,
	})
}

func (s *Service) CreateDisputeCaseFromAssignment(ctx context.Context, quest *questRecord, assignment *questAssignmentRecord, escrow *escrowRecord, raisedByAuthUserID string, reason string) (string, error) {
	now := time.Now().UTC()
	disputeID := uuid.NewString()

	if err := s.client.Insert(ctx, "dispute_cases", map[string]any{
		"id":                     disputeID,
		"quest_id":               quest.ID,
		"assignment_id":          assignment.ID,
		"giver_auth_user_id":     quest.GiverAuthUserID,
		"runner_auth_user_id":    assignment.RunnerAuthUserID,
		"raised_by":              "giver",
		"raised_by_auth_user_id": raisedByAuthUserID,
		"reason":                 nullIfEmpty(reason),
		"status":                 "evidence_submission",
		"escrow_amount":          parseOrZeroFloat(escrow.TotalAmount),
		"evidence_deadline_at":   now.Add(24 * time.Hour),
		"created_at":             now,
		"updated_at":             now,
	}); err != nil {
		return "", err
	}

	if err := s.client.Insert(ctx, "dispute_events", map[string]any{
		"id":          uuid.NewString(),
		"dispute_id":  disputeID,
		"actor_party": "giver",
		"status":      "evidence_submission",
		"description": buildDisputeCreateDescription(quest.Title, reason),
		"event_time":  now,
		"created_at":  now,
		"updated_at":  now,
	}); err != nil {
		return "", err
	}

	return disputeID, nil
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
		var out []string
		if err := json.Unmarshal([]byte(trimmed), &out); err == nil {
			return out
		}
		return []string{trimmed}
	default:
		return []string{}
	}
}

func nullIfEmpty(value string) any {
	trimmed := strings.TrimSpace(value)
	if trimmed == "" {
		return nil
	}
	return trimmed
}

func parseOrZeroFloat(value string) float64 {
	trimmed := strings.TrimSpace(strings.ReplaceAll(value, ",", ""))
	if trimmed == "" {
		return 0
	}
	parsed, err := json.Number(trimmed).Float64()
	if err != nil {
		return 0
	}
	return parsed
}

func buildDisputeCreateDescription(questTitle string, reason string) string {
	if strings.TrimSpace(reason) == "" {
		return "Giver membuka dispute untuk quest " + questTitle + "."
	}
	return "Giver membuka dispute: " + reason
}
