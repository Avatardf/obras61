/**
 * VoiceRecorderRDO
 * ─────────────────
 * Modal de gravação por voz para alimentar o RDO.
 *
 * Fluxo:
 *  1. Exibe um roteiro pré-formatado dos quesitos do RDO (script de fala).
 *  2. Usuário clica em "Iniciar Gravação" — MediaRecorder captura o áudio do mic.
 *  3. Ao parar, o áudio é enviado ao backend (POST /rdos/transcrever-voz).
 *  4. O Gemini transcreve + extrai os campos estruturados.
 *  5. Componente entrega os campos ao parent via callback `onTranscricaoPronta`.
 */
import { useMutation } from "@tanstack/react-query";
import { clsx } from "clsx";
import {
  AlertCircle, CheckCircle2, Loader2, Mic, MicOff, Pause,
  Play, RotateCcw, Square, Volume2, X, Sparkles,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { rdoApi } from "@/api/client";
import type { TranscricaoVozResponse } from "@/types";

// ─────────────────────────────────────────────────────────────────────────────
// Roteiro / Script com os quesitos que o RDO deve conter
// ─────────────────────────────────────────────────────────────────────────────

interface ItemRoteiro {
  numero: number;
  titulo: string;
  icone: string;
  guia: string;
  exemplo: string;
}

const ROTEIRO_RDO: ItemRoteiro[] = [
  {
    numero: 1,
    titulo: "Condições Climáticas",
    icone: "🌤️",
    guia: "Descreva o clima da MANHÃ e da TARDE separadamente.",
    exemplo: "\"De manhã estava ensolarado. À tarde caiu uma chuva forte por volta das 15h.\"",
  },
  {
    numero: 2,
    titulo: "Efetivo presente",
    icone: "👷",
    guia: "Quantos trabalhadores no total e a composição por função.",
    exemplo: "\"Hoje tivemos 18 trabalhadores: 5 pedreiros, 8 serventes, 2 armadores, 2 carpinteiros e 1 mestre.\"",
  },
  {
    numero: 3,
    titulo: "Atividades executadas",
    icone: "🔨",
    guia: "Liste cada atividade realizada durante o dia, com clareza técnica.",
    exemplo: "\"Concretamos a laje do 3º pavimento. Continuamos a alvenaria do bloco B. Iniciamos a instalação hidráulica do térreo.\"",
  },
  {
    numero: 4,
    titulo: "Ocorrências e não-conformidades",
    icone: "⚠️",
    guia: "Mencione acidentes, retrabalhos, atrasos, falhas. Indique gravidade (baixa, média, alta).",
    exemplo: "\"Tivemos um quase-acidente: servente quase caiu do andaime no bloco A — gravidade média. Material errado entregue de cimento — baixa.\"",
  },
  {
    numero: 5,
    titulo: "Observações gerais",
    icone: "📝",
    guia: "Pendências, próximos passos, comentários, decisões importantes.",
    exemplo: "\"Amanhã precisa entrega de ferragem CA-50. Cliente vem visitar a obra na sexta.\"",
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Hook: useVoiceRecorder — encapsula MediaRecorder
// ─────────────────────────────────────────────────────────────────────────────

type EstadoGravacao = "ocioso" | "gravando" | "pausado" | "encerrado";

function useVoiceRecorder() {
  const [estado, setEstado]       = useState<EstadoGravacao>("ocioso");
  const [duracaoSeg, setDuracao]  = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl]   = useState<string | null>(null);
  const [erro, setErro]           = useState<string | null>(null);
  const [nivelAudio, setNivelAudio] = useState(0);  // 0–100 (animação visual)

  const recorderRef    = useRef<MediaRecorder | null>(null);
  const streamRef      = useRef<MediaStream | null>(null);
  const chunksRef      = useRef<Blob[]>([]);
  const startTimeRef   = useRef<number>(0);
  const timerRef       = useRef<number | null>(null);
  const audioCtxRef    = useRef<AudioContext | null>(null);
  const analyserRef    = useRef<AnalyserNode | null>(null);
  const animRef        = useRef<number | null>(null);

  function _cleanupTimers() {
    if (timerRef.current !== null) { clearInterval(timerRef.current); timerRef.current = null; }
    if (animRef.current !== null)  { cancelAnimationFrame(animRef.current); animRef.current = null; }
  }

  function _cleanupStream() {
    streamRef.current?.getTracks().forEach(t => t.stop());
    streamRef.current = null;
    if (audioCtxRef.current && audioCtxRef.current.state !== "closed") {
      audioCtxRef.current.close();
    }
    audioCtxRef.current = null;
    analyserRef.current = null;
  }

  async function iniciar() {
    setErro(null);
    setAudioBlob(null);
    setAudioUrl(null);
    chunksRef.current = [];
    setDuracao(0);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      // Analisador para feedback visual
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      audioCtxRef.current = ctx;
      analyserRef.current = analyser;

      const data = new Uint8Array(analyser.frequencyBinCount);
      const loop = () => {
        analyser.getByteFrequencyData(data);
        const sum = data.reduce((s, v) => s + v, 0);
        const avg = sum / data.length;
        setNivelAudio(Math.min(100, (avg / 128) * 100));
        animRef.current = requestAnimationFrame(loop);
      };
      loop();

      // Picks best supported mime
      const candidatos = ["audio/webm;codecs=opus", "audio/webm", "audio/ogg;codecs=opus", "audio/mp4"];
      const mime = candidatos.find(c => MediaRecorder.isTypeSupported(c)) || "";
      const recorder = mime ? new MediaRecorder(stream, { mimeType: mime }) : new MediaRecorder(stream);
      recorderRef.current = recorder;

      recorder.ondataavailable = (ev) => {
        if (ev.data.size > 0) chunksRef.current.push(ev.data);
      };
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" });
        setAudioBlob(blob);
        setAudioUrl(URL.createObjectURL(blob));
        setEstado("encerrado");
        _cleanupTimers();
        _cleanupStream();
      };
      recorder.start();

      startTimeRef.current = Date.now();
      timerRef.current = window.setInterval(() => {
        setDuracao(Math.floor((Date.now() - startTimeRef.current) / 1000));
      }, 250);

      setEstado("gravando");
    } catch (err: any) {
      setErro(
        err?.name === "NotAllowedError"
          ? "Permissão de microfone negada. Habilite o microfone para gravar."
          : `Erro ao acessar microfone: ${err?.message || err}`
      );
      setEstado("ocioso");
    }
  }

  function pausar() {
    recorderRef.current?.pause();
    setEstado("pausado");
    if (timerRef.current !== null) { clearInterval(timerRef.current); timerRef.current = null; }
  }

  function retomar() {
    recorderRef.current?.resume();
    startTimeRef.current = Date.now() - duracaoSeg * 1000;
    timerRef.current = window.setInterval(() => {
      setDuracao(Math.floor((Date.now() - startTimeRef.current) / 1000));
    }, 250);
    setEstado("gravando");
  }

  function parar() {
    if (recorderRef.current && recorderRef.current.state !== "inactive") {
      recorderRef.current.stop();
    } else {
      setEstado("encerrado");
      _cleanupTimers();
      _cleanupStream();
    }
  }

  function descartar() {
    if (audioUrl) URL.revokeObjectURL(audioUrl);
    setAudioBlob(null);
    setAudioUrl(null);
    setEstado("ocioso");
    setDuracao(0);
    setNivelAudio(0);
    setErro(null);
  }

  useEffect(() => () => {
    _cleanupTimers();
    _cleanupStream();
    if (audioUrl) URL.revokeObjectURL(audioUrl);
  }, []);

  return {
    estado, duracaoSeg, audioBlob, audioUrl, erro, nivelAudio,
    iniciar, pausar, retomar, parar, descartar,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Formatador de duração
// ─────────────────────────────────────────────────────────────────────────────

function fmtDur(s: number) {
  const m = Math.floor(s / 60).toString().padStart(2, "0");
  const sec = (s % 60).toString().padStart(2, "0");
  return `${m}:${sec}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Componente principal
// ─────────────────────────────────────────────────────────────────────────────

interface Props {
  aberto: boolean;
  onFechar: () => void;
  /** Callback chamado quando a transcrição vier do backend.
   *  O parent (RDOForm) usa para popular os campos do formulário. */
  onTranscricaoPronta: (dados: TranscricaoVozResponse) => void;
}

export function VoiceRecorderRDO({ aberto, onFechar, onTranscricaoPronta }: Props) {
  const rec = useVoiceRecorder();
  const [passo, setPasso] = useState<"roteiro" | "gravando" | "revisao">("roteiro");

  const transcrever = useMutation({
    mutationFn: (audio: Blob) => rdoApi.transcreverVoz(audio),
    onSuccess: (data) => {
      onTranscricaoPronta(data);
    },
  });

  useEffect(() => {
    if (rec.estado === "gravando" && passo === "roteiro") setPasso("gravando");
    if (rec.estado === "encerrado" && passo === "gravando") setPasso("revisao");
  }, [rec.estado, passo]);

  function handleFechar() {
    if (rec.estado === "gravando" || rec.estado === "pausado") rec.parar();
    rec.descartar();
    transcrever.reset();
    setPasso("roteiro");
    onFechar();
  }

  function handleRefazer() {
    rec.descartar();
    transcrever.reset();
    setPasso("roteiro");
  }

  function handleEnviar() {
    if (!rec.audioBlob) return;
    transcrever.mutate(rec.audioBlob);
  }

  if (!aberto) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center p-4 pt-8">
      <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={handleFechar} />

      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden animate-slide-in">

        {/* Header */}
        <div className="px-6 py-4 flex items-center gap-3 bg-gradient-to-r from-violet-50 to-brand-50 border-b border-slate-100">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-brand-600 flex items-center justify-center shadow-glow-brand">
            <Mic size={18} className="text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-slate-800">Gravar RDO por voz</h3>
            <p className="text-xs text-slate-500">
              {passo === "roteiro"  && "Siga o roteiro abaixo e clique em gravar"}
              {passo === "gravando" && "🔴 Gravando seu relato — fale com clareza"}
              {passo === "revisao"  && "Revise o áudio e envie para transcrição"}
            </p>
          </div>
          <button onClick={handleFechar}
            className="p-1.5 rounded-lg hover:bg-white/50 text-slate-500 transition-colors">
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1">

          {/* ── ROTEIRO ── */}
          {passo === "roteiro" && (
            <div className="p-6 space-y-4">
              <div className="bg-gradient-to-br from-brand-50 to-violet-50 border border-brand-200 rounded-xl p-4">
                <div className="flex items-start gap-3">
                  <Sparkles className="text-brand-600 shrink-0 mt-0.5" size={20} />
                  <div className="text-sm text-slate-700 leading-relaxed">
                    <p className="font-semibold mb-1">📋 Roteiro do RDO — leia antes de gravar</p>
                    <p className="text-xs text-slate-600">
                      Fale na ordem dos quesitos abaixo. Não precisa ler — fale naturalmente.
                      A IA vai transcrever e organizar os dados no formato correto. Você poderá
                      revisar e editar antes de salvar.
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-2.5">
                {ROTEIRO_RDO.map((it) => (
                  <div key={it.numero}
                    className="bg-white border border-slate-200 rounded-xl p-4 hover:border-brand-300 transition-colors">
                    <div className="flex items-start gap-3">
                      <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center shrink-0 text-base">
                        {it.icone}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-[10px] font-bold text-brand-600 bg-brand-50 px-1.5 py-0.5 rounded">
                            {it.numero}
                          </span>
                          <h4 className="font-semibold text-slate-800 text-sm">{it.titulo}</h4>
                        </div>
                        <p className="text-xs text-slate-600 mb-1.5">{it.guia}</p>
                        <p className="text-xs text-slate-500 italic bg-slate-50 px-2.5 py-1.5 rounded-lg">
                          💬 {it.exemplo}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {rec.erro && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-3 flex items-start gap-2">
                  <AlertCircle className="text-red-500 shrink-0 mt-0.5" size={16} />
                  <p className="text-xs text-red-700">{rec.erro}</p>
                </div>
              )}
            </div>
          )}

          {/* ── GRAVANDO ── */}
          {passo === "gravando" && (
            <div className="p-6 flex flex-col items-center justify-center text-center min-h-[400px]">

              {/* Anel pulsante com nível de áudio */}
              <div className="relative w-44 h-44 mb-6">
                <div className={clsx(
                  "absolute inset-0 rounded-full bg-red-500/20 transition-transform duration-200",
                  rec.estado === "gravando" && "animate-pulse"
                )}
                  style={{ transform: `scale(${1 + (rec.nivelAudio / 100) * 0.3})` }}
                />
                <div className="absolute inset-4 rounded-full bg-gradient-to-br from-red-500 to-red-600 flex items-center justify-center shadow-2xl">
                  {rec.estado === "gravando"
                    ? <Mic size={56} className="text-white" />
                    : <Pause size={56} className="text-white" />
                  }
                </div>
                {/* Indicador de gravação */}
                {rec.estado === "gravando" && (
                  <div className="absolute top-2 right-2 w-3 h-3 bg-red-500 rounded-full animate-ping" />
                )}
              </div>

              {/* Cronômetro */}
              <div className="text-4xl font-bold text-slate-800 font-mono tabular-nums mb-2">
                {fmtDur(rec.duracaoSeg)}
              </div>
              <p className="text-xs text-slate-500 mb-6">
                {rec.estado === "gravando" ? "🔴 Gravando…" : "⏸ Pausado"}
              </p>

              {/* Barra de nível */}
              <div className="w-full max-w-xs h-2 bg-slate-100 rounded-full overflow-hidden mb-6">
                <div
                  className="h-full bg-gradient-to-r from-emerald-400 via-amber-400 to-red-500 transition-all duration-100"
                  style={{ width: `${rec.nivelAudio}%` }}
                />
              </div>

              {/* Controles */}
              <div className="flex items-center gap-3">
                {rec.estado === "gravando" ? (
                  <button onClick={rec.pausar}
                    className="flex items-center gap-2 px-4 py-2.5 bg-amber-100 hover:bg-amber-200 text-amber-800 rounded-xl font-semibold text-sm transition-colors">
                    <Pause size={16} /> Pausar
                  </button>
                ) : (
                  <button onClick={rec.retomar}
                    className="flex items-center gap-2 px-4 py-2.5 bg-emerald-100 hover:bg-emerald-200 text-emerald-800 rounded-xl font-semibold text-sm transition-colors">
                    <Play size={16} /> Retomar
                  </button>
                )}
                <button onClick={rec.parar}
                  className="flex items-center gap-2 px-4 py-2.5 bg-slate-800 hover:bg-slate-900 text-white rounded-xl font-semibold text-sm transition-colors">
                  <Square size={14} /> Parar
                </button>
              </div>

              <p className="text-[11px] text-slate-400 mt-6 max-w-xs">
                💡 Dica: fale com clareza, na ordem dos quesitos do roteiro.
                Você pode pausar para consultar suas anotações.
              </p>
            </div>
          )}

          {/* ── REVISÃO ── */}
          {passo === "revisao" && (
            <div className="p-6 space-y-5">
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex items-start gap-3">
                <CheckCircle2 className="text-emerald-600 shrink-0 mt-0.5" size={18} />
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-emerald-800 text-sm">Gravação concluída!</p>
                  <p className="text-xs text-emerald-700 mt-0.5">
                    Duração: <strong>{fmtDur(rec.duracaoSeg)}</strong>.
                    Escute para conferir e envie para transcrição.
                  </p>
                </div>
              </div>

              {/* Player */}
              {rec.audioUrl && (
                <div className="bg-slate-50 rounded-xl p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <Volume2 size={14} className="text-slate-500" />
                    <span className="text-xs font-semibold text-slate-600">Pré-visualização do áudio</span>
                  </div>
                  <audio controls src={rec.audioUrl} className="w-full" />
                </div>
              )}

              {/* Estado de transcrição */}
              {transcrever.isPending && (
                <div className="bg-gradient-to-br from-violet-50 to-brand-50 border border-violet-200 rounded-xl p-5 flex flex-col items-center text-center">
                  <Loader2 className="text-violet-600 animate-spin mb-3" size={32} />
                  <p className="font-semibold text-slate-800 text-sm">Transcrevendo com IA…</p>
                  <p className="text-xs text-slate-600 mt-1">
                    Gemini está processando o áudio e extraindo os campos do RDO.
                    Isso pode levar até 1 minuto.
                  </p>
                </div>
              )}

              {transcrever.isError && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-4 flex items-start gap-3">
                  <AlertCircle className="text-red-500 shrink-0 mt-0.5" size={16} />
                  <div className="flex-1">
                    <p className="font-semibold text-red-800 text-sm">Erro na transcrição</p>
                    <p className="text-xs text-red-700 mt-0.5">
                      {(transcrever.error as any)?.response?.data?.detail
                        ?? "Erro ao processar o áudio. Tente novamente."}
                    </p>
                  </div>
                </div>
              )}

              {/* Ações */}
              {!transcrever.isPending && !transcrever.isSuccess && (
                <div className="flex items-center gap-3 justify-end">
                  <button onClick={handleRefazer}
                    className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors">
                    <RotateCcw size={14} /> Refazer gravação
                  </button>
                  <button onClick={handleEnviar}
                    className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-violet-600 to-brand-600 hover:from-violet-700 hover:to-brand-700 text-white font-semibold text-sm rounded-xl shadow-md transition-all active:scale-95">
                    <Sparkles size={14} /> Transcrever e preencher RDO
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer fixo: botão grande de gravação (somente passo roteiro) */}
        {passo === "roteiro" && (
          <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between gap-3">
            <p className="text-xs text-slate-500">
              🎙️ A IA transcreve o que você falar e organiza nos campos do RDO automaticamente.
            </p>
            <button
              onClick={rec.iniciar}
              className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white font-bold text-sm rounded-xl shadow-md transition-all active:scale-95"
            >
              <Mic size={16} /> Iniciar gravação
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
