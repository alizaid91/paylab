import { GoogleGenAI } from '@google/genai';
import { env } from '../config/env.js';

export interface AIProvider {
  generateStructured(input: {
    systemPrompt: string;
    userPrompt: string;
    responseJsonSchema?: Record<string, unknown>;
  }): Promise<unknown>;
}

export class GeminiAIProvider implements AIProvider {
  async generateStructured(input: {
    systemPrompt: string;
    userPrompt: string;
    responseJsonSchema?: Record<string, unknown>;
  }): Promise<unknown> {
    if (!env.GEMINI_API_KEY) {
      throw new Error('GEMINI_API_KEY is not configured');
    }

    const ai = new GoogleGenAI({ apiKey: env.GEMINI_API_KEY });
    const response = await ai.models.generateContent({
      model: env.GEMINI_MODEL,
      contents: input.userPrompt,
      config: {
        systemInstruction: input.systemPrompt,
        responseMimeType: 'application/json',
        responseJsonSchema: input.responseJsonSchema
      }
    });

    const text = response.text?.trim();
    if (!text) {
      throw new Error('Gemini returned an empty response');
    }

    try {
      return JSON.parse(text);
    } catch (error) {
      throw new Error('Gemini returned invalid JSON', { cause: error });
    }
  }
}

export class UnavailableAIProvider implements AIProvider {
  async generateStructured(): Promise<unknown> {
    throw new Error('No AI provider is configured');
  }
}
