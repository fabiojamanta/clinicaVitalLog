from pydantic import field_validator, model_validator
from pydantic_settings import BaseSettings

INSECURE_SECRET_PLACEHOLDER = "troque-esta-chave-em-producao"


class Settings(BaseSettings):
    DATABASE_URL: str = "sqlite:///./clinica_estoque.db"
    ENV: str = "development"
    SECRET_KEY: str = INSECURE_SECRET_PLACEHOLDER
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 120
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    CORS_ORIGINS: str = "http://localhost:4200,http://127.0.0.1:4200"
    APP_NAME: str = "VitalLog"
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
        return self.ENV.lower() in ("production", "prod")

    def cors_origins_list(self) -> list[str]:
        raw = (self.CORS_ORIGINS or "*").strip()
        if raw == "*":
            return ["*"]
        return [o.strip() for o in raw.split(",") if o.strip()]

    @model_validator(mode="after")
    def validate_production_secrets(self):
        if self.is_production and self.SECRET_KEY == INSECURE_SECRET_PLACEHOLDER:
            raise ValueError("SECRET_KEY deve ser definida em produção (ENV=production)")
        return self

    class Config:
        env_file = ".env"


settings = Settings()
