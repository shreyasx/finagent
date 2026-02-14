from pydantic_settings import BaseSettings
from functools import lru_cache


class Settings(BaseSettings):
    # App
    app_name: str = "FinAgent"
    debug: bool = False
    api_prefix: str = "/api"

    # Database
    database_url: str = "postgresql+asyncpg://finagent:finagent@localhost:5432/finagent"

    # ChromaDB
    chroma_host: str = "localhost"
    chroma_port: int = 8100
    chroma_collection: str = "financial_documents"

    # S3 / MinIO
    s3_endpoint: str = "http://localhost:9000"
    s3_access_key: str = "minioadmin"
    s3_secret_key: str = "minioadmin"
    s3_bucket: str = "finagent-documents"

    # LLM (Anthropic only)
    anthropic_api_key: str = ""
    default_llm: str = "claude-sonnet-4-5-20250929"

    # Auth
    jwt_secret: str = "change-me-in-production"
    jwt_expiry_hours: int = 24
    resend_api_key: str = ""
    verification_url_base: str = "http://localhost:3000/verify"
    max_interactions: int = 50

    # File Upload
    max_file_size_mb: int = 50
    allowed_extensions: list[str] = ["pdf", "csv", "xlsx"]

    # CORS
    cors_origins: list[str] = ["http://localhost:3000"]

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}


@lru_cache
def get_settings() -> Settings:
    return Settings()
