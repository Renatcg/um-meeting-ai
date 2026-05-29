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
    openai_media_transcription_model: str = "gpt-4o-mini-transcribe"
    openai_intervention_model: str = "gpt-4o-mini"
    openai_summary_model: str = "gpt-4o-mini"
    cors_origins: str = "http://localhost:3000"
    hosted_web_origin: str = "https://um-copilot.vercel.app"
    agent_api_key: str | None = None
    jarvis_agent_name: str = "jarvis"
    copilot_auto_dispatch: bool = True
    copilot_dispatch_timeout_seconds: float = 5.0
    smtp_host: str | None = None
    smtp_port: int = 587
    smtp_username: str | None = None
    smtp_password: str | None = None
    smtp_from_email: str = "contato@coevolabs.com"
    smtp_from_name: str = "Coevo Labs"
    resend_api_key: str | None = None
    resend_from_email: str = "contato@coevolabs.com"
    resend_from_name: str = "Coevo Labs"
    google_client_id: str | None = None
    google_client_secret: str | None = None
    google_calendar_redirect_uri: str | None = None
    google_calendar_time_zone: str = "America/Sao_Paulo"
    recordings_enabled: bool = False
    recording_storage_provider: str = "s3"
    recording_s3_bucket: str | None = None
    recording_s3_region: str = "auto"
    recording_s3_access_key_id: str | None = None
    recording_s3_secret_access_key: str | None = None
    recording_s3_endpoint: str | None = None
    recording_s3_force_path_style: bool = True
    recording_public_base_url: str | None = None
    recording_object_prefix: str = "recordings"
    meeting_cleanup_enabled: bool = True
    meeting_cleanup_interval_seconds: int = 300
    evo_api_enabled: bool = False
    evo_api_base_url: str | None = None
    evo_api_key: str | None = None
    evo_api_instance: str | None = None
    evo_api_webhook_secret: str | None = None
    whatsapp_allowed_phones: str = ""
    whatsapp_send_audio_replies: bool = True
    whatsapp_audio_voice: str = "marin"
    whatsapp_tts_model: str = "gpt-4o-mini-tts"
    whatsapp_group_enabled: bool = True
    whatsapp_group_summary_limit: int = 80
    smart_speaker_api_key: str | None = None
    smart_speaker_tts_model: str = "gpt-4o-mini-tts"
    smart_speaker_default_mimetype: str = "audio/wav"
    client_directory_enabled: bool = False
    client_directory_api_url: str | None = None
    client_directory_api_key: str | None = None
    client_directory_auth_header: str = "Authorization"
    client_directory_auth_scheme: str = "Bearer"
    client_directory_name_field: str = "name"
    client_directory_external_id_field: str = "id"
    client_directory_items_path: str = ""
    client_directory_sync_enabled: bool = True
    client_directory_sync_hours: str = "6,14"
    client_directory_sync_interval_seconds: int = 300

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

    @property
    def google_redirect_uri(self) -> str:
        if self.google_calendar_redirect_uri:
            return self.google_calendar_redirect_uri
        return "http://localhost:8000/integrations/google-calendar/callback"

    @property
    def allowed_whatsapp_phones(self) -> set[str]:
        return {
            "".join(character for character in phone if character.isdigit())
            for phone in self.whatsapp_allowed_phones.split(",")
            if phone.strip()
        }

    @property
    def client_directory_sync_hour_set(self) -> set[int]:
        hours: set[int] = set()
        for raw_hour in self.client_directory_sync_hours.split(","):
            try:
                hour = int(raw_hour.strip())
            except ValueError:
                continue
            if 0 <= hour <= 23:
                hours.add(hour)
        return hours or {6, 14}


@lru_cache
def get_settings() -> Settings:
    return Settings()
