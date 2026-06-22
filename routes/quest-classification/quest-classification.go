package questclassification

import (
	"math"
	"strings"
)

const (
	TierQ1 = "Q1"
	TierQ2 = "Q2"
	TierQ3 = "Q3"

	StatusAutoClassified = "auto_classified"
	StatusPendingReview  = "pending_review"

	ContractOneOff    = "one_off"
	ContractFixedTerm = "fixed_term"
	ContractLongTerm  = "long_term"

	ReqNone      = "none"
	ReqPreferred = "preferred"
	ReqRequired  = "required"

	IdentityBasic    = "basic"
	IdentityKTP      = "ktp"
	IdentityFullDocs = "full_docs"
)

type ClassificationInput struct {
	ContractType         string
	ContractDurationDays *int
	ReqEducation         string
	ReqEducationDetail   string
	ReqPortfolio         string
	ReqIdentityLevel     string
	ReqDocuments         []string
	RewardAmount         float64
	Description          string
	SkillTags            []string
}

type ClassificationResult struct {
	Tier       string
	Score      int
	Status     string
	Confidence float64
	Flags      []string
}

type QuestClassifier interface {
	Classify(input ClassificationInput) ClassificationResult
}

type RuleBasedClassifier struct{}

func NewRuleBasedClassifier() RuleBasedClassifier {
	return RuleBasedClassifier{}
}

func (RuleBasedClassifier) Classify(input ClassificationInput) ClassificationResult {
	normalized := normalizeInput(input)
	contractScore := scoreContractType(normalized.ContractType)
	educationScore := scoreRequirementLevel(normalized.ReqEducation)
	portfolioScore := scoreRequirementLevel(normalized.ReqPortfolio)
	identityScore := scoreIdentityLevel(normalized.ReqIdentityLevel)
	rewardScore := scoreRewardAmount(normalized.RewardAmount)
	score := contractScore + educationScore + portfolioScore + identityScore + rewardScore
	tier := resolveTier(score)
	flags := resolveFlags(normalized, score, contractScore+educationScore+portfolioScore+identityScore, tier)
	status := StatusAutoClassified
	confidence := 1.0
	if len(flags) > 0 {
		status = StatusPendingReview
		confidence = 0.72
	}

	return ClassificationResult{
		Tier:       tier,
		Score:      score,
		Status:     status,
		Confidence: confidence,
		Flags:      flags,
	}
}

func normalizeInput(input ClassificationInput) ClassificationInput {
	input.ContractType = NormalizeContractType(input.ContractType, input.ContractDurationDays)
	input.ReqEducation = NormalizeRequirementLevel(input.ReqEducation)
	input.ReqPortfolio = NormalizeRequirementLevel(input.ReqPortfolio)
	input.ReqIdentityLevel = NormalizeIdentityLevel(input.ReqIdentityLevel)
	input.ReqEducationDetail = strings.TrimSpace(input.ReqEducationDetail)
	input.Description = strings.TrimSpace(input.Description)
	input.ReqDocuments = normalizeStringSlice(input.ReqDocuments)
	input.SkillTags = normalizeStringSlice(input.SkillTags)
	if input.RewardAmount < 0 || math.IsNaN(input.RewardAmount) || math.IsInf(input.RewardAmount, 0) {
		input.RewardAmount = 0
	}
	return input
}

func NormalizeContractType(value string, durationDays *int) string {
	switch strings.ToLower(strings.TrimSpace(value)) {
	case ContractFixedTerm, "fixed", "short_term", "short-contract", "short_contract":
		return ContractFixedTerm
	case ContractLongTerm, "long", "subscription", "employment":
		return ContractLongTerm
	case ContractOneOff, "oneoff", "one-off", "single", "":
		if durationDays != nil {
			if *durationDays >= 30 {
				return ContractLongTerm
			}
			if *durationDays >= 3 {
				return ContractFixedTerm
			}
		}
		return ContractOneOff
	default:
		return ""
	}
}

func NormalizeRequirementLevel(value string) string {
	switch strings.ToLower(strings.TrimSpace(value)) {
	case ReqPreferred, "semi", "semi_required", "semi-wajib", "semi_wajib", "optional_plus":
		return ReqPreferred
	case ReqRequired, "wajib", "must":
		return ReqRequired
	case ReqNone, "optional", "opsional", "":
		return ReqNone
	default:
		return ""
	}
}

func NormalizeIdentityLevel(value string) string {
	switch strings.ToLower(strings.TrimSpace(value)) {
	case IdentityKTP, "id_card", "identity_card":
		return IdentityKTP
	case IdentityFullDocs, "full", "full-document", "full_document", "documents":
		return IdentityFullDocs
	case IdentityBasic, "none", "":
		return IdentityBasic
	default:
		return ""
	}
}

func NormalizeTier(value string) string {
	switch strings.ToUpper(strings.TrimSpace(value)) {
	case TierQ2:
		return TierQ2
	case TierQ3:
		return TierQ3
	default:
		return TierQ1
	}
}

func TierRank(value string) int {
	switch NormalizeTier(value) {
	case TierQ3:
		return 3
	case TierQ2:
		return 2
	default:
		return 1
	}
}

func CanRunnerAccessQuestTier(runnerTier string, questTier string) bool {
	return TierRank(runnerTier) >= TierRank(questTier)
}

func BuildTierAccessReason(runnerTier string, questTier string, accessible bool) string {
	normalizedRunnerTier := NormalizeTier(runnerTier)
	normalizedQuestTier := NormalizeTier(questTier)
	if accessible {
		return "Runner " + normalizedRunnerTier + " memenuhi akses quest " + normalizedQuestTier + "."
	}
	return "Quest " + normalizedQuestTier + " terkunci untuk Runner " + normalizedRunnerTier + ". Naikkan tier runner untuk membuka quest ini."
}

func scoreContractType(value string) int {
	switch value {
	case ContractFixedTerm:
		return 3
	case ContractLongTerm:
		return 6
	default:
		return 0
	}
}

func scoreRequirementLevel(value string) int {
	switch value {
	case ReqPreferred:
		return 1
	case ReqRequired:
		return 2
	default:
		return 0
	}
}

func scoreIdentityLevel(value string) int {
	switch value {
	case IdentityKTP:
		return 2
	case IdentityFullDocs:
		return 4
	default:
		return 0
	}
}

func scoreRewardAmount(value float64) int {
	switch {
	case value >= 2000000:
		return 3
	case value >= 500000:
		return 2
	case value >= 100000:
		return 1
	default:
		return 0
	}
}

func resolveTier(score int) string {
	switch {
	case score >= 9:
		return TierQ3
	case score >= 4:
		return TierQ2
	default:
		return TierQ1
	}
}

func resolveFlags(input ClassificationInput, score int, nonRewardScore int, tier string) []string {
	flags := []string{}
	if score == 3 || score == 4 || score == 8 || score == 9 {
		flags = append(flags, "border_score")
	}
	if nonRewardScore <= 1 && input.RewardAmount >= 2000000 {
		flags = append(flags, "reward_high_with_basic_requirements")
	}
	if tier == TierQ1 && input.RewardAmount >= 500000 {
		flags = append(flags, "q1_high_reward")
	}
	if input.ContractType == ContractOneOff && input.ReqIdentityLevel == IdentityFullDocs {
		flags = append(flags, "one_off_requires_full_docs")
	}
	if input.ContractType == ContractOneOff && input.ContractDurationDays != nil && *input.ContractDurationDays > 1 {
		flags = append(flags, "one_off_has_duration")
	}
	if input.ContractType == ContractFixedTerm {
		if input.ContractDurationDays == nil {
			flags = append(flags, "fixed_term_duration_missing")
		} else if *input.ContractDurationDays < 3 || *input.ContractDurationDays > 14 {
			flags = append(flags, "fixed_term_duration_out_of_range")
		}
	}
	if input.ContractType == ContractLongTerm {
		if input.ContractDurationDays == nil {
			flags = append(flags, "long_term_duration_missing")
		} else if *input.ContractDurationDays < 30 {
			flags = append(flags, "long_term_duration_too_short")
		}
	}
	if input.ReqIdentityLevel == IdentityFullDocs && len(input.ReqDocuments) == 0 {
		flags = append(flags, "full_docs_without_document_list")
	}
	if input.ReqEducation == ReqRequired && input.ReqEducationDetail == "" {
		flags = append(flags, "education_required_without_detail")
	}
	return flags
}

func normalizeStringSlice(values []string) []string {
	out := make([]string, 0, len(values))
	seen := map[string]bool{}
	for _, value := range values {
		trimmed := strings.TrimSpace(value)
		if trimmed == "" {
			continue
		}
		key := strings.ToLower(trimmed)
		if seen[key] {
			continue
		}
		seen[key] = true
		out = append(out, trimmed)
	}
	return out
}
