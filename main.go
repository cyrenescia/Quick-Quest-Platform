package main

import (
	"log"
	"strings"

	"Stream-StrictMode/config"
	"Stream-StrictMode/routes/admin"
	"Stream-StrictMode/routes/dispute"
	giverassignment "Stream-StrictMode/routes/giver-assignment"
	giverquest "Stream-StrictMode/routes/giver-quest"
	"Stream-StrictMode/routes/login"
	"Stream-StrictMode/routes/logout"
	"Stream-StrictMode/routes/performance"
	"Stream-StrictMode/routes/profile"
	"Stream-StrictMode/routes/quest"
	"Stream-StrictMode/routes/rating"
	"Stream-StrictMode/routes/register"
	runnerquest "Stream-StrictMode/routes/runner-quest"
	userverification "Stream-StrictMode/routes/user-verification"

	"github.com/gofiber/fiber/v3"
	"github.com/joho/godotenv"
)

func main() {
	_ = godotenv.Load()

	appConfig, err := config.LoadAppConfigFromEnv()
	if err != nil {
		log.Fatalf("gagal membaca konfigurasi strict backend: %v", err)
	}

	client, err := config.NewSupabaseClient(appConfig.SupabaseURL, appConfig.SupabaseKey)
	if err != nil {
		log.Fatalf("gagal inisialisasi koneksi Supabase: %v", err)
	}

	app := fiber.New()
	app.Use(corsMiddleware(appConfig))

	loginHandler := login.Login(login.NewService(client, appConfig))
	registerHandler := register.Register(register.NewService(client))
	profileService := profile.NewService(client, appConfig)
	profileHandler := profile.Profile(profileService)
	questService := quest.NewService(client, appConfig)
	questHandler := quest.Quest(questService)
	giverQuestService := giverquest.NewService(client, appConfig)
	giverQuestHandler := giverquest.GiverQuest(giverQuestService)
	giverAssignmentService := giverassignment.NewService(client, appConfig)
	giverAssignmentHandler := giverassignment.GiverAssignment(giverAssignmentService)
	adminService := admin.NewService(client, appConfig)
	adminHandler := admin.Admin(adminService)
	disputeService := dispute.NewService(client, appConfig)
	disputeHandler := dispute.Dispute(disputeService)
	ratingService := rating.NewService(client, appConfig)
	ratingHandler := rating.Rating(ratingService)
	performanceService := performance.NewService(client, appConfig)
	performanceHandler := performance.Performance(performanceService)
	runnerQuestService := runnerquest.NewService(client, appConfig)
	runnerQuestHandler := runnerquest.RunnerQuest(runnerQuestService)
	verificationService := userverification.NewService(client, appConfig)
	profileVerificationHandler := userverification.Verification(verificationService)
	profileVerificationDraftHandler := userverification.VerificationDraft(verificationService)
	profileVerificationDocumentsHandler := userverification.VerificationDocuments(verificationService)
	profileVerificationSubmitHandler := userverification.VerificationSubmit(verificationService)
	profileVerificationResubmitHandler := userverification.VerificationResubmit(verificationService)
	profileVerificationHistoryHandler := userverification.VerificationHistory(verificationService)
	logoutHandler := logout.Logout(logout.NewService(appConfig))

	app.Get("/", func(c fiber.Ctx) error {
		return c.JSON(fiber.Map{
			"success": true,
			"message": "Quick Quest Stream strict gateway aktif.",
		})
	})

	api := app.Group("/api")
	api.Post("/login", loginHandler)
	api.Options("/login", loginHandler)
	api.Post("/register", registerHandler)
	api.Options("/register", registerHandler)
	api.Post("/logout", logoutHandler)
	api.Options("/logout", logoutHandler)
	api.Get("/profile", profileHandler)
	api.Put("/profile", profileHandler)
	api.Options("/profile", profileHandler)
	api.Get("/quests", questHandler)
	api.Get("/quests/:id", questHandler)
	api.Options("/quests", questHandler)
	api.Options("/quests/:id", questHandler)
	api.Get("/giver/quests", giverQuestHandler)
	api.Get("/giver/quests/history", giverQuestHandler)
	api.Post("/giver/quests", giverQuestHandler)
	api.Options("/giver/quests", giverQuestHandler)
	api.Options("/giver/quests/history", giverQuestHandler)
	api.Put("/giver/quests/:id", giverQuestHandler)
	api.Delete("/giver/quests/:id", giverQuestHandler)
	api.Options("/giver/quests/:id", giverQuestHandler)
	api.Post("/giver/quests/:id/escrow/lock", giverQuestHandler)
	api.Options("/giver/quests/:id/escrow/lock", giverQuestHandler)
	api.Post("/giver/quests/:id/publish", giverQuestHandler)
	api.Options("/giver/quests/:id/publish", giverQuestHandler)
	api.Get("/giver/quests/:id/assignments", giverAssignmentHandler)
	api.Options("/giver/quests/:id/assignments", giverAssignmentHandler)
	api.Post("/giver/assignments/:id/accept", giverAssignmentHandler)
	api.Post("/giver/assignments/:id/confirm", giverAssignmentHandler)
	api.Post("/giver/assignments/:id/reject", giverAssignmentHandler)
	api.Post("/giver/assignments/:id/share-location", giverAssignmentHandler)
	api.Post("/giver/assignments/:id/request-revision", giverAssignmentHandler)
	api.Post("/giver/assignments/:id/dispute", giverAssignmentHandler)
	api.Options("/giver/assignments/:id/accept", giverAssignmentHandler)
	api.Options("/giver/assignments/:id/confirm", giverAssignmentHandler)
	api.Options("/giver/assignments/:id/reject", giverAssignmentHandler)
	api.Options("/giver/assignments/:id/share-location", giverAssignmentHandler)
	api.Options("/giver/assignments/:id/request-revision", giverAssignmentHandler)
	api.Options("/giver/assignments/:id/dispute", giverAssignmentHandler)
	api.Get("/admin/verifications", adminHandler)
	api.Get("/admin/verifications/:id", adminHandler)
	api.Get("/admin/disputes", adminHandler)
	api.Get("/admin/disputes/:id", adminHandler)
	api.Post("/admin/verifications/:id/approve", adminHandler)
	api.Post("/admin/verifications/:id/reject", adminHandler)
	api.Post("/admin/verifications/:id/resubmission", adminHandler)
	api.Post("/admin/disputes/:id/mediate", adminHandler)
	api.Post("/admin/escrows/auto-release", adminHandler)
	api.Options("/admin/verifications", adminHandler)
	api.Options("/admin/verifications/:id", adminHandler)
	api.Options("/admin/disputes", adminHandler)
	api.Options("/admin/disputes/:id", adminHandler)
	api.Options("/admin/verifications/:id/approve", adminHandler)
	api.Options("/admin/verifications/:id/reject", adminHandler)
	api.Options("/admin/verifications/:id/resubmission", adminHandler)
	api.Options("/admin/disputes/:id/mediate", adminHandler)
	api.Options("/admin/escrows/auto-release", adminHandler)
	api.Get("/disputes", disputeHandler)
	api.Get("/disputes/:id", disputeHandler)
	api.Post("/disputes", disputeHandler)
	api.Post("/disputes/:id/evidence", disputeHandler)
	api.Post("/disputes/:id/mediate", disputeHandler)
	api.Options("/disputes", disputeHandler)
	api.Options("/disputes/:id", disputeHandler)
	api.Options("/disputes/:id/evidence", disputeHandler)
	api.Options("/disputes/:id/mediate", disputeHandler)
	api.Post("/ratings", ratingHandler)
	api.Options("/ratings", ratingHandler)
	api.Get("/performance/summary", performanceHandler)
	api.Get("/performance/ledger", performanceHandler)
	api.Get("/performance/skills", performanceHandler)
	api.Get("/performance/ratings", performanceHandler)
	api.Options("/performance/summary", performanceHandler)
	api.Options("/performance/ledger", performanceHandler)
	api.Options("/performance/skills", performanceHandler)
	api.Options("/performance/ratings", performanceHandler)
	api.Get("/runner/tier-status", runnerQuestHandler)
	api.Get("/runner/quests/active", runnerQuestHandler)
	api.Get("/runner/quests/history", runnerQuestHandler)
	api.Post("/runner/quests/:id/take", runnerQuestHandler)
	api.Post("/runner/quests/:id/start", runnerQuestHandler)
	api.Post("/runner/quests/:id/finish", runnerQuestHandler)
	api.Options("/runner/tier-status", runnerQuestHandler)
	api.Options("/runner/quests/active", runnerQuestHandler)
	api.Options("/runner/quests/history", runnerQuestHandler)
	api.Options("/runner/quests/:id/take", runnerQuestHandler)
	api.Options("/runner/quests/:id/start", runnerQuestHandler)
	api.Options("/runner/quests/:id/finish", runnerQuestHandler)
	api.Get("/profile/verification", profileVerificationHandler)
	api.Options("/profile/verification", profileVerificationHandler)
	api.Post("/profile/verification/draft", profileVerificationDraftHandler)
	api.Options("/profile/verification/draft", profileVerificationDraftHandler)
	api.Post("/profile/verification/documents", profileVerificationDocumentsHandler)
	api.Options("/profile/verification/documents", profileVerificationDocumentsHandler)
	api.Post("/profile/verification/submit", profileVerificationSubmitHandler)
	api.Options("/profile/verification/submit", profileVerificationSubmitHandler)
	api.Post("/profile/verification/resubmit", profileVerificationResubmitHandler)
	api.Options("/profile/verification/resubmit", profileVerificationResubmitHandler)
	api.Get("/profile/verification/history", profileVerificationHistoryHandler)
	api.Options("/profile/verification/history", profileVerificationHistoryHandler)

	log.Printf("Stream strict gateway running on http://localhost:%s", appConfig.Port)
	log.Fatal(app.Listen(":" + appConfig.Port))
}

func corsMiddleware(appConfig config.AppConfig) fiber.Handler {
	return func(c fiber.Ctx) error {
		origin := strings.TrimSpace(c.Get("Origin"))
		if config.IsAllowedOrigin(appConfig, origin) {
			c.Set("Access-Control-Allow-Origin", origin)
			c.Set("Vary", "Origin")
		}

		c.Set("Access-Control-Allow-Credentials", "true")
		c.Set("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS")
		c.Set("Access-Control-Allow-Headers", "Content-Type,Authorization")

		if c.Method() == fiber.MethodOptions {
			return c.SendStatus(fiber.StatusNoContent)
		}

		return c.Next()
	}
}
