import axios, { AxiosInstance } from 'axios';
import {
  ImageAnalysisResult,
  ProviderCapabilities,
  ProviderConfig,
  VisionProvider,
} from '../types/index.js';
import { Logger } from '../utils/logger.js';

/**
 * Dedicated adapter for Azure OpenAI.
 *
 * Phase 2A classified Azure as PSI (Provider-Specific Implementation) because:
 *  - Auth: Azure uses 'api-key: <key>' header, not 'Authorization: Bearer'
 *  - URL: the deployment name is in the URL path, not the request body's
 *    'model' field. The user's BASE_URL must be the full deployment URL
 *    including '?api-version=...' (R6).
 *  - No /models endpoint: Azure uses deployment-based discovery
 *    (configured out-of-band), not a /v1/models list.
 *
 * Design decisions (Phase 2C plan §9.3):
 *  - R1: the 'model' field is omitted from the request body — Azure routes
 *    by deployment URL, not body field.
 *  - R3: testConnection() returns true unconditionally — Azure has no
 *    /models endpoint; the first analyzeImage call is the real health
 *    check.
 *  - validateModel() returns true unconditionally — same rationale.
 *  - Response parsing is identical to OpenAICompatibleProvider (Azure
 *    returns the standard OpenAI chat completion response shape).
 *  - D6: response_format is gated on capabilities.jsonMode. Azure's
 *    capabilities have jsonMode: true, so the gate passes.
 *
 * The shared response-parsing logic is duplicated from
 * OpenAICompatibleProvider. Extracting a shared utility is a refactor
 * deferred to a future phase (not Phase 2C scope).
 */
export class AzureOpenAIProvider implements VisionProvider {
  private client: AxiosInstance;
  private config: ProviderConfig;
  private logger: Logger;
  public readonly capabilities: ProviderCapabilities;

  constructor(config: ProviderConfig, capabilities: ProviderCapabilities) {
    this.config = config;
    this.logger = Logger.getInstance();
    this.capabilities = capabilities;

    // Azure auth: api-key header (NOT Bearer).
    // baseUrl is the full deployment URL including ?api-version=.
    // The adapter appends /chat/completions to baseUrl.
    this.client = axios.create({
      baseURL: config.baseUrl,
      headers: {
        'api-key': config.apiKey,
        'Content-Type': 'application/json',
        ...(config.extraHeaders ?? {}),
      },
      timeout: 120000,
      maxContentLength: 50 * 1024 * 1024,
      maxBodyLength: 50 * 1024 * 1024,
    });
  }

  public async validateModel(modelId: string): Promise<boolean> {
    // Azure has no /models endpoint — deployment discovery is out-of-band.
    // The "model" is the deployment name, configured in BASE_URL.
    // Return true unconditionally (trust the user's deployment URL).
    this.logger.debug(`Azure validateModel: trusting deployment for '${modelId}' (no /models endpoint)`);
    return true;
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
      this.logger.debug(`Analyzing image with Azure deployment`);

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

      // R1: Azure routes by deployment URL — the 'model' field is omitted
      // from the request body. The deployment is in config.baseUrl.
      const requestBody = {
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: promptText },
              { type: 'image_url', image_url: { url: `data:${mimeType};base64,${imageData}` } },
            ],
          },
        ],
        max_tokens: Math.min(options.maxTokens || 4000, 8000),
        temperature: options.temperature || 0.1,
        // D6: gate response_format on capabilities.jsonMode
        response_format: (options.format === 'json' && this.capabilities.jsonMode)
          ? { type: 'json_object' }
          : undefined,
      };

      this.logger.debug(`Sending request to Azure API`, {
        imageSize: imageData.length,
        promptLength: promptText.length,
        maxTokens: requestBody.max_tokens,
      });

      const response = await this.client.post('/chat/completions', requestBody);

      const choice = response.data.choices?.[0];
      if (!choice) {
        throw new Error('No response from model');
      }
      const content = choice.message?.content;
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

      const usage = response.data.usage;
      this.logger.info(`Azure image analysis completed successfully`, { usage });

      return {
        success: true,
        analysis,
        structuredData,
        model: this.config.model,
        usage: usage ? {
          promptTokens: usage.prompt_tokens,
          completionTokens: usage.completion_tokens,
          totalTokens: usage.total_tokens,
        } : undefined,
      };
    } catch (error) {
      this.logger.error('Failed to analyze image', error);
      const errorMessage = this.extractErrorMessage(error);
      return { success: false, error: errorMessage };
    }
  }

  private extractErrorMessage(error: any): string {
    if (axios.isAxiosError(error)) {
      const data = error.response?.data;
      if (data?.error?.message) {
        return `azure API Error: ${data.error.message}`;
      }
      if (data?.message) {
        return `azure API Error: ${data.message}`;
      }
      return `HTTP ${error.response?.status}: ${error.message}`;
    }
    if (error instanceof Error) {
      return error.message;
    }
    return 'Unknown error occurred';
  }

  public async testConnection(): Promise<boolean> {
    // R3: Azure has no /models endpoint; deployment discovery is out-of-band.
    // Returns true unconditionally — the first analyzeImage call is the
    // real health check. A real health check would require a chat
    // completion, which costs tokens and requires a prompt.
    this.logger.debug('Azure testConnection: no /models endpoint; trusting deployment URL');
    return true;
  }
}