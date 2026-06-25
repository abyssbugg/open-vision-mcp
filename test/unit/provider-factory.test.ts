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

    it('should pass the correct capabilities for each provider', () => {
      for (const p of ['openrouter', 'openai', 'together', 'deepinfra', 'fireworks', 'groq'] as ProviderId[]) {
        const config = makeConfig(p);
        const provider = ProviderFactory.create(config);
        expect(provider.capabilities).toEqual({
          jsonMode: true,
          modelsEndpoint: true,
          maxTokensField: 'max_tokens',
        });
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