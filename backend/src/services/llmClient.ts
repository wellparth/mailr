export type AIProvider = 'openai' | 'claude' | 'google' | 'nvidia';

export interface LLMRequestOptions {
  provider: AIProvider;
  apiKey?: string;
  model?: string;
  systemPrompt?: string;
  userPrompt: string;
  temperature?: number;
  maxTokens?: number;
}

export interface LLMResponse {
  text: string;
  provider: AIProvider;
  model: string;
  usage?: {
    promptTokens?: number;
    completionTokens?: number;
  };
}

export class LLMClient {
  /**
   * Default models per provider.
   */
  static getDefaultModel(provider: AIProvider): string {
    switch (provider) {
      case 'openai':
        return 'gpt-4o-mini';
      case 'claude':
        return 'claude-3-5-haiku-20241022';
      case 'google':
        return 'gemini-1.5-flash';
      case 'nvidia':
        return 'meta/llama-3.1-70b-instruct';
      default:
        return 'gpt-4o-mini';
    }
  }

  /**
   * Resolve effective API key: user-supplied key or fallback server environment variable.
   */
  static resolveApiKey(provider: AIProvider, userKey?: string): string {
    if (userKey && userKey.trim().length > 0) {
      return userKey.trim();
    }

    switch (provider) {
      case 'openai':
        return process.env.OPENAI_API_KEY || '';
      case 'claude':
        return process.env.ANTHROPIC_API_KEY || '';
      case 'google':
        return process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || '';
      case 'nvidia':
        return process.env.NVIDIA_API_KEY || '';
      default:
        return '';
    }
  }

  /**
   * Unified generation call supporting OpenAI, Claude, Google Gemini, and Nvidia NIM.
   */
  static async generate(options: LLMRequestOptions): Promise<LLMResponse> {
    const { provider, userPrompt, systemPrompt = 'You are Mailr AI, an intelligent executive email copilot.' } = options;
    const apiKey = this.resolveApiKey(provider, options.apiKey);
    const model = options.model || this.getDefaultModel(provider);
    const temperature = options.temperature ?? 0.3;
    const maxTokens = options.maxTokens ?? 2048;

    if (!apiKey) {
      throw new Error(
        `Missing API key for ${provider.toUpperCase()}. Please configure your Bring-Your-Own-Key (BYOK) in Mailr Settings.`
      );
    }

    switch (provider) {
      case 'openai':
        return this.callOpenAI(apiKey, model, systemPrompt, userPrompt, temperature, maxTokens);
      case 'claude':
        return this.callClaude(apiKey, model, systemPrompt, userPrompt, temperature, maxTokens);
      case 'google':
        return this.callGoogle(apiKey, model, systemPrompt, userPrompt, temperature, maxTokens);
      case 'nvidia':
        return this.callNvidia(apiKey, model, systemPrompt, userPrompt, temperature, maxTokens);
      default:
        throw new Error(`Unsupported AI provider: ${provider}`);
    }
  }

  /**
   * 1. OpenAI Chat Completions API
   */
  private static async callOpenAI(
    apiKey: string,
    model: string,
    systemPrompt: string,
    userPrompt: string,
    temperature: number,
    maxTokens: number
  ): Promise<LLMResponse> {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature,
        max_tokens: maxTokens,
      }),
    });

    if (!res.ok) {
      const errBody = await res.text();
      throw new Error(`OpenAI API error (${res.status}): ${errBody}`);
    }

    const data = (await res.json()) as any;
    const text = data.choices?.[0]?.message?.content || '';
    return {
      text,
      provider: 'openai',
      model,
      usage: {
        promptTokens: data.usage?.prompt_tokens,
        completionTokens: data.usage?.completion_tokens,
      },
    };
  }

  /**
   * 2. Anthropic Claude Messages API
   */
  private static async callClaude(
    apiKey: string,
    model: string,
    systemPrompt: string,
    userPrompt: string,
    temperature: number,
    maxTokens: number
  ): Promise<LLMResponse> {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model,
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
        max_tokens: maxTokens,
        temperature,
      }),
    });

    if (!res.ok) {
      const errBody = await res.text();
      throw new Error(`Anthropic Claude API error (${res.status}): ${errBody}`);
    }

    const data = (await res.json()) as any;
    const text = data.content?.[0]?.text || '';
    return {
      text,
      provider: 'claude',
      model,
      usage: {
        promptTokens: data.usage?.input_tokens,
        completionTokens: data.usage?.output_tokens,
      },
    };
  }

  /**
   * 3. Google Gemini API
   */
  private static async callGoogle(
    apiKey: string,
    model: string,
    systemPrompt: string,
    userPrompt: string,
    temperature: number,
    maxTokens: number
  ): Promise<LLMResponse> {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [
          {
            role: 'user',
            parts: [{ text: `${systemPrompt}\n\nTask:\n${userPrompt}` }],
          },
        ],
        generationConfig: {
          temperature,
          maxOutputTokens: maxTokens,
        },
      }),
    });

    if (!res.ok) {
      const errBody = await res.text();
      throw new Error(`Google Gemini API error (${res.status}): ${errBody}`);
    }

    const data = (await res.json()) as any;
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    return {
      text,
      provider: 'google',
      model,
      usage: {
        promptTokens: data.usageMetadata?.promptTokenCount,
        completionTokens: data.usageMetadata?.candidatesTokenCount,
      },
    };
  }

  /**
   * 4. NVIDIA NIM API (OpenAI-compatible)
   */
  private static async callNvidia(
    apiKey: string,
    model: string,
    systemPrompt: string,
    userPrompt: string,
    temperature: number,
    maxTokens: number
  ): Promise<LLMResponse> {
    const res = await fetch('https://integrate.api.nvidia.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature,
        max_tokens: maxTokens,
      }),
    });

    if (!res.ok) {
      const errBody = await res.text();
      throw new Error(`NVIDIA NIM API error (${res.status}): ${errBody}`);
    }

    const data = (await res.json()) as any;
    const text = data.choices?.[0]?.message?.content || '';
    return {
      text,
      provider: 'nvidia',
      model,
      usage: {
        promptTokens: data.usage?.prompt_tokens,
        completionTokens: data.usage?.completion_tokens,
      },
    };
  }

  /**
   * Quick connection & API key verification test.
   */
  static async testApiKey(provider: AIProvider, apiKey: string, model?: string): Promise<{ success: boolean; message: string }> {
    try {
      const testModel = model || this.getDefaultModel(provider);
      const res = await this.generate({
        provider,
        apiKey,
        model: testModel,
        systemPrompt: 'You are an API validator.',
        userPrompt: 'Respond with exactly: OK',
        maxTokens: 10,
        temperature: 0,
      });

      if (res.text) {
        return {
          success: true,
          message: `Successfully connected to ${provider.toUpperCase()} (${testModel})!`,
        };
      }
      return { success: false, message: 'Received empty response from provider.' };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown validation error';
      return { success: false, message: msg };
    }
  }
}
