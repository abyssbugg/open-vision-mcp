import { describe, it, expect, beforeEach, vi } from 'vitest';
import axios from 'axios';
import { OpenAICompatibleProvider } from '../../src/providers/openai-compatible.js';
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

const DEFAULT_CAPABILITIES: ProviderCapabilities = {
  jsonMode: true, modelsEndpoint: true, maxTokensField: 'max_tokens',
};

const BASE_CONFIG: ProviderConfig = {
  provider: 'openai',
  apiKey: 'test-api-key',
  model: 'gpt-4o',
  baseUrl: 'https://api.openai.com/v1',
};

describe('OpenAICompatibleProvider', () => {
  let provider: OpenAICompatibleProvider;
  let mockAxiosInstance: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockAxiosInstance = { get: vi.fn(), post: vi.fn() };
    mockedAxios.create = vi.fn(() => mockAxiosInstance);
    mockedAxios.isAxiosError = vi.fn(() => false);
  });

  describe('constructor', () => {
    it('should create axios instance with Bearer auth + extraHeaders', () => {
      const config: ProviderConfig = {
        ...BASE_CONFIG,
        extraHeaders: { 'X-Custom': 'value' },
      };
      provider = new OpenAICompatibleProvider(config, DEFAULT_CAPABILITIES);

      expect(mockedAxios.create).toHaveBeenCalledWith({
        baseURL: 'https://api.openai.com/v1',
        headers: {
          'Authorization': 'Bearer test-api-key',
          'Content-Type': 'application/json',
          'X-Custom': 'value',
        },
        timeout: 120000,
        maxContentLength: 50 * 1024 * 1024,
        maxBodyLength: 50 * 1024 * 1024,
      });
    });

    it('should expose the injected capabilities', () => {
      provider = new OpenAICompatibleProvider(BASE_CONFIG, DEFAULT_CAPABILITIES);
      expect(provider.capabilities).toBe(DEFAULT_CAPABILITIES);
    });
  });

  describe('testConnection', () => {
    it('should return true for successful connection', async () => {
      provider = new OpenAICompatibleProvider(BASE_CONFIG, DEFAULT_CAPABILITIES);
      mockAxiosInstance.get.mockResolvedValue({ status: 200 });
      expect(await provider.testConnection()).toBe(true);
    });

    it('should return false for failed connection', async () => {
      provider = new OpenAICompatibleProvider(BASE_CONFIG, DEFAULT_CAPABILITIES);
      mockAxiosInstance.get.mockRejectedValue(new Error('Network error'));
      expect(await provider.testConnection()).toBe(false);
    });
  });

  describe('validateModel', () => {
    it('should return true when model exists in /models list', async () => {
      provider = new OpenAICompatibleProvider(BASE_CONFIG, DEFAULT_CAPABILITIES);
      mockAxiosInstance.get.mockResolvedValue({
        data: { data: [{ id: 'gpt-4o', architecture: { modality: ['text', 'vision'] } }] },
      });
      expect(await provider.validateModel!('gpt-4o')).toBe(true);
    });

    it('should return false when model does not exist', async () => {
      provider = new OpenAICompatibleProvider(BASE_CONFIG, DEFAULT_CAPABILITIES);
      mockAxiosInstance.get.mockResolvedValue({ data: { data: [] } });
      expect(await provider.validateModel!('nonexistent')).toBe(false);
    });
  });

  describe('analyzeImage', () => {
    const mockImageData = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
    const mockMimeType = 'image/png';
    const mockPrompt = 'Analyze this image';

    beforeEach(() => {
      provider = new OpenAICompatibleProvider(BASE_CONFIG, DEFAULT_CAPABILITIES);
    });

    it('should successfully analyze image with text response', async () => {
      mockAxiosInstance.post.mockResolvedValue({
        data: {
          choices: [{ message: { content: 'This is a detailed analysis.' } }],
          usage: { prompt_tokens: 50, completion_tokens: 100, total_tokens: 150 },
        },
      });

      const result = await provider.analyzeImage(mockImageData, mockMimeType, mockPrompt);

      expect(result.success).toBe(true);
      expect(result.analysis).toBe('This is a detailed analysis.');
      expect(result.model).toBe('gpt-4o');
      expect(result.usage).toEqual({ promptTokens: 50, completionTokens: 100, totalTokens: 150 });

      expect(mockAxiosInstance.post).toHaveBeenCalledWith('/chat/completions', {
        model: 'gpt-4o',
        messages: [{
          role: 'user',
          content: [
            { type: 'text', text: mockPrompt },
            { type: 'image_url', image_url: { url: `data:${mockMimeType};base64,${mockImageData}` } },
          ],
        }],
        max_tokens: 4000,
        temperature: 0.1,
        response_format: undefined,
      });
    });

    it('should successfully analyze image with JSON response', async () => {
      mockAxiosInstance.post.mockResolvedValue({
        data: {
          choices: [{ message: { content: '{"objects":["person"],"colors":["red"]}' } }],
          usage: { prompt_tokens: 30, completion_tokens: 80, total_tokens: 110 },
        },
      });

      const result = await provider.analyzeImage(mockImageData, mockMimeType, mockPrompt, {
        format: 'json', maxTokens: 2000, temperature: 0.5,
      });

      expect(result.success).toBe(true);
      expect(result.structuredData).toEqual({ objects: ['person'], colors: ['red'] });
      expect(mockAxiosInstance.post).toHaveBeenCalledWith('/chat/completions', expect.objectContaining({
        max_tokens: 2000,
        temperature: 0.5,
        response_format: { type: 'json_object' },
      }));
    });

    it('should handle JSON parsing gracefully (fall back to text)', async () => {
      mockAxiosInstance.post.mockResolvedValue({
        data: { choices: [{ message: { content: 'Not valid JSON' } }] },
      });

      const result = await provider.analyzeImage(mockImageData, mockMimeType, mockPrompt, { format: 'json' });

      expect(result.success).toBe(true);
      expect(result.analysis).toBe('Not valid JSON');
      expect(result.structuredData).toEqual({ analysis: 'Not valid JSON' });
    });

    it('should handle empty response from model', async () => {
      mockAxiosInstance.post.mockResolvedValue({ data: { choices: [] } });
      const result = await provider.analyzeImage(mockImageData, mockMimeType, mockPrompt);
      expect(result.success).toBe(false);
      expect(result.error).toBe('No response from model');
    });

    it('should handle empty message content', async () => {
      mockAxiosInstance.post.mockResolvedValue({ data: { choices: [{ message: {} }] } });
      const result = await provider.analyzeImage(mockImageData, mockMimeType, mockPrompt);
      expect(result.success).toBe(false);
      expect(result.error).toBe('Empty response from model');
    });

    it('should handle axios errors with provider-aware message', async () => {
      const axiosError = {
        isAxiosError: true,
        response: { status: 401, data: { error: { message: 'Invalid API key' } } },
        message: 'Request failed',
      };
      mockedAxios.isAxiosError.mockReturnValue(true);
      mockAxiosInstance.post.mockRejectedValue(axiosError);

      const result = await provider.analyzeImage(mockImageData, mockMimeType, mockPrompt);

      expect(result.success).toBe(false);
      expect(result.error).toBe('openai API Error: Invalid API key');
    });

    it('should handle generic errors', async () => {
      mockAxiosInstance.post.mockRejectedValue(new Error('Something went wrong'));
      const result = await provider.analyzeImage(mockImageData, mockMimeType, mockPrompt);
      expect(result.success).toBe(false);
      expect(result.error).toBe('Something went wrong');
    });

    it('should use default prompt when none provided', async () => {
      mockAxiosInstance.post.mockResolvedValue({
        data: { choices: [{ message: { content: 'Default analysis' } }] },
      });

      await provider.analyzeImage(mockImageData, mockMimeType, '');

      expect(mockAxiosInstance.post).toHaveBeenCalledWith('/chat/completions', expect.objectContaining({
        messages: [expect.objectContaining({
          content: [expect.objectContaining({
            text: 'Analyze this image in detail. Describe what you see, including objects, people, text, and any notable features.',
          }), expect.any(Object)],
        })],
      }));
    });
  });
});