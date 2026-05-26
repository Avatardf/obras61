from fastapi import APIRouter

from app.api.v1 import auth, catalogo, centro_custo, dashboard, empreendimentos, financeiro, obras, orcamentos, rdo, suprimentos, vision

router = APIRouter(prefix="/api/v1")

router.include_router(auth.router)
router.include_router(dashboard.router)       # GET /dashboard
router.include_router(empreendimentos.router)
router.include_router(obras.router)           # /empreendimentos/{id}/obras e /obras/{id}
router.include_router(orcamentos.router)      # /orcamentos + /obras/{id}/orcamentos + /obras/{id}/custos
router.include_router(rdo.router)             # /rdos + /obras/{id}/rdos
router.include_router(vision.router)
router.include_router(suprimentos.router)     # /fornecedores + /estoque + /requisicoes + /ordens-compra + /recebimentos
router.include_router(financeiro.router)      # /financeiro + /obras/{id}/financeiro
router.include_router(catalogo.router)        # /materiais + /materiais/familias
router.include_router(centro_custo.router)    # /obras/{id}/centro-custo
