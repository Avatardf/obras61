import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.core.security import TokenData, create_access_token, hash_password, verify_password
from app.database import get_db
from app.dependencies import CurrentUser
from app.models.tenant import Papel, Plano, Tenant, User
from app.schemas.auth import LoginRequest, TenantCreate, TokenResponse, UserMe

router = APIRouter(prefix="/auth", tags=["autenticação"])


@router.post("/login", response_model=TokenResponse)
async def login(body: LoginRequest, db: AsyncSession = Depends(get_db)):
    """Autentica usuário e retorna JWT."""
    result = await db.execute(
        select(User).where(User.email == body.email.lower(), User.ativo == True)
    )
    user = result.scalar_one_or_none()

    if not user or not verify_password(body.senha, user.senha_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Email ou senha incorretos",
        )

    tenant = await db.get(Tenant, user.tenant_id)
    if not tenant or not tenant.ativo:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Conta da construtora inativa",
        )

    token = create_access_token(
        TokenData(user_id=user.id, tenant_id=user.tenant_id, papel=user.papel.value)
    )

    return TokenResponse(
        access_token=token,
        expires_in=settings.access_token_expire_minutes * 60,
        user=UserMe(
            id=user.id,
            nome=user.nome,
            email=user.email,
            papel=user.papel.value,
            tenant_id=user.tenant_id,
            tenant_nome=tenant.nome,
        ),
    )


@router.get("/me", response_model=UserMe)
async def me(current_user: CurrentUser, db: AsyncSession = Depends(get_db)):
    """Retorna dados do usuário autenticado."""
    tenant = await db.get(Tenant, current_user.tenant_id)
    return UserMe(
        id=current_user.id,
        nome=current_user.nome,
        email=current_user.email,
        papel=current_user.papel.value,
        tenant_id=current_user.tenant_id,
        tenant_nome=tenant.nome if tenant else "",
    )


@router.post("/registrar", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
async def registrar_tenant(body: TenantCreate, db: AsyncSession = Depends(get_db)):
    """
    Cria uma nova construtora (tenant) com seu usuário admin.
    Usado no onboarding — não requer autenticação.
    """
    # Verifica se email já existe
    result = await db.execute(select(User).where(User.email == body.email_admin.lower()))
    if result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Este email já está em uso",
        )

    # Cria tenant
    tenant = Tenant(
        id=uuid.uuid4(),
        nome=body.nome,
        cnpj=body.cnpj,
        plano=Plano.starter,
    )
    db.add(tenant)
    await db.flush()

    # Cria usuário admin
    admin = User(
        id=uuid.uuid4(),
        tenant_id=tenant.id,
        nome=body.nome_admin,
        email=body.email_admin.lower(),
        senha_hash=hash_password(body.senha_admin),
        papel=Papel.admin,
    )
    db.add(admin)
    await db.commit()

    token = create_access_token(
        TokenData(user_id=admin.id, tenant_id=tenant.id, papel=Papel.admin.value)
    )

    return TokenResponse(
        access_token=token,
        expires_in=settings.access_token_expire_minutes * 60,
        user=UserMe(
            id=admin.id,
            nome=admin.nome,
            email=admin.email,
            papel=admin.papel.value,
            tenant_id=tenant.id,
            tenant_nome=tenant.nome,
        ),
    )
