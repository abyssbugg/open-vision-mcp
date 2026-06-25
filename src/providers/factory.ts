import { OpenRouterConfig, ProviderId, VisionProvider } from '../types/index.js';
import { OpenRouterClient } from '../utils/openrouter-client.js';

/**
 * Construction point for VisionProvider instances.
 *
 * Phase 2B commit 1 widened the ProviderId union; the factory's switch is
 * updated in commit 4. Until then, the default arm is reached only if a
 * caller passes a widened id, which cannot happen until commit 5 wires
 * index.ts through the new config. The 'satisfies never' exhaustiveness
 * guard is temporarily relaxed here and restored in commit 4.
 */
export class ProviderFactory {
  static create(provider: ProviderId, config: OpenRouterConfig): VisionProvider {
    switch (provider) {
      case 'openrouter':
        return OpenRouterClient.getInstance(config);
      default:
        throw new Error(`Unknown provider: ${provider as string}`);
    }
  }
}