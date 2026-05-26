from uuid import UUID
from pydantic import BaseModel, EmailStr


# ── Requests ──────────────────────────────────────────────────────────────────

class LoginRequest(BaseModel):
    email: EmailStr
    senha: str


class TenantCreate(BaseModel):
    nome: str
    cnpj: str
    email_admin: EmailStr
    senha_admin: str
    nome_admin: str


# ── Responses ─────────────────────────────────────────────────────────────────

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int  # segundos
    user: "UserMe"


class UserMe(BaseModel):
    id: UUID
    nome: str
    email: str
    papel: str
    tenant_id: UUID
    tenant_nome: str

    model_config = {"from_attributes": True}


TokenResponse.model_rebuild()
