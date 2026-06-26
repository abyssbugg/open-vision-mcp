import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Config } from '../../src/config/index.js';

describe('Config', () => {
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    // Capture the original env ONCE per describe, not per test, so
    // afterEach restoration doesn't accumulate state across tests.
    if (!originalEnv) originalEnv = { ...process.env };
    (Config as any).instance = undefined;
    // Clear ALL relevant env vars to a known state, then set the baseline.
    delete process.env.PROVIDER;
    delete process.env.API_KEY;
    delete process.env.OPENROUTER_API_KEY;
    delete process.env.MODEL;
    delete process.env.OPENROUTER_MODEL;
    delete process.env.BASE_URL;
    delete process.env.OPENROUTER_BASE_URL;
    delete process.env.EXTRA_HEADERS;
    delete process.env.PORT;
    delete process.env.LOG_LEVEL;
    delete process.env.RETRY_ATTEMPTS;
    delete process.env.MAX_IMAGE_SIZE;
    process.env.API_KEY = 'test-api-key';
    process.env.MODEL = 'test-model';
    process.env.LOG_LEVEL = 'info';
  });

  afterEach(() => {
    (Config as any).instance = undefined;
    // Restore the original env captured once at the start.
    for (const k of Object.keys(process.env)) {
      if (!(k in (originalEnv || {}))) delete process.env[k];
    }
    if (originalEnv) for (const [k, v] of Object.entries(originalEnv)) process.env[k] = v as string;
  });

  describe('getInstance', () => {
    it('should return singleton instance', () => {
      const config1 = Config.getInstance();
      const config2 = Config.getInstance();
      expect(config1).toBe(config2);
    });
  });

  describe('required env vars', () => {
    it('should throw when API_KEY is missing and no legacy OPENROUTER_API_KEY', () => {
      delete process.env.API_KEY;
      delete process.env.OPENROUTER_API_KEY;
      expect(() => Config.getInstance()).toThrow(
        /API_KEY environment variable is required/
      );
    });

    it('should accept legacy OPENROUTER_API_KEY when API_KEY is unset', () => {
      delete process.env.API_KEY;
      process.env.OPENROUTER_API_KEY = 'legacy-key';
      process.env.PROVIDER = 'openrouter';
      const config = Config.getInstance();
      expect(config.getProviderConfig().apiKey).toBe('legacy-key');
    });
  });

  describe('PROVIDER resolution', () => {
    it('should default to openrouter when PROVIDER is unset', () => {
      delete process.env.PROVIDER;
      const config = Config.getInstance();
      expect(config.getProviderConfig().provider).toBe('openrouter');
    });

    it('should use PROVIDER when set', () => {
      process.env.PROVIDER = 'openai';
      const config = Config.getInstance();
      expect(config.getProviderConfig().provider).toBe('openai');
    });

    it('should throw on unknown PROVIDER with a list of valid values', () => {
      process.env.PROVIDER = 'invalid-provider';
      expect(() => Config.getInstance()).toThrow(/Unknown PROVIDER 'invalid-provider'/);
      expect(() => Config.getInstance()).toThrow(/openrouter, openai, together, deepinfra, fireworks, groq/);
    });
  });

  describe('per-provider defaults', () => {
    it('should use openrouter defaults (model + baseUrl + extraHeaders)', () => {
      delete process.env.PROVIDER;
      delete process.env.MODEL;
      delete process.env.BASE_URL;
      delete process.env.OPENROUTER_MODEL;
      delete process.env.OPENROUTER_BASE_URL;
      delete process.env.EXTRA_HEADERS;
      const config = Config.getInstance();
      const pc = config.getProviderConfig();
      expect(pc.provider).toBe('openrouter');
      expect(pc.model).toBe('anthropic/claude-3.5-sonnet');
      expect(pc.baseUrl).toBe('https://openrouter.ai/api/v1');
      expect(pc.extraHeaders).toEqual({
        'HTTP-Referer': 'https://github.com/openrouter-image-mcp',
        'X-Title': 'OpenRouter Image MCP',
      });
    });

    it('should use openai defaults (model + baseUrl, no extraHeaders)', () => {
      delete process.env.MODEL;
      delete process.env.BASE_URL;
      process.env.PROVIDER = 'openai';
      const config = Config.getInstance();
      const pc = config.getProviderConfig();
      expect(pc.model).toBe('gpt-4o');
      expect(pc.baseUrl).toBe('https://api.openai.com/v1');
      expect(pc.extraHeaders).toBeUndefined();
    });

    it('should use groq defaults', () => {
      delete process.env.MODEL;
      delete process.env.BASE_URL;
      process.env.PROVIDER = 'groq';
      const config = Config.getInstance();
      const pc = config.getProviderConfig();
      expect(pc.model).toBe('llama-3.2-90b-vision-preview');
      expect(pc.baseUrl).toBe('https://api.groq.com/openai/v1');
    });

    it('should use cerebras defaults (optimistic model, unverified vision)', () => {
      delete process.env.MODEL;
      delete process.env.BASE_URL;
      process.env.PROVIDER = 'cerebras';
      const config = Config.getInstance();
      const pc = config.getProviderConfig();
      expect(pc.model).toBe('llama-4-scout-17b-16e-instruct');
      expect(pc.baseUrl).toBe('https://api.cerebras.ai/v1');
    });

    it('should use chutes defaults (baseUrl, MODEL required)', () => {
      process.env.PROVIDER = 'chutes';
      process.env.MODEL = 'deepseek-ai/DeepSeek-V3-0324';
      delete process.env.BASE_URL;
      const config = Config.getInstance();
      const pc = config.getProviderConfig();
      expect(pc.baseUrl).toBe('https://llm.chutes.ai/v1');
      expect(pc.model).toBe('deepseek-ai/DeepSeek-V3-0324');
    });

    it('should throw when MODEL is required but unset (chutes)', () => {
      delete process.env.MODEL;
      delete process.env.OPENROUTER_MODEL;
      process.env.PROVIDER = 'chutes';
      expect(() => Config.getInstance()).toThrow(
        /MODEL environment variable is required for provider 'chutes'/
      );
    });

    it('should use azure config when BASE_URL is provided', () => {
      process.env.PROVIDER = 'azure';
      process.env.BASE_URL = 'https://myresource.openai.azure.com/openai/deployments/my-dep?api-version=2024-02-15-preview';
      delete process.env.MODEL;  // azure ignores MODEL (requiresExplicitModel: false)
      const config = Config.getInstance();
      const pc = config.getProviderConfig();
      expect(pc.provider).toBe('azure');
      expect(pc.baseUrl).toBe('https://myresource.openai.azure.com/openai/deployments/my-dep?api-version=2024-02-15-preview');
    });

    it('should throw when BASE_URL is missing for azure', () => {
      process.env.PROVIDER = 'azure';
      delete process.env.BASE_URL;
      delete process.env.OPENROUTER_BASE_URL;
      expect(() => Config.getInstance()).toThrow(
        /BASE_URL is required for provider 'azure'/
      );
    });

    it('should throw when BASE_URL is empty/whitespace for azure', () => {
      process.env.PROVIDER = 'azure';
      process.env.BASE_URL = '   ';
      expect(() => Config.getInstance()).toThrow(
        /BASE_URL is required for provider 'azure'/
      );
    });

    it('should throw when MODEL is required but unset (together)', () => {
      delete process.env.MODEL;
      delete process.env.OPENROUTER_MODEL;
      process.env.PROVIDER = 'together';
      expect(() => Config.getInstance()).toThrow(
        /MODEL environment variable is required for provider 'together'/
      );
    });

    it('should throw when MODEL is required but unset (deepinfra)', () => {
      delete process.env.MODEL;
      delete process.env.OPENROUTER_MODEL;
      process.env.PROVIDER = 'deepinfra';
      expect(() => Config.getInstance()).toThrow(
        /MODEL environment variable is required for provider 'deepinfra'/
      );
    });

    it('should throw when MODEL is required but unset (fireworks)', () => {
      delete process.env.MODEL;
      delete process.env.OPENROUTER_MODEL;
      process.env.PROVIDER = 'fireworks';
      expect(() => Config.getInstance()).toThrow(
        /MODEL environment variable is required for provider 'fireworks'/
      );
    });
  });

  describe('env-var precedence (new > legacy > default)', () => {
    it('API_KEY takes precedence over OPENROUTER_API_KEY', () => {
      process.env.API_KEY = 'new-key';
      process.env.OPENROUTER_API_KEY = 'legacy-key';
      process.env.PROVIDER = 'openrouter';
      const config = Config.getInstance();
      expect(config.getProviderConfig().apiKey).toBe('new-key');
    });

    it('MODEL takes precedence over OPENROUTER_MODEL', () => {
      process.env.MODEL = 'new-model';
      process.env.OPENROUTER_MODEL = 'legacy-model';
      process.env.PROVIDER = 'openrouter';
      const config = Config.getInstance();
      expect(config.getProviderConfig().model).toBe('new-model');
    });

    it('BASE_URL takes precedence over OPENROUTER_BASE_URL', () => {
      process.env.BASE_URL = 'http://new.example.com/v1';
      process.env.OPENROUTER_BASE_URL = 'http://legacy.example.com/v1';
      process.env.PROVIDER = 'openrouter';
      const config = Config.getInstance();
      expect(config.getProviderConfig().baseUrl).toBe('http://new.example.com/v1');
    });

    it('legacy vars are used when new vars are unset', () => {
      delete process.env.API_KEY;
      delete process.env.MODEL;
      delete process.env.BASE_URL;
      process.env.OPENROUTER_API_KEY = 'legacy-key';
      process.env.OPENROUTER_MODEL = 'legacy-model';
      process.env.OPENROUTER_BASE_URL = 'http://legacy.example.com/v1';
      process.env.PROVIDER = 'openrouter';
      const config = Config.getInstance();
      const pc = config.getProviderConfig();
      expect(pc.apiKey).toBe('legacy-key');
      expect(pc.model).toBe('legacy-model');
      expect(pc.baseUrl).toBe('http://legacy.example.com/v1');
    });
  });

  describe('EXTRA_HEADERS', () => {
    it('should parse valid JSON object', () => {
      process.env.EXTRA_HEADERS = '{"X-Custom":"test-value"}';
      process.env.PROVIDER = 'openai';
      const config = Config.getInstance();
      expect(config.getProviderConfig().extraHeaders).toEqual({ 'X-Custom': 'test-value' });
    });

    it('should reject malformed JSON with a clear error', () => {
      process.env.EXTRA_HEADERS = '{not-json}';
      process.env.PROVIDER = 'openai';
      expect(() => Config.getInstance()).toThrow(/EXTRA_HEADERS.*not valid JSON/);
    });

    it('should reject non-object JSON (array)', () => {
      process.env.EXTRA_HEADERS = '["not","an","object"]';
      process.env.PROVIDER = 'openai';
      expect(() => Config.getInstance()).toThrow(/EXTRA_HEADERS/);
    });

    it('should fall back to per-provider default extraHeaders when EXTRA_HEADERS is unset (openrouter)', () => {
      delete process.env.EXTRA_HEADERS;
      process.env.PROVIDER = 'openrouter';
      delete process.env.MODEL;
      delete process.env.BASE_URL;
      const config = Config.getInstance();
      expect(config.getProviderConfig().extraHeaders).toEqual({
        'HTTP-Referer': 'https://github.com/openrouter-image-mcp',
        'X-Title': 'OpenRouter Image MCP',
      });
    });

    it('should have no extraHeaders when unset and provider has no default (openai)', () => {
      delete process.env.EXTRA_HEADERS;
      process.env.PROVIDER = 'openai';
      const config = Config.getInstance();
      expect(config.getProviderConfig().extraHeaders).toBeUndefined();
    });
  });

  describe('custom env values', () => {
    it('should use custom MODEL and BASE_URL when set', () => {
      process.env.MODEL = 'custom-model';
      process.env.BASE_URL = 'https://custom.api.com/v1';
      process.env.PROVIDER = 'openai';
      const config = Config.getInstance();
      const pc = config.getProviderConfig();
      expect(pc.model).toBe('custom-model');
      expect(pc.baseUrl).toBe('https://custom.api.com/v1');
    });
  });

  describe('ServerConfig', () => {
    it('should use default values when optional env vars are not set', () => {
      delete process.env.PORT;
      delete process.env.LOG_LEVEL;
      delete process.env.RETRY_ATTEMPTS;
      delete process.env.MAX_IMAGE_SIZE;
      const config = Config.getInstance();
      const sc = config.getServerConfig();
      expect(sc.port).toBe(3000);
      expect(sc.logLevel).toBe('info');
      expect(sc.retryAttempts).toBe(3);
      expect(sc.maxImageSize).toBe(10485760);
    });

    it('should use custom values when env vars are set', () => {
      process.env.PORT = '8080';
      process.env.LOG_LEVEL = 'debug';
      process.env.RETRY_ATTEMPTS = '5';
      process.env.MAX_IMAGE_SIZE = '20971520';
      const config = Config.getInstance();
      const sc = config.getServerConfig();
      expect(sc.port).toBe(8080);
      expect(sc.logLevel).toBe('debug');
      expect(sc.retryAttempts).toBe(5);
      expect(sc.maxImageSize).toBe(20971520);
    });
  });
});