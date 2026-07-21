import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { generateTaskInsights } from "./api/_lib/insights";

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  app.use(express.json());

  // Rota de IA (Insights de tarefas) — em produção (Vercel), a mesma lógica roda
  // como função serverless em api/insights.ts; aqui é só para o servidor de dev local.
  app.post("/api/insights", async (req, res) => {
    try {
      const insights = await generateTaskInsights(req.body);
      res.json(insights);
    } catch (error: any) {
      console.error("Erro no endpoint /api/insights:", error);
      res.status(500).json({
        error: error.message || "Ocorreu um erro interno ao gerar os insights com a IA."
      });
    }
  });

  // Serve static assets and Vite middleware
  if (process.env.NODE_ENV !== "production") {
    // O servidor HTTP precisa existir antes do Vite, pra gente anexar o WebSocket do HMR
    // nele — sem isso, o Vite tenta abrir um WebSocket próprio numa porta fixa separada,
    // que trava (ex: em uso por outro processo) e causa recarregamentos contínuos da página.
    const httpServer = app.listen(PORT, "0.0.0.0", () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
    const vite = await createViteServer({
      server: { middlewareMode: true, hmr: { server: httpServer } },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
    app.listen(PORT, "0.0.0.0", () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  }
}

startServer();
