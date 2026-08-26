export interface AIProvider {
  generateStructured(input: {
    systemPrompt: string;
    userPrompt: string;
  }): Promise<unknown>;
}

export class UnavailableAIProvider implements AIProvider {
  async generateStructured(): Promise<unknown> {
    throw new Error('No AI provider is configured');
  }
}
