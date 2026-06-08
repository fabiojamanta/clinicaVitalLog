from pydantic import field_validator
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    DATABASE_URL: str = "sqlite:///./clinica_estoque.db"

    @field_validator("DATABASE_URL", mode="before")
    @classmethod
    def fix_postgres_url(cls, v: str) -> str:
        if isinstance(v, str) and v.startswith("postgres://"):
            return v.replace("postgres://", "postgresql://", 1)
        return v
    SECRET_KEY: str = "troque-esta-chave-em-producao"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 480
    APP_NAME: str = "VitalLog"
    TIMEZONE: str = "America/Sao_Paulo"
    WRITE_OFF_CLIENT_NAME: str = "Baixa de estoque / Descarte"

    class Config:
        env_file = ".env"

settings = Settings()
