package performance

import (
	"testing"
	"time"
)

func TestPerformanceSummaryStats(t *testing.T) {
	assignments := []assignmentRecord{
		{AssignmentStatus: "finished"},
		{AssignmentStatus: "finished"},
		{AssignmentStatus: "cancelled"},
	}
	ledgers := []ledgerRecord{
		{SkillScope: "programming", PPDelta: 100},
		{SkillScope: "design", PPDelta: 40},
		{SkillScope: "programming", PPDelta: 60},
	}
	ratings := []ratingRecord{
		{SkillScope: "programming", RatingScore: 5},
		{SkillScope: "design", RatingScore: 4},
	}

	stats := buildPerformanceSummaryStats(ledgers, ratings, assignments)
	if stats.TotalRatingsReceived != 2 {
		t.Fatalf("TotalRatingsReceived = %d, want 2", stats.TotalRatingsReceived)
	}
	if stats.AvgRatingReceived != 4.5 {
		t.Fatalf("AvgRatingReceived = %.2f, want 4.50", stats.AvgRatingReceived)
	}
	if stats.TotalQuestsCompleted != 2 {
		t.Fatalf("TotalQuestsCompleted = %d, want 2", stats.TotalQuestsCompleted)
	}
	if stats.TotalPPEarned != 200 {
		t.Fatalf("TotalPPEarned = %.2f, want 200", stats.TotalPPEarned)
	}
	if stats.TopSkillScope != "programming" {
		t.Fatalf("TopSkillScope = %q, want programming", stats.TopSkillScope)
	}
}

func TestPerformanceLedgerPagination(t *testing.T) {
	records := []ledgerRecord{
		{ID: "1"},
		{ID: "2"},
		{ID: "3"},
		{ID: "4"},
		{ID: "5"},
	}

	page, limit := normalizePagination("2", "2")
	paged := paginateLedgerRecords(records, page, limit)
	if len(paged) != 2 {
		t.Fatalf("len(paged) = %d, want 2", len(paged))
	}
	if paged[0].ID != "3" || paged[1].ID != "4" {
		t.Fatalf("paged IDs = %s,%s; want 3,4", paged[0].ID, paged[1].ID)
	}

	_, cappedLimit := normalizePagination("1", "99")
	if cappedLimit != 50 {
		t.Fatalf("capped limit = %d, want 50", cappedLimit)
	}
}

func TestPerformanceSkillsGrouping(t *testing.T) {
	now := time.Now()
	older := now.Add(-48 * time.Hour)
	breakdown := buildSkillBreakdown(
		[]ledgerRecord{
			{SkillScope: "programming", PPDelta: 120, CreatedAt: &older},
			{SkillScope: "design", PPDelta: 80, CreatedAt: &now},
			{SkillScope: "programming", PPDelta: 100, CreatedAt: &now},
		},
		[]ratingRecord{
			{SkillScope: "programming", RatingScore: 5},
			{SkillScope: "programming", RatingScore: 4},
			{SkillScope: "design", RatingScore: 3},
		},
	)

	if breakdown.TotalPP != 300 {
		t.Fatalf("TotalPP = %.2f, want 300", breakdown.TotalPP)
	}
	if breakdown.TopSkill != "programming" {
		t.Fatalf("TopSkill = %q, want programming", breakdown.TopSkill)
	}
	if len(breakdown.Skills) != 2 {
		t.Fatalf("len(Skills) = %d, want 2", len(breakdown.Skills))
	}

	top := breakdown.Skills[0]
	if top.SkillScope != "programming" {
		t.Fatalf("top skill = %q, want programming", top.SkillScope)
	}
	if top.TotalPP != 220 {
		t.Fatalf("top totalPP = %.2f, want 220", top.TotalPP)
	}
	if top.Percentage != 73.33 {
		t.Fatalf("top percentage = %.2f, want 73.33", top.Percentage)
	}
	if top.QuestCount != 2 {
		t.Fatalf("top questCount = %d, want 2", top.QuestCount)
	}
	if top.AvgRating != 4.5 {
		t.Fatalf("top avgRating = %.2f, want 4.50", top.AvgRating)
	}
}

func TestPerformanceRatingsSummaryBlock(t *testing.T) {
	summary := buildRatingSummary([]ratingRecord{
		{RatingScore: 5},
		{RatingScore: 4.4},
		{RatingScore: 4.1},
		{RatingScore: 3},
		{RatingScore: 2},
	})

	if summary.TotalRatings != 5 {
		t.Fatalf("TotalRatings = %d, want 5", summary.TotalRatings)
	}
	if summary.AvgRating != 3.7 {
		t.Fatalf("AvgRating = %.2f, want 3.70", summary.AvgRating)
	}
	if summary.RatingDistribution[5] != 1 {
		t.Fatalf("5-star bucket = %d, want 1", summary.RatingDistribution[5])
	}
	if summary.RatingDistribution[4] != 2 {
		t.Fatalf("4-star bucket = %d, want 2", summary.RatingDistribution[4])
	}
	if summary.RatingDistribution[3] != 1 {
		t.Fatalf("3-star bucket = %d, want 1", summary.RatingDistribution[3])
	}
	if summary.RatingDistribution[2] != 1 {
		t.Fatalf("2-star bucket = %d, want 1", summary.RatingDistribution[2])
	}
	if summary.RatingDistribution[1] != 0 {
		t.Fatalf("1-star bucket = %d, want 0", summary.RatingDistribution[1])
	}
}
