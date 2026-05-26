from uuid import UUID

from fastapi import HTTPException, Request, status
from sqlalchemy.ext.asyncio import AsyncSession


async def set_tenant_context(db: AsyncSession, tenant_id: UUID) -> None:
    """Ativa o contexto de tenant para Row-Level Security no PostgreSQL."""
    await db.execute(
        "SELECT set_config('app.tenant_id', :tid, true)",
        {"tid": str(tenant_id)},
    )


def get_tenant_id(request: Request) -> UUID:
    """Extrai o tenant_id do token JWT (injetado pelo middleware de auth)."""
    tenant_id = getattr(request.state, "tenant_id", None)
    if not tenant_id:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Tenant não identificado")
    return tenant_id


RLS_SETUP_SQL = """
-- Habilitar RLS nas tabelas principais
ALTER TABLE empreendimentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE obras ENABLE ROW LEVEL SECURITY;
ALTER TABLE orcamentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE custos_realizados ENABLE ROW LEVEL SECURITY;
ALTER TABLE fornecedores ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Políticas de isolamento por tenant
CREATE POLICY tenant_isolation ON empreendimentos
    USING (tenant_id = current_setting('app.tenant_id')::uuid);

CREATE POLICY tenant_isolation ON obras
    USING (tenant_id = current_setting('app.tenant_id')::uuid);

CREATE POLICY tenant_isolation ON orcamentos
    USING (tenant_id = current_setting('app.tenant_id')::uuid);

CREATE POLICY tenant_isolation ON custos_realizados
    USING (tenant_id = current_setting('app.tenant_id')::uuid);

CREATE POLICY tenant_isolation ON fornecedores
    USING (tenant_id = current_setting('app.tenant_id')::uuid);

CREATE POLICY tenant_isolation ON users
    USING (tenant_id = current_setting('app.tenant_id')::uuid);
"""
