from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    REDIS_URL: str = "redis://redis:6379/0"
    API_V1_PREFIX: str = "/v1"
    PROJECT_NAME: str = "Currency & Exchange Microservice"
    CORS_ORIGINS: list[str] = ["http://localhost:5173"]
    CORS_ORIGIN_REGEX: str = r"^https:\/\/.*\.vercel\.app$"

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=True,
        extra="ignore"
    )


settings = Settings()
