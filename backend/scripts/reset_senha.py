"""Redefine senha de todos os usuários para admin123 — uso pontual."""
import asyncio
import bcrypt
import asyncpg


async def run():
    conn = await asyncpg.connect(
        "postgresql://obras_user:obras_dev_pass@db:5432/obras"
    )
    rows = await conn.fetch("SELECT id, email FROM users")
    novo_hash = bcrypt.hashpw(b"senha123", bcrypt.gensalt(rounds=12)).decode()
    for r in rows:
        await conn.execute(
            "UPDATE users SET senha_hash = $1 WHERE id = $2",
            novo_hash,
            r["id"],
        )
        print(f"✅ {r['email']} → senha: admin123")
    await conn.close()


asyncio.run(run())
