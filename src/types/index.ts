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

export interface ServerConfig {
  port?: number;
  logLevel?: 'debug' | 'info' | 'warn' | 'error';
  retryAttempts?: number;
  maxImageSize?: number;
}

/**
 * Identifier of an inference provider. Phase 1 ships only 'openrouter'.
 * Phase 2 will widen this union without changing the factory signature.
 */
export type ProviderId = 'openrouter';

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
 * Phase 1: implemented solely by OpenRouterClient. Tool handlers depend on
 * this interface rather than the concrete class so that Phase 2 may add
 * alternative providers without touching tool code.
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