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
    You are an expert copywriter and UI designer. Create a high-conversion landing page content structure for a business.
    
    Business Name: "${params.companyName}"
    Niche: "${params.niche}"
    Target Audience: "${params.targetAudience}"
    Primary Goal: "${params.goal}"
    
    Return ONLY raw JSON (no markdown block) matching strictly this structure:
    {
      "headline": "A powerful, short, punchy H1 headline",
      "subheadline": "A 2-sentence subheadline expanding on the value proposition",
      "ctaText": "Short, action-oriented button text",
      "benefits": [
        {"title": "Benefit 1", "description": "Short description of benefit 1"},
        {"title": "Benefit 2", "description": "Short description of benefit 2"},
        {"title": "Benefit 3", "description": "Short description of benefit 3"}
      ],
      "testimonials": [
        {"name": "Firstname Lastname", "role": "Job Title", "quote": "A believable positive review about the service."}
      ],
      "colors": {
        "primary": "A hex color code suitable for the niche (main brand color)",
        "secondary": "A complementary hex color code",
        "background": "A hex color code (usually white or very light gray/blue)",
        "text": "A hex color code for main text (usually dark gray or black)"
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
      headline: "Error Generating Content",
      subheadline: "We couldn't reach the AI at this moment. This is a fallback template.",
      ctaText: "Try Again",
      benefits: [],
      testimonials: [],
      colors: { primary: "#3b82f6", secondary: "#1e40af", background: "#ffffff", text: "#1f2937" }
    };
  }
};
