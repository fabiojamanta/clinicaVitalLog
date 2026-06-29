import os
import re

from pydantic import field_validator, model_validator
from pydantic_settings import BaseSettings

INSECURE_SECRET_PLACEHOLDER = "troque-esta-chave-em-producao"
_PASSWORD_RE = re.compile(r"^(?=.*[A-Za-z])(?=.*\d).{8,}$")


class Settings(BaseSettings):
    DATABASE_URL: str = "sqlite:///./clinica_estoque.db"
    ENV: str = "development"
    SECRET_KEY: str = INSECURE_SECRET_PLACEHOLDER
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 120
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    CORS_ORIGINS: str = "http://localhost:4200,http://127.0.0.1:4200"
    APP_NAME: str = "Sanelis Medical EcoSystem"
    TIMEZONE: str = "America/Sao_Paulo"
    WRITE_OFF_CLIENT_NAME: str = "Baixa de estoque / Descarte"
    ADMIN_EMAIL: str = ""
    ADMIN_PASSWORD: str = ""
    PUBLIC_SIGN_PIN: str = ""

    @field_validator("DATABASE_URL", mode="before")
    @classmethod
    def fix_postgres_url(cls, v: str) -> str:
        if isinstance(v, str) and v.startswith("postgres://"):
            return v.replace("postgres://", "postgresql://", 1)
        return v

    @property
    def is_production(self) -> bool:
        if self.ENV.lower() in ("production", "prod"):
            return True
        return os.environ.get("RENDER") == "true"

    def cors_origins_list(self) -> list[str]:
        raw = (self.CORS_ORIGINS or "*").strip()
        if raw == "*":
            return ["*"]
        return [o.strip() for o in raw.split(",") if o.strip()]

    @model_validator(mode="after")
    def validate_production_secrets(self):
        if self.is_production:
            if self.SECRET_KEY == INSECURE_SECRET_PLACEHOLDER:
                raise ValueError("SECRET_KEY deve ser definida em produção (ENV=production)")
            if "*" in self.cors_origins_list():
                raise ValueError("CORS_ORIGINS não pode ser * em produção")
            if self.ADMIN_PASSWORD and not _PASSWORD_RE.match(self.ADMIN_PASSWORD):
                raise ValueError("ADMIN_PASSWORD deve ter letras e números (mín. 8 caracteres) em produção")
        return self

    class Config:
        env_file = ".env"


settings = Settings()
