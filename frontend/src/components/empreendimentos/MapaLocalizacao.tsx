/**
 * MapaLocalizacao
 * ────────────────
 * Mapa interativo Leaflet + OpenStreetMap.
 *
 * Funcionalidades:
 *  - Marcador arrastável: usuário arrasta para a posição exata.
 *  - Clique no mapa: o marcador "pula" para o ponto clicado.
 *  - Quando ainda não há lat/lng, usa o ponto inicial padrão
 *    (-15.736799662478845, -48.27383761053686 — região centro-oeste).
 *  - Reverse-geocoding opcional via Nominatim ao mover o marcador,
 *    útil para preencher os campos de endereço quando o usuário
 *    marca direto no mapa (ex: área rural sem endereço formal).
 *
 * Notas técnicas:
 *  - Leaflet exige importar o CSS uma vez.
 *  - Os ícones padrão do Leaflet quebram com bundlers — corrigimos
 *    sobrescrevendo as URLs com versões hospedadas no CDN unpkg.
 */
import { useEffect, useMemo, useRef, useState } from "react";
import { MapContainer, Marker, Popup, TileLayer, useMapEvents } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Crosshair, MapPin } from "lucide-react";

// Fix dos ícones default do Leaflet — sem isso o pin some / dá 404
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl:       "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl:     "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

// Ícone customizado em tom brand (azul ciano) para diferenciar
const ICONE_BRAND = L.divIcon({
  className: "",
  html: `
    <div style="
      width: 38px; height: 38px;
      transform: translate(-50%, -100%);
      display:flex; align-items:flex-start; justify-content:center;
      filter: drop-shadow(0 2px 4px rgba(0,0,0,0.25));
    ">
      <svg width="38" height="38" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="1">
        <path d="M12 1.5C7.7 1.5 4 5.2 4 9.6 4 16.2 12 22.5 12 22.5s8-6.3 8-12.9C20 5.2 16.3 1.5 12 1.5z"
              fill="#0ea5e9"/>
        <circle cx="12" cy="9.5" r="3" fill="#fff"/>
      </svg>
    </div>`,
  iconSize: [38, 38],
  iconAnchor: [19, 38],
});

// Ponto inicial padrão (centro-oeste — Águas Lindas/Brasília)
const DEFAULT_CENTER: [number, number] = [-15.736799662478845, -48.27383761053686];
const DEFAULT_ZOOM = 14;

interface Coords { lat: number; lng: number }

interface Props {
  lat: number | null;
  lng: number | null;
  /** Disparado sempre que a posição muda (arrastar ou clicar). */
  onChange: (coords: Coords) => void;
  /** Reverse-geocoding ao soltar o marker — útil em áreas urbanas. */
  onReverseGeocode?: (resultado: ReverseGeocodeResult) => void;
}

export interface ReverseGeocodeResult {
  rua: string | null;
  numero: string | null;
  bairro: string | null;
  cidade: string | null;
  uf: string | null;
  cep: string | null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Reverse-geocoding via Nominatim (mesma fonte do autocomplete)
// ─────────────────────────────────────────────────────────────────────────────

const ESTADO_UF: Record<string, string> = {
  Acre: "AC", Alagoas: "AL", Amapá: "AP", Amazonas: "AM",
  Bahia: "BA", Ceará: "CE", "Distrito Federal": "DF", "Espírito Santo": "ES",
  Goiás: "GO", Maranhão: "MA", "Mato Grosso": "MT", "Mato Grosso do Sul": "MS",
  "Minas Gerais": "MG", Pará: "PA", Paraíba: "PB", Paraná: "PR",
  Pernambuco: "PE", Piauí: "PI", "Rio de Janeiro": "RJ", "Rio Grande do Norte": "RN",
  "Rio Grande do Sul": "RS", Rondônia: "RO", Roraima: "RR", "Santa Catarina": "SC",
  "São Paulo": "SP", Sergipe: "SE", Tocantins: "TO",
};

async function reverseGeocode(lat: number, lng: number): Promise<ReverseGeocodeResult | null> {
  try {
    const url =
      `https://nominatim.openstreetmap.org/reverse?format=jsonv2` +
      `&lat=${lat}&lon=${lng}&accept-language=pt-BR&addressdetails=1`;
    const r = await fetch(url, { headers: { Accept: "application/json" } });
    if (!r.ok) return null;
    const data = await r.json();
    const a = data.address ?? {};
    const cidade = a.city || a.town || a.village || a.municipality || "";
    const ufNome = a.state || "";
    const cep = (a.postcode || "").replace("-", "");
    return {
      rua:     a.road || null,
      numero:  a.house_number || null,
      bairro:  a.suburb || a.neighbourhood || null,
      cidade:  cidade || null,
      uf:      ESTADO_UF[ufNome] || null,
      cep:     cep ? `${cep.slice(0,5)}-${cep.slice(5)}` : null,
    };
  } catch {
    return null;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Hook interno: captura clique no mapa e move o marker
// ─────────────────────────────────────────────────────────────────────────────

function CapturaClique({ onPick }: { onPick: (c: Coords) => void }) {
  useMapEvents({
    click(e) {
      onPick({ lat: e.latlng.lat, lng: e.latlng.lng });
    },
  });
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Hook interno: re-centra o mapa quando lat/lng muda externamente
// (ex: usuário escolheu endereço no autocomplete)
// ─────────────────────────────────────────────────────────────────────────────

function ReCentralizar({ lat, lng }: { lat: number | null; lng: number | null }) {
  const map = useMapEvents({});
  const ultimoRef = useRef<string>("");
  useEffect(() => {
    if (lat == null || lng == null) return;
    const chave = `${lat.toFixed(6)},${lng.toFixed(6)}`;
    if (chave === ultimoRef.current) return;
    ultimoRef.current = chave;
    map.flyTo([lat, lng], Math.max(map.getZoom(), 15), { duration: 0.6 });
  }, [lat, lng, map]);
  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Componente principal
// ─────────────────────────────────────────────────────────────────────────────

export function MapaLocalizacao({ lat, lng, onChange, onReverseGeocode }: Props) {
  const markerRef = useRef<L.Marker | null>(null);
  const [geocodandoReverso, setGeocodandoReverso] = useState(false);

  // Posição efetiva do marcador (usa lat/lng do form ou default)
  const posicaoMarker = useMemo<[number, number]>(() => {
    if (lat != null && lng != null) return [lat, lng];
    return DEFAULT_CENTER;
  }, [lat, lng]);

  const temMarcador = lat != null && lng != null;

  // Função única que processa qualquer mudança (clique ou drag)
  async function aplicarPosicao(c: Coords) {
    onChange(c);
    if (onReverseGeocode) {
      setGeocodandoReverso(true);
      const r = await reverseGeocode(c.lat, c.lng);
      setGeocodandoReverso(false);
      if (r) onReverseGeocode(r);
    }
  }

  return (
    <div className="relative rounded-xl overflow-hidden border border-slate-200 shadow-sm">
      <MapContainer
        center={posicaoMarker}
        zoom={DEFAULT_ZOOM}
        style={{ height: 320, width: "100%" }}
        scrollWheelZoom={true}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          maxZoom={19}
        />

        {/* Marcador sempre presente, arrastável */}
        <Marker
          ref={markerRef as any}
          position={posicaoMarker}
          icon={ICONE_BRAND}
          draggable={true}
          eventHandlers={{
            dragend: (e) => {
              const m = e.target as L.Marker;
              const ll = m.getLatLng();
              aplicarPosicao({ lat: ll.lat, lng: ll.lng });
            },
          }}
        >
          <Popup>
            <div className="text-xs">
              {temMarcador ? (
                <>
                  <strong>Localização da obra</strong><br />
                  {posicaoMarker[0].toFixed(6)}, {posicaoMarker[1].toFixed(6)}
                </>
              ) : (
                <>
                  <strong>Posição inicial</strong><br />
                  Arraste o marcador ou clique no mapa
                </>
              )}
            </div>
          </Popup>
        </Marker>

        <CapturaClique onPick={aplicarPosicao} />
        <ReCentralizar lat={lat} lng={lng} />
      </MapContainer>

      {/* Barra inferior com instruções e coords */}
      <div className="flex items-center gap-2 px-3 py-2 bg-slate-50 border-t border-slate-100 text-[11px] text-slate-500">
        <Crosshair size={11} className="text-brand-500" />
        <span className="font-medium">
          {temMarcador
            ? `${posicaoMarker[0].toFixed(6)}, ${posicaoMarker[1].toFixed(6)}`
            : "Sem coordenada — clique no mapa ou arraste o marcador"
          }
        </span>
        {geocodandoReverso && (
          <span className="text-brand-500">· Buscando endereço…</span>
        )}
        <span className="ml-auto text-slate-400 hidden sm:inline">
          💡 Arraste o marcador ou clique no mapa
        </span>
      </div>

      {/* Header sobre o mapa */}
      {!temMarcador && (
        <div className="absolute top-3 left-1/2 -translate-x-1/2 z-[1000] bg-white/95 backdrop-blur-sm border border-amber-200 rounded-lg px-3 py-1.5 shadow-md flex items-center gap-2 text-xs animate-fade-in">
          <MapPin size={12} className="text-amber-600" />
          <span className="text-slate-700 font-medium">
            Clique no mapa para marcar a localização
          </span>
        </div>
      )}
    </div>
  );
}

// Re-export do centro default caso o caller precise
export { DEFAULT_CENTER };
