"""
API de Gerenciamento de Usuários — exclusivo para administradores do tenant.
"""
import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, EmailStr
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.security import hash_password
from app.database import get_db
from app.dependencies import AdminOnly
from app.models.tenant import Papel, User

router = APIRouter(prefix="/usuarios", tags=["usuários"])
DB = Depends(get_db)


# ── Schemas ────────────────────────────────────────────────────────────────────

class UsuarioResponse(BaseModel):
    id: uuid.UUID
    nome: str
    email: str
    papel: str
    ativo: bool

    model_config = {"from_attributes": True}


class UsuarioCreate(BaseModel):
    nome: str
    email: EmailStr
    senha: str
    papel: Papel = Papel.viewer


class UsuarioUpdate(BaseModel):
    nome: str | None = None
    papel: Papel | None = None
    ativo: bool | None = None
    senha: str | None = None


# ── Endpoints ──────────────────────────────────────────────────────────────────

@router.get("", response_model=list[UsuarioResponse])
async def listar_usuarios(db: AsyncSession = DB, user: AdminOnly = None):
    """Lista todos os usuários do tenant."""
    stmt = (
        select(User)
        .where(User.tenant_id == user.tenant_id)
        .order_by(User.nome)
    )
    result = await db.execute(stmt)
    return result.scalars().all()


@router.post("", response_model=UsuarioResponse, status_code=status.HTTP_201_CREATED)
async def criar_usuario(
    body: UsuarioCreate,
    db: AsyncSession = DB,
    user: AdminOnly = None,
):
    """Cria um novo usuário no tenant."""
    existing = await db.execute(select(User).where(User.email == body.email.lower()))
    if existing.scalar_one_or_none():
        raise HTTPException(status.HTTP_409_CONFLICT, "Este e-mail já está em uso")

    novo = User(
        id=uuid.uuid4(),
        tenant_id=user.tenant_id,
        nome=body.nome,
        email=body.email.lower(),
        senha_hash=hash_password(body.senha),
        papel=body.papel,
    )
    db.add(novo)
    await db.commit()
    await db.refresh(novo)
    return novo


@router.patch("/{uid}", response_model=UsuarioResponse)
async def atualizar_usuario(
    uid: uuid.UUID,
    body: UsuarioUpdate,
    db: AsyncSession = DB,
    user: AdminOnly = None,
):
    """Atualiza papel, nome, status ou senha de um usuário do tenant."""
    alvo = await db.get(User, uid)
    if not alvo or alvo.tenant_id != user.tenant_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Usuário não encontrado")

    if str(alvo.id) == str(user.id) and body.papel and body.papel != Papel.admin:
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Você não pode alterar seu próprio papel")

    if body.nome is not None:
        alvo.nome = body.nome
    if body.papel is not None:
        alvo.papel = body.papel
    if body.ativo is not None:
        alvo.ativo = body.ativo
    if body.senha:
        alvo.senha_hash = hash_password(body.senha)

    await db.commit()
    await db.refresh(alvo)
    return alvo


@router.delete("/{uid}", status_code=status.HTTP_204_NO_CONTENT)
async def excluir_usuario(
    uid: uuid.UUID,
    db: AsyncSession = DB,
    user: AdminOnly = None,
):
    """Remove um usuário do tenant (não pode excluir a si mesmo)."""
    alvo = await db.get(User, uid)
    if not alvo or alvo.tenant_id != user.tenant_id:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Usuário não encontrado")
    if str(alvo.id) == str(user.id):
        raise HTTPException(status.HTTP_422_UNPROCESSABLE_ENTITY, "Você não pode excluir sua própria conta")
    await db.delete(alvo)
    await db.commit()
