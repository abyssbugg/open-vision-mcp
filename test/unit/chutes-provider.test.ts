import { describe, it, expect, beforeEach, vi } from 'vitest';
import axios from 'axios';
import { ChutesProvider } from '../../src/providers/chutes.js';
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

const CHUTES_CAPABILITIES: ProviderCapabilities = {
  jsonMode: true, modelsEndpoint: true, maxTokensField: 'max_tokens',
};

const CHUTES_CONFIG: ProviderConfig = {
  provider: 'chutes',
  apiKey: 'chutes-api-key',
  model: 'deepseek-ai/DeepSeek-V3-0324',
  baseUrl: 'https://llm.chutes.ai/v1',
};

describe('ChutesProvider', () => {
  let mockAxiosInstance: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockAxiosInstance = { get: vi.fn(), post: vi.fn() };
    mockedAxios.create = vi.fn(() => mockAxiosInstance);
    mockedAxios.isAxiosError = vi.fn(() => false);
  });

  describe('validateModel', () => {
    it('should return true when model exists with supported_features including vision', async () => {
      const provider = new ChutesProvider(CHUTES_CONFIG, CHUTES_CAPABILITIES);
      mockAxiosInstance.get.mockResolvedValue({
        data: {
          data: [{
            id: 'deepseek-ai/DeepSeek-V3-0324',
            architecture: { modality: ['text', 'vision'] },
            supported_features: ['vision', 'json'],
          }],
        },
      });

      const result = await provider.validateModel!('deepseek-ai/DeepSeek-V3-0324');
      expect(result).toBe(true);
    });

    it('should warn when supported_features lacks vision', async () => {
      const provider = new ChutesProvider(CHUTES_CONFIG, CHUTES_CAPABILITIES);
      mockAxiosInstance.get.mockResolvedValue({
        data: {
          data: [{
            id: 'text-only-model',
            supported_features: ['text'],  // no vision
          }],
        },
      });

      const result = await provider.validateModel!('text-only-model');
      expect(result).toBe(true);  // still true — warning only
    });

    it('should handle absent supported_features gracefully (trust user model id)', async () => {
      const provider = new ChutesProvider(CHUTES_CONFIG, CHUTES_CAPABILITIES);
      mockAxiosInstance.get.mockResolvedValue({
        data: {
          data: [{ id: 'model-without-features' }],  // no supported_features field
        },
      });

      const result = await provider.validateModel!('model-without-features');
      expect(result).toBe(true);  // no features field -> trust user
    });

    it('should return false when model does not exist', async () => {
      const provider = new ChutesProvider(CHUTES_CONFIG, CHUTES_CAPABILITIES);
      mockAxiosInstance.get.mockResolvedValue({ data: { data: [] } });
      expect(await provider.validateModel!('nonexistent')).toBe(false);
    });
  });

  describe('capabilities', () => {
    it('should expose the injected capabilities', () => {
      const provider = new ChutesProvider(CHUTES_CONFIG, CHUTES_CAPABILITIES);
      expect(provider.capabilities).toBe(CHUTES_CAPABILITIES);
    });
  });
});