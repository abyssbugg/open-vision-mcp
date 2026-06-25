import {
  ProviderCapabilities,
  ProviderConfig,
  ProviderId,
  VisionProvider,
} from '../types/index.js';
import { OpenAICompatibleProvider } from './openai-compatible.js';

/**
 * Per-provider capability descriptor. All six Phase 2B providers are
 * OpenAI-compatible and support json_object mode, expose /models, and use
 * the max_tokens field. Phase 2C may diverge (e.g. Azure has no /models).
 */
const PROVIDER_CAPABILITIES: Record<ProviderId, ProviderCapabilities> = {
  openrouter: { jsonMode: true, modelsEndpoint: true, maxTokensField: 'max_tokens' },
  openai: { jsonMode: true, modelsEndpoint: true, maxTokensField: 'max_tokens' },
  together: { jsonMode: true, modelsEndpoint: true, maxTokensField: 'max_tokens' },
  deepinfra: { jsonMode: true, modelsEndpoint: true, maxTokensField: 'max_tokens' },
  fireworks: { jsonMode: true, modelsEndpoint: true, maxTokensField: 'max_tokens' },
  groq: { jsonMode: true, modelsEndpoint: true, maxTokensField: 'max_tokens' },
};

/**
 * Construction point for VisionProvider instances.
 *
 * Phase 2B: all six fully-compatible providers resolve to a single shared
 * OpenAICompatibleProvider instance, differing only in configuration
 * (baseUrl, extraHeaders) and the injected capability descriptor. The
 * default arm is exhaustiveness-checked: 'satisfies never' ensures that
 * if a new ProviderId member is added without a corresponding case,
 * TypeScript flags it.
 *
 * Phase 2C will add 'chutes', 'cerebras', and 'azure' cases. The 'azure'
 * case will require a dedicated adapter (different auth scheme), but the
 * factory signature and call sites do not change.
 */
export class ProviderFactory {
  static create(config: ProviderConfig): VisionProvider {
    const capabilities = PROVIDER_CAPABILITIES[config.provider];
    switch (config.provider) {
      case 'openrouter':
      case 'openai':
      case 'together':
      case 'deepinfra':
      case 'fireworks':
      case 'groq':
        return new OpenAICompatibleProvider(config, capabilities);
      default:
        throw new Error(`Unknown provider: ${config.provider satisfies never}`);
    }
  }
}