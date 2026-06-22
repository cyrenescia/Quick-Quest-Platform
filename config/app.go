package config

import (
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"net/url"
	"os"
	"strconv"
	"strings"

	"github.com/gofiber/fiber/v3"
)

const (
	UserRoleRunner   = "user_runner"
	UserRoleUnlocked = "user_unlocked"
)

type AppConfig struct {
	Port                  string
	SupabaseURL           string
	SupabaseKey           string
	SessionCookieName     string
	RoleCookieName        string
	SessionCookieSameSite string
	SessionCookieSecure   bool
	AllowedOrigins        []string
	RunnerQ2MinPP         float64
	RunnerQ3MinPP         float64
	RunnerQ3MinSR         float64
	RunnerRiskLowMax      int
	RunnerRiskModerateMax int
}

type AppError struct {
	Message    string
	StatusCode int
}

func (e *AppError) Error() string {
	if e == nil {
		return ""
	}
	return e.Message
}

func NewAppError(message string, statusCode int) error {
	if statusCode <= 0 {
		statusCode = fiber.StatusBadRequest
	}

	return &AppError{
		Message:    strings.TrimSpace(message),
		StatusCode: statusCode,
	}
}

func LoadAppConfigFromEnv() (AppConfig, error) {
	cfg := AppConfig{
		Port:                  FirstNonEmpty(os.Getenv("PORT"), "4450"),
		SupabaseURL:           strings.TrimSpace(os.Getenv("SUPABASE_URL")),
		SupabaseKey:           FirstNonEmpty(os.Getenv("SUPABASE_SERVICE_KEY"), os.Getenv("SUPABASE_KEY"), os.Getenv("SERVICE_KEY"), os.Getenv("SUPABASE_API_KEY")),
		SessionCookieName:     FirstNonEmpty(os.Getenv("AUTH_SESSION_COOKIE_NAME"), os.Getenv("SESSION_COOKIE_NAME"), "qqm_session"),
		RoleCookieName:        FirstNonEmpty(os.Getenv("AUTH_ROLE_COOKIE_NAME"), os.Getenv("ROLE_COOKIE_NAME"), "qqm_role_session"),
		SessionCookieSameSite: NormalizeSameSite(FirstNonEmpty(os.Getenv("AUTH_COOKIE_SAME_SITE"), os.Getenv("SESSION_COOKIE_SAMESITE"))),
		SessionCookieSecure:   ToBooleanFlag(FirstNonEmpty(os.Getenv("AUTH_COOKIE_SECURE"), os.Getenv("SESSION_COOKIE_SECURE")), false),
		RunnerQ2MinPP:         ToFloatFlag(FirstNonEmpty(os.Getenv("RUNNER_Q2_MIN_PP"), os.Getenv("Q2_MIN_PP")), 500),
		RunnerQ3MinPP:         ToFloatFlag(FirstNonEmpty(os.Getenv("RUNNER_Q3_MIN_PP"), os.Getenv("Q3_MIN_PP")), 2000),
		RunnerQ3MinSR:         ToFloatFlag(FirstNonEmpty(os.Getenv("RUNNER_Q3_MIN_SR"), os.Getenv("Q3_MIN_SR")), 6),
		RunnerRiskLowMax:      ToIntFlag(FirstNonEmpty(os.Getenv("RUNNER_RISK_LOW_MAX"), os.Getenv("RISK_LOW_MAX")), 30),
		RunnerRiskModerateMax: ToIntFlag(FirstNonEmpty(os.Getenv("RUNNER_RISK_MODERATE_MAX"), os.Getenv("RISK_MODERATE_MAX")), 60),
		AllowedOrigins: []string{
			"http://localhost:5173",
			"https://neiraverse.com",
		},
	}

	if cfg.SupabaseURL == "" {
		return AppConfig{}, errors.New("SUPABASE_URL wajib diisi.")
	}

	if cfg.SupabaseKey == "" {
		return AppConfig{}, errors.New("SUPABASE key wajib diisi.")
	}

	return cfg, nil
}

func FirstNonEmpty(values ...string) string {
	for _, value := range values {
		trimmed := strings.TrimSpace(value)
		if trimmed != "" {
			return trimmed
		}
	}
	return ""
}

func ToBooleanFlag(value string, defaultValue bool) bool {
	normalized := strings.ToLower(strings.TrimSpace(value))
	if normalized == "" {
		return defaultValue
	}

	switch normalized {
	case "1", "true", "yes", "y", "on":
		return true
	case "0", "false", "no", "n", "off":
		return false
	default:
		return defaultValue
	}
}

func ToFloatFlag(value string, defaultValue float64) float64 {
	normalized := strings.TrimSpace(value)
	if normalized == "" {
		return defaultValue
	}

	parsed, err := strconv.ParseFloat(normalized, 64)
	if err != nil {
		return defaultValue
	}

	return parsed
}

func ToIntFlag(value string, defaultValue int) int {
	normalized := strings.TrimSpace(value)
	if normalized == "" {
		return defaultValue
	}

	parsed, err := strconv.Atoi(normalized)
	if err != nil {
		return defaultValue
	}

	return parsed
}

func NormalizeSameSite(value string) string {
	switch strings.ToLower(strings.TrimSpace(value)) {
	case "strict", "none":
		return strings.ToLower(strings.TrimSpace(value))
	default:
		return "lax"
	}
}

func ResolveCookieSecure(cfg AppConfig) bool {
	return cfg.SessionCookieSecure || cfg.SessionCookieSameSite == "none"
}

func IsAllowedOrigin(cfg AppConfig, origin string) bool {
	trimmed := strings.TrimSpace(origin)
	if trimmed == "" {
		return false
	}

	for _, candidate := range cfg.AllowedOrigins {
		if trimmed == candidate {
			return true
		}
	}

	return false
}

func NormalizeUserRole(value string) string {
	switch strings.ToLower(strings.TrimSpace(value)) {
	case UserRoleUnlocked:
		return UserRoleUnlocked
	default:
		return UserRoleRunner
	}
}

func IsRoleSwitchEnabled(value string) bool {
	return NormalizeUserRole(value) == UserRoleUnlocked
}

func ParseJSONBody(c fiber.Ctx) (map[string]any, error) {
	payload := map[string]any{}
	raw := c.Body()
	if len(raw) == 0 {
		return payload, nil
	}

	if err := json.Unmarshal(raw, &payload); err != nil {
		return nil, NewAppError("Payload request harus berupa JSON valid.", fiber.StatusBadRequest)
	}

	return payload, nil
}

func WriteError(c fiber.Ctx, err error, fallbackMessage string) error {
	if err == nil {
		err = errors.New(strings.TrimSpace(fallbackMessage))
	}

	statusCode := fiber.StatusInternalServerError
	var typedErr *AppError
	if errors.As(err, &typedErr) {
		statusCode = typedErr.StatusCode
	}

	message := strings.TrimSpace(err.Error())
	if message == "" {
		message = strings.TrimSpace(fallbackMessage)
	}

	return c.Status(statusCode).JSON(fiber.Map{
		"success": false,
		"message": message,
	})
}

func MapSupabaseError(err error, fallbackMessage string) error {
	if err == nil {
		return nil
	}

	var reqErr *SupabaseRequestError
	if errors.As(err, &reqErr) {
		if reqErr.StatusCode == http.StatusConflict || strings.Contains(reqErr.Error(), "23505") {
			return NewAppError("Username, email, atau nomor HP sudah terdaftar.", fiber.StatusConflict)
		}

		return NewAppError(reqErr.Error(), fiber.StatusBadGateway)
	}

	message := strings.TrimSpace(err.Error())
	if message == "" {
		message = strings.TrimSpace(fallbackMessage)
	}

	return NewAppError(message, fiber.StatusBadGateway)
}

func NormalizeString(value any) string {
	switch typed := value.(type) {
	case nil:
		return ""
	case string:
		return strings.TrimSpace(typed)
	case json.Number:
		return strings.TrimSpace(typed.String())
	case float64:
		return strconv.FormatInt(int64(typed), 10)
	case float32:
		return strconv.FormatInt(int64(typed), 10)
	case int:
		return strconv.Itoa(typed)
	case int8:
		return strconv.FormatInt(int64(typed), 10)
	case int16:
		return strconv.FormatInt(int64(typed), 10)
	case int32:
		return strconv.FormatInt(int64(typed), 10)
	case int64:
		return strconv.FormatInt(typed, 10)
	case uint:
		return strconv.FormatUint(uint64(typed), 10)
	case uint8:
		return strconv.FormatUint(uint64(typed), 10)
	case uint16:
		return strconv.FormatUint(uint64(typed), 10)
	case uint32:
		return strconv.FormatUint(uint64(typed), 10)
	case uint64:
		return strconv.FormatUint(typed, 10)
	case bool:
		return strconv.FormatBool(typed)
	case fmt.Stringer:
		return strings.TrimSpace(typed.String())
	default:
		return strings.TrimSpace(fmt.Sprintf("%v", typed))
	}
}

func ResolveSessionToken(c fiber.Ctx, cookieName string) string {
	if bearerToken := ExtractBearerToken(c.Get("Authorization")); bearerToken != "" {
		return bearerToken
	}

	return ExtractCookieToken(c.Get("Cookie"), cookieName)
}

func ExtractBearerToken(header string) string {
	normalized := strings.TrimSpace(header)
	if normalized == "" {
		return ""
	}

	parts := strings.SplitN(normalized, " ", 2)
	if len(parts) != 2 || strings.ToLower(strings.TrimSpace(parts[0])) != "bearer" {
		return ""
	}

	return strings.TrimSpace(parts[1])
}

func ExtractCookieToken(header string, cookieName string) string {
	normalized := strings.TrimSpace(header)
	if normalized == "" {
		return ""
	}

	for _, pair := range strings.Split(normalized, ";") {
		segments := strings.Split(pair, "=")
		if len(segments) == 0 || strings.TrimSpace(segments[0]) != cookieName {
			continue
		}

		raw := strings.TrimSpace(strings.Join(segments[1:], "="))
		decoded, err := url.PathUnescape(raw)
		if err != nil {
			return raw
		}

		return strings.TrimSpace(decoded)
	}

	return ""
}
