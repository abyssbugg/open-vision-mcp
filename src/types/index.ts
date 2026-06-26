export interface ImageAnalysisOptions {
  format?: 'text' | 'json';
  prompt?: string;
  maxTokens?: number;
  temperature?: number;
}

export interface ImageInput {
  type: 'base64' | 'file' | 'url';
  data: string;
  mimeType?: string;
}

export interface ImageAnalysisResult {
  success: boolean;
  analysis?: string;
  structuredData?: any;
  error?: string;
  model?: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

export interface OpenRouterConfig {
  apiKey: string;
  model: string;
  baseUrl?: string;
}

/**
 * Phase 2B unified provider configuration. Carries the provider discriminator
 * alongside the credentials and per-provider settings.
 *
 * `OpenRouterConfig` is preserved above as a structural supertype so that
 * any external references continue to type-check. Phase 3 removed the
 * runtime getOpenRouterConfig() accessor; the type alias is retained
 * indefinitely (zero-cost, potential external-consumer compatibility).
 */
export interface ProviderConfig {
  provider: ProviderId;
  apiKey: string;
  model: string;
  baseUrl: string;
  extraHeaders?: Record<string, string>;
}

export interface ServerConfig {
  port?: number;
  logLevel?: 'debug' | 'info' | 'warn' | 'error';
  retryAttempts?: number;
  maxImageSize?: number;
}

/**
 * Identifier of an inference provider. Phase 2B widens this to the six
 * fully-compatible OpenAI-compatible providers. Phase 2C will add 'chutes',
 * 'cerebras', and 'azure' without changing the factory signature.
 */
export type ProviderId =
  | 'openrouter'
  | 'openai'
  | 'together'
  | 'deepinfra'
  | 'fireworks'
  | 'groq';

/**
 * Static capability descriptor for a VisionProvider. Enables synchronous,
 * instanceof-free capability checks (e.g. provider.capabilities.jsonMode).
 */
export interface ProviderCapabilities {
  /** Provider supports response_format: { type: 'json_object' }. */
  readonly jsonMode: boolean;
  /** Provider exposes a list-models endpoint usable by testConnection/validateModel. */
  readonly modelsEndpoint: boolean;
  /** Field name used for max tokens in the request body. */
  readonly maxTokensField: 'max_tokens' | 'maxOutputTokens';
}

/**
 * Behavioral contract for a vision-capable inference provider.
 *
 * Tool handlers depend on this interface rather than any concrete class so
 * that alternative providers can be added without touching tool code.
 */
export interface VisionProvider {
  /** Static capability descriptor for this provider. */
  readonly capabilities: ProviderCapabilities;

  /**
   * Analyze an image and return structured/textual analysis.
   * Signature is byte-identical to OpenRouterClient.analyzeImage.
   */
  analyzeImage(
    imageData: string,
    mimeType: string,
    prompt: string,
    options: {
      format?: 'text' | 'json';
      maxTokens?: number;
      temperature?: number;
    }
  ): Promise<ImageAnalysisResult>;

  /** Health check. Returns true on success. */
  testConnection(): Promise<boolean>;

  /** Optional: validate that the configured model id is known and vision-capable. */
  validateModel?(modelId: string): Promise<boolean>;
}