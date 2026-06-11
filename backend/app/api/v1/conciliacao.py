"""API Conciliação Bancária: parse OFX + finalizar matches."""
import re
import uuid
from datetime import date
from typing import Annotated

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.dependencies import CurrentUser
from app.models.financeiro import LancamentoFinanceiro, StatusLancamento

router = APIRouter(tags=["conciliacao"])
DB = Annotated[AsyncSession, Depends(get_db)]


# ── Schemas ────────────────────────────────────────────────────────────────────

class TransacaoOFX(BaseModel):
    fitid: str
    data: str           # YYYY-MM-DD
    valor: float        # positivo = crédito, negativo = débito
    nome: str           # rótulo do banco (DEB PIX CH, RESG AUT…)
    memo: str           # descrição longa
    tipo: str           # CREDIT | DEBIT
    categoria: str      # resg_aut | tarifa | pix | boleto | pagamento | outro


class OFXParseResult(BaseModel):
    banco: str
    conta: str
    moeda: str
    data_inicio: str
    data_fim: str
    saldo_final: float
    data_saldo: str
    transacoes: list[TransacaoOFX]


class MatchItem(BaseModel):
    transacao_fitid: str
    lancamento_id: str


class FinalizarRequest(BaseModel):
    matches: list[MatchItem]


# ── Parser OFX (SGML / OFXSGML v102) ──────────────────────────────────────────

def _tag(name: str, text: str) -> str | None:
    m = re.search(rf"<{name}>\s*([^\r\n<]+)", text, re.IGNORECASE)
    return m.group(1).strip() if m else None


def _parse_date(s: str) -> str:
    """'20260501120000[-3:EST]' → '2026-05-01'"""
    if not s or len(s) < 8:
        return "0000-00-00"
    return f"{s[:4]}-{s[4:6]}-{s[6:8]}"


def _classify(nome: str) -> str:
    n = nome.upper()
    if any(k in n for k in ("RESG AUT", "APLIC AUT", "RESGATE AUT")):
        return "resg_aut"
    if any(k in n for k in ("TAR PIX", "TAR MAN", "TARIFA", "TAR ", "ANUIDADE")):
        return "tarifa"
    if any(k in n for k in ("DEB PIX", "CRE PIX", "ENVIO PIX", "REC PIX", "PIX")):
        return "pix"
    if any(k in n for k in ("PAG BOLETO", "PG BOL", "BOLETO")):
        return "boleto"
    if any(k in n for k in ("PAG ", "PG ", "PAGTO")):
        return "pagamento"
    return "outro"


def _parse_ofx(content: str) -> OFXParseResult:
    banco      = _tag("BANKID",  content) or "desconhecido"
    conta      = _tag("ACCTID",  content) or ""
    moeda      = _tag("CURDEF",  content) or "BRL"
    dt_ini_raw = _tag("DTSTART", content) or "00000000"
    dt_fim_raw = _tag("DTEND",   content) or "00000000"
    saldo_raw  = _tag("BALAMT",  content) or "0"
    dt_sal_raw = _tag("DTASOF",  content) or "00000000"

    try:
        saldo_final = float(saldo_raw.replace(",", "."))
    except ValueError:
        saldo_final = 0.0

    transacoes: list[TransacaoOFX] = []
    blocos = re.findall(r"<STMTTRN>(.*?)</STMTTRN>", content, re.DOTALL | re.IGNORECASE)

    for bloco in blocos:
        dtpost  = _parse_date(_tag("DTPOSTED", bloco) or "00000000")
        valor_s = (_tag("TRNAMT", bloco) or "0").replace(",", ".")
        try:
            valor = float(valor_s)
        except ValueError:
            valor = 0.0
        fitid   = _tag("FITID", bloco) or ""
        nome    = _tag("NAME",  bloco) or ""
        memo    = _tag("MEMO",  bloco) or nome
        tipo    = "CREDIT" if valor >= 0 else "DEBIT"
        categ   = _classify(nome)

        transacoes.append(TransacaoOFX(
            fitid=fitid, data=dtpost, valor=valor,
            nome=nome, memo=memo, tipo=tipo, categoria=categ,
        ))

    return OFXParseResult(
        banco=banco, conta=conta, moeda=moeda,
        data_inicio=_parse_date(dt_ini_raw),
        data_fim=_parse_date(dt_fim_raw),
        saldo_final=saldo_final,
        data_saldo=_parse_date(dt_sal_raw),
        transacoes=transacoes,
    )


# ── Endpoints ──────────────────────────────────────────────────────────────────

@router.post("/conciliacao/upload", response_model=OFXParseResult)
async def upload_ofx(
    user: CurrentUser,
    arquivo: UploadFile = File(...),
) -> OFXParseResult:
    """Recebe arquivo OFX e retorna transações parseadas (sem persistir)."""
    try:
        raw = await arquivo.read()
        # Tenta UTF-8 → latin-1 → fallback ignore
        for enc in ("utf-8", "latin-1", "cp1252"):
            try:
                content = raw.decode(enc)
                break
            except UnicodeDecodeError:
                continue
        else:
            content = raw.decode("latin-1", errors="ignore")
    except Exception:
        raise HTTPException(400, "Não foi possível ler o arquivo.")

    try:
        return _parse_ofx(content)
    except Exception as exc:
        raise HTTPException(400, f"Erro ao parsear OFX: {exc}")


@router.post("/conciliacao/finalizar")
async def finalizar_conciliacao(
    body: FinalizarRequest,
    db: DB,
    user: CurrentUser,
) -> dict:
    """Marca os lançamentos confirmados como pagos na data de hoje."""
    atualizados = 0
    for match in body.matches:
        try:
            lid = uuid.UUID(match.lancamento_id)
        except ValueError:
            continue
        lanc = await db.get(LancamentoFinanceiro, lid)
        if lanc and lanc.tenant_id == user.tenant_id:
            lanc.status = StatusLancamento.pago
            if not lanc.data_pagamento:
                lanc.data_pagamento = date.today()
            atualizados += 1

    await db.commit()
    return {"atualizados": atualizados}
