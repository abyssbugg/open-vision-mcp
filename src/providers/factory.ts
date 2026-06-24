import { OpenRouterConfig, ProviderId, VisionProvider } from '../types/index.js';
import { OpenRouterClient } from '../utils/openrouter-client.js';

/**
 * Construction point for VisionProvider instances.
 *
 * Phase 1: only 'openrouter' is implemented. The default arm throws so any
 * unsupported id fails fast at the wiring point rather than silently falling
 * through. 'satisfies never' keeps the default exhaustiveness-checked: if a
 * new ProviderId member is added later without a corresponding case, TypeScript
 * flags it.
 *
 * Phase 2 will add cases without modifying this signature or any existing
 * call site.
 */
export class ProviderFactory {
  static create(provider: ProviderId, config: OpenRouterConfig): VisionProvider {
    switch (provider) {
      case 'openrouter':
        return OpenRouterClient.getInstance(config);
      default:
        throw new Error(`Unknown provider: ${provider satisfies never}`);
    }
  }
}