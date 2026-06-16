package giverquest

import (
	"context"
	"regexp"
	"strconv"
	"strings"
	"time"

	"Stream-StrictMode/config"

	"github.com/gofiber/fiber/v3"
)

var postalCodePattern = regexp.MustCompile(`^[0-9]{5}$`)

func GiverQuest(service *Service) fiber.Handler {
	return func(c fiber.Ctx) error {
		switch c.Method() {
		case fiber.MethodGet:
			return handleGiverQuestGet(c, service)
		case fiber.MethodPost:
			return handleGiverQuestPost(c, service)
		case fiber.MethodPut:
			return handleGiverQuestPut(c, service)
		case fiber.MethodDelete:
			return handleGiverQuestDelete(c, service)
		case fiber.MethodOptions:
			return c.SendStatus(fiber.StatusNoContent)
		default:
			return config.WriteError(c, config.NewAppError("Method tidak diizinkan untuk giver quest.", fiber.StatusMethodNotAllowed), "Gagal memproses giver quest.")
		}
	}
}

func handleGiverQuestGet(c fiber.Ctx, service *Service) error {
	if strings.HasSuffix(c.Path(), "/history") {
		return handleGiverQuestHistoryGet(c, service)
	}

	ctx, cancel, authRecord, roleRecord, err := resolveGiverQuestContext(c, service, false)
	if err != nil {
		return config.WriteError(c, err, "Gagal mengambil quest giver.")
	}
	defer cancel()

	quests, err := service.ListGiverQuests(ctx, authRecord.AuthUserID)
	if err != nil {
		return config.WriteError(c, config.MapSupabaseError(err, "Gagal mengambil quest giver cloud."), "Gagal mengambil quest giver.")
	}

	items := make([]fiber.Map, 0, len(quests))
	for _, record := range quests {
		escrow, err := service.FindQuestEscrowByQuestID(ctx, record.ID)
		if err != nil {
			return config.WriteError(c, config.MapSupabaseError(err, "Gagal mengambil escrow quest cloud."), "Gagal mengambil quest giver.")
		}

		ratingState, err := buildQuestRatingState(ctx, service, record.ID, authRecord.AuthUserID)
		if err != nil {
			return config.WriteError(c, config.MapSupabaseError(err, "Gagal mengambil rating state quest cloud."), "Gagal mengambil quest giver.")
		}
		if isGiverClosedQuest(&record, escrow, ratingState) {
			continue
		}

		items = append(items, toGiverQuestPayload(&record, escrow, ratingState))
	}

	return c.JSON(fiber.Map{
		"success": true,
		"message": "Quest giver berhasil diambil.",
		"data": fiber.Map{
			"giver_auth_user_id": authRecord.AuthUserID,
			"user_role":          roleRecord.UserRole,
			"items":              items,
			"total":              len(items),
		},
	})
}

func handleGiverQuestHistoryGet(c fiber.Ctx, service *Service) error {
	ctx, cancel, authRecord, roleRecord, err := resolveGiverQuestContext(c, service, false)
	if err != nil {
		return config.WriteError(c, err, "Gagal mengambil riwayat quest giver.")
	}
	defer cancel()

	quests, err := service.ListGiverQuests(ctx, authRecord.AuthUserID)
	if err != nil {
		return config.WriteError(c, config.MapSupabaseError(err, "Gagal mengambil quest giver cloud."), "Gagal mengambil riwayat quest giver.")
	}

	items := make([]fiber.Map, 0)
	for _, record := range quests {
		escrow, err := service.FindQuestEscrowByQuestID(ctx, record.ID)
		if err != nil {
			return config.WriteError(c, config.MapSupabaseError(err, "Gagal mengambil escrow riwayat quest cloud."), "Gagal mengambil riwayat quest giver.")
		}

		ratingState, err := buildQuestRatingState(ctx, service, record.ID, authRecord.AuthUserID)
		if err != nil {
			return config.WriteError(c, config.MapSupabaseError(err, "Gagal mengambil rating state riwayat quest cloud."), "Gagal mengambil riwayat quest giver.")
		}
		if !isGiverHistoryQuest(&record, escrow, ratingState) {
			continue
		}

		items = append(items, toGiverQuestPayload(&record, escrow, ratingState))
	}

	return c.JSON(fiber.Map{
		"success": true,
		"message": "Riwayat quest giver berhasil diambil.",
		"data": fiber.Map{
			"giver_auth_user_id": authRecord.AuthUserID,
			"user_role":          roleRecord.UserRole,
			"items":              items,
			"total":              len(items),
		},
	})
}

func handleGiverQuestPost(c fiber.Ctx, service *Service) error {
	body, err := config.ParseJSONBody(c)
	if err != nil {
		return config.WriteError(c, err, "Gagal membuat quest giver.")
	}

	ctx, cancel, authRecord, _, err := resolveGiverQuestContext(c, service, true)
	if err != nil {
		return config.WriteError(c, err, "Gagal membuat quest giver.")
	}
	defer cancel()

	action := resolveGiverQuestAction(c)
	switch action {
	case "create":
		payload, err := collectCreateQuestRequest(body)
		if err != nil {
			return config.WriteError(c, err, "Gagal membuat draft quest giver.")
		}

		questID, err := service.CreateQuestDraft(ctx, authRecord, payload)
		if err != nil {
			return config.WriteError(c, config.MapSupabaseError(err, "Gagal membuat draft quest giver cloud."), "Gagal membuat draft quest giver.")
		}

		escrow, err := service.FindQuestEscrowByQuestID(ctx, questID)
		if err != nil {
			return config.WriteError(c, config.MapSupabaseError(err, "Gagal mengambil escrow quest cloud."), "Gagal membuat draft quest giver.")
		}

		createdQuest, err := service.FindQuestByID(ctx, questID)
		if err != nil {
			return config.WriteError(c, config.MapSupabaseError(err, "Gagal mengambil draft quest cloud."), "Gagal membuat draft quest giver.")
		}

		return c.Status(fiber.StatusCreated).JSON(fiber.Map{
			"success": true,
			"message": "Draft quest giver berhasil dibuat.",
			"data":    toGiverQuestPayload(createdQuest, escrow, nil),
		})
	case "lock":
		questID := strings.TrimSpace(c.Params("id"))
		paymentMethod := normalizePaymentMethod(config.NormalizeString(body["payment_method"]))
		if questID == "" {
			return config.WriteError(c, config.NewAppError("Quest ID wajib dikirim untuk lock escrow.", fiber.StatusBadRequest), "Gagal mengunci escrow quest.")
		}

		questRecord, err := service.FindQuestByID(ctx, questID)
		if err != nil {
			return config.WriteError(c, config.MapSupabaseError(err, "Gagal mengambil quest giver cloud."), "Gagal mengunci escrow quest.")
		}
		if questRecord == nil {
			return config.WriteError(c, config.NewAppError("Quest tidak ditemukan.", fiber.StatusNotFound), "Gagal mengunci escrow quest.")
		}
		if questRecord.GiverAuthUserID != authRecord.AuthUserID {
			return config.WriteError(c, config.NewAppError("Quest ini bukan milik giver login.", fiber.StatusForbidden), "Gagal mengunci escrow quest.")
		}
		if questRecord.Status != "draft" {
			return config.WriteError(c, config.NewAppError("Escrow hanya bisa dikunci saat quest masih draft.", fiber.StatusConflict), "Gagal mengunci escrow quest.")
		}

		escrow, err := service.FindQuestEscrowByQuestID(ctx, questID)
		if err != nil {
			return config.WriteError(c, config.MapSupabaseError(err, "Gagal mengambil escrow quest cloud."), "Gagal mengunci escrow quest.")
		}
		if escrow == nil {
			return config.WriteError(c, config.NewAppError("Escrow quest belum tersedia.", fiber.StatusNotFound), "Gagal mengunci escrow quest.")
		}
		if escrow.EscrowState != "unpaid" {
			return config.WriteError(c, config.NewAppError("Escrow quest sudah pernah dikunci atau diproses.", fiber.StatusConflict), "Gagal mengunci escrow quest.")
		}

		if err := service.UpdateQuestEscrowLock(ctx, questID, paymentMethod); err != nil {
			return config.WriteError(c, config.MapSupabaseError(err, "Gagal mengunci escrow quest cloud."), "Gagal mengunci escrow quest.")
		}

		updatedEscrow, err := service.FindQuestEscrowByQuestID(ctx, questID)
		if err != nil {
			return config.WriteError(c, config.MapSupabaseError(err, "Gagal mengambil escrow quest cloud."), "Gagal mengunci escrow quest.")
		}

		return c.JSON(fiber.Map{
			"success": true,
			"message": "Escrow quest berhasil dikunci.",
			"data": fiber.Map{
				"quest_id": questID,
				"escrow":   toQuestEscrowPayload(updatedEscrow),
			},
		})
	case "publish":
		questID := strings.TrimSpace(c.Params("id"))
		if questID == "" {
			return config.WriteError(c, config.NewAppError("Quest ID wajib dikirim untuk publish.", fiber.StatusBadRequest), "Gagal publish quest giver.")
		}

		questRecord, err := service.FindQuestByID(ctx, questID)
		if err != nil {
			return config.WriteError(c, config.MapSupabaseError(err, "Gagal mengambil quest giver cloud."), "Gagal publish quest giver.")
		}
		if questRecord == nil {
			return config.WriteError(c, config.NewAppError("Quest tidak ditemukan.", fiber.StatusNotFound), "Gagal publish quest giver.")
		}
		if questRecord.GiverAuthUserID != authRecord.AuthUserID {
			return config.WriteError(c, config.NewAppError("Quest ini bukan milik giver login.", fiber.StatusForbidden), "Gagal publish quest giver.")
		}
		if questRecord.Status != "draft" {
			return config.WriteError(c, config.NewAppError("Quest hanya bisa dipublish dari status draft.", fiber.StatusConflict), "Gagal publish quest giver.")
		}

		escrow, err := service.FindQuestEscrowByQuestID(ctx, questID)
		if err != nil {
			return config.WriteError(c, config.MapSupabaseError(err, "Gagal mengambil escrow quest cloud."), "Gagal publish quest giver.")
		}
		if escrow == nil {
			return config.WriteError(c, config.NewAppError("Escrow quest belum tersedia.", fiber.StatusNotFound), "Gagal publish quest giver.")
		}
		if escrow.EscrowState != "locked" {
			return config.WriteError(c, config.NewAppError("Quest belum bisa dipublish sebelum escrow terkunci.", fiber.StatusConflict), "Gagal publish quest giver.")
		}

		if err := service.PublishQuest(ctx, questID); err != nil {
			return config.WriteError(c, config.MapSupabaseError(err, "Gagal publish quest giver cloud."), "Gagal publish quest giver.")
		}

		return c.JSON(fiber.Map{
			"success": true,
			"message": "Quest giver berhasil dipublish ke feed runner.",
			"data": fiber.Map{
				"quest_id":      questID,
				"quest_status":  "open",
				"escrow_status": "locked",
			},
		})
	default:
		return config.WriteError(c, config.NewAppError("Aksi giver quest tidak dikenal.", fiber.StatusNotFound), "Gagal memproses giver quest.")
	}
}

func handleGiverQuestPut(c fiber.Ctx, service *Service) error {
	body, err := config.ParseJSONBody(c)
	if err != nil {
		return config.WriteError(c, err, "Gagal update draft quest giver.")
	}

	ctx, cancel, authRecord, _, err := resolveGiverQuestContext(c, service, true)
	if err != nil {
		return config.WriteError(c, err, "Gagal update draft quest giver.")
	}
	defer cancel()

	questID := strings.TrimSpace(c.Params("id"))
	if questID == "" {
		return config.WriteError(c, config.NewAppError("Quest ID wajib dikirim untuk update draft.", fiber.StatusBadRequest), "Gagal update draft quest giver.")
	}

	questRecord, err := service.FindQuestByID(ctx, questID)
	if err != nil {
		return config.WriteError(c, config.MapSupabaseError(err, "Gagal mengambil quest giver cloud."), "Gagal update draft quest giver.")
	}
	if questRecord == nil {
		return config.WriteError(c, config.NewAppError("Quest tidak ditemukan.", fiber.StatusNotFound), "Gagal update draft quest giver.")
	}
	if questRecord.GiverAuthUserID != authRecord.AuthUserID {
		return config.WriteError(c, config.NewAppError("Draft ini bukan milik giver login.", fiber.StatusForbidden), "Gagal update draft quest giver.")
	}
	if questRecord.Status != "draft" {
		return config.WriteError(c, config.NewAppError("Quest yang sudah publish tidak bisa diedit lewat draft.", fiber.StatusConflict), "Gagal update draft quest giver.")
	}

	payload, err := collectCreateQuestRequest(body)
	if err != nil {
		return config.WriteError(c, err, "Gagal update draft quest giver.")
	}

	if err := service.UpdateQuestDraft(ctx, questID, payload); err != nil {
		return config.WriteError(c, config.MapSupabaseError(err, "Gagal update draft quest giver cloud."), "Gagal update draft quest giver.")
	}

	updatedQuest, err := service.FindQuestByID(ctx, questID)
	if err != nil {
		return config.WriteError(c, config.MapSupabaseError(err, "Gagal mengambil draft quest cloud."), "Gagal update draft quest giver.")
	}
	updatedEscrow, err := service.FindQuestEscrowByQuestID(ctx, questID)
	if err != nil {
		return config.WriteError(c, config.MapSupabaseError(err, "Gagal mengambil escrow draft cloud."), "Gagal update draft quest giver.")
	}

	return c.JSON(fiber.Map{
		"success": true,
		"message": "Draft quest giver berhasil diperbarui.",
		"data":    toGiverQuestPayload(updatedQuest, updatedEscrow, nil),
	})
}

func handleGiverQuestDelete(c fiber.Ctx, service *Service) error {
	ctx, cancel, authRecord, _, err := resolveGiverQuestContext(c, service, true)
	if err != nil {
		return config.WriteError(c, err, "Gagal hapus draft quest giver.")
	}
	defer cancel()

	questID := strings.TrimSpace(c.Params("id"))
	if questID == "" {
		return config.WriteError(c, config.NewAppError("Quest ID wajib dikirim untuk hapus draft.", fiber.StatusBadRequest), "Gagal hapus draft quest giver.")
	}

	questRecord, err := service.FindQuestByID(ctx, questID)
	if err != nil {
		return config.WriteError(c, config.MapSupabaseError(err, "Gagal mengambil quest giver cloud."), "Gagal hapus draft quest giver.")
	}
	if questRecord == nil {
		return config.WriteError(c, config.NewAppError("Quest tidak ditemukan.", fiber.StatusNotFound), "Gagal hapus draft quest giver.")
	}
	if questRecord.GiverAuthUserID != authRecord.AuthUserID {
		return config.WriteError(c, config.NewAppError("Draft ini bukan milik giver login.", fiber.StatusForbidden), "Gagal hapus draft quest giver.")
	}
	if questRecord.Status != "draft" {
		return config.WriteError(c, config.NewAppError("Quest yang sudah publish tidak bisa dihapus lewat draft.", fiber.StatusConflict), "Gagal hapus draft quest giver.")
	}

	if err := service.DeleteQuestDraft(ctx, questID); err != nil {
		return config.WriteError(c, config.MapSupabaseError(err, "Gagal hapus draft quest giver cloud."), "Gagal hapus draft quest giver.")
	}

	return c.JSON(fiber.Map{
		"success": true,
		"message": "Draft quest giver berhasil dihapus.",
		"data": fiber.Map{
			"quest_id": questID,
			"deleted":  true,
		},
	})
}

func resolveGiverQuestContext(c fiber.Ctx, service *Service, enforceUnlocked bool) (context.Context, context.CancelFunc, *authSessionRecord, *userRoleRecord, error) {
	sessionToken := config.ResolveSessionToken(c, service.cfg.SessionCookieName)
	if sessionToken == "" {
		return nil, nil, nil, nil, config.NewAppError("Token sesi tidak ditemukan. Kirim bearer token atau cookie sesi.", fiber.StatusUnauthorized)
	}

	ctx, cancel := context.WithTimeout(context.Background(), 20*time.Second)
	authRecord, err := service.FindAuthBySessionToken(ctx, sessionToken)
	if err != nil {
		cancel()
		return nil, nil, nil, nil, config.MapSupabaseError(err, "Gagal mengambil data auth cloud.")
	}
	if authRecord == nil {
		cancel()
		return nil, nil, nil, nil, config.NewAppError("Token sesi tidak valid atau sudah kadaluarsa.", fiber.StatusUnauthorized)
	}

	roleRecord, err := service.GetUserRole(ctx, authRecord.AuthUserID)
	if err != nil {
		cancel()
		return nil, nil, nil, nil, config.MapSupabaseError(err, "Gagal mengambil role user cloud.")
	}
	if roleRecord == nil {
		cancel()
		return nil, nil, nil, nil, config.NewAppError("Role user tidak ditemukan.", fiber.StatusNotFound)
	}

	if enforceUnlocked && roleRecord.UserRole != config.UserRoleUnlocked {
		cancel()
		return nil, nil, nil, nil, config.NewAppError("Akun belum unlocked untuk memposting quest. Lengkapi verifikasi profile terlebih dahulu.", fiber.StatusForbidden)
	}

	return ctx, cancel, authRecord, roleRecord, nil
}

func collectCreateQuestRequest(body map[string]any) (createQuestPayload, error) {
	payload := createQuestPayload{
		Title:          config.NormalizeString(body["title"]),
		Description:    config.NormalizeString(body["description"]),
		Category:       config.NormalizeString(body["category"]),
		SkillTags:      collectStringArray(body["skill_tags"]),
		Mode:           normalizeQuestMode(config.NormalizeString(body["mode"])),
		Status:         normalizeQuestStatus(config.NormalizeString(body["status"])),
		RewardCurrency: firstNonEmpty(config.NormalizeString(body["reward_currency"]), "IDR"),
		Province:       config.NormalizeString(body["province"]),
		City:           config.NormalizeString(body["city"]),
		District:       config.NormalizeString(body["district"]),
		SubDistrict:    config.NormalizeString(body["sub_district"]),
		FullAddress:    config.NormalizeString(body["full_address"]),
		PostalCode:     config.NormalizeString(body["postal_code"]),
		MaxRunner:      parseOrDefaultInt(config.NormalizeString(body["max_runner"]), 1),
	}

	if payload.Title == "" {
		return createQuestPayload{}, config.NewAppError("Judul quest wajib diisi.", fiber.StatusBadRequest)
	}
	if payload.Description == "" {
		return createQuestPayload{}, config.NewAppError("Deskripsi quest wajib diisi.", fiber.StatusBadRequest)
	}

	rewardAmount, err := strconv.ParseFloat(strings.TrimSpace(config.NormalizeString(body["reward_amount"])), 64)
	if err != nil || rewardAmount < 0 {
		return createQuestPayload{}, config.NewAppError("Reward amount wajib berupa angka valid.", fiber.StatusBadRequest)
	}
	payload.RewardAmount = rewardAmount

	if payload.PostalCode != "" && !postalCodePattern.MatchString(payload.PostalCode) {
		return createQuestPayload{}, config.NewAppError("Postal code quest harus 5 digit.", fiber.StatusBadRequest)
	}

	if lat := strings.TrimSpace(config.NormalizeString(body["lat"])); lat != "" {
		parsed, err := strconv.ParseFloat(lat, 64)
		if err != nil {
			return createQuestPayload{}, config.NewAppError("Latitude quest tidak valid.", fiber.StatusBadRequest)
		}
		payload.Lat = &parsed
	}

	if lng := strings.TrimSpace(config.NormalizeString(body["lng"])); lng != "" {
		parsed, err := strconv.ParseFloat(lng, 64)
		if err != nil {
			return createQuestPayload{}, config.NewAppError("Longitude quest tidak valid.", fiber.StatusBadRequest)
		}
		payload.Lng = &parsed
	}

	if startsAt := strings.TrimSpace(config.NormalizeString(body["starts_at"])); startsAt != "" {
		parsed, err := parseRequestTime(startsAt)
		if err != nil {
			return createQuestPayload{}, err
		}
		payload.StartsAt = &parsed
	}

	if endsAt := strings.TrimSpace(config.NormalizeString(body["ends_at"])); endsAt != "" {
		parsed, err := parseRequestTime(endsAt)
		if err != nil {
			return createQuestPayload{}, err
		}
		payload.EndsAt = &parsed
	}

	if payload.EndsAt != nil && payload.StartsAt != nil && payload.EndsAt.Before(*payload.StartsAt) {
		return createQuestPayload{}, config.NewAppError("Akhir waktu quest tidak boleh sebelum waktu mulai.", fiber.StatusBadRequest)
	}

	if payload.Mode == "solo" {
		payload.MaxRunner = 1
	}

	return payload, nil
}

func buildQuestRatingState(ctx context.Context, service *Service, questID string, viewerAuthUserID string) (*questRatingStateRecord, error) {
	assignments, err := service.ListQuestAssignmentsForRating(ctx, questID)
	if err != nil {
		return nil, err
	}

	state := &questRatingStateRecord{
		AssignmentsTotal: len(assignments),
	}
	uniqueRaters := map[string]bool{}
	for _, assignment := range assignments {
		assignmentRating, err := service.FindRatingStateByAssignment(ctx, assignment.ID, viewerAuthUserID)
		if err != nil {
			return nil, err
		}

		state.RatingCount += assignmentRating.RatingCount
		if assignmentRating.GiverRated {
			state.GiverRated = true
		}
		if assignmentRating.RunnerRated {
			state.RunnerRated = true
		}
		if assignmentRating.ViewerHasRated {
			state.ViewerHasRated = true
		}
		if assignmentRating.BothRated {
			state.AssignmentsBothRated++
		}

		rows, err := service.client.SelectMany(ctx, "quest_ratings", "rater_auth_user_id", map[string]string{
			"assignment_id": assignment.ID,
		}, &config.SelectOptions{Limit: 10})
		if err != nil {
			return nil, err
		}
		for _, row := range rows {
			if raterID := config.NormalizeString(row["rater_auth_user_id"]); raterID != "" {
				uniqueRaters[raterID] = true
			}
		}
	}

	state.UniqueRatingCount = len(uniqueRaters)
	state.BothRated = state.AssignmentsTotal > 0 && state.AssignmentsBothRated == state.AssignmentsTotal
	return state, nil
}

func isGiverClosedQuest(record *questRecord, escrow *escrowRecord, ratingState *questRatingStateRecord) bool {
	if record == nil || ratingState == nil {
		return false
	}
	escrowState := ""
	if escrow != nil {
		escrowState = escrow.EscrowState
	}
	return strings.EqualFold(record.Status, "completed") &&
		strings.EqualFold(escrowState, "released") &&
		ratingState.BothRated
}

func isGiverHistoryQuest(record *questRecord, escrow *escrowRecord, ratingState *questRatingStateRecord) bool {
	if isGiverClosedQuest(record, escrow, ratingState) {
		return true
	}
	if record != nil {
		switch strings.ToLower(strings.TrimSpace(record.Status)) {
		case "disputed", "cancelled":
			return true
		}
	}
	if escrow != nil {
		switch strings.ToLower(strings.TrimSpace(escrow.EscrowState)) {
		case "disputed", "refund":
			return true
		}
	}
	return false
}

func toGiverQuestPayload(record *questRecord, escrow *escrowRecord, ratingState *questRatingStateRecord) fiber.Map {
	if record == nil {
		return fiber.Map{}
	}

	currentRunnerCount := parseOptionalInt(record.CurrentRunnerCount)
	maxRunner := parseOptionalInt(record.MaxRunner)
	location := fiber.Map{
		"label":        firstNonEmpty(record.SubDistrict, record.District, record.City, record.FullAddress),
		"full_address": record.FullAddress,
		"sub_district": record.SubDistrict,
		"district":     record.District,
		"city":         record.City,
		"province":     record.Province,
		"postal_code":  record.PostalCode,
		"lat":          parseOptionalFloat(record.Lat),
		"lng":          parseOptionalFloat(record.Lng),
	}
	capacity := fiber.Map{
		"current_runner_count": currentRunnerCount,
		"max_runner":           maxRunner,
	}

	return fiber.Map{
		"id":                   record.ID,
		"quest_id":             record.ID,
		"title":                record.Title,
		"description":          record.Description,
		"category":             record.Category,
		"skill_tags":           record.SkillTags,
		"mode":                 record.Mode,
		"status":               record.Status,
		"reward_amount":        record.RewardAmount,
		"reward_currency":      firstNonEmpty(record.RewardCurrency, "IDR"),
		"reward_display":       buildRewardDisplay(record.RewardAmount, record.RewardCurrency),
		"current_runner_count": currentRunnerCount,
		"max_runner":           maxRunner,
		"province":             record.Province,
		"city":                 record.City,
		"district":             record.District,
		"sub_district":         record.SubDistrict,
		"full_address":         record.FullAddress,
		"postal_code":          record.PostalCode,
		"lat":                  parseOptionalFloat(record.Lat),
		"lng":                  parseOptionalFloat(record.Lng),
		"location":             location,
		"capacity":             capacity,
		"starts_at":            optionalTimeValue(record.StartsAt),
		"ends_at":              optionalTimeValue(record.EndsAt),
		"published_at":         optionalTimeValue(record.PublishedAt),
		"created_at":           optionalTimeValue(record.CreatedAt),
		"updated_at":           optionalTimeValue(record.UpdatedAt),
		"escrow":               toQuestEscrowPayload(escrow),
		"rating_state":         toQuestRatingStatePayload(ratingState),
	}
}

func toQuestRatingStatePayload(record *questRatingStateRecord) fiber.Map {
	if record == nil {
		record = &questRatingStateRecord{}
	}
	return fiber.Map{
		"rating_count":           record.RatingCount,
		"unique_rating_count":    record.UniqueRatingCount,
		"assignments_total":      record.AssignmentsTotal,
		"assignments_both_rated": record.AssignmentsBothRated,
		"giver_rated":            record.GiverRated,
		"runner_rated":           record.RunnerRated,
		"viewer_has_rated":       record.ViewerHasRated,
		"both_rated":             record.BothRated,
	}
}

func collectStringArray(value any) []string {
	switch typed := value.(type) {
	case []any:
		out := make([]string, 0, len(typed))
		for _, item := range typed {
			if normalized := config.NormalizeString(item); normalized != "" {
				out = append(out, normalized)
			}
		}
		return out
	case string:
		if trimmed := strings.TrimSpace(typed); trimmed != "" {
			return []string{trimmed}
		}
	}
	return []string{}
}

func normalizeQuestMode(value string) string {
	switch strings.ToLower(strings.TrimSpace(value)) {
	case "group":
		return "group"
	default:
		return "solo"
	}
}

func normalizeQuestStatus(value string) string {
	switch strings.ToLower(strings.TrimSpace(value)) {
	case "draft":
		return "draft"
	default:
		return "draft"
	}
}

func parseOrDefaultInt(value string, defaultValue int) int {
	trimmed := strings.TrimSpace(value)
	if trimmed == "" {
		return defaultValue
	}
	parsed, err := strconv.Atoi(trimmed)
	if err != nil || parsed <= 0 {
		return defaultValue
	}
	return parsed
}

func parseRequestTime(value string) (time.Time, error) {
	layouts := []string{
		time.RFC3339,
		time.RFC3339Nano,
		time.DateOnly,
		"2006-01-02 15:04:05",
	}
	for _, layout := range layouts {
		if parsed, err := time.Parse(layout, value); err == nil {
			return parsed, nil
		}
	}
	return time.Time{}, config.NewAppError("Format waktu quest tidak valid.", fiber.StatusBadRequest)
}

func buildRewardDisplay(amount string, currency string) string {
	normalizedAmount := strings.TrimSpace(amount)
	if normalizedAmount == "" {
		return ""
	}
	return firstNonEmpty(strings.TrimSpace(currency), "IDR") + " " + normalizedAmount
}

func parseOptionalInt(value string) any {
	trimmed := strings.TrimSpace(value)
	if trimmed == "" {
		return nil
	}
	parsed, err := strconv.Atoi(trimmed)
	if err != nil {
		return nil
	}
	return parsed
}

func parseOptionalFloat(value string) any {
	trimmed := strings.TrimSpace(value)
	if trimmed == "" {
		return nil
	}
	parsed, err := strconv.ParseFloat(trimmed, 64)
	if err != nil {
		return nil
	}
	return parsed
}

func resolveGiverQuestAction(c fiber.Ctx) string {
	path := strings.TrimSuffix(strings.ToLower(c.Path()), "/")
	if strings.HasSuffix(path, "/escrow/lock") {
		return "lock"
	}
	if strings.HasSuffix(path, "/publish") {
		return "publish"
	}
	return "create"
}

func normalizePaymentMethod(value string) string {
	switch strings.ToLower(strings.TrimSpace(value)) {
	case "wallet":
		return "wallet"
	case "qris":
		return "qris"
	default:
		return "virtual_account"
	}
}

func toQuestEscrowPayload(record *escrowRecord) fiber.Map {
	if record == nil {
		return fiber.Map{}
	}

	return fiber.Map{
		"id":                  record.ID,
		"quest_id":            record.QuestID,
		"escrow_state":        record.EscrowState,
		"reward_amount":       record.RewardAmount,
		"platform_fee_amount": record.PlatformFeeAmount,
		"total_amount":        record.TotalAmount,
		"payment_method":      record.PaymentMethod,
		"payment_reference":   record.PaymentReference,
		"paid_at":             optionalTimeValue(record.PaidAt),
		"locked_at":           optionalTimeValue(record.LockedAt),
		"released_at":         optionalTimeValue(record.ReleasedAt),
		"disputed_at":         optionalTimeValue(record.DisputedAt),
		"refunded_at":         optionalTimeValue(record.RefundedAt),
	}
}
