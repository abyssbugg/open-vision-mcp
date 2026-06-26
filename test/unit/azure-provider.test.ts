import { describe, it, expect, beforeEach, vi } from 'vitest';
import axios from 'axios';
import { AzureOpenAIProvider } from '../../src/providers/azure.js';
import type { ProviderConfig, ProviderCapabilities } from '../../src/types/index.js';

vi.mock('axios');
const mockedAxios = vi.mocked(axios);

vi.mock('../../src/utils/logger.js', () => ({
  Logger: {
    getInstance: vi.fn(() => ({
      debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn(),
    })),
  },
}));

const AZURE_CAPABILITIES: ProviderCapabilities = {
  jsonMode: true, modelsEndpoint: false, maxTokensField: 'max_tokens',
};

const AZURE_CONFIG: ProviderConfig = {
  provider: 'azure',
  apiKey: 'azure-api-key',
  model: 'gpt-4o-deployment',  // ignored by Azure (R1) but stored in config
  baseUrl: 'https://myresource.openai.azure.com/openai/deployments/my-deployment',
};

describe('AzureOpenAIProvider', () => {
  let mockAxiosInstance: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockAxiosInstance = { get: vi.fn(), post: vi.fn() };
    mockedAxios.create = vi.fn(() => mockAxiosInstance);
    mockedAxios.isAxiosError = vi.fn(() => false);
  });

  describe('constructor', () => {
    it('R1: should use api-key header (NOT Bearer)', () => {
      const provider = new AzureOpenAIProvider(AZURE_CONFIG, AZURE_CAPABILITIES);

      expect(mockedAxios.create).toHaveBeenCalledWith({
        baseURL: AZURE_CONFIG.baseUrl,
        headers: {
          'api-key': 'azure-api-key',   // NOT 'Authorization': 'Bearer ...'
          'Content-Type': 'application/json',
        },
        timeout: 120000,
        maxContentLength: 50 * 1024 * 1024,
        maxBodyLength: 50 * 1024 * 1024,
      });
    });

    it('should expose the injected capabilities', () => {
      const provider = new AzureOpenAIProvider(AZURE_CONFIG, AZURE_CAPABILITIES);
      expect(provider.capabilities).toBe(AZURE_CAPABILITIES);
      expect(provider.capabilities.modelsEndpoint).toBe(false);
    });
  });

  describe('testConnection', () => {
    it('R3: should return true without making an HTTP call (no /models endpoint)', async () => {
      const provider = new AzureOpenAIProvider(AZURE_CONFIG, AZURE_CAPABILITIES);
      const result = await provider.testConnection();
      expect(result).toBe(true);
      expect(mockAxiosInstance.get).not.toHaveBeenCalled();
    });
  });

  describe('validateModel', () => {
    it('should return true without making an HTTP call (no /models endpoint)', async () => {
      const provider = new AzureOpenAIProvider(AZURE_CONFIG, AZURE_CAPABILITIES);
      const result = await provider.validateModel!('any-deployment');
      expect(result).toBe(true);
      expect(mockAxiosInstance.get).not.toHaveBeenCalled();
    });
  });

  describe('analyzeImage', () => {
    const mockImageData = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
    const mockMimeType = 'image/png';
    const mockPrompt = 'Analyze this image';

    beforeEach(() => {
      // Re-create provider for each analyzeImage test
    });

    it('should successfully analyze image', async () => {
      const provider = new AzureOpenAIProvider(AZURE_CONFIG, AZURE_CAPABILITIES);
      mockAxiosInstance.post.mockResolvedValue({
        data: {
          choices: [{ message: { content: 'Azure analysis result' } }],
          usage: { prompt_tokens: 50, completion_tokens: 100, total_tokens: 150 },
        },
      });

      const result = await provider.analyzeImage(mockImageData, mockMimeType, mockPrompt);

      expect(result.success).toBe(true);
      expect(result.analysis).toBe('Azure analysis result');
      expect(result.usage).toEqual({ promptTokens: 50, completionTokens: 100, totalTokens: 150 });

      const callArgs = mockAxiosInstance.post.mock.calls[0];
      expect(callArgs[0]).toBe('/chat/completions');
      const body = callArgs[1] as any;
      expect(body.messages[0].content[1]).toEqual({
        type: 'image_url',
        image_url: { url: `data:${mockMimeType};base64,${mockImageData}` },
      });
    });

    it('R1: should NOT include model field in request body (Azure routes by deployment URL)', async () => {
      const provider = new AzureOpenAIProvider(AZURE_CONFIG, AZURE_CAPABILITIES);
      mockAxiosInstance.post.mockResolvedValue({
        data: { choices: [{ message: { content: 'ok' } }] },
      });

      await provider.analyzeImage(mockImageData, mockMimeType, mockPrompt);

      const body = mockAxiosInstance.post.mock.calls[0][1] as any;
      expect(body.model).toBeUndefined();
      expect(body.messages).toBeDefined();
      expect(body.max_tokens).toBeDefined();
    });

    it('D6: should include response_format when format=json and jsonMode=true', async () => {
      const provider = new AzureOpenAIProvider(AZURE_CONFIG, AZURE_CAPABILITIES);
      mockAxiosInstance.post.mockResolvedValue({
        data: { choices: [{ message: { content: '{"result":"ok"}' } }] },
      });

      await provider.analyzeImage(mockImageData, mockMimeType, mockPrompt, { format: 'json' });

      const body = mockAxiosInstance.post.mock.calls[0][1] as any;
      expect(body.response_format).toEqual({ type: 'json_object' });
    });

    it('D6: should omit response_format when jsonMode=false even if format=json', async () => {
      const noJsonCap: ProviderCapabilities = { jsonMode: false, modelsEndpoint: false, maxTokensField: 'max_tokens' };
      const provider = new AzureOpenAIProvider(AZURE_CONFIG, noJsonCap);
      mockAxiosInstance.post.mockResolvedValue({
        data: { choices: [{ message: { content: '{"result":"ok"}' } }] },
      });

      await provider.analyzeImage(mockImageData, mockMimeType, mockPrompt, { format: 'json' });

      const body = mockAxiosInstance.post.mock.calls[0][1] as any;
      expect(body.response_format).toBeUndefined();
    });

    it('should handle empty choices response', async () => {
      const provider = new AzureOpenAIProvider(AZURE_CONFIG, AZURE_CAPABILITIES);
      mockAxiosInstance.post.mockResolvedValue({ data: { choices: [] } });
      const result = await provider.analyzeImage(mockImageData, mockMimeType, mockPrompt);
      expect(result.success).toBe(false);
      expect(result.error).toBe('No response from model');
    });

    it('should handle axios errors with provider-aware message', async () => {
      const provider = new AzureOpenAIProvider(AZURE_CONFIG, AZURE_CAPABILITIES);
      const axiosError = {
        isAxiosError: true,
        response: { status: 401, data: { error: { message: 'Invalid api-key' } } },
        message: 'Request failed',
      };
      mockedAxios.isAxiosError.mockReturnValue(true);
      mockAxiosInstance.post.mockRejectedValue(axiosError);

      const result = await provider.analyzeImage(mockImageData, mockMimeType, mockPrompt);

      expect(result.success).toBe(false);
      expect(result.error).toBe('azure API Error: Invalid api-key');
    });

    it('should handle generic errors', async () => {
      const provider = new AzureOpenAIProvider(AZURE_CONFIG, AZURE_CAPABILITIES);
      mockAxiosInstance.post.mockRejectedValue(new Error('Something went wrong'));
      const result = await provider.analyzeImage(mockImageData, mockMimeType, mockPrompt);
      expect(result.success).toBe(false);
      expect(result.error).toBe('Something went wrong');
    });
  });
});