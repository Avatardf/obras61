from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # App
    app_name: str = "Obras Platform"
    environment: str = "development"
    debug: bool = False

    # Database
    database_url: str

    # Auth
    secret_key: str
    algorithm: str = "HS256"
    access_token_expire_minutes: int = 60 * 8  # 8 horas

    # Redis / Celery
    redis_url: str = "redis://localhost:6379/0"

    # CORS — em produção defina via env var (lista JSON):
    # ALLOWED_ORIGINS='["https://app.61brasil.com.br"]'
    allowed_origins: list[str] = [
        "http://localhost:5173",
        "http://localhost:3000",
    ]

    # Storage
    storage_bucket: str = "obras-dev"
    storage_endpoint: str | None = None
    storage_access_key: str | None = None
    storage_secret_key: str | None = None
    storage_region: str = "us-east-1"

    # IA
    gemini_api_key: str | None = None

    # Bases de custo
    sinapi_api_url: str = "https://apisinapi.caixa.gov.br"
    sinapi_token: str | None = None

    @property
    def is_production(self) -> bool:
        return self.environment == "production"


settings = Settings()
