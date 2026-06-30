import axios, { AxiosInstance } from 'axios';
import {
  ImageAnalysisResult,
  ProviderCapabilities,
  ProviderConfig,
  VisionProvider,
} from '../types/index.js';
import { Logger } from '../utils/logger.js';

/**
 * Dedicated adapter for Ollama (local and Cloud).
 *
 * ARCHITECTURAL INVARIANT: OllamaProvider is the SINGLE OWNERSHIP BOUNDARY
 * for all Ollama-native protocol handling. All Ollama-specific request
 * translation, response translation, and future native capabilities belong
 * ONLY in this file. Shared infrastructure (OpenAICompatibleProvider,
 * ProviderFactory, Config, types, tool handlers) must remain protocol-neutral.
 *
 * Ollama's native /api/chat endpoint uses a different request/response shape
 * from the OpenAI Chat Completions API:
 *  - Request: plain-string message content + separate images array (not the
 *    OpenAI content[] with type:image_url). No data: prefix on base64.
 *  - Response: message.content (no choices[] array). prompt_eval_count /
 *    eval_count (not usage.prompt_tokens / usage.completion_tokens).
 *  - max_tokens → options.num_predict (nested under options).
 *  - response_format → format (Ollama's native JSON mode field).
 *  - stream: false is explicit (Ollama defaults to streaming).
 *
 * The /v1/models endpoint (OpenAI-compatible) is used for testConnection and
 * validateModel — it works for both local and Cloud with Bearer auth.
 *
 * One PROVIDER=ollama serves both local (http://localhost:11434) and Cloud
 * (https://api.ollama.com). The baseUrl must NOT include /v1 — the adapter
 * appends /api/chat (inference) and /v1/models (discovery).
 */
export class OllamaProvider implements VisionProvider {
  private client: AxiosInstance;
  private config: ProviderConfig;
  private logger: Logger;
  public readonly capabilities: ProviderCapabilities;

  constructor(config: ProviderConfig, capabilities: ProviderCapabilities) {
    this.config = config;
    this.logger = Logger.getInstance();
    this.capabilities = capabilities;

    this.client = axios.create({
      baseURL: config.baseUrl,
      headers: {
        'Authorization': `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json',
        ...(config.extraHeaders ?? {}),
      },
      timeout: 120000,
      maxContentLength: 50 * 1024 * 1024,
      maxBodyLength: 50 * 1024 * 1024,
    });
  }

  public async validateModel(modelId: string): Promise<boolean> {
    try {
      this.logger.debug(`Ollama validateModel: ${modelId}`);
      // Ollama's /v1/models endpoint (OpenAI-compatible) works for both
      // local and Cloud with Bearer auth.
      const response = await this.client.get('/v1/models');
      const models = response.data.data || [];
      const modelExists = models.some((model: any) => model.id === modelId);
      if (!modelExists) {
        this.logger.warn(`Ollama model not found: ${modelId}`);
        return false;
      }
      this.logger.debug(`Ollama model validated: ${modelId}`);
      return true;
    } catch (error) {
      this.logger.error(`Ollama validateModel failed for ${modelId}`, error);
      return false;
    }
  }

  public async analyzeImage(
    imageData: string,
    mimeType: string,
    prompt: string,
    options: {
      format?: 'text' | 'json';
      maxTokens?: number;
      temperature?: number;
    } = {}
  ): Promise<ImageAnalysisResult> {
    try {
      this.logger.debug(`Ollama analyzeImage with model: ${this.config.model}`);

      if (!imageData || imageData.length === 0) {
        throw new Error('No image data provided');
      }
      if (!mimeType) {
        throw new Error('No MIME type provided');
      }
      if (imageData.length > 20 * 1024 * 1024) {
        throw new Error(`Image data too large: ${imageData.length} characters. Maximum allowed is 20MB.`);
      }

      const promptText = prompt || 'Analyze this image in detail. Describe what you see, including objects, people, text, and any notable features.';
      if (promptText.length > 10000) {
        throw new Error(`Prompt too long: ${promptText.length} characters. Maximum allowed is 10000.`);
      }

      // Ollama-native request translation (owned by OllamaProvider only):
      // - content is a plain string (not the OpenAI content[] array)
      // - images is a separate array of raw base64 (no data: prefix)
      // - max_tokens → options.num_predict
      // - response_format → format
      // - stream: false is explicit
      const requestBody = {
        model: this.config.model,
        messages: [{
          role: 'user',
          content: promptText,
          images: [imageData],
        }],
        stream: false,
        options: {
          num_predict: Math.min(options.maxTokens || 4000, 8000),
          temperature: options.temperature || 0.1,
        },
        format: (options.format === 'json' && this.capabilities.jsonMode)
          ? 'json'
          : undefined,
      };

      this.logger.debug(`Sending request to Ollama API`, {
        model: this.config.model,
        imageSize: imageData.length,
        promptLength: promptText.length,
        maxTokens: requestBody.options.num_predict,
      });

      const response = await this.client.post('/api/chat', requestBody);

      // Ollama-native response translation (owned by OllamaProvider only):
      // - message.content (no choices[] array)
      // - prompt_eval_count / eval_count (not usage.prompt_tokens / completion_tokens)
      const content = response.data.message?.content;
      if (!content) {
        throw new Error('Empty response from model');
      }

      let analysis: string;
      let structuredData: any;

      if (options.format === 'json') {
        try {
          structuredData = JSON.parse(content);
          analysis = JSON.stringify(structuredData, null, 2);
        } catch {
          analysis = content;
          structuredData = { analysis: content };
        }
      } else {
        analysis = content;
        structuredData = { analysis };
      }

      const promptTokens = response.data.prompt_eval_count ?? 0;
      const completionTokens = response.data.eval_count ?? 0;

      this.logger.info(`Ollama image analysis completed successfully`, {
        model: this.config.model,
        promptTokens,
        completionTokens,
      });

      return {
        success: true,
        analysis,
        structuredData,
        model: this.config.model,
        usage: {
          promptTokens,
          completionTokens,
          totalTokens: promptTokens + completionTokens,
        },
      };
    } catch (error) {
      this.logger.error('Failed to analyze image (Ollama)', error);
      const errorMessage = this.extractErrorMessage(error);
      return { success: false, error: errorMessage };
    }
  }

  private extractErrorMessage(error: any): string {
    if (axios.isAxiosError(error)) {
      const data = error.response?.data;
      if (data?.error) {
        // Ollama native error: { "error": "model not found" } (string)
        // or { "error": { "message": "..." } } (object)
        const msg = typeof data.error === 'string'
          ? data.error
          : data.error.message || 'Unknown error';
        return `ollama API Error: ${msg}`;
      }
      if (data?.message) {
        return `ollama API Error: ${data.message}`;
      }
      return `HTTP ${error.response?.status}: ${error.message}`;
    }
    if (error instanceof Error) {
      return error.message;
    }
    return 'Unknown error occurred';
  }

  public async testConnection(): Promise<boolean> {
    try {
      // Ollama's /v1/models endpoint (OpenAI-compatible) works for both
      // local and Cloud. Used as the health check.
      const response = await this.client.get('/v1/models');
      return response.status === 200;
    } catch (error) {
      this.logger.error('Failed to connect to Ollama API', error);
      return false;
    }
  }
}