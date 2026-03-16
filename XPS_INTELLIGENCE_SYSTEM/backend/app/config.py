from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env", env_file_encoding="utf-8", extra="ignore"
    )

    # ── Database (Railway Postgres or local) ─────────────────────────────────
    DATABASE_URL: str = "postgresql://leadgen:leadgen123@localhost:5432/leadgen"

    # ── Redis (Railway Redis or local) ───────────────────────────────────────
    REDIS_URL: str = "redis://localhost:6379/0"

    # ── Security ─────────────────────────────────────────────────────────────
    SECRET_KEY: str = "dev-secret-key-change-in-production"

    # ── LLM Providers ────────────────────────────────────────────────────────
    # Routing: "auto" tries Groq → Ollama → OpenAI in priority order.
    # Set to "groq" for Railway (cloud), "ollama" for local Docker Desktop.
    LLM_PROVIDER: str = "auto"

    # Groq (used by frontend; also available for backend inference)
    GROQ_API_KEY: str = ""
    GROQ_MODEL: str = "llama3-8b-8192"

    # Ollama (Railway Ollama service or local Docker container)
    OLLAMA_BASE_URL: str = "http://localhost:11434"
    OLLAMA_MODEL: str = "llama3.2"

    # OpenAI (fallback)
    OPENAI_API_KEY: str = ""
    OPENAI_MODEL: str = "gpt-4o-mini"

    # ── CORS / Frontend ───────────────────────────────────────────────────────
    # Comma-separated list of allowed frontend origins.
    # Leave empty to allow all origins (development default).
    CORS_ALLOWED_ORIGINS: str = ""
    # Base URL of the frontend (XPS-INTELLIGENCE-FRONTEND) for link generation.
    FRONTEND_URL: str = ""

    # ── Integrations ─────────────────────────────────────────────────────────
    SENDGRID_API_KEY: str = ""
    GITHUB_TOKEN: str = ""
    GITHUB_REPO: str = "InfinityXOneSystems/XPS_INTELLIGENCE_SYSTEM"
    GOOGLE_SHEETS_CREDENTIALS: str = ""

    # ── Scraper / Worker ─────────────────────────────────────────────────────
    SCRAPER_CONCURRENCY: int = 10
    MAX_LEADS_PER_DAY: int = 100000
    # Shadow REST Scraper settings (no API keys required)
    PLAYWRIGHT_ENABLED: bool = True
    SCRAPER_TIMEOUT: int = 20

    # Derived
    @property
    def async_database_url(self) -> str:
        return self.DATABASE_URL.replace("postgresql://", "postgresql+asyncpg://")

    @property
    def cors_origins(self) -> list[str]:
        """Return parsed CORS origins list. Wildcard '*' when not configured."""
        if not self.CORS_ALLOWED_ORIGINS:
            return ["*"]
        return [o.strip() for o in self.CORS_ALLOWED_ORIGINS.split(",") if o.strip()]


settings = Settings()
