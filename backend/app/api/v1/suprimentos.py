"""
API de Suprimentos: Fornecedores · Estoque · Requisições · Cotações · OC · Recebimentos · Transferências
"""
import uuid
from typing import Annotated

from fastapi import APIRouter, Depends, File, HTTPException, Query, UploadFile, status
from fastapi.responses import Response
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.database import get_db
from app.dependencies import CurrentUser
from app.models.obra import Obra
from app.models.suprimentos import (
    Cotacao, CotacaoItem,
    EstoqueItem, Fornecedor, OCItem, OrdemCompra,
    Recebimento, RecebimentoItem, Requisicao,
    TransferenciaEstoque, StatusTransferencia,
    StatusOC, StatusRecebimento,
)
from app.schemas.suprimentos import (
    ComparativoFornecedor, ComparativoItemRow, ComparativoPreco, ComparativoResponse,
    CotacaoCreate, CotacaoResponse, CotacaoUpdate,
    EstoqueItemCreate, EstoqueItemResponse, EstoqueItemUpdate,
    FornecedorCreate, FornecedorResponse, FornecedorUpdate,
    GerarOCsBody,
    OCItemResponse, OrdemCompraCreate, OrdemCompraResponse, OrdemCompraUpdate,
    ObraResumida, RecebimentoCreate, RecebimentoResponse, RecebimentoItemUpdate, RecebimentoUpdate,
    RequisicaoCreate, RequisicaoResponse, RequisicaoUpdate,
    SobrasResponse, TransferenciaCreate, TransferenciaResponse, TransferenciaUpdate,
)
from app.services.extrator_cotacao import extrair_itens as _extrair_itens
from app.utils.excel import (
    exportar_fornecedores as _excel_exportar,
    gerar_template_fornecedores as _excel_template,
    importar_fornecedores_xlsx as _excel_importar,
    gerar_template_requisicao as _excel_req_template,
    importar_requisicao_xlsx as _excel_req_importar,
    gerar_template_oc_itens as _excel_oc_template,
    importar_oc_itens_xlsx as _excel_oc_importar,
)

_XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"


class ImportacaoResultado(BaseModel):
    importados: int
    erros: list[str]
    nomes: list[str]


class ItensImportadosResultado(BaseModel):
    itens: list[dict]
    erros: list[str]

router = APIRouter(tags=["suprimentos"])
DB = Annotated[AsyncSession, Depends(get_db)]


def _tenant(user: CurrentUser):
    return user.tenant_id


# ═══════════════════════════════════════════════════════════════════════════════
# LISTA PLANA DE OBRAS (selectbox para transferências)
# ═══════════════════════════════════════════════════════════════════════════════

@router.get("/obras-lista", response_model=list[ObraResumida])
async def listar_obras_resumo(db: DB, user: CurrentUser):
    """Retorna todas as obras do tenant (para selectboxes em suprimentos)."""
    stmt = (
        select(Obra)
        .where(Obra.tenant_id == _tenant(user))
        .order_by(Obra.nome)
    )
    result = await db.execute(stmt)
    return result.scalars().all()


# ═══════════════════════════════════════════════════════════════════════════════
# FORNECEDORES
# ═══════════════════════════════════════════════════════════════════════════════

@router.get("/fornecedores", response_model=list[FornecedorResponse])
async def listar_fornecedores(
    db: DB, user: CurrentUser,
    ativo: bool | None = Query(None),
    q: str | None = Query(None),
):
    stmt = select(Fornecedor).where(Fornecedor.tenant_id == _tenant(user))
    if ativo is not None:
        stmt = stmt.where(Fornecedor.ativo == ativo)
    if q:
        stmt = stmt.where(Fornecedor.nome.ilike(f"%{q}%"))
    stmt = stmt.order_by(Fornecedor.nome)
    result = await db.execute(stmt)
    return result.scalars().all()


@router.post("/fornecedores", response_model=FornecedorResponse, status_code=status.HTTP_201_CREATED)
async def criar_fornecedor(body: FornecedorCreate, db: DB, user: CurrentUser):
    f = Fornecedor(**body.model_dump(), tenant_id=_tenant(user))
    db.add(f)
    await db.commit()
    await db.refresh(f)
    return f


@router.get("/fornecedores/xlsx-template")
async def template_fornecedores():
    """Baixa template Excel para importação de fornecedores."""
    return Response(
        content=_excel_template(),
        media_type=_XLSX_MIME,
        headers={"Content-Disposition": 'attachment; filename="template_fornecedores.xlsx"'},
    )


@router.get("/fornecedores/xlsx-exportar")
async def exportar_fornecedores_xlsx(db: DB, user: CurrentUser):
    """Exporta todos os fornecedores em formato Excel."""
    stmt = select(Fornecedor).where(Fornecedor.tenant_id == _tenant(user)).order_by(Fornecedor.nome)
    result = await db.execute(stmt)
    dados = [
        {
            "nome": f.nome, "cnpj": f.cnpj, "categoria": f.categoria,
            "contato": f.contato, "telefone": f.telefone, "email": f.email,
            "cidade": f.cidade, "uf": f.uf, "avaliacao": float(f.avaliacao) if f.avaliacao else None,
            "ativo": f.ativo, "observacoes": f.observacoes,
        }
        for f in result.scalars().all()
    ]
    return Response(
        content=_excel_exportar(dados),
        media_type=_XLSX_MIME,
        headers={"Content-Disposition": 'attachment; filename="fornecedores.xlsx"'},
    )


@router.post("/fornecedores/xlsx-importar", response_model=ImportacaoResultado,
             status_code=status.HTTP_201_CREATED)
async def importar_fornecedores_xlsx(arquivo: UploadFile, db: DB, user: CurrentUser):
    """Importa fornecedores a partir de um arquivo Excel (.xlsx)."""
    conteudo = await arquivo.read()
    try:
        dados, erros = _excel_importar(conteudo)
    except Exception as exc:
        raise HTTPException(422, f"Erro ao processar arquivo: {exc}") from exc

    nomes: list[str] = []
    for d in dados:
        db.add(Fornecedor(**d, tenant_id=_tenant(user)))
        nomes.append(d["nome"])

    if nomes:
        await db.commit()

    return ImportacaoResultado(importados=len(nomes), erros=erros, nomes=nomes)


@router.get("/fornecedores/{fid}", response_model=FornecedorResponse)
async def obter_fornecedor(fid: uuid.UUID, db: DB, user: CurrentUser):
    f = await db.get(Fornecedor, fid)
    if not f or f.tenant_id != _tenant(user):
        raise HTTPException(404, "Fornecedor não encontrado")
    return f


@router.patch("/fornecedores/{fid}", response_model=FornecedorResponse)
async def atualizar_fornecedor(fid: uuid.UUID, body: FornecedorUpdate, db: DB, user: CurrentUser):
    f = await db.get(Fornecedor, fid)
    if not f or f.tenant_id != _tenant(user):
        raise HTTPException(404, "Fornecedor não encontrado")
    for k, v in body.model_dump(exclude_none=True).items():
        setattr(f, k, v)
    await db.commit()
    await db.refresh(f)
    return f


@router.delete("/fornecedores/{fid}", status_code=status.HTTP_204_NO_CONTENT)
async def excluir_fornecedor(fid: uuid.UUID, db: DB, user: CurrentUser):
    f = await db.get(Fornecedor, fid)
    if not f or f.tenant_id != _tenant(user):
        raise HTTPException(404, "Fornecedor não encontrado")
    await db.delete(f)
    await db.commit()


# ═══════════════════════════════════════════════════════════════════════════════
# ESTOQUE
# Escopo: almoxarifado geral (obra_id IS NULL) ou obra específica (obra_id = X)
# ═══════════════════════════════════════════════════════════════════════════════

@router.get("/estoque", response_model=list[EstoqueItemResponse])
async def listar_estoque(
    db: DB, user: CurrentUser,
    obra_id: uuid.UUID | None = Query(None),
    almoxarifado: bool | None = Query(None,
        description="true = apenas almoxarifado geral (sem obra); false = apenas itens de obra"),
):
    """Lista itens de estoque.

    - ?almoxarifado=true  → apenas almoxarifado geral (obra_id IS NULL)
    - ?obra_id=<id>       → apenas estoque dessa obra
    - sem parâmetros      → todos os itens do tenant
    """
    stmt = select(EstoqueItem).where(EstoqueItem.tenant_id == _tenant(user))
    if obra_id:
        stmt = stmt.where(EstoqueItem.obra_id == obra_id)
    elif almoxarifado is True:
        stmt = stmt.where(EstoqueItem.obra_id.is_(None))
    elif almoxarifado is False:
        stmt = stmt.where(EstoqueItem.obra_id.is_not(None))
    stmt = stmt.order_by(EstoqueItem.nome)
    result = await db.execute(stmt)
    return [EstoqueItemResponse.from_orm_with_alerta(i) for i in result.scalars().all()]


@router.get("/obras/{obra_id}/estoque", response_model=list[EstoqueItemResponse])
async def listar_estoque_obra(obra_id: uuid.UUID, db: DB, user: CurrentUser):
    stmt = select(EstoqueItem).where(
        EstoqueItem.tenant_id == _tenant(user),
        EstoqueItem.obra_id == obra_id,
    ).order_by(EstoqueItem.nome)
    result = await db.execute(stmt)
    return [EstoqueItemResponse.from_orm_with_alerta(i) for i in result.scalars().all()]


@router.get("/obras/{obra_id}/estoque/sobras", response_model=SobrasResponse)
async def sobras_estoque_obra(obra_id: uuid.UUID, db: DB, user: CurrentUser):
    """Retorna resumo de sobras em estoque para uma obra (útil no encerramento)."""
    stmt = select(EstoqueItem).where(
        EstoqueItem.tenant_id == _tenant(user),
        EstoqueItem.obra_id == obra_id,
        EstoqueItem.quantidade > 0,
    ).order_by(EstoqueItem.nome)
    result = await db.execute(stmt)
    itens = result.scalars().all()

    valor_total = sum(
        float(i.quantidade) * float(i.preco_unitario)
        for i in itens if i.preco_unitario
    )
    return SobrasResponse(
        obra_id=obra_id,
        itens=[EstoqueItemResponse.from_orm_with_alerta(i) for i in itens],
        valor_total=round(valor_total, 2),
        quantidade_itens=len(itens),
    )


@router.post("/estoque", response_model=EstoqueItemResponse, status_code=status.HTTP_201_CREATED)
async def criar_estoque_item(body: EstoqueItemCreate, db: DB, user: CurrentUser):
    item = EstoqueItem(**body.model_dump(), tenant_id=_tenant(user))
    db.add(item)
    await db.commit()
    await db.refresh(item)
    return EstoqueItemResponse.from_orm_with_alerta(item)


@router.patch("/estoque/{item_id}", response_model=EstoqueItemResponse)
async def atualizar_estoque(item_id: uuid.UUID, body: EstoqueItemUpdate, db: DB, user: CurrentUser):
    item = await db.get(EstoqueItem, item_id)
    if not item or item.tenant_id != _tenant(user):
        raise HTTPException(404)
    for k, v in body.model_dump(exclude_none=True).items():
        setattr(item, k, v)
    await db.commit()
    await db.refresh(item)
    return EstoqueItemResponse.from_orm_with_alerta(item)


@router.delete("/estoque/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
async def excluir_estoque(item_id: uuid.UUID, db: DB, user: CurrentUser):
    item = await db.get(EstoqueItem, item_id)
    if not item or item.tenant_id != _tenant(user):
        raise HTTPException(404)
    await db.delete(item)
    await db.commit()


# ═══════════════════════════════════════════════════════════════════════════════
# TRANSFERÊNCIAS DE ESTOQUE
# ═══════════════════════════════════════════════════════════════════════════════

async def _proximo_numero(db: AsyncSession, prefix: str, model, tenant_id: uuid.UUID) -> str:
    count_stmt = select(func.count()).select_from(model).where(model.tenant_id == tenant_id)
    count = (await db.execute(count_stmt)).scalar_one()
    return f"{prefix}-{str(count + 1).zfill(4)}"


async def _label_obra(db: AsyncSession, obra_id: uuid.UUID | None) -> str:
    if obra_id is None:
        return "Almoxarifado Geral"
    obra = await db.get(Obra, obra_id)
    return obra.nome if obra else str(obra_id)


def _trf_to_response(trf: TransferenciaEstoque,
                     origem_label: str, destino_label: str) -> TransferenciaResponse:
    r = TransferenciaResponse.model_validate(trf)
    r.origem_label = origem_label
    r.destino_label = destino_label
    return r


@router.get("/transferencias", response_model=list[TransferenciaResponse])
async def listar_transferencias(
    db: DB, user: CurrentUser,
    obra_id: uuid.UUID | None = Query(None, description="Filtra por obra (origem ou destino)"),
    status_: str | None = Query(None, alias="status"),
):
    stmt = select(TransferenciaEstoque).where(
        TransferenciaEstoque.tenant_id == _tenant(user)
    )
    if obra_id:
        stmt = stmt.where(
            (TransferenciaEstoque.origem_obra_id == obra_id) |
            (TransferenciaEstoque.destino_obra_id == obra_id)
        )
    if status_:
        stmt = stmt.where(TransferenciaEstoque.status == status_)
    stmt = stmt.order_by(TransferenciaEstoque.data_transferencia.desc())
    result = await db.execute(stmt)
    trfs = result.scalars().all()

    # Cache de labels para evitar N+1
    obras_cache: dict[uuid.UUID, str] = {}
    async def get_label(oid: uuid.UUID | None) -> str:
        if oid is None:
            return "Almoxarifado Geral"
        if oid not in obras_cache:
            obras_cache[oid] = await _label_obra(db, oid)
        return obras_cache[oid]

    return [
        _trf_to_response(
            t,
            await get_label(t.origem_obra_id),
            await get_label(t.destino_obra_id),
        )
        for t in trfs
    ]


@router.post("/transferencias", response_model=TransferenciaResponse,
             status_code=status.HTTP_201_CREATED)
async def criar_transferencia(body: TransferenciaCreate, db: DB, user: CurrentUser):
    # Origem e destino não podem ser iguais
    if body.origem_obra_id == body.destino_obra_id:
        raise HTTPException(422, "Origem e destino não podem ser iguais")

    numero = await _proximo_numero(db, "TRF", TransferenciaEstoque, _tenant(user))
    valor_total = (
        round(body.quantidade * body.valor_unitario, 2)
        if body.valor_unitario else None
    )
    trf = TransferenciaEstoque(
        **body.model_dump(),
        numero=numero,
        valor_total=valor_total,
        tenant_id=_tenant(user),
    )
    db.add(trf)
    await db.commit()
    await db.refresh(trf)

    return _trf_to_response(
        trf,
        await _label_obra(db, trf.origem_obra_id),
        await _label_obra(db, trf.destino_obra_id),
    )


@router.patch("/transferencias/{trf_id}", response_model=TransferenciaResponse)
async def atualizar_transferencia(
    trf_id: uuid.UUID, body: TransferenciaUpdate, db: DB, user: CurrentUser
):
    trf = await db.get(TransferenciaEstoque, trf_id)
    if not trf or trf.tenant_id != _tenant(user):
        raise HTTPException(404, "Transferência não encontrada")

    novo_status = body.status

    if novo_status == StatusTransferencia.concluida and trf.status == StatusTransferencia.pendente:
        # ── Movimentação automática de estoque ───────────────────────────────
        # 1. Debit na origem
        if trf.estoque_item_id:
            origem_item = await db.get(EstoqueItem, trf.estoque_item_id)
            if not origem_item or origem_item.tenant_id != _tenant(user):
                raise HTTPException(422, "Item de origem não encontrado")
            if float(origem_item.quantidade) < float(trf.quantidade):
                raise HTTPException(
                    422,
                    f"Estoque insuficiente: disponível {origem_item.quantidade} {origem_item.unidade}"
                )
            origem_item.quantidade = round(float(origem_item.quantidade) - float(trf.quantidade), 3)

        # 2. Credit no destino (busca ou cria item)
        # Determina o valor unitário a usar
        vu = float(trf.valor_unitario) if trf.valor_unitario else (
            float(origem_item.preco_unitario) if trf.estoque_item_id and origem_item.preco_unitario else None
        )

        destino_stmt = select(EstoqueItem).where(
            EstoqueItem.tenant_id == _tenant(user),
            EstoqueItem.obra_id == trf.destino_obra_id,
            EstoqueItem.nome == trf.material,
            EstoqueItem.unidade == trf.unidade,
        )
        result = await db.execute(destino_stmt)
        destino_item = result.scalar_one_or_none()

        if destino_item:
            destino_item.quantidade = round(
                float(destino_item.quantidade) + float(trf.quantidade), 3
            )
        else:
            # Copia metadados do item de origem quando possível
            origem_ref = await db.get(EstoqueItem, trf.estoque_item_id) if trf.estoque_item_id else None
            destino_item = EstoqueItem(
                obra_id=trf.destino_obra_id,
                nome=trf.material,
                unidade=trf.unidade,
                quantidade=float(trf.quantidade),
                quantidade_minima=float(origem_ref.quantidade_minima) if origem_ref else 0,
                preco_unitario=vu,
                categoria=origem_ref.categoria if origem_ref else None,
                localizacao=None,
                tenant_id=_tenant(user),
            )
            db.add(destino_item)

    elif novo_status == StatusTransferencia.cancelada and trf.status != StatusTransferencia.pendente:
        raise HTTPException(422, "Só é possível cancelar transferências pendentes")

    if body.status:
        trf.status = body.status
    if body.observacoes is not None:
        trf.observacoes = body.observacoes

    await db.commit()
    await db.refresh(trf)
    return _trf_to_response(
        trf,
        await _label_obra(db, trf.origem_obra_id),
        await _label_obra(db, trf.destino_obra_id),
    )


@router.delete("/transferencias/{trf_id}", status_code=status.HTTP_204_NO_CONTENT)
async def excluir_transferencia(trf_id: uuid.UUID, db: DB, user: CurrentUser):
    trf = await db.get(TransferenciaEstoque, trf_id)
    if not trf or trf.tenant_id != _tenant(user):
        raise HTTPException(404)
    if trf.status == StatusTransferencia.concluida:
        raise HTTPException(422, "Transferências concluídas não podem ser excluídas")
    await db.delete(trf)
    await db.commit()


# ═══════════════════════════════════════════════════════════════════════════════
# REQUISIÇÕES
# ═══════════════════════════════════════════════════════════════════════════════

@router.get("/obras/{obra_id}/requisicoes", response_model=list[RequisicaoResponse])
async def listar_requisicoes(obra_id: uuid.UUID, db: DB, user: CurrentUser):
    stmt = select(Requisicao).where(
        Requisicao.tenant_id == _tenant(user),
        Requisicao.obra_id == obra_id,
    ).order_by(Requisicao.criado_em.desc())
    result = await db.execute(stmt)
    return result.scalars().all()


@router.get("/requisicoes", response_model=list[RequisicaoResponse])
async def listar_todas_requisicoes(db: DB, user: CurrentUser):
    stmt = select(Requisicao).where(
        Requisicao.tenant_id == _tenant(user),
    ).order_by(Requisicao.criado_em.desc())
    result = await db.execute(stmt)
    return result.scalars().all()


@router.post("/requisicoes", response_model=RequisicaoResponse, status_code=status.HTTP_201_CREATED)
async def criar_requisicao(body: RequisicaoCreate, db: DB, user: CurrentUser):
    numero = await _proximo_numero(db, "REQ", Requisicao, _tenant(user))
    req = Requisicao(**body.model_dump(), numero=numero, tenant_id=_tenant(user))
    db.add(req)
    await db.commit()
    await db.refresh(req)
    return req


@router.get("/requisicoes/xlsx-template")
async def template_requisicao():
    """Baixa template Excel para importação de itens de requisição."""
    return Response(
        content=_excel_req_template(),
        media_type=_XLSX_MIME,
        headers={"Content-Disposition": 'attachment; filename="template_requisicao_itens.xlsx"'},
    )


@router.post("/requisicoes/xlsx-importar-itens", response_model=ItensImportadosResultado)
async def importar_req_itens(arquivo: UploadFile, user: CurrentUser):
    """Parseia um XLSX e retorna os itens como JSON (não persiste)."""
    conteudo = await arquivo.read()
    try:
        itens, erros = _excel_req_importar(conteudo)
    except Exception as exc:
        raise HTTPException(422, f"Erro ao processar arquivo: {exc}") from exc
    return ItensImportadosResultado(itens=itens, erros=erros)


@router.patch("/requisicoes/{req_id}", response_model=RequisicaoResponse)
async def atualizar_requisicao(req_id: uuid.UUID, body: RequisicaoUpdate, db: DB, user: CurrentUser):
    req = await db.get(Requisicao, req_id)
    if not req or req.tenant_id != _tenant(user):
        raise HTTPException(404)
    for k, v in body.model_dump(exclude_none=True).items():
        setattr(req, k, v)
    await db.commit()
    await db.refresh(req)
    return req


@router.delete("/requisicoes/{req_id}", status_code=status.HTTP_204_NO_CONTENT)
async def excluir_requisicao(req_id: uuid.UUID, db: DB, user: CurrentUser):
    req = await db.get(Requisicao, req_id)
    if not req or req.tenant_id != _tenant(user):
        raise HTTPException(404)
    await db.delete(req)
    await db.commit()


# ═══════════════════════════════════════════════════════════════════════════════
# ORDENS DE COMPRA
# ═══════════════════════════════════════════════════════════════════════════════

def _oc_to_response(oc: OrdemCompra) -> OrdemCompraResponse:
    r = OrdemCompraResponse.model_validate(oc)
    if oc.fornecedor:
        r.fornecedor_nome = oc.fornecedor.nome
    return r


@router.get("/obras/{obra_id}/ordens-compra", response_model=list[OrdemCompraResponse])
async def listar_ocs(obra_id: uuid.UUID, db: DB, user: CurrentUser):
    stmt = (
        select(OrdemCompra)
        .options(selectinload(OrdemCompra.itens), selectinload(OrdemCompra.fornecedor))
        .where(OrdemCompra.tenant_id == _tenant(user), OrdemCompra.obra_id == obra_id)
        .order_by(OrdemCompra.criado_em.desc())
    )
    result = await db.execute(stmt)
    return [_oc_to_response(oc) for oc in result.scalars().all()]


@router.get("/ordens-compra", response_model=list[OrdemCompraResponse])
async def listar_todas_ocs(db: DB, user: CurrentUser):
    stmt = (
        select(OrdemCompra)
        .options(selectinload(OrdemCompra.itens), selectinload(OrdemCompra.fornecedor))
        .where(OrdemCompra.tenant_id == _tenant(user))
        .order_by(OrdemCompra.criado_em.desc())
    )
    result = await db.execute(stmt)
    return [_oc_to_response(oc) for oc in result.scalars().all()]


@router.post("/ordens-compra", response_model=OrdemCompraResponse, status_code=status.HTTP_201_CREATED)
async def criar_oc(body: OrdemCompraCreate, db: DB, user: CurrentUser):
    numero = await _proximo_numero(db, "OC", OrdemCompra, _tenant(user))
    itens_data = body.model_dump(exclude={"itens"})
    oc = OrdemCompra(**itens_data, numero=numero, tenant_id=_tenant(user))

    valor_total = 0.0
    for item_data in body.itens:
        preco_total = round(item_data.quantidade * item_data.preco_unitario, 2)
        item = OCItem(**item_data.model_dump(), preco_total=preco_total, oc=oc)
        db.add(item)
        valor_total += preco_total

    oc.valor_total = round(valor_total, 2)
    db.add(oc)
    await db.commit()

    stmt = (
        select(OrdemCompra)
        .options(selectinload(OrdemCompra.itens), selectinload(OrdemCompra.fornecedor))
        .where(OrdemCompra.id == oc.id)
    )
    result = await db.execute(stmt)
    oc = result.scalar_one()
    return _oc_to_response(oc)


@router.get("/ordens-compra/xlsx-template")
async def template_oc_itens():
    """Baixa template Excel para importação de itens de OC."""
    return Response(
        content=_excel_oc_template(),
        media_type=_XLSX_MIME,
        headers={"Content-Disposition": 'attachment; filename="template_oc_itens.xlsx"'},
    )


@router.post("/ordens-compra/xlsx-importar-itens", response_model=ItensImportadosResultado)
async def importar_oc_itens_endpoint(arquivo: UploadFile, user: CurrentUser):
    """Parseia um XLSX e retorna os itens de OC como JSON (não persiste)."""
    conteudo = await arquivo.read()
    try:
        itens, erros = _excel_oc_importar(conteudo)
    except Exception as exc:
        raise HTTPException(422, f"Erro ao processar arquivo: {exc}") from exc
    return ItensImportadosResultado(itens=itens, erros=erros)


@router.get("/ordens-compra/{oc_id}", response_model=OrdemCompraResponse)
async def obter_oc(oc_id: uuid.UUID, db: DB, user: CurrentUser):
    stmt = (
        select(OrdemCompra)
        .options(selectinload(OrdemCompra.itens), selectinload(OrdemCompra.fornecedor))
        .where(OrdemCompra.id == oc_id, OrdemCompra.tenant_id == _tenant(user))
    )
    result = await db.execute(stmt)
    oc = result.scalar_one_or_none()
    if not oc:
        raise HTTPException(404)
    return _oc_to_response(oc)


@router.patch("/ordens-compra/{oc_id}", response_model=OrdemCompraResponse)
async def atualizar_oc(oc_id: uuid.UUID, body: OrdemCompraUpdate, db: DB, user: CurrentUser):
    from datetime import date as _date, timedelta
    from app.models.financeiro import LancamentoFinanceiro, StatusLancamento, TipoLancamento

    stmt = (
        select(OrdemCompra)
        .options(selectinload(OrdemCompra.itens), selectinload(OrdemCompra.fornecedor))
        .where(OrdemCompra.id == oc_id, OrdemCompra.tenant_id == _tenant(user))
    )
    result = await db.execute(stmt)
    oc = result.scalar_one_or_none()
    if not oc:
        raise HTTPException(404)

    status_anterior = oc.status
    for k, v in body.model_dump(exclude_none=True).items():
        setattr(oc, k, v)

    # ── Quando OC vai para financeiro → cria lançamento de despesa ────────────
    if body.status == StatusOC.aguardando_pagamento and status_anterior != StatusOC.aguardando_pagamento:
        # Verifica se já existe lançamento vinculado a esta OC
        from sqlalchemy import select as sa_select
        existing_lanc_stmt = sa_select(LancamentoFinanceiro).where(
            LancamentoFinanceiro.oc_id == oc.id,
            LancamentoFinanceiro.tenant_id == _tenant(user),
        )
        existing_lanc_res = await db.execute(existing_lanc_stmt)
        if not existing_lanc_res.scalar_one_or_none():
            forn_nome = oc.fornecedor.nome if oc.fornecedor else "Fornecedor"
            db.add(LancamentoFinanceiro(
                tenant_id=_tenant(user),
                obra_id=oc.obra_id,
                tipo=TipoLancamento.despesa,
                categoria="material",
                descricao=f"{oc.numero} · {forn_nome}",
                valor=float(oc.valor_total),
                data_vencimento=oc.prazo_entrega or (_date.today() + timedelta(days=30)),
                status=StatusLancamento.previsto,
                fornecedor_id=oc.fornecedor_id,
                oc_id=oc.id,
                observacoes=f"Gerado automaticamente pela Ordem de Compra {oc.numero}",
            ))

    await db.commit()
    # Reload com relacionamentos
    stmt2 = (
        select(OrdemCompra)
        .options(selectinload(OrdemCompra.itens), selectinload(OrdemCompra.fornecedor))
        .where(OrdemCompra.id == oc_id)
    )
    res2 = await db.execute(stmt2)
    return _oc_to_response(res2.scalar_one())


@router.delete("/ordens-compra/{oc_id}", status_code=status.HTTP_204_NO_CONTENT)
async def excluir_oc(oc_id: uuid.UUID, db: DB, user: CurrentUser):
    oc = await db.get(OrdemCompra, oc_id)
    if not oc or oc.tenant_id != _tenant(user):
        raise HTTPException(404)
    await db.delete(oc)
    await db.commit()


class CancelarOCBody(BaseModel):
    motivo: str


@router.post("/ordens-compra/{oc_id}/cancelar", response_model=RequisicaoResponse)
async def cancelar_oc_e_criar_requisicao(
    oc_id: uuid.UUID, body: CancelarOCBody, db: DB, user: CurrentUser
):
    """
    Cancela a OC e cria automaticamente uma nova requisição com os itens pendentes,
    registrando o motivo do cancelamento nas observações.
    """
    stmt = (
        select(OrdemCompra)
        .options(selectinload(OrdemCompra.itens), selectinload(OrdemCompra.fornecedor))
        .where(OrdemCompra.id == oc_id, OrdemCompra.tenant_id == _tenant(user))
    )
    result = await db.execute(stmt)
    oc = result.scalar_one_or_none()
    if not oc:
        raise HTTPException(404, "Ordem de compra não encontrada")

    oc.status = StatusOC.cancelada
    oc.observacoes = (oc.observacoes or "") + f"\n[CANCELADA] {body.motivo}"

    # Cria nova requisição com os itens da OC (itens é campo JSON em Requisicao)
    numero = await _proximo_numero(db, "REQ", Requisicao, _tenant(user))
    from datetime import date
    itens_json = [
        {"descricao": item.descricao, "unidade": item.unidade,
         "quantidade": float(item.quantidade), "observacao": None}
        for item in oc.itens
    ]
    nova_req = Requisicao(
        tenant_id=_tenant(user),
        numero=numero,
        solicitante=user.nome,
        data_solicitacao=date.today(),
        prioridade="normal",
        status="pendente",
        itens=itens_json,
        observacoes=f"Gerada pelo cancelamento da {oc.numero}. Motivo: {body.motivo}",
    )
    db.add(nova_req)
    await db.commit()
    await db.refresh(nova_req)
    return nova_req


@router.patch("/ordens-compra/{oc_id}/arquivar", response_model=OrdemCompraResponse)
async def arquivar_oc(oc_id: uuid.UUID, db: DB, user: CurrentUser):
    """Arquiva uma OC entregue ou concluída para remover da lista ativa."""
    stmt = (
        select(OrdemCompra)
        .options(selectinload(OrdemCompra.itens), selectinload(OrdemCompra.fornecedor))
        .where(OrdemCompra.id == oc_id, OrdemCompra.tenant_id == _tenant(user))
    )
    result = await db.execute(stmt)
    oc = result.scalar_one_or_none()
    if not oc:
        raise HTTPException(404)
    oc.status = StatusOC.arquivada
    await db.commit()
    await db.refresh(oc)
    return _oc_to_response(oc)


# ═══════════════════════════════════════════════════════════════════════════════
# RECEBIMENTOS
# ═══════════════════════════════════════════════════════════════════════════════

@router.get("/recebimentos", response_model=list[RecebimentoResponse])
async def listar_todos_recebimentos(db: DB, user: CurrentUser):
    """Lista todos os recebimentos do tenant."""
    stmt = (
        select(Recebimento)
        .options(selectinload(Recebimento.itens))
        .where(Recebimento.tenant_id == _tenant(user))
        .order_by(Recebimento.data_recebimento.desc())
    )
    result = await db.execute(stmt)
    return result.scalars().all()


@router.get("/obras/{obra_id}/recebimentos", response_model=list[RecebimentoResponse])
async def listar_recebimentos(obra_id: uuid.UUID, db: DB, user: CurrentUser):
    stmt = (
        select(Recebimento)
        .options(selectinload(Recebimento.itens))
        .where(Recebimento.tenant_id == _tenant(user), Recebimento.obra_id == obra_id)
        .order_by(Recebimento.data_recebimento.desc())
    )
    result = await db.execute(stmt)
    return result.scalars().all()


@router.post("/recebimentos", response_model=RecebimentoResponse, status_code=status.HTTP_201_CREATED)
async def criar_recebimento(body: RecebimentoCreate, db: DB, user: CurrentUser):
    numero = await _proximo_numero(db, "REC", Recebimento, _tenant(user))
    itens_data = body.model_dump(exclude={"itens"})
    rec = Recebimento(**itens_data, numero=numero, tenant_id=_tenant(user))

    for item_data in body.itens:
        item = RecebimentoItem(**item_data.model_dump(), recebimento=rec)
        db.add(item)

    db.add(rec)
    await db.commit()

    stmt = (
        select(Recebimento)
        .options(selectinload(Recebimento.itens))
        .where(Recebimento.id == rec.id)
    )
    result = await db.execute(stmt)
    return result.scalar_one()


@router.patch("/recebimentos/{rec_id}", response_model=RecebimentoResponse)
async def atualizar_recebimento(rec_id: uuid.UUID, body: RecebimentoUpdate, db: DB, user: CurrentUser):
    stmt = (
        select(Recebimento)
        .options(selectinload(Recebimento.itens))
        .where(Recebimento.id == rec_id, Recebimento.tenant_id == _tenant(user))
    )
    result = await db.execute(stmt)
    rec = result.scalar_one_or_none()
    if not rec:
        raise HTTPException(404)

    status_anterior = rec.status
    for k, v in body.model_dump(exclude_none=True, exclude={"itens"}).items():
        setattr(rec, k, v)

    # ── Atualiza itens individualmente se fornecidos ──────────────────────────
    if body.itens:
        for item_upd in body.itens:
            item = await db.get(RecebimentoItem, item_upd.id)
            if item:
                if item_upd.quantidade_recebida is not None:
                    item.quantidade_recebida = item_upd.quantidade_recebida
                if item_upd.quantidade_recusada is not None:
                    item.quantidade_recusada = item_upd.quantidade_recusada
                if item_upd.motivo_recusa is not None:
                    item.motivo_recusa = item_upd.motivo_recusa

    # ── Quando entrega confirmada → credita no estoque + encerra OC ───────────
    if body.status == StatusRecebimento.conferido and status_anterior != StatusRecebimento.conferido:
        for item in rec.itens:
            qtd_efetiva = round(
                max(0.0, float(item.quantidade_recebida) - float(item.quantidade_recusada)), 3
            )
            if qtd_efetiva <= 0:
                continue

            # Tenta obter preço unitário do item de OC vinculado
            preco_unitario: float | None = None
            if item.oc_item_id:
                oc_item = await db.get(OCItem, item.oc_item_id)
                if oc_item:
                    preco_unitario = float(oc_item.preco_unitario)

            # Busca ou cria item de estoque
            estoque_stmt = select(EstoqueItem).where(
                EstoqueItem.tenant_id == _tenant(user),
                EstoqueItem.obra_id == rec.obra_id,
                EstoqueItem.nome == item.descricao,
                EstoqueItem.unidade == item.unidade,
            )
            estoque_res = await db.execute(estoque_stmt)
            estoque_item = estoque_res.scalar_one_or_none()

            if estoque_item:
                estoque_item.quantidade = round(float(estoque_item.quantidade) + qtd_efetiva, 3)
                # Preenche preço unitário se ainda não tinha
                if preco_unitario is not None and estoque_item.preco_unitario is None:
                    estoque_item.preco_unitario = preco_unitario
            else:
                db.add(EstoqueItem(
                    tenant_id=_tenant(user),
                    obra_id=rec.obra_id,
                    nome=item.descricao,
                    unidade=item.unidade,
                    quantidade=qtd_efetiva,
                    quantidade_minima=0,
                    preco_unitario=preco_unitario,
                ))

        # Marca OC vinculada como entregue
        if rec.oc_id:
            oc = await db.get(OrdemCompra, rec.oc_id)
            if oc and oc.tenant_id == _tenant(user) and oc.status not in (
                StatusOC.cancelada, StatusOC.arquivada, StatusOC.entregue
            ):
                oc.status = StatusOC.entregue

    await db.commit()
    # Reload com itens
    stmt2 = (
        select(Recebimento)
        .options(selectinload(Recebimento.itens))
        .where(Recebimento.id == rec_id)
    )
    res2 = await db.execute(stmt2)
    return res2.scalar_one()


@router.delete("/recebimentos/{rec_id}", status_code=status.HTTP_204_NO_CONTENT)
async def excluir_recebimento(rec_id: uuid.UUID, db: DB, user: CurrentUser):
    rec = await db.get(Recebimento, rec_id)
    if not rec or rec.tenant_id != _tenant(user):
        raise HTTPException(404)
    await db.delete(rec)
    await db.commit()


# ═══════════════════════════════════════════════════════════════════════════════
# EXTRAÇÃO DE ITENS DE PROPOSTA (PDF / XLSX / DOCX → JSON)
# ═══════════════════════════════════════════════════════════════════════════════

MIME_PERMITIDOS = {
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/msword",
}


@router.post("/cotacoes/extrair-itens")
async def extrair_itens_proposta(
    arquivo: UploadFile,
    user: CurrentUser,
):
    """
    Recebe um arquivo de proposta (PDF, XLSX ou DOCX) e retorna os itens
    extraídos via IA (Gemini) ou parser direto.
    """
    # Detecta mime type (usa o informado ou infere pela extensão)
    mime = arquivo.content_type or ""
    nome = (arquivo.filename or "").lower()
    if not mime or mime == "application/octet-stream":
        if nome.endswith(".pdf"):
            mime = "application/pdf"
        elif nome.endswith((".xlsx", ".xls")):
            mime = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        elif nome.endswith((".docx", ".doc")):
            mime = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"

    if not any(m in mime for m in ["pdf", "excel", "spreadsheet", "word", "msword"]):
        raise HTTPException(400, f"Tipo de arquivo não suportado: {mime}. Use PDF, XLSX ou DOCX.")

    conteudo = await arquivo.read()
    if len(conteudo) > 20 * 1024 * 1024:  # 20 MB
        raise HTTPException(400, "Arquivo muito grande. Limite: 20 MB.")

    try:
        itens = await _extrair_itens(conteudo, mime)
    except Exception as exc:
        raise HTTPException(422, f"Erro na extração: {exc}") from exc

    return {
        "total": len(itens),
        "itens": itens,
        "arquivo": arquivo.filename,
        "tipo": mime,
    }


# ═══════════════════════════════════════════════════════════════════════════════
# COTAÇÕES
# ═══════════════════════════════════════════════════════════════════════════════

def _cotacao_to_response(c: Cotacao) -> CotacaoResponse:
    r = CotacaoResponse.model_validate(c)
    r.fornecedor_nome = c.fornecedor.nome if c.fornecedor else None
    r.arquivo_nome = c.arquivo_nome
    return r


@router.get("/cotacoes", response_model=list[CotacaoResponse])
async def listar_todas_cotacoes(db: DB, user: CurrentUser):
    stmt = (
        select(Cotacao)
        .options(selectinload(Cotacao.itens), selectinload(Cotacao.fornecedor))
        .where(Cotacao.tenant_id == _tenant(user))
        .order_by(Cotacao.criado_em.desc())
    )
    result = await db.execute(stmt)
    return [_cotacao_to_response(c) for c in result.scalars().all()]


@router.get("/requisicoes/{req_id}/cotacoes", response_model=list[CotacaoResponse])
async def listar_cotacoes_por_requisicao(req_id: uuid.UUID, db: DB, user: CurrentUser):
    stmt = (
        select(Cotacao)
        .options(selectinload(Cotacao.itens), selectinload(Cotacao.fornecedor))
        .where(Cotacao.tenant_id == _tenant(user), Cotacao.requisicao_id == req_id)
        .order_by(Cotacao.criado_em.desc())
    )
    result = await db.execute(stmt)
    return [_cotacao_to_response(c) for c in result.scalars().all()]


@router.post("/cotacoes", response_model=CotacaoResponse, status_code=status.HTTP_201_CREATED)
async def criar_cotacao(body: CotacaoCreate, db: DB, user: CurrentUser):
    numero = await _proximo_numero(db, "COT", Cotacao, _tenant(user))
    dados = body.model_dump(exclude={"itens"})
    cot = Cotacao(**dados, numero=numero, tenant_id=_tenant(user))

    valor_total = 0.0
    for it in body.itens:
        preco_total = round(it.quantidade * it.preco_unitario, 2)
        db.add(CotacaoItem(**it.model_dump(), preco_total=preco_total, cotacao=cot))
        valor_total += preco_total

    cot.valor_total = round(valor_total, 2)
    db.add(cot)
    await db.commit()

    # Atualiza status da requisição para em_cotacao (se existir)
    if body.requisicao_id:
        req = await db.get(Requisicao, body.requisicao_id)
        if req and req.status == "aprovada":
            req.status = "em_cotacao"
            await db.commit()

    stmt = (
        select(Cotacao)
        .options(selectinload(Cotacao.itens), selectinload(Cotacao.fornecedor))
        .where(Cotacao.id == cot.id)
    )
    result = await db.execute(stmt)
    return _cotacao_to_response(result.scalar_one())


@router.get("/cotacoes/{cot_id}", response_model=CotacaoResponse)
async def obter_cotacao(cot_id: uuid.UUID, db: DB, user: CurrentUser):
    stmt = (
        select(Cotacao)
        .options(selectinload(Cotacao.itens), selectinload(Cotacao.fornecedor))
        .where(Cotacao.id == cot_id, Cotacao.tenant_id == _tenant(user))
    )
    result = await db.execute(stmt)
    cot = result.scalar_one_or_none()
    if not cot:
        raise HTTPException(404, "Cotação não encontrada")
    return _cotacao_to_response(cot)


@router.patch("/cotacoes/{cot_id}", response_model=CotacaoResponse)
async def atualizar_cotacao(cot_id: uuid.UUID, body: CotacaoUpdate, db: DB, user: CurrentUser):
    stmt = (
        select(Cotacao)
        .options(selectinload(Cotacao.itens), selectinload(Cotacao.fornecedor))
        .where(Cotacao.id == cot_id, Cotacao.tenant_id == _tenant(user))
    )
    result = await db.execute(stmt)
    cot = result.scalar_one_or_none()
    if not cot:
        raise HTTPException(404)
    for k, v in body.model_dump(exclude_none=True).items():
        setattr(cot, k, v)
    await db.commit()
    await db.refresh(cot)
    return _cotacao_to_response(cot)


@router.delete("/cotacoes/{cot_id}", status_code=status.HTTP_204_NO_CONTENT)
async def excluir_cotacao(cot_id: uuid.UUID, db: DB, user: CurrentUser):
    cot = await db.get(Cotacao, cot_id)
    if not cot or cot.tenant_id != _tenant(user):
        raise HTTPException(404)
    await db.delete(cot)
    await db.commit()


@router.post("/cotacoes/{cot_id}/arquivo", status_code=status.HTTP_204_NO_CONTENT)
async def upload_arquivo_cotacao(
    cot_id: uuid.UUID,
    arquivo: UploadFile,
    db: DB,
    user: CurrentUser,
):
    """Anexa o arquivo da proposta recebida (PDF, XLSX ou DOCX) a uma cotação."""
    cot = await db.get(Cotacao, cot_id)
    if not cot or cot.tenant_id != _tenant(user):
        raise HTTPException(404)

    conteudo = await arquivo.read()
    if len(conteudo) > 20 * 1024 * 1024:
        raise HTTPException(400, "Arquivo muito grande. Limite: 20 MB.")

    mime = arquivo.content_type or "application/octet-stream"
    nome = arquivo.filename or "proposta"

    cot.arquivo_nome = nome
    cot.arquivo_mime = mime
    cot.arquivo_bytes = conteudo
    await db.commit()


@router.get("/cotacoes/{cot_id}/arquivo")
async def download_arquivo_cotacao(cot_id: uuid.UUID, db: DB, user: CurrentUser):
    """Retorna o arquivo da proposta anexado à cotação."""
    cot = await db.get(Cotacao, cot_id)
    if not cot or cot.tenant_id != _tenant(user):
        raise HTTPException(404)
    if not cot.arquivo_bytes:
        raise HTTPException(404, "Nenhum arquivo anexado a esta cotação.")
    return Response(
        content=cot.arquivo_bytes,
        media_type=cot.arquivo_mime or "application/octet-stream",
        headers={
            "Content-Disposition": f'inline; filename="{cot.arquivo_nome}"',
            "Content-Type": cot.arquivo_mime or "application/octet-stream",
        },
    )


# ── Comparativo ────────────────────────────────────────────────────────────────

@router.get("/requisicoes/{req_id}/comparativo", response_model=ComparativoResponse)
async def comparativo_cotacoes(req_id: uuid.UUID, db: DB, user: CurrentUser):
    """
    Monta grade comparativa de preços: linhas = itens, colunas = fornecedores.
    Para cada item, marca o menor preço.
    """
    stmt = (
        select(Cotacao)
        .options(selectinload(Cotacao.itens), selectinload(Cotacao.fornecedor))
        .where(
            Cotacao.tenant_id == _tenant(user),
            Cotacao.requisicao_id == req_id,
            Cotacao.status.notin_(["recusada"]),
        )
        .order_by(Cotacao.numero)
    )
    result = await db.execute(stmt)
    cotacoes = result.scalars().all()

    if not cotacoes:
        return ComparativoResponse(
            requisicao_id=req_id, fornecedores=[], itens=[]
        )

    # Normaliza descrição para chave de agrupamento (lower + strip)
    def _key(desc: str) -> str:
        return desc.strip().lower()

    # Agrupa itens por descrição normalizada → {key: {cotacao_id: CotacaoItem}}
    itens_map: dict[str, dict[uuid.UUID, CotacaoItem]] = {}
    descricao_original: dict[str, str] = {}
    unidade_map: dict[str, str] = {}
    qtd_map: dict[str, float] = {}

    for cot in cotacoes:
        for item in cot.itens:
            k = _key(item.descricao)
            if k not in itens_map:
                itens_map[k] = {}
                descricao_original[k] = item.descricao
                unidade_map[k] = item.unidade
                qtd_map[k] = float(item.quantidade)
            itens_map[k][cot.id] = item

    # Monta linhas do comparativo
    rows: list[ComparativoItemRow] = []
    for k, cot_items in itens_map.items():
        precos: list[ComparativoPreco] = []
        for cot in cotacoes:
            if cot.id in cot_items:
                ci = cot_items[cot.id]
                precos.append(ComparativoPreco(
                    cotacao_id=cot.id,
                    cotacao_numero=cot.numero,
                    fornecedor_id=cot.fornecedor_id,
                    fornecedor_nome=cot.fornecedor.nome if cot.fornecedor else "Sem fornecedor",
                    preco_unitario=float(ci.preco_unitario),
                    preco_total=float(ci.preco_total),
                    marca_modelo=ci.marca_modelo,
                    observacao=ci.observacao,
                    melhor=False,
                ))

        if precos:
            menor = min(p.preco_unitario for p in precos)
            for p in precos:
                p.melhor = abs(p.preco_unitario - menor) < 0.0001

        rows.append(ComparativoItemRow(
            descricao=descricao_original[k],
            unidade=unidade_map[k],
            quantidade=qtd_map[k],
            cotacoes=precos,
            menor_preco=min((p.preco_unitario for p in precos), default=None),
        ))

    # Totais por fornecedor (soma apenas os itens que cada um cotou)
    forn_totals: dict[uuid.UUID, float] = {c.id: float(c.valor_total) for c in cotacoes}

    fornecedores = [
        ComparativoFornecedor(
            cotacao_id=c.id,
            cotacao_numero=c.numero,
            fornecedor_id=c.fornecedor_id,
            fornecedor_nome=c.fornecedor.nome if c.fornecedor else "Sem fornecedor",
            total_geral=forn_totals[c.id],
            validade=c.validade,
            prazo_entrega=c.prazo_entrega,
            condicao_pagamento=c.condicao_pagamento,
            frete=c.frete,
        )
        for c in cotacoes
    ]

    return ComparativoResponse(
        requisicao_id=req_id,
        fornecedores=fornecedores,
        itens=rows,
    )


# ── Geração de OCs a partir do comparativo ────────────────────────────────────

@router.post(
    "/requisicoes/{req_id}/gerar-ocs",
    response_model=list[OrdemCompraResponse],
    status_code=status.HTTP_201_CREATED,
)
async def gerar_ocs_do_comparativo(
    req_id: uuid.UUID, body: GerarOCsBody, db: DB, user: CurrentUser
):
    """
    Recebe as seleções do comparativo (cotacao_id + item) e cria uma OC por
    fornecedor com os respectivos itens selecionados.
    """
    # Agrupa seleções por cotacao_id
    grupos: dict[uuid.UUID, list] = {}
    for sel in body.selecoes:
        grupos.setdefault(sel.cotacao_id, []).append(sel)

    ocs_criadas: list[OrdemCompra] = []

    for cot_id, selecoes in grupos.items():
        # Busca a cotação para herdar obra_id, fornecedor_id etc.
        cot = await db.get(Cotacao, cot_id)
        if not cot or cot.tenant_id != _tenant(user):
            raise HTTPException(404, f"Cotação {cot_id} não encontrada")

        # Busca obra_id da requisição
        obra_id = None
        if cot.requisicao_id:
            req = await db.get(Requisicao, cot.requisicao_id)
            if req:
                obra_id = req.obra_id

        numero = await _proximo_numero(db, "OC", OrdemCompra, _tenant(user))
        oc = OrdemCompra(
            numero=numero,
            tenant_id=_tenant(user),
            obra_id=obra_id,
            fornecedor_id=cot.fornecedor_id,
            requisicao_id=req_id,
            data_emissao=body.data_emissao,
            prazo_entrega=None,
            condicao_pagamento=cot.condicao_pagamento,
            local_entrega=None,
            observacoes=f"Gerada a partir de {cot.numero}",
        )

        valor_total = 0.0
        for sel in selecoes:
            preco_total = round(sel.quantidade * sel.preco_unitario, 2)
            db.add(OCItem(
                descricao=sel.descricao,
                unidade=sel.unidade,
                quantidade=sel.quantidade,
                preco_unitario=sel.preco_unitario,
                preco_total=preco_total,
                oc=oc,
            ))
            valor_total += preco_total

        oc.valor_total = round(valor_total, 2)
        db.add(oc)
        ocs_criadas.append(oc)

    await db.commit()

    # Atualiza status da requisição para comprada
    req = await db.get(Requisicao, req_id)
    if req and req.tenant_id == _tenant(user):
        req.status = "comprada"
        await db.commit()

    # Retorna OCs criadas com itens e fornecedor
    result_ocs: list[OrdemCompraResponse] = []
    for oc in ocs_criadas:
        stmt = (
            select(OrdemCompra)
            .options(selectinload(OrdemCompra.itens), selectinload(OrdemCompra.fornecedor))
            .where(OrdemCompra.id == oc.id)
        )
        res = await db.execute(stmt)
        result_ocs.append(_oc_to_response(res.scalar_one()))

    return result_ocs
