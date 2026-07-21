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

export interface InsightsRequest {
  title: string
  description?: string
  dueDate?: string | null
  priority?: string
  status?: string
  checklists?: unknown
  subtasks?: unknown
}

export async function generateTaskInsights(body: InsightsRequest) {
  const { title, description, dueDate, priority, status, checklists, subtasks } = body;

  if (!title) {
    throw new Error("O título da tarefa é obrigatório.");
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

  return JSON.parse(responseText.trim());
}
