import { OpenAICompatibleProvider } from './openai-compatible.js';

/**
 * Chutes provider — extends OpenAICompatibleProvider with a per-model
 * capability preflight.
 *
 * Phase 2A classified Chutes as CA (Compatible with Adapter) because
 * Chutes' /models response includes a per-model 'supported_features'
 * field. Capability (JSON mode, vision) varies by model, not just by
 * provider. This override checks supported_features in addition to the
 * inherited architecture.modality check.
 *
 * The inherited analyzeImage, testConnection, and extractErrorMessage
 * methods are unchanged — Chutes is OpenAI-compatible for request/response.
 */
export class ChutesProvider extends OpenAICompatibleProvider {
  public override async validateModel(modelId: string): Promise<boolean> {
    // Inherit the existence check + architecture.modality warning from
    // the parent. If the model doesn't exist in /models, return false.
    const exists = await super.validateModel(modelId);
    if (!exists) return false;

    // Re-fetch /models to check supported_features. This duplicates the
    // parent's HTTP call, but keeps the override simple (no response
    // caching). The tradeoff: simplicity over DRY. If this becomes a
    // perf concern, cache the /models response in the parent.
    try {
      // Access the protected axios client via a cast — the parent's
      // client is private, but the override needs to make the same call.
      // Alternatively, refactor the parent to expose a protected
      // fetchModels() method (deferred — not Phase 2C scope).
      const response = await (this as any).client.get('/models', {
        headers: { 'Authorization': `Bearer ${(this as any).config.apiKey}` },
      });
      const models = response.data.data || [];
      const model = models.find((m: any) => m.id === modelId);
      const supportedFeatures: string[] = model?.supported_features || [];

      if (supportedFeatures.length > 0) {
        const hasVision = supportedFeatures.includes('vision') ||
                         supportedFeatures.includes('image');
        const hasJson = supportedFeatures.includes('json') ||
                       supportedFeatures.includes('json_object');
        if (!hasVision) {
          (this as any).logger.warn(
            `Chutes model '${modelId}' may not support vision (supported_features: ${JSON.stringify(supportedFeatures)})`
          );
        }
        if (!hasJson) {
          (this as any).logger.warn(
            `Chutes model '${modelId}' may not support JSON mode (supported_features: ${JSON.stringify(supportedFeatures)})`
          );
        }
      }
      // If supported_features is absent, trust the user's model id
      // (same as the parent's architecture.modality behavior).
    } catch {
      // If the /models fetch fails, the parent's check already passed;
      // don't fail validation on the features check alone.
    }

    return true;
  }
}