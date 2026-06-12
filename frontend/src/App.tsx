import { useState, useEffect } from "react";
import { BrowserRouter, Navigate, Route, Routes, useLocation } from "react-router-dom";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { Header } from "@/components/layout/Header";
import { MobileNav } from "@/components/layout/MobileNav";
import { Sidebar } from "@/components/layout/Sidebar";
import { CronogramaGantt } from "@/pages/CronogramaGantt";
import { Dashboard } from "@/pages/Dashboard";
import { EmpreendimentoDetalhe } from "@/pages/EmpreendimentoDetalhe";
import { Empreendimentos } from "@/pages/Empreendimentos";
import { Financeiro } from "@/pages/Financeiro";
import { Login } from "@/pages/Login";
import { ObraDetalhe } from "@/pages/ObraDetalhe";
import { OrcamentoDetalhe } from "@/pages/OrcamentoDetalhe";
import { Orcamentos } from "@/pages/Orcamentos";
import { Pipeline } from "@/pages/Pipeline";
import { Qualidade } from "@/pages/Qualidade";
import { RDODetalhe } from "@/pages/RDODetalhe";
import { Suprimentos } from "@/pages/Suprimentos";
import { Conciliacao } from "@/pages/Conciliacao";
import { Documentos } from "@/pages/Documentos";
import { Usuarios } from "@/pages/Usuarios";
import { Equipes } from "@/pages/Equipes";

const titulos: Record<string, string> = {
  "/":               "Dashboard",
  "/empreendimentos":"Empreendimentos",
  "/pipeline":       "Pipeline de Obras",
  "/cronograma":     "Cronograma Gantt",
  "/orcamentos":     "Orçamentos",
  "/suprimentos":    "Suprimentos",
  "/financeiro":     "Financeiro",
  "/equipes":        "Equipes",
  "/qualidade":      "Qualidade e RDO",
  "/documentos":     "Status Documental",
  "/vision":         "Vision 360°",
  "/analises":       "Análises IA",
  "/configuracoes":  "Configurações",
  "/conciliacao":    "Conciliação Bancária",
  "/usuarios":       "Gerenciar Usuários",
};

function PlaceholderPage({ path }: { path: string }) {
  return (
    <div className="p-6 flex items-center justify-center h-64">
      <div className="text-center text-slate-400">
        <p className="text-lg font-medium">{titulos[path] ?? path}</p>
        <p className="text-sm mt-1">Módulo em desenvolvimento</p>
      </div>
    </div>
  );
}

function AppLayout({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const titulo = titulos[location.pathname] ?? "";
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Fecha sidebar ao navegar
  useEffect(() => { setSidebarOpen(false); }, [location.pathname]);

  // Fecha sidebar ao redimensionar para desktop
  useEffect(() => {
    const onResize = () => { if (window.innerWidth >= 1024) setSidebarOpen(false); };
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  return (
    <div className="flex min-h-screen">
      {/* Overlay escurecido (mobile) */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 lg:hidden backdrop-blur-sm"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Header titulo={titulo} onMenuToggle={() => setSidebarOpen(v => !v)} />
        {/* pb-20 no mobile: espaço para a bottom nav não cobrir o conteúdo */}
        <main className="flex-1 overflow-auto pb-20 lg:pb-0">{children}</main>
      </div>

      {/* Navegação inferior — só mobile */}
      <MobileNav />
    </div>
  );
}

function PrivatePage({ path, children }: { path: string; children: React.ReactNode }) {
  return (
    <ProtectedRoute>
      <AppLayout>
        {children}
      </AppLayout>
    </ProtectedRoute>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Rota pública */}
        <Route path="/login" element={<Login />} />

        {/* Rotas protegidas */}
        <Route path="/" element={
          <PrivatePage path="/">
            <Dashboard />
          </PrivatePage>
        } />
        <Route path="/empreendimentos" element={
          <PrivatePage path="/empreendimentos">
            <Empreendimentos />
          </PrivatePage>
        } />
        <Route path="/empreendimentos/:id" element={
          <PrivatePage path="/empreendimentos/:id">
            <EmpreendimentoDetalhe />
          </PrivatePage>
        } />
        <Route path="/obras/:id" element={
          <PrivatePage path="/obras/:id">
            <ObraDetalhe />
          </PrivatePage>
        } />
        <Route path="/orcamentos" element={
          <PrivatePage path="/orcamentos">
            <Orcamentos />
          </PrivatePage>
        } />
        <Route path="/orcamentos/:id" element={
          <PrivatePage path="/orcamentos/:id">
            <OrcamentoDetalhe />
          </PrivatePage>
        } />
        <Route path="/qualidade" element={
          <PrivatePage path="/qualidade">
            <Qualidade />
          </PrivatePage>
        } />
        <Route path="/rdos/:id" element={
          <PrivatePage path="/rdos/:id">
            <RDODetalhe />
          </PrivatePage>
        } />

        <Route path="/pipeline" element={
          <PrivatePage path="/pipeline">
            <Pipeline />
          </PrivatePage>
        } />
        <Route path="/cronograma" element={
          <PrivatePage path="/cronograma">
            <CronogramaGantt />
          </PrivatePage>
        } />
        <Route path="/suprimentos" element={
          <PrivatePage path="/suprimentos">
            <Suprimentos />
          </PrivatePage>
        } />
        <Route path="/financeiro" element={
          <PrivatePage path="/financeiro">
            <Financeiro />
          </PrivatePage>
        } />

        {/* Conciliação Bancária */}
        <Route path="/conciliacao" element={
          <PrivatePage path="/conciliacao">
            <Conciliacao />
          </PrivatePage>
        } />

        {/* Gerenciar Usuários (admin) */}
        <Route path="/usuarios" element={
          <PrivatePage path="/usuarios">
            <Usuarios />
          </PrivatePage>
        } />

        {/* Documentos — página real */}
        <Route path="/documentos" element={
          <PrivatePage path="/documentos">
            <Documentos />
          </PrivatePage>
        } />

        {/* Equipes — página real */}
        <Route path="/equipes" element={
          <PrivatePage path="/equipes">
            <Equipes />
          </PrivatePage>
        } />

        {/* Módulos em desenvolvimento */}
        {["/vision",
          "/analises", "/configuracoes"].map((p) => (
          <Route key={p} path={p} element={
            <PrivatePage path={p}>
              <PlaceholderPage path={p} />
            </PrivatePage>
          } />
        ))}

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
