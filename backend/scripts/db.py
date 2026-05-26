#!/usr/bin/env python
"""
Utilitários de banco de dados.

Uso:
  python scripts/db.py upgrade          # aplica todas as migrações pendentes
  python scripts/db.py downgrade        # desfaz a última migração
  python scripts/db.py reset            # apaga tudo e recria (APENAS dev)
  python scripts/db.py history          # histórico de migrações
  python scripts/db.py seed             # insere dados de exemplo para desenvolvimento
"""
import subprocess
import sys


def alembic(*args: str) -> None:
    subprocess.run(["alembic", *args], check=True)


def seed() -> None:
    import asyncio
    import uuid
    from app.core.security import hash_password
    from app.database import AsyncSessionLocal
    from app.models.tenant import Tenant, User, Plano, Papel
    from app.models.obra import Empreendimento, Obra, Etapa, TipoEmpreendimento

    async def _seed() -> None:
        async with AsyncSessionLocal() as db:
            # Tenant de exemplo
            tenant = Tenant(
                id=uuid.uuid4(),
                nome="Construtora Demo Ltda",
                cnpj="12.345.678/0001-90",
                plano=Plano.professional,
            )
            db.add(tenant)
            await db.flush()

            # Usuário admin
            admin = User(
                id=uuid.uuid4(),
                tenant_id=tenant.id,
                nome="Admin Demo",
                email="admin@demo.com.br",
                senha_hash=hash_password("demo1234"),
                papel=Papel.admin,
            )
            db.add(admin)

            # Empreendimento de exemplo
            emp = Empreendimento(
                id=uuid.uuid4(),
                tenant_id=tenant.id,
                nome="Residencial Carioca Tower",
                tipo=TipoEmpreendimento.residencial_vertical,
                endereco={"cidade": "Rio de Janeiro", "uf": "RJ", "bairro": "Barra da Tijuca"},
                vgv_previsto=42_000_000.00,
                status="em_obras",
            )
            db.add(emp)
            await db.flush()

            # Obra
            obra = Obra(
                id=uuid.uuid4(),
                tenant_id=tenant.id,
                empreendimento_id=emp.id,
                nome="Torre A — 18 pavimentos",
                area_construida_m2=8_400.0,
                numero_pavimentos=18,
                numero_unidades=72,
                status="em_execucao",
            )
            db.add(obra)
            await db.flush()

            # Etapas padrão de um edifício residencial vertical
            etapas = [
                ("Fundação",          1,  8.0),
                ("Estrutura",         2, 30.0),
                ("Vedação / Alvenaria",3, 12.0),
                ("Cobertura",         4,  5.0),
                ("Instalações Elétricas", 5, 10.0),
                ("Instalações Hidráulicas",6, 10.0),
                ("Revestimentos",     7, 12.0),
                ("Esquadrias",        8,  5.0),
                ("Pintura",           9,  5.0),
                ("Acabamentos / Entrega", 10, 3.0),
            ]
            for nome, ordem, peso in etapas:
                db.add(Etapa(
                    id=uuid.uuid4(),
                    obra_id=obra.id,
                    nome=nome,
                    ordem=ordem,
                    percentual_peso=peso,
                ))

            await db.commit()
            print("✓ Seed concluído.")
            print(f"  Tenant:  {tenant.nome}  (id: {tenant.id})")
            print(f"  Login:   admin@demo.com.br  /  demo1234")
            print(f"  Obra:    {obra.nome}")

    asyncio.run(_seed())


if __name__ == "__main__":
    cmd = sys.argv[1] if len(sys.argv) > 1 else "upgrade"

    if cmd == "upgrade":
        alembic("upgrade", "head")
    elif cmd == "downgrade":
        alembic("downgrade", "-1")
    elif cmd == "history":
        alembic("history", "--verbose")
    elif cmd == "reset":
        confirm = input("⚠️  Isso apagará todos os dados. Confirma? (sim/não): ")
        if confirm.lower() == "sim":
            alembic("downgrade", "base")
            alembic("upgrade", "head")
    elif cmd == "seed":
        seed()
    else:
        print(__doc__)
