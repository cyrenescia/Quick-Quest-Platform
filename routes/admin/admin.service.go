package admin

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
	AuthUserID    string
	Username      string
	Email         string
	Phone         string
	Authorization string
}

type userRecord struct {
	AuthUserID    string
	Fullname      string
	Username      string
	Email         string
	Phone         string
	UserRole      string
	Authorization string
}

type verificationProfileRecord struct {
	ID                    string
	AuthUserID            string
	FullLegalName         string
	NIK                   string
	BirthPlace            string
	BirthDate             *time.Time
	Gender                string
	Occupation            string
	Province              string
	City                  string
	District              string
	SubDistrict           string
	PostalCode            string
	FullAddress           string
	DomicileSameAsKTP     bool
	VerificationStatus    string
	VerificationStage     string
	RiskScore             string
	RiskFlags             []string
	SubmittedAt           *time.Time
	ReviewedAt            *time.Time
	ApprovedAt            *time.Time
	RejectedAt            *time.Time
	RejectionReasonCode   string
	RejectionReasonDetail string
	NeedsResubmission     bool
	CreatedAt             *time.Time
	UpdatedAt             *time.Time
}

type verificationDocumentRecord struct {
	ID               string
	VerificationID   string
	DocumentType     string
	FileKey          string
	FileURL          string
	MimeType         string
	FileSize         string
	ValidationStatus string
	UploadedAt       *time.Time
}

type verificationReviewRecord struct {
	ID                   string
	VerificationID       string
	ReviewType           string
	ReviewResult         string
	ReviewerID           string
	ReviewerRole         string
	ReviewNotes          string
	DecisionReasonCode   string
	DecisionReasonDetail string
	CreatedAt            *time.Time
}

type verificationDecisionPayload struct {
	ReviewResult         string
	NextStatus           string
	NextStage            string
	ReviewerRole         string
	ReviewNotes          string
	DecisionReasonCode   string
	DecisionReasonDetail string
	NeedsResubmission    bool
}

type adminQuestRecord struct {
	ID     string
	Title  string
	Status string
}

type adminAssignmentRecord struct {
	ID               string
	QuestID          string
	RunnerAuthUserID string
	AssignmentStatus string
	FinishedAt       *time.Time
}

type adminEscrowRecord struct {
	QuestID      string
	EscrowState  string
	TotalAmount  string
	RewardAmount string
}

type adminDisputeCaseRecord struct {
	ID                     string
	QuestID                string
	AssignmentID           string
	GiverAuthUserID        string
	RunnerAuthUserID       string
	RaisedBy               string
	RaisedByAuthUserID     string
	Reason                 string
	Status                 string
	EscrowAmount           string
	GiverSettlementAmount  string
	RunnerSettlementAmount string
	MediationFeeAmount     string
	EvidenceDeadlineAt     *time.Time
	MediatorNote           string
	ResolvedAt             *time.Time
	CreatedAt              *time.Time
	UpdatedAt              *time.Time
}

type adminDisputeEvidenceRecord struct {
	ID            string
	DisputeID     string
	UploaderParty string
	EvidenceType  string
	Label         string
	NoteText      string
	FileName      string
	FileURL       string
	Metadata      map[string]any
	UploadedAt    *time.Time
}

type adminDisputeEventRecord struct {
	ID          string
	DisputeID   string
	ActorParty  string
	Status      string
	Description string
	EventTime   *time.Time
}

type adminDisputeMediationPayload struct {
	DisputeID              string
	NextStatus             string
	MediatorNote           string
	GiverSettlementAmount  float64
	RunnerSettlementAmount float64
	MediationFeeAmount     float64
}

type adminAutoReleaseResult struct {
	AssignmentID  string
	QuestID       string
	QuestTitle    string
	RunnerAuthID  string
	FinishedAt    *time.Time
	AutoReleaseAt *time.Time
	Released      bool
	SkippedReason string
}

func NewService(client *config.SupabaseClient, cfg config.AppConfig) *Service {
	return &Service{
		client: client,
		cfg:    cfg,
	}
}

func (s *Service) FindAuthBySessionToken(ctx context.Context, token string) (*authSessionRecord, error) {
	row, err := s.client.SelectFirst(ctx, "authentication", "auth_user_id,username,email,phone,authorization", map[string]string{
		"auth_token": token,
	})
	if err != nil {
		return nil, err
	}
	if row == nil {
		return nil, nil
	}

	return &authSessionRecord{
		AuthUserID:    config.NormalizeString(row["auth_user_id"]),
		Username:      config.NormalizeString(row["username"]),
		Email:         config.NormalizeString(row["email"]),
		Phone:         config.NormalizeString(row["phone"]),
		Authorization: config.NormalizeString(row["authorization"]),
	}, nil
}

func (s *Service) ListVerificationProfiles(ctx context.Context) ([]verificationProfileRecord, error) {
	rows, err := s.client.SelectMany(
		ctx,
		"user_verification_profiles",
		"id,auth_user_id,full_legal_name,nik,birth_place,birth_date,gender,occupation,province,city,district,sub_district,postal_code,full_address,domicile_same_as_ktp,verification_status,verification_stage,risk_score,risk_flags,submitted_at,reviewed_at,approved_at,rejected_at,rejection_reason_code,rejection_reason_detail,needs_resubmission,created_at,updated_at",
		map[string]string{},
		&config.SelectOptions{OrderBy: "updated_at", Desc: true, Limit: 100},
	)
	if err != nil {
		return nil, err
	}

	items := make([]verificationProfileRecord, 0, len(rows))
	for _, row := range rows {
		items = append(items, mapVerificationProfile(row))
	}
	return items, nil
}

func (s *Service) ListDisputeCases(ctx context.Context) ([]adminDisputeCaseRecord, error) {
	rows, err := s.client.SelectMany(
		ctx,
		"dispute_cases",
		"id,quest_id,assignment_id,giver_auth_user_id,runner_auth_user_id,raised_by,raised_by_auth_user_id,reason,status,escrow_amount,giver_settlement_amount,runner_settlement_amount,mediation_fee_amount,evidence_deadline_at,mediator_note,resolved_at,created_at,updated_at",
		map[string]string{},
		&config.SelectOptions{OrderBy: "created_at", Desc: true, Limit: 200},
	)
	if err != nil {
		return nil, err
	}

	items := make([]adminDisputeCaseRecord, 0, len(rows))
	for _, row := range rows {
		items = append(items, mapAdminDisputeCaseRecord(row))
	}
	return items, nil
}

func (s *Service) FindDisputeCaseByID(ctx context.Context, disputeID string) (*adminDisputeCaseRecord, error) {
	row, err := s.client.SelectFirst(
		ctx,
		"dispute_cases",
		"id,quest_id,assignment_id,giver_auth_user_id,runner_auth_user_id,raised_by,raised_by_auth_user_id,reason,status,escrow_amount,giver_settlement_amount,runner_settlement_amount,mediation_fee_amount,evidence_deadline_at,mediator_note,resolved_at,created_at,updated_at",
		map[string]string{"id": disputeID},
	)
	if err != nil {
		return nil, err
	}
	if row == nil {
		return nil, nil
	}
	record := mapAdminDisputeCaseRecord(row)
	return &record, nil
}

func (s *Service) FindQuestByID(ctx context.Context, questID string) (*adminQuestRecord, error) {
	row, err := s.client.SelectFirst(ctx, "quests", "id,title,status", map[string]string{
		"id": questID,
	})
	if err != nil {
		return nil, err
	}
	if row == nil {
		return nil, nil
	}
	return &adminQuestRecord{
		ID:     config.NormalizeString(row["id"]),
		Title:  config.NormalizeString(row["title"]),
		Status: config.NormalizeString(row["status"]),
	}, nil
}

func (s *Service) FindQuestEscrowByQuestID(ctx context.Context, questID string) (*adminEscrowRecord, error) {
	row, err := s.client.SelectFirst(ctx, "quest_escrows", "quest_id,escrow_state,total_amount,reward_amount", map[string]string{
		"quest_id": questID,
	})
	if err != nil {
		return nil, err
	}
	if row == nil {
		return nil, nil
	}
	return &adminEscrowRecord{
		QuestID:      config.NormalizeString(row["quest_id"]),
		EscrowState:  config.NormalizeString(row["escrow_state"]),
		TotalAmount:  config.NormalizeString(row["total_amount"]),
		RewardAmount: config.NormalizeString(row["reward_amount"]),
	}, nil
}

func (s *Service) ListFinishedAssignments(ctx context.Context) ([]adminAssignmentRecord, error) {
	rows, err := s.client.SelectMany(
		ctx,
		"quest_assignments",
		"id,quest_id,runner_auth_user_id,assignment_status,finished_at",
		map[string]string{"assignment_status": "finished"},
		&config.SelectOptions{OrderBy: "finished_at", Desc: false, Limit: 300},
	)
	if err != nil {
		return nil, err
	}

	items := make([]adminAssignmentRecord, 0, len(rows))
	for _, row := range rows {
		items = append(items, adminAssignmentRecord{
			ID:               config.NormalizeString(row["id"]),
			QuestID:          config.NormalizeString(row["quest_id"]),
			RunnerAuthUserID: config.NormalizeString(row["runner_auth_user_id"]),
			AssignmentStatus: config.NormalizeString(row["assignment_status"]),
			FinishedAt:       parseOptionalTime(row["finished_at"]),
		})
	}
	return items, nil
}

func (s *Service) ListDisputeEvidences(ctx context.Context, disputeID string) ([]adminDisputeEvidenceRecord, error) {
	rows, err := s.client.SelectMany(
		ctx,
		"dispute_evidences",
		"id,dispute_id,uploader_party,evidence_type,label,note_text,file_name,file_url,metadata,uploaded_at",
		map[string]string{"dispute_id": disputeID},
		&config.SelectOptions{OrderBy: "uploaded_at", Desc: false, Limit: 200},
	)
	if err != nil {
		return nil, err
	}

	items := make([]adminDisputeEvidenceRecord, 0, len(rows))
	for _, row := range rows {
		items = append(items, adminDisputeEvidenceRecord{
			ID:            config.NormalizeString(row["id"]),
			DisputeID:     config.NormalizeString(row["dispute_id"]),
			UploaderParty: config.NormalizeString(row["uploader_party"]),
			EvidenceType:  config.NormalizeString(row["evidence_type"]),
			Label:         config.NormalizeString(row["label"]),
			NoteText:      config.NormalizeString(row["note_text"]),
			FileName:      config.NormalizeString(row["file_name"]),
			FileURL:       config.NormalizeString(row["file_url"]),
			Metadata:      parseObject(row["metadata"]),
			UploadedAt:    parseOptionalTime(row["uploaded_at"]),
		})
	}
	return items, nil
}

func (s *Service) ListDisputeEvents(ctx context.Context, disputeID string) ([]adminDisputeEventRecord, error) {
	rows, err := s.client.SelectMany(
		ctx,
		"dispute_events",
		"id,dispute_id,actor_party,status,description,event_time",
		map[string]string{"dispute_id": disputeID},
		&config.SelectOptions{OrderBy: "event_time", Desc: false, Limit: 200},
	)
	if err != nil {
		return nil, err
	}

	items := make([]adminDisputeEventRecord, 0, len(rows))
	for _, row := range rows {
		items = append(items, adminDisputeEventRecord{
			ID:          config.NormalizeString(row["id"]),
			DisputeID:   config.NormalizeString(row["dispute_id"]),
			ActorParty:  config.NormalizeString(row["actor_party"]),
			Status:      config.NormalizeString(row["status"]),
			Description: config.NormalizeString(row["description"]),
			EventTime:   parseOptionalTime(row["event_time"]),
		})
	}
	return items, nil
}

func (s *Service) FindVerificationProfileByID(ctx context.Context, verificationID string) (*verificationProfileRecord, error) {
	row, err := s.client.SelectFirst(ctx, "user_verification_profiles", "id,auth_user_id,full_legal_name,nik,birth_place,birth_date,gender,occupation,province,city,district,sub_district,postal_code,full_address,domicile_same_as_ktp,verification_status,verification_stage,risk_score,risk_flags,submitted_at,reviewed_at,approved_at,rejected_at,rejection_reason_code,rejection_reason_detail,needs_resubmission,created_at,updated_at", map[string]string{
		"id": verificationID,
	})
	if err != nil {
		return nil, err
	}
	if row == nil {
		return nil, nil
	}

	record := mapVerificationProfile(row)
	return &record, nil
}

func (s *Service) FindUserByAuthUserID(ctx context.Context, authUserID string) (*userRecord, error) {
	row, err := s.client.SelectFirst(ctx, "user_identification", "auth_user_id,fullname,username,email,phone,user_role,authorization", map[string]string{
		"auth_user_id": authUserID,
	})
	if err != nil {
		return nil, err
	}
	if row == nil {
		return nil, nil
	}

	return &userRecord{
		AuthUserID:    config.NormalizeString(row["auth_user_id"]),
		Fullname:      config.NormalizeString(row["fullname"]),
		Username:      config.NormalizeString(row["username"]),
		Email:         config.NormalizeString(row["email"]),
		Phone:         config.NormalizeString(row["phone"]),
		UserRole:      config.NormalizeString(row["user_role"]),
		Authorization: config.NormalizeString(row["authorization"]),
	}, nil
}

func (s *Service) ListVerificationDocuments(ctx context.Context, verificationID string) ([]verificationDocumentRecord, error) {
	rows, err := s.client.SelectMany(ctx, "user_verification_documents", "id,verification_profile_id,document_type,file_key,file_url,mime_type,file_size,validation_status,uploaded_at", map[string]string{
		"verification_profile_id": verificationID,
	}, &config.SelectOptions{OrderBy: "created_at", Desc: false, Limit: 50})
	if err != nil {
		return nil, err
	}

	documents := make([]verificationDocumentRecord, 0, len(rows))
	for _, row := range rows {
		documents = append(documents, verificationDocumentRecord{
			ID:               config.NormalizeString(row["id"]),
			VerificationID:   config.NormalizeString(row["verification_profile_id"]),
			DocumentType:     config.NormalizeString(row["document_type"]),
			FileKey:          config.NormalizeString(row["file_key"]),
			FileURL:          config.NormalizeString(row["file_url"]),
			MimeType:         config.NormalizeString(row["mime_type"]),
			FileSize:         config.NormalizeString(row["file_size"]),
			ValidationStatus: config.NormalizeString(row["validation_status"]),
			UploadedAt:       parseOptionalTime(row["uploaded_at"]),
		})
	}

	return documents, nil
}

func (s *Service) ListVerificationReviews(ctx context.Context, verificationID string) ([]verificationReviewRecord, error) {
	rows, err := s.client.SelectMany(ctx, "user_verification_reviews", "id,verification_profile_id,review_type,review_result,reviewer_id,reviewer_role,review_notes,decision_reason_code,decision_reason_detail,created_at", map[string]string{
		"verification_profile_id": verificationID,
	}, &config.SelectOptions{OrderBy: "created_at", Desc: true, Limit: 20})
	if err != nil {
		return nil, err
	}

	reviews := make([]verificationReviewRecord, 0, len(rows))
	for _, row := range rows {
		reviews = append(reviews, verificationReviewRecord{
			ID:                   config.NormalizeString(row["id"]),
			VerificationID:       config.NormalizeString(row["verification_profile_id"]),
			ReviewType:           config.NormalizeString(row["review_type"]),
			ReviewResult:         config.NormalizeString(row["review_result"]),
			ReviewerID:           config.NormalizeString(row["reviewer_id"]),
			ReviewerRole:         config.NormalizeString(row["reviewer_role"]),
			ReviewNotes:          config.NormalizeString(row["review_notes"]),
			DecisionReasonCode:   config.NormalizeString(row["decision_reason_code"]),
			DecisionReasonDetail: config.NormalizeString(row["decision_reason_detail"]),
			CreatedAt:            parseOptionalTime(row["created_at"]),
		})
	}

	return reviews, nil
}

func (s *Service) ApplyVerificationDecision(ctx context.Context, record *verificationProfileRecord, adminRecord *authSessionRecord, payload verificationDecisionPayload) error {
	if record == nil || adminRecord == nil {
		return nil
	}

	now := time.Now().UTC()
	updates := map[string]any{
		"verification_status":     payload.NextStatus,
		"verification_stage":      payload.NextStage,
		"reviewed_at":             now,
		"needs_resubmission":      payload.NeedsResubmission,
		"rejection_reason_code":   nullIfEmpty(payload.DecisionReasonCode),
		"rejection_reason_detail": nullIfEmpty(payload.DecisionReasonDetail),
		"updated_at":              now,
	}

	switch payload.NextStatus {
	case "approved":
		updates["approved_at"] = now
		updates["rejected_at"] = nil
	case "rejected", "resubmission_required":
		updates["approved_at"] = nil
		updates["rejected_at"] = now
	default:
		updates["approved_at"] = nil
	}

	if err := s.client.Update(ctx, "user_verification_profiles", map[string]string{
		"id": record.ID,
	}, updates); err != nil {
		return err
	}

	if err := s.client.Insert(ctx, "user_verification_reviews", map[string]any{
		"id":                      uuid.NewString(),
		"verification_profile_id": record.ID,
		"review_type":             "manual_admin",
		"review_result":           payload.ReviewResult,
		"reviewer_id":             adminRecord.AuthUserID,
		"reviewer_role":           payload.ReviewerRole,
		"review_notes":            nullIfEmpty(payload.ReviewNotes),
		"decision_reason_code":    nullIfEmpty(payload.DecisionReasonCode),
		"decision_reason_detail":  nullIfEmpty(payload.DecisionReasonDetail),
		"created_at":              now,
	}); err != nil {
		return err
	}

	return s.client.Insert(ctx, "user_verification_events", map[string]any{
		"id":                      uuid.NewString(),
		"verification_profile_id": record.ID,
		"previous_status":         nullIfEmpty(record.VerificationStatus),
		"new_status":              payload.NextStatus,
		"actor_id":                adminRecord.AuthUserID,
		"actor_type":              "admin",
		"notes":                   buildDecisionEventNote(payload),
		"created_at":              now,
	})
}

func (s *Service) UpdateDisputeCaseForMediation(ctx context.Context, payload adminDisputeMediationPayload) error {
	now := time.Now().UTC()
	return s.client.Update(ctx, "dispute_cases", map[string]string{
		"id": payload.DisputeID,
	}, map[string]any{
		"status":                   payload.NextStatus,
		"mediator_note":            nullIfEmpty(payload.MediatorNote),
		"giver_settlement_amount":  payload.GiverSettlementAmount,
		"runner_settlement_amount": payload.RunnerSettlementAmount,
		"mediation_fee_amount":     payload.MediationFeeAmount,
		"resolved_at":              now,
		"updated_at":               now,
	})
}

func (s *Service) UpdateQuestStatus(ctx context.Context, questID string, nextStatus string) error {
	return s.client.Update(ctx, "quests", map[string]string{
		"id": questID,
	}, map[string]any{
		"status":     nextStatus,
		"updated_at": time.Now().UTC(),
	})
}

func (s *Service) TouchQuestAssignment(ctx context.Context, assignmentID string) error {
	return s.client.Update(ctx, "quest_assignments", map[string]string{
		"id": assignmentID,
	}, map[string]any{
		"updated_at": time.Now().UTC(),
	})
}

func (s *Service) UpdateQuestAssignmentStatus(ctx context.Context, assignmentID string, nextStatus string) error {
	return s.client.Update(ctx, "quest_assignments", map[string]string{
		"id": assignmentID,
	}, map[string]any{
		"assignment_status": nextStatus,
		"updated_at":        time.Now().UTC(),
	})
}

func (s *Service) UpdateQuestEscrowState(ctx context.Context, questID string, nextState string, timestampField string) error {
	now := time.Now().UTC()
	payload := map[string]any{
		"escrow_state": nextState,
		"updated_at":   now,
	}
	if timestampField != "" {
		payload[timestampField] = now
	}
	return s.client.Update(ctx, "quest_escrows", map[string]string{
		"quest_id": questID,
	}, payload)
}

func (s *Service) CreateDisputeEvent(ctx context.Context, disputeID string, actorParty string, status string, description string) error {
	now := time.Now().UTC()
	return s.client.Insert(ctx, "dispute_events", map[string]any{
		"id":          uuid.NewString(),
		"dispute_id":  disputeID,
		"actor_party": actorParty,
		"status":      status,
		"description": description,
		"event_time":  now,
		"created_at":  now,
		"updated_at":  now,
	})
}

func mapAdminDisputeCaseRecord(row map[string]any) adminDisputeCaseRecord {
	return adminDisputeCaseRecord{
		ID:                     config.NormalizeString(row["id"]),
		QuestID:                config.NormalizeString(row["quest_id"]),
		AssignmentID:           config.NormalizeString(row["assignment_id"]),
		GiverAuthUserID:        config.NormalizeString(row["giver_auth_user_id"]),
		RunnerAuthUserID:       config.NormalizeString(row["runner_auth_user_id"]),
		RaisedBy:               config.NormalizeString(row["raised_by"]),
		RaisedByAuthUserID:     config.NormalizeString(row["raised_by_auth_user_id"]),
		Reason:                 config.NormalizeString(row["reason"]),
		Status:                 config.NormalizeString(row["status"]),
		EscrowAmount:           config.NormalizeString(row["escrow_amount"]),
		GiverSettlementAmount:  config.NormalizeString(row["giver_settlement_amount"]),
		RunnerSettlementAmount: config.NormalizeString(row["runner_settlement_amount"]),
		MediationFeeAmount:     config.NormalizeString(row["mediation_fee_amount"]),
		EvidenceDeadlineAt:     parseOptionalTime(row["evidence_deadline_at"]),
		MediatorNote:           config.NormalizeString(row["mediator_note"]),
		ResolvedAt:             parseOptionalTime(row["resolved_at"]),
		CreatedAt:              parseOptionalTime(row["created_at"]),
		UpdatedAt:              parseOptionalTime(row["updated_at"]),
	}
}

func mapVerificationProfile(row map[string]any) verificationProfileRecord {
	return verificationProfileRecord{
		ID:                    config.NormalizeString(row["id"]),
		AuthUserID:            config.NormalizeString(row["auth_user_id"]),
		FullLegalName:         config.NormalizeString(row["full_legal_name"]),
		NIK:                   config.NormalizeString(row["nik"]),
		BirthPlace:            config.NormalizeString(row["birth_place"]),
		BirthDate:             parseOptionalTime(row["birth_date"]),
		Gender:                config.NormalizeString(row["gender"]),
		Occupation:            config.NormalizeString(row["occupation"]),
		Province:              config.NormalizeString(row["province"]),
		City:                  config.NormalizeString(row["city"]),
		District:              config.NormalizeString(row["district"]),
		SubDistrict:           config.NormalizeString(row["sub_district"]),
		PostalCode:            config.NormalizeString(row["postal_code"]),
		FullAddress:           config.NormalizeString(row["full_address"]),
		DomicileSameAsKTP:     parseBool(row["domicile_same_as_ktp"]),
		VerificationStatus:    config.NormalizeString(row["verification_status"]),
		VerificationStage:     config.NormalizeString(row["verification_stage"]),
		RiskScore:             config.NormalizeString(row["risk_score"]),
		RiskFlags:             parseStringArray(row["risk_flags"]),
		SubmittedAt:           parseOptionalTime(row["submitted_at"]),
		ReviewedAt:            parseOptionalTime(row["reviewed_at"]),
		ApprovedAt:            parseOptionalTime(row["approved_at"]),
		RejectedAt:            parseOptionalTime(row["rejected_at"]),
		RejectionReasonCode:   config.NormalizeString(row["rejection_reason_code"]),
		RejectionReasonDetail: config.NormalizeString(row["rejection_reason_detail"]),
		NeedsResubmission:     parseBool(row["needs_resubmission"]),
		CreatedAt:             parseOptionalTime(row["created_at"]),
		UpdatedAt:             parseOptionalTime(row["updated_at"]),
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

func parseBool(value any) bool {
	switch typed := value.(type) {
	case bool:
		return typed
	case string:
		normalized := strings.ToLower(strings.TrimSpace(typed))
		return normalized == "true" || normalized == "1"
	default:
		return strings.EqualFold(config.NormalizeString(value), "true")
	}
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

func parseObject(value any) map[string]any {
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
		if err := json.Unmarshal([]byte(trimmed), &out); err == nil {
			return out
		}
	}
	return map[string]any{}
}

func nullIfEmpty(value string) any {
	trimmed := strings.TrimSpace(value)
	if trimmed == "" {
		return nil
	}
	return trimmed
}

func buildDecisionEventNote(payload verificationDecisionPayload) string {
	base := "Admin verification decision: " + payload.ReviewResult
	if strings.TrimSpace(payload.ReviewNotes) == "" {
		return base
	}
	return base + " - " + strings.TrimSpace(payload.ReviewNotes)
}
