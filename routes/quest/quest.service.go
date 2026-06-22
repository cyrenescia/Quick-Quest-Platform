package quest

import (
	"context"
	"encoding/json"
	"strings"
	"time"

	"Stream-StrictMode/config"
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

type giverSummaryRecord struct {
	AuthUserID string
	Fullname   string
	Username   string
	Phone      string
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

const questSelectColumns = "id,giver_auth_user_id,title,description,category,skill_tags,mode,status,reward_amount,reward_currency,quest_tier,tier_score,tier_status,province,city,district,sub_district,full_address,postal_code,lat,lng,max_runner,current_runner_count,starts_at,ends_at,published_at,created_at,updated_at"

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

func (s *Service) ListOpenQuests(ctx context.Context) ([]questRecord, error) {
	rows, err := s.client.SelectMany(
		ctx,
		"quests",
		questSelectColumns,
		map[string]string{"status": "open"},
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

func (s *Service) FindQuestByID(ctx context.Context, questID string) (*questRecord, error) {
	row, err := s.client.SelectFirst(
		ctx,
		"quests",
		questSelectColumns,
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

func (s *Service) FindGiverSummary(ctx context.Context, authUserID string) (*giverSummaryRecord, error) {
	row, err := s.client.SelectFirst(ctx, "user_identification", "auth_user_id,fullname,username,phone", map[string]string{
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
		Phone:      config.NormalizeString(row["phone"]),
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
