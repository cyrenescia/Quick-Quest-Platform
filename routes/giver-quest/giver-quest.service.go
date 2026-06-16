package giverquest

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

type userRoleRecord struct {
	AuthUserID string
	UserRole   string
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

type escrowRecord struct {
	ID                string
	QuestID           string
	GiverAuthUserID   string
	EscrowState       string
	RewardAmount      string
	PlatformFeeAmount string
	TotalAmount       string
	PaymentMethod     string
	PaymentReference  string
	PaidAt            *time.Time
	LockedAt          *time.Time
	ReleasedAt        *time.Time
	DisputedAt        *time.Time
	RefundedAt        *time.Time
	CreatedAt         *time.Time
	UpdatedAt         *time.Time
}

type questAssignmentRatingRecord struct {
	ID               string
	AssignmentStatus string
}

type ratingStateRecord struct {
	RatingCount       int
	UniqueRatingCount int
	GiverRated        bool
	RunnerRated       bool
	ViewerHasRated    bool
	BothRated         bool
}

type questRatingStateRecord struct {
	RatingCount          int
	UniqueRatingCount    int
	AssignmentsTotal     int
	AssignmentsBothRated int
	GiverRated           bool
	RunnerRated          bool
	ViewerHasRated       bool
	BothRated            bool
}

type createQuestPayload struct {
	Title          string
	Description    string
	Category       string
	SkillTags      []string
	Mode           string
	Status         string
	RewardAmount   float64
	RewardCurrency string
	Province       string
	City           string
	District       string
	SubDistrict    string
	FullAddress    string
	PostalCode     string
	Lat            *float64
	Lng            *float64
	MaxRunner      int
	StartsAt       *time.Time
	EndsAt         *time.Time
}

const platformFeePercent = 5

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

func (s *Service) GetUserRole(ctx context.Context, authUserID string) (*userRoleRecord, error) {
	row, err := s.client.SelectFirst(ctx, "user_identification", "auth_user_id,user_role", map[string]string{
		"auth_user_id": authUserID,
	})
	if err != nil {
		return nil, err
	}
	if row == nil {
		return nil, nil
	}

	return &userRoleRecord{
		AuthUserID: config.NormalizeString(row["auth_user_id"]),
		UserRole:   config.NormalizeUserRole(config.NormalizeString(row["user_role"])),
	}, nil
}

func (s *Service) FindQuestByID(ctx context.Context, questID string) (*questRecord, error) {
	row, err := s.client.SelectFirst(
		ctx,
		"quests",
		"id,giver_auth_user_id,title,description,category,skill_tags,mode,status,reward_amount,reward_currency,province,city,district,sub_district,full_address,postal_code,lat,lng,max_runner,current_runner_count,starts_at,ends_at,published_at,created_at,updated_at",
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

func (s *Service) CreateQuestDraft(ctx context.Context, authRecord *authSessionRecord, payload createQuestPayload) (string, error) {
	questID := uuid.NewString()
	now := time.Now().UTC()
	rewardAmount := roundCurrency(payload.RewardAmount * float64(payload.MaxRunner))
	platformFeeAmount := roundCurrency(rewardAmount * float64(platformFeePercent) / 100)
	totalAmount := roundCurrency(rewardAmount + platformFeeAmount)
	insertPayload := map[string]any{
		"id":                   questID,
		"giver_auth_user_id":   authRecord.AuthUserID,
		"title":                payload.Title,
		"description":          payload.Description,
		"category":             nullIfEmpty(payload.Category),
		"skill_tags":           payload.SkillTags,
		"mode":                 payload.Mode,
		"status":               "draft",
		"reward_amount":        payload.RewardAmount,
		"reward_currency":      firstNonEmpty(payload.RewardCurrency, "IDR"),
		"province":             nullIfEmpty(payload.Province),
		"city":                 nullIfEmpty(payload.City),
		"district":             nullIfEmpty(payload.District),
		"sub_district":         nullIfEmpty(payload.SubDistrict),
		"full_address":         nullIfEmpty(payload.FullAddress),
		"postal_code":          nullIfEmpty(payload.PostalCode),
		"lat":                  optionalFloat64Value(payload.Lat),
		"lng":                  optionalFloat64Value(payload.Lng),
		"max_runner":           payload.MaxRunner,
		"current_runner_count": 0,
		"starts_at":            optionalTimeValue(payload.StartsAt),
		"ends_at":              optionalTimeValue(payload.EndsAt),
		"created_at":           now,
		"updated_at":           now,
	}

	if err := s.client.Insert(ctx, "quests", insertPayload); err != nil {
		return "", err
	}

	escrowPayload := map[string]any{
		"quest_id":            questID,
		"giver_auth_user_id":  authRecord.AuthUserID,
		"escrow_state":        "unpaid",
		"reward_amount":       rewardAmount,
		"platform_fee_amount": platformFeeAmount,
		"total_amount":        totalAmount,
		"created_at":          now,
		"updated_at":          now,
	}

	if err := s.client.Insert(ctx, "quest_escrows", escrowPayload); err != nil {
		_ = s.client.Delete(ctx, "quests", map[string]string{"id": questID})
		return "", err
	}

	return questID, nil
}

func (s *Service) UpdateQuestDraft(ctx context.Context, questID string, payload createQuestPayload) error {
	now := time.Now().UTC()
	updatePayload := map[string]any{
		"title":           payload.Title,
		"description":     payload.Description,
		"category":        nullIfEmpty(payload.Category),
		"skill_tags":      payload.SkillTags,
		"mode":            payload.Mode,
		"reward_amount":   payload.RewardAmount,
		"reward_currency": firstNonEmpty(payload.RewardCurrency, "IDR"),
		"province":        nullIfEmpty(payload.Province),
		"city":            nullIfEmpty(payload.City),
		"district":        nullIfEmpty(payload.District),
		"sub_district":    nullIfEmpty(payload.SubDistrict),
		"full_address":    nullIfEmpty(payload.FullAddress),
		"postal_code":     nullIfEmpty(payload.PostalCode),
		"lat":             optionalFloat64Value(payload.Lat),
		"lng":             optionalFloat64Value(payload.Lng),
		"max_runner":      payload.MaxRunner,
		"starts_at":       optionalTimeValue(payload.StartsAt),
		"ends_at":         optionalTimeValue(payload.EndsAt),
		"updated_at":      now,
	}

	if err := s.client.Update(ctx, "quests", map[string]string{"id": questID}, updatePayload); err != nil {
		return err
	}

	rewardAmount := roundCurrency(payload.RewardAmount * float64(payload.MaxRunner))
	platformFeeAmount := roundCurrency(rewardAmount * float64(platformFeePercent) / 100)
	totalAmount := roundCurrency(rewardAmount + platformFeeAmount)
	return s.client.Update(ctx, "quest_escrows", map[string]string{
		"quest_id": questID,
	}, map[string]any{
		"reward_amount":       rewardAmount,
		"platform_fee_amount": platformFeeAmount,
		"total_amount":        totalAmount,
		"updated_at":          now,
	})
}

func (s *Service) DeleteQuestDraft(ctx context.Context, questID string) error {
	return s.client.Delete(ctx, "quests", map[string]string{"id": questID})
}

func (s *Service) ListGiverQuests(ctx context.Context, authUserID string) ([]questRecord, error) {
	rows, err := s.client.SelectMany(
		ctx,
		"quests",
		"id,giver_auth_user_id,title,description,category,skill_tags,mode,status,reward_amount,reward_currency,province,city,district,sub_district,full_address,postal_code,lat,lng,max_runner,current_runner_count,starts_at,ends_at,published_at,created_at,updated_at",
		map[string]string{"giver_auth_user_id": authUserID},
		&config.SelectOptions{OrderBy: "created_at", Desc: true, Limit: 100},
	)
	if err != nil {
		return nil, err
	}

	quests := make([]questRecord, 0, len(rows))
	for _, row := range rows {
		quests = append(quests, mapQuestRecord(row))
	}
	return quests, nil
}

func (s *Service) FindQuestEscrowByQuestID(ctx context.Context, questID string) (*escrowRecord, error) {
	row, err := s.client.SelectFirst(
		ctx,
		"quest_escrows",
		"id,quest_id,giver_auth_user_id,escrow_state,reward_amount,platform_fee_amount,total_amount,payment_method,payment_reference,paid_at,locked_at,released_at,disputed_at,refunded_at,created_at,updated_at",
		map[string]string{"quest_id": questID},
	)
	if err != nil {
		return nil, err
	}
	if row == nil {
		return nil, nil
	}
	record := mapEscrowRecord(row)
	return &record, nil
}

func (s *Service) ListQuestAssignmentsForRating(ctx context.Context, questID string) ([]questAssignmentRatingRecord, error) {
	rows, err := s.client.SelectMany(
		ctx,
		"quest_assignments",
		"id,assignment_status",
		map[string]string{"quest_id": questID},
		&config.SelectOptions{OrderBy: "created_at", Desc: true, Limit: 100},
	)
	if err != nil {
		return nil, err
	}

	items := make([]questAssignmentRatingRecord, 0, len(rows))
	for _, row := range rows {
		items = append(items, questAssignmentRatingRecord{
			ID:               config.NormalizeString(row["id"]),
			AssignmentStatus: config.NormalizeString(row["assignment_status"]),
		})
	}
	return items, nil
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

func (s *Service) UpdateQuestEscrowLock(ctx context.Context, questID string, paymentMethod string) error {
	now := time.Now().UTC()
	return s.client.Update(ctx, "quest_escrows", map[string]string{
		"quest_id": questID,
	}, map[string]any{
		"escrow_state":      "locked",
		"payment_method":    nullIfEmpty(paymentMethod),
		"payment_reference": "SIM-" + strings.ToUpper(strings.ReplaceAll(questID, "-", ""))[:12],
		"paid_at":           now,
		"locked_at":         now,
		"updated_at":        now,
	})
}

func (s *Service) PublishQuest(ctx context.Context, questID string) error {
	now := time.Now().UTC()
	return s.client.Update(ctx, "quests", map[string]string{
		"id": questID,
	}, map[string]any{
		"status":       "open",
		"published_at": now,
		"updated_at":   now,
	})
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

func mapEscrowRecord(row map[string]any) escrowRecord {
	return escrowRecord{
		ID:                config.NormalizeString(row["id"]),
		QuestID:           config.NormalizeString(row["quest_id"]),
		GiverAuthUserID:   config.NormalizeString(row["giver_auth_user_id"]),
		EscrowState:       config.NormalizeString(row["escrow_state"]),
		RewardAmount:      config.NormalizeString(row["reward_amount"]),
		PlatformFeeAmount: config.NormalizeString(row["platform_fee_amount"]),
		TotalAmount:       config.NormalizeString(row["total_amount"]),
		PaymentMethod:     config.NormalizeString(row["payment_method"]),
		PaymentReference:  config.NormalizeString(row["payment_reference"]),
		PaidAt:            parseOptionalTime(row["paid_at"]),
		LockedAt:          parseOptionalTime(row["locked_at"]),
		ReleasedAt:        parseOptionalTime(row["released_at"]),
		DisputedAt:        parseOptionalTime(row["disputed_at"]),
		RefundedAt:        parseOptionalTime(row["refunded_at"]),
		CreatedAt:         parseOptionalTime(row["created_at"]),
		UpdatedAt:         parseOptionalTime(row["updated_at"]),
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

		var arr []string
		if err := json.Unmarshal([]byte(trimmed), &arr); err == nil {
			return arr
		}

		return []string{trimmed}
	default:
		return []string{}
	}
}

func optionalTimeValue(value *time.Time) any {
	if value == nil || value.IsZero() {
		return nil
	}
	return value.UTC()
}

func optionalFloat64Value(value *float64) any {
	if value == nil {
		return nil
	}
	return *value
}

func nullIfEmpty(value string) any {
	trimmed := strings.TrimSpace(value)
	if trimmed == "" {
		return nil
	}
	return trimmed
}

func firstNonEmpty(values ...string) string {
	for _, value := range values {
		if strings.TrimSpace(value) != "" {
			return strings.TrimSpace(value)
		}
	}
	return ""
}

func roundCurrency(value float64) float64 {
	return float64(int(value*100+0.5)) / 100
}
