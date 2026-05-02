from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    livekit_url: str
    livekit_api_key: str
    livekit_api_secret: str
    database_url: str = "postgresql://postgres:postgres@localhost:5432/um_meeting_ai"
    app_jwt_secret: str = "dev-only-change-me"
    openai_api_key: str | None = None
    openai_embedding_model: str = "text-embedding-3-small"
    openai_embedding_dimensions: int = 1536
    cors_origins: str = "http://localhost:3000"
    hosted_web_origin: str = "https://um-copilot.vercel.app"
    agent_api_key: str | None = None
    copilot_agent_name: str = "um-copilot"
    copilot_auto_dispatch: bool = True
    copilot_dispatch_timeout_seconds: float = 5.0

    model_config = SettingsConfigDict(
        env_file=("../../.env", ".env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    @property
    def allowed_origins(self) -> list[str]:
        origins = [
            origin.strip().rstrip("/")
            for origin in self.cors_origins.split(",")
            if origin.strip()
        ]
        hosted_origin = self.hosted_web_origin.rstrip("/")
        if hosted_origin not in origins:
            origins.append(hosted_origin)
        return origins


@lru_cache
def get_settings() -> Settings:
    return Settings()
