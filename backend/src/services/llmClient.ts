export type AIProvider = 'openai' | 'claude' | 'google' | 'nvidia';

export interface AIModelOption {
  id: string;
  name: string;
  provider: AIProvider;
  description?: string;
  contextWindow?: string;
  isRecommended?: boolean;
}

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
        return process.env.NVIDIA_MODEL || 'nvidia/nemotron-3.5-bolt-e4b';
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
   * 4. NVIDIA NIM API (Free-tier OpenAI-compatible endpoint with Nemotron 3.5 Bolt)
   */
  private static async callNvidia(
    apiKey: string,
    model: string,
    systemPrompt: string,
    userPrompt: string,
    temperature: number,
    maxTokens: number
  ): Promise<LLMResponse> {
    const payload = {
      model,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature,
      top_p: 0.95,
      max_tokens: maxTokens,
      seed: 42,
      stream: false,
      parallel_tool_calls: true,
      chat_template_kwargs: { enable_thinking: true },
    };

    const res = await fetch('https://integrate.api.nvidia.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const errBody = await res.text();
      throw new Error(`NVIDIA NIM API error (${res.status}): ${errBody}`);
    }

    const data = (await res.json()) as any;
    let text = data.choices?.[0]?.message?.content || data.choices?.[0]?.message?.reasoning_content || '';

    // Strip out internal reasoning tags if present so draft responses & notes remain clean
    text = text.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
    text = text.replace(/<thought>[\s\S]*?<\/thought>/gi, '').trim();

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
   * Fetch active, available AI models dynamically from provider APIs.
   * Supports NVIDIA NIM, OpenAI, Anthropic Claude, and Google Gemini with robust fallbacks.
   */
  static async fetchActiveModels(provider: AIProvider, customKey?: string): Promise<AIModelOption[]> {
    const apiKey = this.resolveApiKey(provider, customKey);

    // 1. NVIDIA NIM Models
    if (provider === 'nvidia') {
      const fallbackNvidiaModels: AIModelOption[] = [
        { id: 'nvidia/nemotron-3.5-bolt-e4b', name: 'NVIDIA Nemotron 3.5 Bolt (Fast & Free)', provider: 'nvidia', description: 'Optimized reasoning & fast email drafting', isRecommended: true },
        { id: 'meta/llama-3.3-70b-instruct', name: 'Llama 3.3 70B Instruct', provider: 'nvidia', description: 'Meta flagship 70B high-reasoning model', isRecommended: true },
        { id: 'deepseek-ai/deepseek-r1', name: 'DeepSeek R1 Reasoning', provider: 'nvidia', description: 'DeepSeek frontier chain-of-thought model', isRecommended: true },
        { id: 'deepseek-ai/deepseek-v4.1-flash', name: 'DeepSeek v4.1 Flash', provider: 'nvidia', description: 'High-speed reasoning model' },
        { id: 'meta/llama-3.1-405b-instruct', name: 'Llama 3.1 405B Instruct', provider: 'nvidia', description: 'Massive open frontier model (405B parameters)' },
        { id: 'meta/llama-3.1-70b-instruct', name: 'Llama 3.1 70B Instruct', provider: 'nvidia', description: 'High capability general assistant' },
        { id: 'meta/llama-3.1-8b-instruct', name: 'Llama 3.1 8B Instruct', provider: 'nvidia', description: 'Ultra-fast low-latency model' },
        { id: 'mistralai/mistral-large-2-instruct', name: 'Mistral Large 2', provider: 'nvidia', description: 'Mistral flagship reasoning model' },
        { id: 'qwen/qwen2.5-coder-32b-instruct', name: 'Qwen 2.5 Coder 32B', provider: 'nvidia', description: 'Specialized code & structured syntax model' },
      ];

      if (!apiKey) return fallbackNvidiaModels;

      try {
        const res = await fetch('https://integrate.api.nvidia.com/v1/models', {
          headers: {
            Authorization: `Bearer ${apiKey}`,
            Accept: 'application/json',
          },
        });

        if (res.ok) {
          const data = (await res.json()) as any;
          if (Array.isArray(data.data) && data.data.length > 0) {
            const liveModels: AIModelOption[] = data.data.map((m: any) => {
              const modelId = m.id as string;
              const cleanName = modelId.split('/').pop()?.replace(/[-_]/g, ' ') || modelId;
              const formattedName = cleanName.charAt(0).toUpperCase() + cleanName.slice(1);
              return {
                id: modelId,
                name: formattedName,
                provider: 'nvidia',
                description: `NVIDIA NIM Hosted • ${m.owned_by || 'NVIDIA API'}`,
                isRecommended:
                  modelId.includes('nemotron') ||
                  modelId.includes('llama-3.3') ||
                  modelId.includes('deepseek-r1') ||
                  modelId.includes('mistral-large'),
              };
            });

            // Sort: recommended first, then alphabetical
            return liveModels.sort((a, b) => {
              if (a.isRecommended && !b.isRecommended) return -1;
              if (!a.isRecommended && b.isRecommended) return 1;
              return a.name.localeCompare(b.name);
            });
          }
        }
      } catch (err) {
        console.warn('[LLMClient] Failed to fetch live NVIDIA NIM models, using curated list:', err);
      }
      return fallbackNvidiaModels;
    }

    // 2. OpenAI Models
    if (provider === 'openai') {
      const fallbackOpenAIModels: AIModelOption[] = [
        { id: 'gpt-4o', name: 'GPT-4o (Flagship Omni)', provider: 'openai', description: 'High-intelligence flagship multimodal model', isRecommended: true },
        { id: 'gpt-4o-mini', name: 'GPT-4o Mini (Fast & Affordable)', provider: 'openai', description: 'Fast, cost-efficient model for everyday email', isRecommended: true },
        { id: 'o1', name: 'OpenAI o1 (Deep Reasoning)', provider: 'openai', description: 'Advanced reasoning model for complex synthesis', isRecommended: true },
        { id: 'o1-mini', name: 'OpenAI o1-mini', provider: 'openai', description: 'Fast reasoning model' },
        { id: 'o3-mini', name: 'OpenAI o3-mini', provider: 'openai', description: 'Next-gen compact reasoning model' },
        { id: 'chatgpt-4o-latest', name: 'ChatGPT-4o Latest Dynamic', provider: 'openai', description: 'Continuously updated GPT-4o checkpoint' },
        { id: 'gpt-4-turbo', name: 'GPT-4 Turbo', provider: 'openai', description: '128k context window legacy GPT-4' },
      ];

      if (!apiKey) return fallbackOpenAIModels;

      try {
        const res = await fetch('https://api.openai.com/v1/models', {
          headers: {
            Authorization: `Bearer ${apiKey}`,
          },
        });

        if (res.ok) {
          const data = (await res.json()) as any;
          if (Array.isArray(data.data) && data.data.length > 0) {
            const filtered = data.data.filter((m: any) => {
              const id = m.id.toLowerCase();
              return (
                (id.startsWith('gpt-') || id.startsWith('o1') || id.startsWith('o3') || id.startsWith('chatgpt')) &&
                !id.includes('realtime') &&
                !id.includes('audio') &&
                !id.includes('transcription') &&
                !id.includes('search') &&
                !id.includes('moderation') &&
                !id.includes('tts')
              );
            });

            if (filtered.length > 0) {
              const liveList: AIModelOption[] = filtered.map((m: any) => ({
                id: m.id,
                name: m.id,
                provider: 'openai',
                description: 'Official OpenAI model',
                isRecommended:
                  m.id === 'gpt-4o' ||
                  m.id === 'gpt-4o-mini' ||
                  m.id === 'o1' ||
                  m.id === 'o3-mini',
              }));

              return liveList.sort((a, b) => {
                if (a.isRecommended && !b.isRecommended) return -1;
                if (!a.isRecommended && b.isRecommended) return 1;
                return a.id.localeCompare(b.id);
              });
            }
          }
        }
      } catch (err) {
        console.warn('[LLMClient] Failed to fetch live OpenAI models, using curated list:', err);
      }
      return fallbackOpenAIModels;
    }

    // 3. Google Gemini Models
    if (provider === 'google') {
      const fallbackGoogleModels: AIModelOption[] = [
        { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash (Ultra-Fast)', provider: 'google', description: 'Fast, lightweight and highly capable', isRecommended: true },
        { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro', provider: 'google', description: 'Large context and complex multi-turn reasoning', isRecommended: true },
        { id: 'gemini-2.0-flash-exp', name: 'Gemini 2.0 Flash (Experimental)', provider: 'google', description: 'Next-generation Gemini 2.0 architecture' },
        { id: 'gemini-1.0-pro', name: 'Gemini 1.0 Pro', provider: 'google', description: 'Standard general-purpose model' },
      ];

      if (!apiKey) return fallbackGoogleModels;

      try {
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
        if (res.ok) {
          const data = (await res.json()) as any;
          if (Array.isArray(data.models) && data.models.length > 0) {
            const chatModels = data.models.filter(
              (m: any) =>
                m.supportedGenerationMethods?.includes('generateContent') &&
                !m.name.includes('embedding') &&
                !m.name.includes('aqa')
            );

            if (chatModels.length > 0) {
              return chatModels.map((m: any) => {
                const cleanId = m.name.replace(/^models\//, '');
                return {
                  id: cleanId,
                  name: m.displayName || cleanId,
                  provider: 'google',
                  description: m.description?.substring(0, 80) || 'Google Gemini model',
                  isRecommended: cleanId.includes('flash') || cleanId.includes('1.5-pro'),
                };
              });
            }
          }
        }
      } catch (err) {
        console.warn('[LLMClient] Failed to fetch live Google models, using curated list:', err);
      }
      return fallbackGoogleModels;
    }

    // 4. Anthropic Claude Models
    return [
      { id: 'claude-3-7-sonnet-latest', name: 'Claude 3.7 Sonnet (Hybrid Reasoning)', provider: 'claude', description: 'Most capable Anthropic model with hybrid thinking', isRecommended: true },
      { id: 'claude-3-5-sonnet-latest', name: 'Claude 3.5 Sonnet', provider: 'claude', description: 'Exceptional writing and executive tone synthesis', isRecommended: true },
      { id: 'claude-3-5-haiku-latest', name: 'Claude 3.5 Haiku', provider: 'claude', description: 'Ultra-fast and cost-effective generation', isRecommended: true },
      { id: 'claude-3-opus-latest', name: 'Claude 3 Opus', provider: 'claude', description: 'Complex nuance and deep analytical reasoning' },
      { id: 'claude-3-5-sonnet-20241022', name: 'Claude 3.5 Sonnet (2024-10-22)', provider: 'claude', description: 'Pinned stable release' },
      { id: 'claude-3-5-haiku-20241022', name: 'Claude 3.5 Haiku (2024-10-22)', provider: 'claude', description: 'Pinned stable release' },
    ];
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
