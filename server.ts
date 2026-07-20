import express from "express";
import path from "path";
import fs from "fs";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";

let aiClient: GoogleGenAI | null = null;

function getGeminiAI(): GoogleGenAI {
  if (!aiClient) {
    const key = process.env.GEMINI_API_KEY;
    if (!key) {
      throw new Error("GEMINI_API_KEY environment variable is required. Please set it in Settings > Secrets.");
    }
    aiClient = new GoogleGenAI({
      apiKey: key,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });
  }
  return aiClient;
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API Route for Task Insights
  app.post("/api/insights", async (req, res) => {
    try {
      const { title, description, dueDate, priority, status, checklists, subtasks } = req.body;

      if (!title) {
        return res.status(400).json({ error: "O título da tarefa é obrigatório." });
      }

      const ai = getGeminiAI();

      const prompt = `
Você é um assistente especialista em produtividade e gestão de projetos. Analise a seguinte tarefa e forneça insights inteligentes sobre possíveis gargalos, riscos de execução e sugira sub-tarefas acionáveis adicionais.

DADOS DA TAREFA:
- Título: ${title}
- Descrição: ${description || "Sem descrição fornecida."}
- Prazo (Due Date): ${dueDate || "Sem prazo definido."}
- Prioridade: ${priority || "Média"}
- Status Atual: ${status || "A fazer"}
- Checklists Existentes: ${JSON.stringify(checklists || [])}
- Sub-tarefas Existentes: ${JSON.stringify(subtasks || [])}

INSTRUÇÕES DE ANÁLISE:
1. Avalie a complexidade do título e da descrição para sugerir passos detalhados (sub-tarefas) que ainda não existam na lista.
2. Identifique possíveis gargalos com base no prazo (considere a data de hoje como sendo ${new Date().toLocaleDateString('pt-BR')}), prioridade ou falta de clareza na descrição.
3. Classifique o nível de risco de gargalo ou atraso como 'Baixo', 'Médio' ou 'Alto'.
4. Retorne a resposta estruturada exatamente conforme o esquema especificado. Seja conciso e direto ao ponto.
`;

      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: prompt,
        config: {
          systemInstruction: "Você é um assistente de produtividade altamente focado, conciso, objetivo e profissional. Responda em português brasileiro.",
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              riskLevel: {
                type: Type.STRING,
                description: "Nível de risco de atraso ou gargalo ('Baixo', 'Médio', 'Alto')"
              },
              riskExplanation: {
                type: Type.STRING,
                description: "Explicação sucinta (máximo 2 parágrafos) sobre o nível de risco e por que pode haver um gargalo."
              },
              bottlenecks: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: "Lista de 1 a 3 gargalos ou riscos potenciais identificados para esta tarefa."
              },
              suggestedSubtasks: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: "Lista de 3 a 5 sub-tarefas práticas, acionáveis e realistas recomendadas para ajudar a concluir a tarefa."
              }
            },
            required: ["riskLevel", "riskExplanation", "bottlenecks", "suggestedSubtasks"]
          }
        }
      });

      const responseText = response.text;
      if (!responseText) {
        throw new Error("Não foi possível gerar conteúdo com a IA.");
      }

      const insights = JSON.parse(responseText.trim());
      res.json(insights);
    } catch (error: any) {
      console.error("Erro no endpoint /api/insights:", error);
      res.status(500).json({
        error: error.message || "Ocorreu um erro interno ao gerar os insights com a IA."
      });
    }
  });

  // File-based synchronization storage
  const SYNC_DB_PATH = path.join(process.cwd(), "sync-stores.json");

  function readSyncDb(): Record<string, any> {
    try {
      if (fs.existsSync(SYNC_DB_PATH)) {
        return JSON.parse(fs.readFileSync(SYNC_DB_PATH, "utf-8"));
      }
    } catch (err) {
      console.error("Error reading sync db:", err);
    }
    return {};
  }

  function writeSyncDb(db: Record<string, any>) {
    try {
      fs.writeFileSync(SYNC_DB_PATH, JSON.stringify(db, null, 2), "utf-8");
    } catch (err) {
      console.error("Error writing sync db:", err);
    }
  }

  // API Route to generate sync code and initialize room state
  app.post("/api/sync/generate", (req, res) => {
    try {
      const { state } = req.body;
      const db = readSyncDb();
      
      // Generate a unique 6-character alphanumeric code
      const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
      let code = "";
      let attempts = 0;
      do {
        code = "TF-";
        for (let i = 0; i < 6; i++) {
          code += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        attempts++;
      } while (db[code] && attempts < 100);

      db[code] = {
        state: state || {},
        updatedAt: new Date().toISOString()
      };
      
      writeSyncDb(db);
      res.json({ success: true, syncCode: code });
    } catch (err: any) {
      console.error("Error generating sync code:", err);
      res.status(500).json({ success: false, error: "Falha ao gerar código de sincronização." });
    }
  });

  // API Route to fetch/pull current state
  app.post("/api/sync/pull", (req, res) => {
    try {
      const { syncCode } = req.body;
      if (!syncCode) {
        return res.status(400).json({ success: false, error: "Código de sincronização é obrigatório." });
      }

      const db = readSyncDb();
      const session = db[syncCode.toUpperCase()];
      
      if (!session) {
        return res.status(404).json({ success: false, error: "Código de sincronização não encontrado." });
      }

      res.json({ success: true, state: session.state, updatedAt: session.updatedAt });
    } catch (err: any) {
      console.error("Error pulling state:", err);
      res.status(500).json({ success: false, error: "Erro ao obter dados do servidor." });
    }
  });

  // API Route to push/save current state
  app.post("/api/sync/push", (req, res) => {
    try {
      const { syncCode, state } = req.body;
      if (!syncCode) {
        return res.status(400).json({ success: false, error: "Código de sincronização é obrigatório." });
      }

      const db = readSyncDb();
      const codeKey = syncCode.toUpperCase();
      
      db[codeKey] = {
        state: state || {},
        updatedAt: new Date().toISOString()
      };

      writeSyncDb(db);
      res.json({ success: true, updatedAt: db[codeKey].updatedAt });
    } catch (err: any) {
      console.error("Error pushing state:", err);
      res.status(500).json({ success: false, error: "Erro ao salvar dados no servidor." });
    }
  });

  // Serve static assets and Vite middleware
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
