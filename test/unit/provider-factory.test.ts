import { describe, it, expect, vi } from 'vitest';
import { ProviderFactory } from '../../src/providers/factory.js';
import { OpenAICompatibleProvider } from '../../src/providers/openai-compatible.js';
import type { ProviderConfig, ProviderId } from '../../src/types/index.js';

vi.mock('../../src/providers/openai-compatible.js', () => ({
  OpenAICompatibleProvider: vi.fn().mockImplementation((config, capabilities) => ({
    config,
    capabilities,
    analyzeImage: vi.fn(),
    testConnection: vi.fn(),
    validateModel: vi.fn(),
  })),
}));

vi.mock('../../src/utils/logger.js', () => ({
  Logger: { getInstance: vi.fn(() => ({ debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() })) },
}));

const makeConfig = (provider: ProviderId, overrides: Partial<ProviderConfig> = {}): ProviderConfig => ({
  provider,
  apiKey: 'test-key',
  model: 'test-model',
  baseUrl: 'https://test.example.com/v1',
  ...overrides,
});

describe('ProviderFactory', () => {
  describe('create', () => {
    it('should return an OpenAICompatibleProvider for openrouter', () => {
      const config = makeConfig('openrouter');
      const provider = ProviderFactory.create(config);
      expect(provider).toBeDefined();
      expect(provider.capabilities).toBeDefined();
    });

    it('should return a provider for openai', () => {
      const config = makeConfig('openai');
      const provider = ProviderFactory.create(config);
      expect(provider).toBeDefined();
    });

    it('should return a provider for together', () => {
      const config = makeConfig('together');
      const provider = ProviderFactory.create(config);
      expect(provider).toBeDefined();
    });

    it('should return a provider for deepinfra', () => {
      const config = makeConfig('deepinfra');
      const provider = ProviderFactory.create(config);
      expect(provider).toBeDefined();
    });

    it('should return a provider for fireworks', () => {
      const config = makeConfig('fireworks');
      const provider = ProviderFactory.create(config);
      expect(provider).toBeDefined();
    });

    it('should return a provider for groq', () => {
      const config = makeConfig('groq');
      const provider = ProviderFactory.create(config);
      expect(provider).toBeDefined();
    });

    it('should return a provider for cerebras (config-only, OpenAICompatibleProvider)', () => {
      const config = makeConfig('cerebras');
      const provider = ProviderFactory.create(config);
      expect(provider).toBeDefined();
      expect(provider.capabilities).toEqual({
        jsonMode: true,
        modelsEndpoint: true,
        maxTokensField: 'max_tokens',
      });
    });

    it('should return a ChutesProvider for chutes', () => {
      const config = makeConfig('chutes', { model: 'deepseek-ai/DeepSeek-V3-0324' });
      const provider = ProviderFactory.create(config);
      expect(provider).toBeDefined();
      expect(provider.capabilities).toEqual({
        jsonMode: true,
        modelsEndpoint: true,
        maxTokensField: 'max_tokens',
      });
    });

    it('should return an AzureOpenAIProvider for azure with modelsEndpoint: false', () => {
      const config = makeConfig('azure', { baseUrl: 'https://resource.openai.azure.com/openai/deployments/dep' });
      const provider = ProviderFactory.create(config);
      expect(provider).toBeDefined();
      expect(provider.capabilities).toEqual({
        jsonMode: true,
        modelsEndpoint: false,
        maxTokensField: 'max_tokens',
      });
    });

    it('should return an OllamaProvider for ollama', () => {
      const config = makeConfig('ollama');
      const provider = ProviderFactory.create(config);
      expect(provider).toBeDefined();
      expect(provider.capabilities).toEqual({
        jsonMode: true,
        modelsEndpoint: true,
        maxTokensField: 'max_tokens',
      });
    });

    it('should pass the correct capabilities for each provider', () => {
      const expectedCaps: Record<string, any> = {
        openrouter: { jsonMode: true, modelsEndpoint: true, maxTokensField: 'max_tokens' },
        openai: { jsonMode: true, modelsEndpoint: true, maxTokensField: 'max_tokens' },
        together: { jsonMode: true, modelsEndpoint: true, maxTokensField: 'max_tokens' },
        deepinfra: { jsonMode: true, modelsEndpoint: true, maxTokensField: 'max_tokens' },
        fireworks: { jsonMode: true, modelsEndpoint: true, maxTokensField: 'max_tokens' },
        groq: { jsonMode: true, modelsEndpoint: true, maxTokensField: 'max_tokens' },
        chutes: { jsonMode: true, modelsEndpoint: true, maxTokensField: 'max_tokens' },
        cerebras: { jsonMode: true, modelsEndpoint: true, maxTokensField: 'max_tokens' },
        azure: { jsonMode: true, modelsEndpoint: false, maxTokensField: 'max_tokens' },
        ollama: { jsonMode: true, modelsEndpoint: true, maxTokensField: 'max_tokens' },
      };
      for (const p of Object.keys(expectedCaps) as ProviderId[]) {
        const overrides: any = {};
        if (p === 'azure') overrides.baseUrl = 'https://x.openai.azure.com/openai/deployments/d';
        if (p === 'chutes') overrides.model = 'm';
        const config = makeConfig(p, overrides);
        const provider = ProviderFactory.create(config);
        expect(provider.capabilities).toEqual(expectedCaps[p]);
      }
    });

    it('should pass the config to the provider constructor', () => {
      const config = makeConfig('openai', { apiKey: 'custom-key', model: 'custom-model' });
      const provider = ProviderFactory.create(config) as any;
      expect(provider.config).toBe(config);
    });

    it('should throw on unknown provider id (exhaustiveness guard)', () => {
      const config = makeConfig('invalid' as any);
      expect(() => ProviderFactory.create(config)).toThrow(/Unknown provider/);
    });
  });
});