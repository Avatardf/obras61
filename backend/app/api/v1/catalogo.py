"""Endpoints de catálogo de materiais (dados de referência, leitura apenas)."""
from fastapi import APIRouter, Query

from app.utils.catalogo import carregar_catalogo, listar_familias

router = APIRouter(tags=["catalogo"])


@router.get("/materiais")
async def listar_materiais(
    q: str | None = Query(None, description="Filtro por descrição (case-insensitive)"),
    familia: str | None = Query(None, description="Filtrar por família exata"),
    limit: int = Query(50, ge=1, le=6000),
):
    """Retorna materiais do catálogo com suporte a busca e filtro por família."""
    catalogo = carregar_catalogo()

    resultado = catalogo
    if familia:
        resultado = [m for m in resultado if m["familia"] == familia]
    if q:
        q_lower = q.lower()
        resultado = [m for m in resultado if q_lower in m["descricao"].lower()]

    return {
        "total": len(resultado),
        "items": resultado[:limit],
    }


@router.get("/materiais/familias")
async def listar_familias_endpoint():
    """Retorna lista de famílias disponíveis no catálogo."""
    return listar_familias()
