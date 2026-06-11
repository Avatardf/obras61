"""API Status Documental — leitura e atualização por empreendimento."""
import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import CurrentUser
from app.models.documentos import DocumentoStatus, StatusDoc
from app.models.obra import Empreendimento

router = APIRouter(tags=["documentos"])
DB = Annotated[AsyncSession, Depends(get_db)]


# ── Schemas ────────────────────────────────────────────────────────────────────

class DocStatusIn(BaseModel):
    status: str
    observacoes: str | None = None


class DocStatusOut(BaseModel):
    doc_tipo: str
    status: str
    observacoes: str | None = None


class MatrizEmp(BaseModel):
    id: str
    nome: str
    statuses: dict[str, str]   # doc_tipo → status


# ── Helper de autorização ──────────────────────────────────────────────────────

async def _get_emp(db: AsyncSession, emp_id: uuid.UUID, tenant_id: uuid.UUID) -> Empreendimento:
    emp = await db.get(Empreendimento, emp_id)
    if not emp or emp.tenant_id != tenant_id:
        raise HTTPException(404, "Empreendimento não encontrado.")
    return emp


# ── Endpoints ──────────────────────────────────────────────────────────────────

@router.get(
    "/empreendimentos/{emp_id}/documentos",
    response_model=list[DocStatusOut],
)
async def listar_documentos(
    emp_id: uuid.UUID, db: DB, user: CurrentUser,
) -> list[DocStatusOut]:
    await _get_emp(db, emp_id, user.tenant_id)
    stmt = select(DocumentoStatus).where(
        DocumentoStatus.empreendimento_id == emp_id,
        DocumentoStatus.tenant_id == user.tenant_id,
    )
    result = await db.execute(stmt)
    rows = result.scalars().all()
    return [DocStatusOut(doc_tipo=r.doc_tipo, status=r.status, observacoes=r.observacoes)
            for r in rows]


@router.put(
    "/empreendimentos/{emp_id}/documentos/{doc_tipo}",
    response_model=DocStatusOut,
)
async def atualizar_documento(
    emp_id: uuid.UUID, doc_tipo: str,
    body: DocStatusIn,
    db: DB, user: CurrentUser,
) -> DocStatusOut:
    await _get_emp(db, emp_id, user.tenant_id)

    # Valida status
    try:
        status_val = StatusDoc(body.status)
    except ValueError:
        raise HTTPException(400, f"Status inválido: {body.status}")

    # Upsert atômico — INSERT ... ON CONFLICT DO UPDATE evita race condition
    # quando o usuário clica múltiplos documentos em sequência rápida.
    upsert = (
        pg_insert(DocumentoStatus)
        .values(
            id=uuid.uuid4(),
            tenant_id=user.tenant_id,
            empreendimento_id=emp_id,
            doc_tipo=doc_tipo,
            status=status_val,
            observacoes=body.observacoes,
        )
        .on_conflict_do_update(
            constraint="uq_doc_status_emp_tipo",
            set_={
                "status": status_val,
                "observacoes": body.observacoes,
            },
        )
        .returning(
            DocumentoStatus.doc_tipo,
            DocumentoStatus.status,
            DocumentoStatus.observacoes,
        )
    )
    result = await db.execute(upsert)
    row = result.one()
    await db.commit()
    return DocStatusOut(doc_tipo=row.doc_tipo, status=row.status, observacoes=row.observacoes)


@router.get("/documentos/matriz", response_model=list[MatrizEmp])
async def matriz_documentos(db: DB, user: CurrentUser) -> list[MatrizEmp]:
    """Retorna todos os empreendimentos com seus statuses documentais."""
    # Empreendimentos ativos
    emp_stmt = select(Empreendimento).where(
        Empreendimento.tenant_id == user.tenant_id,
        Empreendimento.deleted_at.is_(None),
    ).order_by(Empreendimento.nome)
    emp_result = await db.execute(emp_stmt)
    emps = emp_result.scalars().all()

    # Statuses salvos (todos)
    doc_stmt = select(DocumentoStatus).where(
        DocumentoStatus.tenant_id == user.tenant_id,
    )
    doc_result = await db.execute(doc_stmt)
    docs = doc_result.scalars().all()

    # Agrupa por empreendimento_id
    by_emp: dict[uuid.UUID, dict[str, str]] = {}
    for d in docs:
        by_emp.setdefault(d.empreendimento_id, {})[d.doc_tipo] = d.status

    return [
        MatrizEmp(
            id=str(e.id),
            nome=e.nome,
            statuses=by_emp.get(e.id, {}),
        )
        for e in emps
    ]
