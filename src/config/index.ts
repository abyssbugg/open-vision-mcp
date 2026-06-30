import { config as loadEnv } from 'dotenv';
import { ProviderConfig, ProviderId, ServerConfig } from '../types/index.js';

/**
 * Per-provider default configuration. The factory consults this table when
 * the user does not override BASE_URL or MODEL via env vars.
 *
 * baseUrl values are FULL prefixes (Phase 2A §5.1) — the adapter never
 * appends /v1 or any path.
 *
 * Together, DeepInfra, and Fireworks are multi-model aggregators; picking
 * a default model would be arbitrary, so MODEL is required for those.
 */
const PROVIDER_DEFAULTS: Record<
  ProviderId,
  {
    baseUrl: string;
    model?: string;
    extraHeaders?: Record<string, string>;
    requiresExplicitModel?: boolean;
  }
> = {
  openrouter: {
    baseUrl: 'https://openrouter.ai/api/v1',
    model: 'anthropic/claude-3.5-sonnet',
    // Preserve the OpenRouter ranking headers verbatim from the Phase 1
    // OpenRouterClient so existing OpenRouter users see no behavior change.
    extraHeaders: {
      'HTTP-Referer': 'https://github.com/openrouter-image-mcp',
      'X-Title': 'OpenRouter Image MCP',
    },
  },
  openai: {
    baseUrl: 'https://api.openai.com/v1',
    model: 'gpt-4o',
  },
  together: {
    baseUrl: 'https://api.together.xyz/v1',
    requiresExplicitModel: true,
  },
  deepinfra: {
    baseUrl: 'https://api.deepinfra.com/v1/openai',
    requiresExplicitModel: true,
  },
  fireworks: {
    baseUrl: 'https://api.fireworks.ai/inference/v1',
    requiresExplicitModel: true,
  },
  groq: {
    baseUrl: 'https://api.groq.com/openai/v1',
    model: 'llama-3.2-90b-vision-preview',
  },
  chutes: {
    baseUrl: 'https://llm.chutes.ai/v1',
    requiresExplicitModel: true,
  },
  cerebras: {
    baseUrl: 'https://api.cerebras.ai/v1',
    model: 'llama-4-scout-17b-16e-instruct', // optimistic; vision support unverified (Spike 2A-1)
  },
  azure: {
    baseUrl: '', // required: user must set BASE_URL to the full deployment URL + ?api-version=
    requiresExplicitModel: false, // R4: Azure ignores MODEL (deployment is in BASE_URL)
  },
  ollama: {
    baseUrl: 'http://localhost:11434', // local default; Cloud users override with https://api.ollama.com
    model: 'llama3.2-vision', // vision-capable default
    requiresExplicitModel: false,
  },
};

export class Config {
  private static instance: Config;
  private providerConfig: ProviderConfig;
  private serverConfig: ServerConfig;

  private constructor() {
    // Load environment variables from .env file (for local development only)
    // In production (MCP usage), env vars are passed by the MCP client via the config
    // If .env doesn't exist, dotenv will silently skip it - that's expected
    loadEnv();

    this.validateEnvironment();

    const provider = (process.env.PROVIDER as ProviderId | undefined) ?? 'openrouter';
    const defaults = PROVIDER_DEFAULTS[provider];
    if (!defaults) {
      throw new Error(
        `Unknown PROVIDER '${provider}'. Valid values: ${Object.keys(PROVIDER_DEFAULTS).join(', ')}`
      );
    }

    // Resolution precedence: new env var > legacy env var > per-provider default.
    const apiKey =
      process.env.API_KEY ??
      process.env.OPENROUTER_API_KEY ??
      this.throwMissingApiKey();
    const model =
      process.env.MODEL ??
      process.env.OPENROUTER_MODEL ??
      defaults.model ??
      (defaults.requiresExplicitModel === false
        ? ''  // provider doesn't require MODEL (e.g., azure ignores it)
        : this.throwMissingModel(provider));
    const baseUrl =
      process.env.BASE_URL ??
      process.env.OPENROUTER_BASE_URL ??
      defaults.baseUrl;
    const extraHeaders = this.parseExtraHeaders() ?? defaults.extraHeaders;

    // Azure requires a user-supplied BASE_URL (the full deployment URL
    // including ?api-version=). The per-provider default is empty.
    if (provider === 'azure' && (!baseUrl || baseUrl.trim() === '')) {
      throw new Error(
        "BASE_URL is required for provider 'azure' (Azure uses deployment-specific URLs including ?api-version=, not a per-provider default)."
      );
    }

    this.providerConfig = {
      provider,
      apiKey,
      model,
      baseUrl,
      extraHeaders,
    };

    this.serverConfig = {
      port: parseInt(process.env.PORT || '3000'),
      logLevel: (process.env.LOG_LEVEL as any) || 'info',
      retryAttempts: parseInt(process.env.RETRY_ATTEMPTS || '3'),
      maxImageSize: parseInt(process.env.MAX_IMAGE_SIZE || '10485760'), // 10MB
    };
  }

  public static getInstance(): Config {
    if (!Config.instance) {
      Config.instance = new Config();
    }
    return Config.instance;
  }

  private validateEnvironment(): void {
    // Phase 1 / Phase 2B backwards compatibility: accept either API_KEY or
    // the legacy OPENROUTER_API_KEY. The detailed error is produced by
    // throwMissingApiKey during resolution.
    if (!process.env.API_KEY && !process.env.OPENROUTER_API_KEY) {
      throw new Error(
        "API_KEY environment variable is required (or the legacy OPENROUTER_API_KEY)."
      );
    }
  }

  private throwMissingApiKey(): string {
    // Unreachable: validateEnvironment throws first. Kept for type safety
    // so the ?? chain has a terminal string branch.
    throw new Error('API_KEY environment variable is required');
  }

  private throwMissingModel(provider: ProviderId): string {
    throw new Error(
      `MODEL environment variable is required for provider '${provider}' (no default is defined).`
    );
  }

  private parseExtraHeaders(): Record<string, string> | undefined {
    const raw = process.env.EXTRA_HEADERS;
    if (!raw) return undefined;
    try {
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as Record<string, string>;
      }
      throw new Error('EXTRA_HEADERS must be a JSON object');
    } catch (e) {
      throw new Error(
        `EXTRA_HEADERS environment variable is not valid JSON: ${(e as Error).message}`
      );
    }
  }

  public getProviderConfig(): ProviderConfig {
    return this.providerConfig;
  }

  public getServerConfig(): ServerConfig {
    return this.serverConfig;
  }
}