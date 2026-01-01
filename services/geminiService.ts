import { GoogleGenAI } from "@google/genai";
import { LandingPageContent, GeneratorParams } from "../types";

// This service is used to simulate the backend AI generation in the client-side demo.
// In production, this logic moves to the Node.js backend (see server/index.js).

export const generateLandingPageContent = async (params: GeneratorParams): Promise<LandingPageContent> => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    throw new Error("API Key is missing. Please set it in the environment.");
  }

  const ai = new GoogleGenAI({ apiKey });

  const prompt = `
    Você é um copywriter expert e designer de UI. Crie uma estrutura de conteúdo para uma Landing Page de alta conversão.
    
    Nome da Empresa: "${params.companyName}"
    Nicho: "${params.niche}"
    Público Alvo: "${params.targetAudience}"
    Objetivo Principal: "${params.goal}"
    
    Retorne APENAS JSON cru (sem blocos markdown) seguindo estritamente esta estrutura em PORTUGUÊS DO BRASIL:
    {
      "headline": "Um título H1 poderoso, curto e impactante",
      "subheadline": "Um subtítulo de 2 frases expandindo a proposta de valor",
      "ctaText": "Texto curto para botão de ação",
      "benefits": [
        {"title": "Benefício 1", "description": "Descrição curta do benefício 1"},
        {"title": "Benefício 2", "description": "Descrição curta do benefício 2"},
        {"title": "Benefício 3", "description": "Descrição curta do benefício 3"}
      ],
      "testimonials": [
        {"name": "Nome Sobrenome", "role": "Cargo", "quote": "Um review positivo verossímil sobre o serviço."}
      ],
      "colors": {
        "primary": "Código hex da cor principal da marca adequada ao nicho",
        "secondary": "Código hex de cor complementar",
        "background": "Código hex de fundo (geralmente branco ou cinza/azul muito claro)",
        "text": "Código hex para texto principal (geralmente cinza escuro ou preto)"
      }
    }
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-latest',
      contents: prompt,
      config: {
        responseMimeType: 'application/json'
      }
    });

    const text = response.text;
    if (!text) throw new Error("No content generated");
    
    // Parse JSON
    return JSON.parse(text) as LandingPageContent;
  } catch (error) {
    console.error("Gemini Generation Error:", error);
    // Fallback for demo if API fails or quota exceeded
    return {
      headline: "Erro ao Gerar Conteúdo",
      subheadline: "Não conseguimos contatar a IA neste momento. Este é um modelo de fallback.",
      ctaText: "Tentar Novamente",
      benefits: [],
      testimonials: [],
      colors: { primary: "#3b82f6", secondary: "#1e40af", background: "#ffffff", text: "#1f2937" }
    };
  }
};