import { describe, it, expect, beforeEach, vi } from 'vitest';
import axios from 'axios';
import { OllamaProvider } from '../../src/providers/ollama.js';
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

const OLLAMA_CAPABILITIES: ProviderCapabilities = {
  jsonMode: true, modelsEndpoint: true, maxTokensField: 'max_tokens',
};

const OLLAMA_CONFIG: ProviderConfig = {
  provider: 'ollama',
  apiKey: 'ollama-key',
  model: 'gemma3:12b',
  baseUrl: 'http://localhost:11434',
};

describe('OllamaProvider', () => {
  let mockAxiosInstance: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockAxiosInstance = { get: vi.fn(), post: vi.fn() };
    mockedAxios.create = vi.fn(() => mockAxiosInstance);
    mockedAxios.isAxiosError = vi.fn(() => false);
  });

  describe('constructor', () => {
    it('should use Bearer auth and the configured baseUrl', () => {
      const provider = new OllamaProvider(OLLAMA_CONFIG, OLLAMA_CAPABILITIES);

      expect(mockedAxios.create).toHaveBeenCalledWith({
        baseURL: 'http://localhost:11434',
        headers: {
          'Authorization': 'Bearer ollama-key',
          'Content-Type': 'application/json',
        },
        timeout: 120000,
        maxContentLength: 50 * 1024 * 1024,
        maxBodyLength: 50 * 1024 * 1024,
      });
    });

    it('should expose the injected capabilities', () => {
      const provider = new OllamaProvider(OLLAMA_CONFIG, OLLAMA_CAPABILITIES);
      expect(provider.capabilities).toBe(OLLAMA_CAPABILITIES);
    });
  });

  describe('analyzeImage', () => {
    const mockImageData = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
    const mockMimeType = 'image/png';
    const mockPrompt = 'What do you see in this image?';

    it('should send a native Ollama request (plain-string content + images array + options.num_predict)', async () => {
      const provider = new OllamaProvider(OLLAMA_CONFIG, OLLAMA_CAPABILITIES);
      mockAxiosInstance.post.mockResolvedValue({
        data: {
          message: { role: 'assistant', content: 'I see a red pixel.' },
          prompt_eval_count: 50,
          eval_count: 10,
          done: true,
        },
      });

      await provider.analyzeImage(mockImageData, mockMimeType, mockPrompt, { maxTokens: 2000, temperature: 0.5 });

      const callArgs = mockAxiosInstance.post.mock.calls[0];
      expect(callArgs[0]).toBe('/api/chat');
      const body = callArgs[1];
      // Native Ollama shape: plain-string content, not content[] array
      expect(body.messages[0].content).toBe(mockPrompt);
      // Images: separate array with raw base64 (no data: prefix)
      expect(body.messages[0].images).toEqual([mockImageData]);
      // stream: false explicit
      expect(body.stream).toBe(false);
      // max_tokens → options.num_predict
      expect(body.options.num_predict).toBe(2000);
      expect(body.options.temperature).toBe(0.5);
      // model passed through
      expect(body.model).toBe('gemma3:12b');
    });

    it('should parse the native Ollama response (message.content, prompt_eval_count, eval_count)', async () => {
      const provider = new OllamaProvider(OLLAMA_CONFIG, OLLAMA_CAPABILITIES);
      mockAxiosInstance.post.mockResolvedValue({
        data: {
          message: { role: 'assistant', content: 'I see a red pixel.' },
          prompt_eval_count: 50,
          eval_count: 10,
          done: true,
        },
      });

      const result = await provider.analyzeImage(mockImageData, mockMimeType, mockPrompt);

      expect(result.success).toBe(true);
      expect(result.analysis).toBe('I see a red pixel.');
      expect(result.model).toBe('gemma3:12b');
      expect(result.usage).toEqual({
        promptTokens: 50,
        completionTokens: 10,
        totalTokens: 60,
      });
    });

    it('should NOT include data: prefix in the images array (raw base64 only)', async () => {
      const provider = new OllamaProvider(OLLAMA_CONFIG, OLLAMA_CAPABILITIES);
      mockAxiosInstance.post.mockResolvedValue({
        data: { message: { content: 'ok' }, prompt_eval_count: 1, eval_count: 1 },
      });

      await provider.analyzeImage(mockImageData, mockMimeType, mockPrompt);

      const body = mockAxiosInstance.post.mock.calls[0][1];
      expect(body.messages[0].images[0]).toBe(mockImageData);
      expect(body.messages[0].images[0]).not.toContain('data:');
    });

    it('should translate response_format to Ollama format field for JSON mode', async () => {
      const provider = new OllamaProvider(OLLAMA_CONFIG, OLLAMA_CAPABILITIES);
      mockAxiosInstance.post.mockResolvedValue({
        data: { message: { content: '{"result":"ok"}' }, prompt_eval_count: 1, eval_count: 1 },
      });

      await provider.analyzeImage(mockImageData, mockMimeType, mockPrompt, { format: 'json' });

      const body = mockAxiosInstance.post.mock.calls[0][1];
      expect(body.format).toBe('json');
      // Must NOT use response_format (OpenAI field)
      expect(body.response_format).toBeUndefined();
    });

    it('should JSON-parse the response content when format=json and content is valid JSON', async () => {
      const provider = new OllamaProvider(OLLAMA_CONFIG, OLLAMA_CAPABILITIES);
      mockAxiosInstance.post.mockResolvedValue({
        data: { message: { content: '{"objects":["person"],"colors":["red"]}' }, prompt_eval_count: 1, eval_count: 1 },
      });

      const result = await provider.analyzeImage(mockImageData, mockMimeType, mockPrompt, { format: 'json' });

      expect(result.success).toBe(true);
      expect(result.structuredData).toEqual({ objects: ['person'], colors: ['red'] });
    });

    it('should fall back to text when format=json but content is not valid JSON', async () => {
      const provider = new OllamaProvider(OLLAMA_CONFIG, OLLAMA_CAPABILITIES);
      mockAxiosInstance.post.mockResolvedValue({
        data: { message: { content: 'Not valid JSON' }, prompt_eval_count: 1, eval_count: 1 },
      });

      const result = await provider.analyzeImage(mockImageData, mockMimeType, mockPrompt, { format: 'json' });

      expect(result.success).toBe(true);
      expect(result.analysis).toBe('Not valid JSON');
      expect(result.structuredData).toEqual({ analysis: 'Not valid JSON' });
    });

    it('should handle empty response (no message.content)', async () => {
      const provider = new OllamaProvider(OLLAMA_CONFIG, OLLAMA_CAPABILITIES);
      mockAxiosInstance.post.mockResolvedValue({
        data: { message: { role: 'assistant' } },
      });

      const result = await provider.analyzeImage(mockImageData, mockMimeType, mockPrompt);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Empty response from model');
    });

    it('should handle axios errors with provider-aware message', async () => {
      const provider = new OllamaProvider(OLLAMA_CONFIG, OLLAMA_CAPABILITIES);
      const axiosError = {
        isAxiosError: true,
        response: { status: 404, data: { error: 'model not found' } },
        message: 'Request failed',
      };
      mockedAxios.isAxiosError.mockReturnValue(true);
      mockAxiosInstance.post.mockRejectedValue(axiosError);

      const result = await provider.analyzeImage(mockImageData, mockMimeType, mockPrompt);

      expect(result.success).toBe(false);
      expect(result.error).toBe('ollama API Error: model not found');
    });

    it('should handle generic errors', async () => {
      const provider = new OllamaProvider(OLLAMA_CONFIG, OLLAMA_CAPABILITIES);
      mockAxiosInstance.post.mockRejectedValue(new Error('Something went wrong'));

      const result = await provider.analyzeImage(mockImageData, mockMimeType, mockPrompt);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Something went wrong');
    });

    it('should use default prompt when none provided', async () => {
      const provider = new OllamaProvider(OLLAMA_CONFIG, OLLAMA_CAPABILITIES);
      mockAxiosInstance.post.mockResolvedValue({
        data: { message: { content: 'ok' }, prompt_eval_count: 1, eval_count: 1 },
      });

      await provider.analyzeImage(mockImageData, mockMimeType, '');

      const body = mockAxiosInstance.post.mock.calls[0][1];
      expect(body.messages[0].content).toContain('Analyze this image in detail');
    });
  });

  describe('testConnection', () => {
    it('should return true when /v1/models returns 200', async () => {
      const provider = new OllamaProvider(OLLAMA_CONFIG, OLLAMA_CAPABILITIES);
      mockAxiosInstance.get.mockResolvedValue({ status: 200 });
      expect(await provider.testConnection()).toBe(true);
    });

    it('should return false on connection failure', async () => {
      const provider = new OllamaProvider(OLLAMA_CONFIG, OLLAMA_CAPABILITIES);
      mockAxiosInstance.get.mockRejectedValue(new Error('Connection refused'));
      expect(await provider.testConnection()).toBe(false);
    });
  });

  describe('validateModel', () => {
    it('should return true when model exists in /v1/models', async () => {
      const provider = new OllamaProvider(OLLAMA_CONFIG, OLLAMA_CAPABILITIES);
      mockAxiosInstance.get.mockResolvedValue({
        data: { data: [{ id: 'gemma3:12b' }, { id: 'llava' }] },
      });
      expect(await provider.validateModel!('gemma3:12b')).toBe(true);
    });

    it('should return false when model does not exist', async () => {
      const provider = new OllamaProvider(OLLAMA_CONFIG, OLLAMA_CAPABILITIES);
      mockAxiosInstance.get.mockResolvedValue({
        data: { data: [{ id: 'llava' }] },
      });
      expect(await provider.validateModel!('nonexistent')).toBe(false);
    });
  });
});