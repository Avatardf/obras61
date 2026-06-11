from fastapi import APIRouter

from app.api.v1 import auth, catalogo, centro_custo, conciliacao, dashboard, documentos, empreendimentos, equipes, financeiro, obras, orcamentos, rdo, suprimentos, usuarios, vision

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
router.include_router(usuarios.router)        # /usuarios — gerenciamento de usuários (admin)
router.include_router(conciliacao.router)     # /conciliacao/upload + /conciliacao/finalizar
router.include_router(documentos.router)      # /empreendimentos/{id}/documentos + /documentos/matriz
router.include_router(equipes.router)         # /colaboradores + /equipes + alocações equipe→obra
