import React from "react";
import ReactDOM from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import App from "./App";
import "./index.css";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 30,          // dados ficam "frescos" por 30s
      retry: 2,                       // tenta 3x no total antes de errar
      retryDelay: attemptIndex =>     // backoff: 1s, 2s (máx)
        Math.min(1000 * 2 ** attemptIndex, 2000),
      refetchOnWindowFocus: true,     // recarrega ao focar a janela
      refetchOnReconnect: true,       // recarrega ao reconectar
    },
  },
});

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </React.StrictMode>
);
