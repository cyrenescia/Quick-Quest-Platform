package runnertier

import (
	"context"
	"encoding/json"
	"errors"
	"math"
	"sort"
	"strconv"
	"strings"
	"time"

	"Stream-StrictMode/config"
	questclassification "Stream-StrictMode/routes/quest-classification"
)

const (
	DefaultQ2MinPP         = 500.0
	DefaultQ3MinPP         = 2000.0
	DefaultQ3MinSR         = 6.0
	DefaultRiskLowMax      = 30
	DefaultRiskModerateMax = 60

	RiskBandLow      = "low"
	RiskBandModerate = "moderate"
	RiskBandHigh     = "high"
)

type Service struct {
	client *config.SupabaseClient
	cfg    config.AppConfig
}

type ProgressionThresholds struct {
	Q2MinPP         float64 `json:"q2_min_pp"`
	Q3MinPP         float64 `json:"q3_min_pp"`
	Q3MinSR         float64 `json:"q3_min_sr"`
	RiskLowMax      int     `json:"risk_low_max"`
	RiskModerateMax int     `json:"risk_moderate_max"`
}

type TierStatus struct {
	AuthUserID                string                `json:"auth_user_id"`
	RunnerTier                string                `json:"runner_tier"`
	RunnerPP                  float64               `json:"runner_pp"`
	RunnerSR                  float64               `json:"runner_sr"`
	RunnerRiskScore           int                   `json:"runner_risk_score"`
	RiskBand                  string                `json:"risk_band"`
	IdentityApproved          bool                  `json:"identity_approved"`
	VerificationStatus        string                `json:"verification_status"`
	EligibleTier              string                `json:"eligible_tier"`
	NextTier                  string                `json:"next_tier"`
	CanUpgradeQ2              bool                  `json:"can_upgrade_q2"`
	CanUpgradeQ3              bool                  `json:"can_upgrade_q3"`
	BlockedReason             string                `json:"blocked_reason"`
	RequiredStableQuestCount  int                   `json:"required_stable_quest_count"`
	TotalRunnerRatings        int                   `json:"total_runner_ratings"`
	TotalRunnerAssignments    int                   `json:"total_runner_assignments"`
	CompletedRunnerAssignment int                   `json:"completed_runner_assignments"`
	Thresholds                ProgressionThresholds `json:"thresholds"`
}

type ProgressionResult struct {
	AuthUserID      string      `json:"auth_user_id"`
	PreviousTier    string      `json:"previous_tier"`
	CurrentTier     string      `json:"current_tier"`
	TierChanged     bool        `json:"tier_changed"`
	PPDeltaApplied  float64     `json:"pp_delta_applied"`
	ProgressionNote string      `json:"progression_note"`
	Status          *TierStatus `json:"status"`
}

type RatingSnapshot struct {
	Score     float64
	CreatedAt *time.Time
}

type AssignmentSnapshot struct {
	Status    string
	CreatedAt *time.Time
}

type LedgerSnapshot struct {
	PPDelta    float64
	SkillScope string
	RaterRole  string
	CreatedAt  *time.Time
}

type RiskInput struct {
	Assignments      []AssignmentSnapshot
	Ratings          []RatingSnapshot
	Ledgers          []LedgerSnapshot
	VerificationRisk float64
	AccountCreatedAt *time.Time
	Now              time.Time
	Thresholds       ProgressionThresholds
}

type RiskAssessment struct {
	Score                    int
	Band                     string
	RequiredStableQuestCount int
}

type ProgressionDecisionInput struct {
	AuthUserID         string
	CurrentTier        string
	RunnerPP           float64
	RunnerSR           float64
	Risk               RiskAssessment
	IdentityApproved   bool
	VerificationStatus string
	TotalRatings       int
	TotalAssignments   int
	Completed          int
	Thresholds         ProgressionThresholds
}

type runnerProfileRecord struct {
	AuthUserID       string
	RunnerTier       string
	RunnerPP         float64
	RunnerSR         float64
	RunnerRiskScore  int
	AccountCreatedAt *time.Time
}

type verificationRecord struct {
	Status    string
	RiskScore float64
}

func NewService(client *config.SupabaseClient, cfg config.AppConfig) *Service {
	return &Service{
		client: client,
		cfg:    cfg,
	}
}

func ThresholdsFromConfig(cfg config.AppConfig) ProgressionThresholds {
	thresholds := ProgressionThresholds{
		Q2MinPP:         cfg.RunnerQ2MinPP,
		Q3MinPP:         cfg.RunnerQ3MinPP,
		Q3MinSR:         cfg.RunnerQ3MinSR,
		RiskLowMax:      cfg.RunnerRiskLowMax,
		RiskModerateMax: cfg.RunnerRiskModerateMax,
	}

	if thresholds.Q2MinPP <= 0 || math.IsNaN(thresholds.Q2MinPP) || math.IsInf(thresholds.Q2MinPP, 0) {
		thresholds.Q2MinPP = DefaultQ2MinPP
	}
	if thresholds.Q3MinPP <= 0 || math.IsNaN(thresholds.Q3MinPP) || math.IsInf(thresholds.Q3MinPP, 0) {
		thresholds.Q3MinPP = DefaultQ3MinPP
	}
	if thresholds.Q3MinPP < thresholds.Q2MinPP {
		thresholds.Q3MinPP = thresholds.Q2MinPP
	}
	if thresholds.Q3MinSR <= 0 || math.IsNaN(thresholds.Q3MinSR) || math.IsInf(thresholds.Q3MinSR, 0) {
		thresholds.Q3MinSR = DefaultQ3MinSR
	}
	if thresholds.RiskLowMax <= 0 || thresholds.RiskLowMax >= 100 {
		thresholds.RiskLowMax = DefaultRiskLowMax
	}
	if thresholds.RiskModerateMax <= thresholds.RiskLowMax || thresholds.RiskModerateMax > 100 {
		thresholds.RiskModerateMax = DefaultRiskModerateMax
	}

	return thresholds
}

func (s *Service) GetTierStatus(ctx context.Context, runnerAuthUserID string) (*TierStatus, error) {
	status, _, err := s.buildTierStatus(ctx, runnerAuthUserID, 0)
	return status, err
}

func (s *Service) ApplyRatingProgression(ctx context.Context, runnerAuthUserID string, ppDelta float64) (*ProgressionResult, error) {
	status, profile, err := s.buildTierStatus(ctx, runnerAuthUserID, ppDelta)
	if err != nil {
		return nil, err
	}
	if profile == nil {
		return nil, errors.New("Profil runner tidak ditemukan untuk progression tier.")
	}

	previousTier := questclassification.NormalizeTier(profile.RunnerTier)
	currentTier := highestTier(previousTier, status.EligibleTier)
	status.RunnerTier = currentTier
	if err := s.updateRunnerProgression(ctx, runnerAuthUserID, status); err != nil {
		return nil, err
	}

	return &ProgressionResult{
		AuthUserID:      runnerAuthUserID,
		PreviousTier:    previousTier,
		CurrentTier:     currentTier,
		TierChanged:     currentTier != previousTier,
		PPDeltaApplied:  round2(ppDelta),
		ProgressionNote: buildProgressionNote(previousTier, currentTier, status.BlockedReason),
		Status:          status,
	}, nil
}

func (s *Service) buildTierStatus(ctx context.Context, runnerAuthUserID string, ppDelta float64) (*TierStatus, *runnerProfileRecord, error) {
	authUserID := strings.TrimSpace(runnerAuthUserID)
	if authUserID == "" {
		return nil, nil, errors.New("Runner auth user id wajib diisi untuk tier progression.")
	}

	thresholds := ThresholdsFromConfig(s.cfg)
	profile, err := s.findRunnerProfile(ctx, authUserID)
	if err != nil {
		return nil, nil, err
	}
	storedProfile := profile
	if profile == nil {
		profile = &runnerProfileRecord{
			AuthUserID:      authUserID,
			RunnerTier:      questclassification.TierQ1,
			RunnerPP:        0,
			RunnerSR:        1,
			RunnerRiskScore: 0,
		}
	}

	verification, err := s.findVerification(ctx, authUserID)
	if err != nil {
		return nil, nil, err
	}

	ratings, err := s.listRunnerRatings(ctx, authUserID)
	if err != nil {
		return nil, nil, err
	}

	assignments, err := s.listRunnerAssignments(ctx, authUserID)
	if err != nil {
		return nil, nil, err
	}

	ledgers, err := s.listRunnerLedgers(ctx, authUserID)
	if err != nil {
		return nil, nil, err
	}

	runnerPP := resolveEffectivePP(profile.RunnerPP, sumRunnerPP(ledgers), ppDelta)
	runnerSR := CalculateServiceReliability(runnerPP, thresholds.Q3MinPP, ratings)
	risk := CalculateRisk(RiskInput{
		Assignments:      assignments,
		Ratings:          ratings,
		Ledgers:          ledgers,
		VerificationRisk: verificationRiskScore(verification),
		AccountCreatedAt: profile.AccountCreatedAt,
		Now:              time.Now().UTC(),
		Thresholds:       thresholds,
	})

	status := BuildTierStatus(ProgressionDecisionInput{
		AuthUserID:         authUserID,
		CurrentTier:        profile.RunnerTier,
		RunnerPP:           runnerPP,
		RunnerSR:           runnerSR,
		Risk:               risk,
		IdentityApproved:   isIdentityApproved(verification),
		VerificationStatus: verificationStatus(verification),
		TotalRatings:       len(ratings),
		TotalAssignments:   len(assignments),
		Completed:          countCompletedAssignments(assignments),
		Thresholds:         thresholds,
	})

	return status, storedProfile, nil
}

func BuildTierStatus(input ProgressionDecisionInput) *TierStatus {
	thresholds := normalizeThresholds(input.Thresholds)
	currentTier := questclassification.NormalizeTier(input.CurrentTier)
	eligibleTier := currentTier
	canUpgradeQ2 := input.RunnerPP >= thresholds.Q2MinPP && input.IdentityApproved
	canUpgradeQ3 := canUpgradeQ2 &&
		input.RunnerPP >= thresholds.Q3MinPP &&
		input.RunnerSR >= thresholds.Q3MinSR &&
		input.Risk.Score <= thresholds.RiskLowMax

	blockedReason := ""
	requiredStableQuestCount := input.Risk.RequiredStableQuestCount
	if input.RunnerPP < thresholds.Q2MinPP {
		blockedReason = "Butuh " + formatNumber(thresholds.Q2MinPP-input.RunnerPP) + " PP lagi untuk membuka Q2."
	} else if !input.IdentityApproved {
		blockedReason = "Verifikasi identitas harus approved sebelum Runner bisa naik ke Q2."
	} else {
		eligibleTier = highestTier(eligibleTier, questclassification.TierQ2)
		if input.RunnerPP < thresholds.Q3MinPP {
			blockedReason = "Runner eligible Q2. Butuh " + formatNumber(thresholds.Q3MinPP-input.RunnerPP) + " PP lagi untuk membuka Q3."
		} else if input.RunnerSR < thresholds.Q3MinSR {
			blockedReason = "Runner eligible Q2. SR minimal " + formatNumber(thresholds.Q3MinSR) + " dibutuhkan untuk membuka Q3."
		} else if input.Risk.Score > thresholds.RiskLowMax {
			blockedReason = buildRiskBlockedReason(input.Risk)
		} else {
			eligibleTier = highestTier(eligibleTier, questclassification.TierQ3)
			requiredStableQuestCount = 0
		}
	}

	if canUpgradeQ3 {
		blockedReason = ""
		requiredStableQuestCount = 0
	}
	if questclassification.TierRank(currentTier) >= questclassification.TierRank(questclassification.TierQ3) {
		blockedReason = ""
		requiredStableQuestCount = 0
		eligibleTier = questclassification.TierQ3
	}

	return &TierStatus{
		AuthUserID:                strings.TrimSpace(input.AuthUserID),
		RunnerTier:                currentTier,
		RunnerPP:                  round2(input.RunnerPP),
		RunnerSR:                  round2(input.RunnerSR),
		RunnerRiskScore:           clampInt(input.Risk.Score, 0, 100),
		RiskBand:                  input.Risk.Band,
		IdentityApproved:          input.IdentityApproved,
		VerificationStatus:        strings.TrimSpace(input.VerificationStatus),
		EligibleTier:              eligibleTier,
		NextTier:                  resolveNextTier(currentTier, eligibleTier),
		CanUpgradeQ2:              canUpgradeQ2,
		CanUpgradeQ3:              canUpgradeQ3,
		BlockedReason:             blockedReason,
		RequiredStableQuestCount:  requiredStableQuestCount,
		TotalRunnerRatings:        input.TotalRatings,
		TotalRunnerAssignments:    input.TotalAssignments,
		CompletedRunnerAssignment: input.Completed,
		Thresholds:                thresholds,
	}
}

func CalculateServiceReliability(pp float64, q3MinPP float64, ratings []RatingSnapshot) float64 {
	if q3MinPP <= 0 {
		q3MinPP = DefaultQ3MinPP
	}

	ppProgress := math.Min(5, math.Max(0, pp)/q3MinPP*5)
	ratingAverage := averageRating(ratings)
	ratingAdjustment := 0.0
	if ratingAverage > 0 {
		if ratingAverage >= 4 {
			ratingAdjustment = (ratingAverage - 4) * 1.0
		} else {
			ratingAdjustment = -((4 - ratingAverage) * 0.75)
		}
	}

	return round2(clampFloat(1+ppProgress+ratingAdjustment, 1, 10))
}

func CalculateRisk(input RiskInput) RiskAssessment {
	thresholds := normalizeThresholds(input.Thresholds)
	now := input.Now
	if now.IsZero() {
		now = time.Now().UTC()
	}

	score := reliabilityRisk(input.Assignments)
	score += qualityRisk(input.Ratings)
	score += maturityRisk(input.Assignments, input.AccountCreatedAt, now)
	score += recentTrendRisk(input.Ratings)
	score += ppLegitimacyRisk(input.Ledgers)
	score = clampInt(int(math.Round(float64(score))), 0, 100)
	if input.VerificationRisk > 0 {
		score = int(math.Max(float64(score), clampFloat(input.VerificationRisk, 0, 100)))
	}

	band := RiskBandHigh
	requiredStableQuestCount := 5
	switch {
	case score <= thresholds.RiskLowMax:
		band = RiskBandLow
		requiredStableQuestCount = 0
	case score <= thresholds.RiskModerateMax:
		band = RiskBandModerate
		requiredStableQuestCount = int(math.Ceil(float64(score-thresholds.RiskLowMax) / 5.0))
		if requiredStableQuestCount < 1 {
			requiredStableQuestCount = 1
		}
	default:
		band = RiskBandHigh
		requiredStableQuestCount = int(math.Ceil(float64(score-thresholds.RiskLowMax) / 5.0))
		if requiredStableQuestCount < 5 {
			requiredStableQuestCount = 5
		}
	}

	return RiskAssessment{
		Score:                    score,
		Band:                     band,
		RequiredStableQuestCount: requiredStableQuestCount,
	}
}

func (s *Service) findRunnerProfile(ctx context.Context, authUserID string) (*runnerProfileRecord, error) {
	row, err := s.client.SelectFirst(ctx, "user_identification", "auth_user_id,runner_tier,runner_pp,runner_sr,runner_risk_score,created_at", map[string]string{
		"auth_user_id": authUserID,
	})
	if err != nil {
		return nil, err
	}
	if row == nil {
		return nil, nil
	}

	return &runnerProfileRecord{
		AuthUserID:       config.NormalizeString(row["auth_user_id"]),
		RunnerTier:       questclassification.NormalizeTier(config.NormalizeString(row["runner_tier"])),
		RunnerPP:         parseFloatValue(row["runner_pp"]),
		RunnerSR:         parseFloatValue(row["runner_sr"]),
		RunnerRiskScore:  parseIntValue(row["runner_risk_score"]),
		AccountCreatedAt: parseOptionalTime(row["created_at"]),
	}, nil
}

func (s *Service) findVerification(ctx context.Context, authUserID string) (*verificationRecord, error) {
	row, err := s.client.SelectFirst(ctx, "user_verification_profiles", "auth_user_id,verification_status,risk_score", map[string]string{
		"auth_user_id": authUserID,
	})
	if err != nil {
		return nil, err
	}
	if row == nil {
		return nil, nil
	}

	return &verificationRecord{
		Status:    strings.ToLower(strings.TrimSpace(config.NormalizeString(row["verification_status"]))),
		RiskScore: parseFloatValue(row["risk_score"]),
	}, nil
}

func (s *Service) listRunnerRatings(ctx context.Context, authUserID string) ([]RatingSnapshot, error) {
	rows, err := s.client.SelectMany(ctx, "quest_ratings", "rating_score,rater_role,created_at", map[string]string{
		"ratee_auth_user_id": authUserID,
	}, &config.SelectOptions{Limit: 500, OrderBy: "created_at", Desc: false})
	if err != nil {
		return nil, err
	}

	ratings := make([]RatingSnapshot, 0, len(rows))
	for _, row := range rows {
		if !strings.EqualFold(config.NormalizeString(row["rater_role"]), "giver") {
			continue
		}
		ratings = append(ratings, RatingSnapshot{
			Score:     parseFloatValue(row["rating_score"]),
			CreatedAt: parseOptionalTime(row["created_at"]),
		})
	}
	return ratings, nil
}

func (s *Service) listRunnerAssignments(ctx context.Context, authUserID string) ([]AssignmentSnapshot, error) {
	rows, err := s.client.SelectMany(ctx, "quest_assignments", "assignment_status,created_at", map[string]string{
		"runner_auth_user_id": authUserID,
	}, &config.SelectOptions{Limit: 500, OrderBy: "created_at", Desc: false})
	if err != nil {
		return nil, err
	}

	assignments := make([]AssignmentSnapshot, 0, len(rows))
	for _, row := range rows {
		assignments = append(assignments, AssignmentSnapshot{
			Status:    strings.ToLower(strings.TrimSpace(config.NormalizeString(row["assignment_status"]))),
			CreatedAt: parseOptionalTime(row["created_at"]),
		})
	}
	return assignments, nil
}

func (s *Service) listRunnerLedgers(ctx context.Context, authUserID string) ([]LedgerSnapshot, error) {
	rows, err := s.client.SelectMany(ctx, "performance_point_ledger", "pp_delta,skill_scope,metadata,created_at", map[string]string{
		"auth_user_id": authUserID,
	}, &config.SelectOptions{Limit: 500, OrderBy: "created_at", Desc: false})
	if err != nil {
		return nil, err
	}

	ledgers := make([]LedgerSnapshot, 0, len(rows))
	for _, row := range rows {
		metadata := parseMetadata(row["metadata"])
		raterRole := strings.ToLower(strings.TrimSpace(config.NormalizeString(metadata["rater_role"])))
		if raterRole != "" && raterRole != "giver" {
			continue
		}
		ledgers = append(ledgers, LedgerSnapshot{
			PPDelta:    parseFloatValue(row["pp_delta"]),
			SkillScope: strings.ToLower(strings.TrimSpace(config.NormalizeString(row["skill_scope"]))),
			RaterRole:  raterRole,
			CreatedAt:  parseOptionalTime(row["created_at"]),
		})
	}
	return ledgers, nil
}

func (s *Service) updateRunnerProgression(ctx context.Context, authUserID string, status *TierStatus) error {
	if status == nil {
		return errors.New("Status runner tier kosong.")
	}

	return s.client.Update(ctx, "user_identification", map[string]string{
		"auth_user_id": authUserID,
	}, map[string]any{
		"runner_tier":       questclassification.NormalizeTier(status.RunnerTier),
		"runner_pp":         round2(status.RunnerPP),
		"runner_sr":         round2(status.RunnerSR),
		"runner_risk_score": clampInt(status.RunnerRiskScore, 0, 100),
		"updated_at":        time.Now().UTC(),
	})
}

func normalizeThresholds(thresholds ProgressionThresholds) ProgressionThresholds {
	return ThresholdsFromConfig(config.AppConfig{
		RunnerQ2MinPP:         thresholds.Q2MinPP,
		RunnerQ3MinPP:         thresholds.Q3MinPP,
		RunnerQ3MinSR:         thresholds.Q3MinSR,
		RunnerRiskLowMax:      thresholds.RiskLowMax,
		RunnerRiskModerateMax: thresholds.RiskModerateMax,
	})
}

func resolveEffectivePP(profilePP float64, ledgerPP float64, ppDelta float64) float64 {
	if ledgerPP > 0 {
		return round2(math.Max(profilePP, ledgerPP))
	}
	return round2(math.Max(0, profilePP+ppDelta))
}

func sumRunnerPP(ledgers []LedgerSnapshot) float64 {
	total := 0.0
	for _, ledger := range ledgers {
		total += ledger.PPDelta
	}
	return round2(total)
}

func reliabilityRisk(assignments []AssignmentSnapshot) int {
	total := len(assignments)
	if total == 0 {
		return 15
	}

	failed := 0
	for _, assignment := range assignments {
		switch strings.ToLower(strings.TrimSpace(assignment.Status)) {
		case "disputed", "cancelled", "rejected":
			failed++
		}
	}

	score := int(math.Round(float64(failed) / float64(total) * 30))
	if total < 3 {
		score += (3 - total) * 3
	}
	return clampInt(score, 0, 30)
}

func qualityRisk(ratings []RatingSnapshot) int {
	if len(ratings) == 0 {
		return 20
	}

	avg := averageRating(ratings)
	score := int(math.Round((5 - clampFloat(avg, 1, 5)) / 4 * 25))
	return clampInt(score, 0, 25)
}

func maturityRisk(assignments []AssignmentSnapshot, accountCreatedAt *time.Time, now time.Time) int {
	completed := countCompletedAssignments(assignments)
	score := 0
	if completed < 5 {
		score += (5 - completed) * 2
	}
	if accountCreatedAt == nil {
		score += 5
	} else {
		age := now.Sub(accountCreatedAt.UTC())
		switch {
		case age < 7*24*time.Hour:
			score += 10
		case age < 30*24*time.Hour:
			score += 5
		}
	}
	return clampInt(score, 0, 20)
}

func recentTrendRisk(ratings []RatingSnapshot) int {
	if len(ratings) < 3 {
		return 8
	}

	ordered := append([]RatingSnapshot{}, ratings...)
	sort.SliceStable(ordered, func(i, j int) bool {
		left := ordered[i].CreatedAt
		right := ordered[j].CreatedAt
		if left == nil || right == nil {
			return i < j
		}
		return left.Before(*right)
	})

	overall := averageRating(ordered)
	windowStart := len(ordered) - 5
	if windowStart < 0 {
		windowStart = 0
	}
	recent := averageRating(ordered[windowStart:])
	score := 0
	if recent < overall {
		score += int(math.Round((overall - recent) * 6))
	}
	if recent < 4 {
		score += int(math.Round((4 - recent) * 4))
	}
	return clampInt(score, 0, 15)
}

func ppLegitimacyRisk(ledgers []LedgerSnapshot) int {
	if len(ledgers) == 0 {
		return 5
	}
	if len(ledgers) < 3 {
		return 4
	}

	total := 0.0
	bySkill := map[string]float64{}
	for _, ledger := range ledgers {
		if ledger.PPDelta <= 0 {
			continue
		}
		skill := strings.TrimSpace(ledger.SkillScope)
		if skill == "" {
			skill = "general"
		}
		bySkill[skill] += ledger.PPDelta
		total += ledger.PPDelta
	}
	if total <= 0 {
		return 5
	}

	topShare := 0.0
	for _, value := range bySkill {
		if share := value / total; share > topShare {
			topShare = share
		}
	}
	switch {
	case topShare >= 0.9 && len(ledgers) >= 8:
		return 10
	case topShare >= 0.8 && len(ledgers) >= 5:
		return 6
	default:
		return 0
	}
}

func averageRating(ratings []RatingSnapshot) float64 {
	total := 0.0
	count := 0
	for _, rating := range ratings {
		if rating.Score <= 0 {
			continue
		}
		total += rating.Score
		count++
	}
	if count == 0 {
		return 0
	}
	return total / float64(count)
}

func countCompletedAssignments(assignments []AssignmentSnapshot) int {
	total := 0
	for _, assignment := range assignments {
		if strings.EqualFold(strings.TrimSpace(assignment.Status), "finished") {
			total++
		}
	}
	return total
}

func isIdentityApproved(record *verificationRecord) bool {
	return record != nil && strings.EqualFold(record.Status, "approved")
}

func verificationStatus(record *verificationRecord) string {
	if record == nil || strings.TrimSpace(record.Status) == "" {
		return "not_started"
	}
	return strings.TrimSpace(record.Status)
}

func verificationRiskScore(record *verificationRecord) float64 {
	if record == nil {
		return 0
	}
	return record.RiskScore
}

func highestTier(left string, right string) string {
	if questclassification.TierRank(right) > questclassification.TierRank(left) {
		return questclassification.NormalizeTier(right)
	}
	return questclassification.NormalizeTier(left)
}

func resolveNextTier(currentTier string, eligibleTier string) string {
	current := questclassification.NormalizeTier(currentTier)
	eligible := questclassification.NormalizeTier(eligibleTier)
	if questclassification.TierRank(eligible) > questclassification.TierRank(current) {
		return eligible
	}
	switch current {
	case questclassification.TierQ1:
		return questclassification.TierQ2
	case questclassification.TierQ2:
		return questclassification.TierQ3
	default:
		return questclassification.TierQ3
	}
}

func buildRiskBlockedReason(risk RiskAssessment) string {
	if risk.Band == RiskBandHigh {
		return "Risk assessment tinggi. Runner perlu review admin sebelum bisa membuka Q3."
	}
	if risk.RequiredStableQuestCount > 0 {
		return "Runner eligible Q2, tetapi risk assessment masih sedang. Selesaikan " + strconv.Itoa(risk.RequiredStableQuestCount) + " quest stabil lagi untuk membuka Q3."
	}
	return "Runner eligible Q2, tetapi risk assessment belum low untuk membuka Q3."
}

func buildProgressionNote(previousTier string, currentTier string, blockedReason string) string {
	previous := questclassification.NormalizeTier(previousTier)
	current := questclassification.NormalizeTier(currentTier)
	if previous != current {
		return "Runner naik dari " + previous + " ke " + current + "."
	}
	if strings.TrimSpace(blockedReason) != "" {
		return blockedReason
	}
	return "Tier runner tetap " + current + "."
}

func formatNumber(value float64) string {
	if value < 0 {
		value = 0
	}
	rounded := round2(value)
	if math.Mod(rounded, 1) == 0 {
		return strconv.FormatInt(int64(rounded), 10)
	}
	return strconv.FormatFloat(rounded, 'f', 2, 64)
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
		if err != nil {
			fallback, fallbackErr := typed.Float64()
			if fallbackErr != nil {
				return 0
			}
			return int(math.Round(fallback))
		}
		return int(parsed)
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
		floatValue, floatErr := strconv.ParseFloat(strings.TrimSpace(typed), 64)
		if floatErr != nil {
			return 0
		}
		return int(math.Round(floatValue))
	default:
		return 0
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
		out := map[string]any{}
		if err := json.Unmarshal([]byte(strings.TrimSpace(typed)), &out); err != nil {
			return map[string]any{}
		}
		return out
	default:
		return map[string]any{}
	}
}

func clampFloat(value float64, minValue float64, maxValue float64) float64 {
	if value < minValue {
		return minValue
	}
	if value > maxValue {
		return maxValue
	}
	return value
}

func clampInt(value int, minValue int, maxValue int) int {
	if value < minValue {
		return minValue
	}
	if value > maxValue {
		return maxValue
	}
	return value
}

func round2(value float64) float64 {
	return math.Round(value*100) / 100
}
