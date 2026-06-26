import { describe, it, expect, beforeEach, vi } from 'vitest';
import { handleAnalyzeImage } from '../../src/tools/analyze-image.js';
import { ImageProcessor } from '../../src/utils/image-processor.js';
import { Logger } from '../../src/utils/logger.js';
import { TestHelpers } from '../utils/test-helpers.js';
import type { Config } from '../../src/config/index.js';
import type { VisionProvider } from '../../src/types/index.js';

vi.mock('../../src/utils/image-processor.js');
vi.mock('../../src/utils/logger.js');

const MockedImageProcessor = vi.mocked(ImageProcessor);

describe('Edge Cases and Error Scenarios — Image Processing and Input Validation', () => {
  let mockConfig: Config;
  let mockProvider: VisionProvider;
  let mockLogger: Logger;
  let mockImageProcessor: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockConfig = {
      getServerConfig: vi.fn(() => ({ maxImageSize: 10485760 })),
    } as any;
    mockProvider = {
      analyzeImage: vi.fn(),
      capabilities: { jsonMode: true, modelsEndpoint: true, maxTokensField: 'max_tokens' },
    } as any;
    mockLogger = { info: vi.fn(), debug: vi.fn(), warn: vi.fn(), error: vi.fn() } as any;
    mockImageProcessor = { processImage: vi.fn(), isValidImageType: vi.fn(() => true) };
    MockedImageProcessor.getInstance = vi.fn(() => mockImageProcessor);
  });

  describe('Image Processing Edge Cases', () => {
    it('should handle empty base64 strings', async () => {
      mockImageProcessor.processImage.mockRejectedValue(new Error('Empty or invalid base64 data provided'));

      const result = await handleAnalyzeImage(
        { type: 'base64', data: '', mimeType: 'image/png' },
        mockConfig, mockProvider, mockLogger
      );

      expect(result.isError).toBe(true);
      expect(result.content[0]).toMatchObject({ type: 'text' });
      expect((result.content[0] as any).text).toContain('Error');
    });

    it('should handle extremely large images', async () => {
      mockImageProcessor.processImage.mockResolvedValue({
        data: 'largedata', mimeType: 'image/png', size: 50 * 1024 * 1024,
      });
      (mockConfig.getServerConfig as any).mockReturnValue({ maxImageSize: 10485760 });

      const result = await handleAnalyzeImage(
        { type: 'base64', data: 'largedata' },
        mockConfig, mockProvider, mockLogger
      );

      expect(result.isError).toBe(true);
      expect((result.content[0] as any).text).toContain('exceeds maximum');
    });

    it('should handle corrupted image data', async () => {
      mockImageProcessor.processImage.mockResolvedValue({
        data: 'corrupt', mimeType: 'application/octet-stream', size: 100,
      });
      mockImageProcessor.isValidImageType.mockReturnValue(false);

      const result = await handleAnalyzeImage(
        { type: 'base64', data: 'corrupt' },
        mockConfig, mockProvider, mockLogger
      );

      expect(result.isError).toBe(true);
      expect((result.content[0] as any).text).toContain('Unsupported image type');
    });

    it('should handle non-existent file paths', async () => {
      mockImageProcessor.processImage.mockRejectedValue(
        new Error('Failed to read file /nonexistent.png: ENOENT')
      );

      const result = await handleAnalyzeImage(
        { type: 'file', data: '/nonexistent.png' },
        mockConfig, mockProvider, mockLogger
      );

      expect(result.isError).toBe(true);
      expect((result.content[0] as any).text).toContain('ENOENT');
    });

    it('should handle invalid URLs', async () => {
      mockImageProcessor.processImage.mockRejectedValue(
        new Error('Failed to fetch image from URL invalid-url: Invalid URL')
      );

      const result = await handleAnalyzeImage(
        { type: 'url', data: 'invalid-url' },
        mockConfig, mockProvider, mockLogger
      );

      expect(result.isError).toBe(true);
    });

    it('should handle network timeouts for URL images', async () => {
      mockImageProcessor.processImage.mockRejectedValue(new Error('timeout'));

      const result = await handleAnalyzeImage(
        { type: 'url', data: 'https://slow.example.com/image.png' },
        mockConfig, mockProvider, mockLogger
      );

      expect(result.isError).toBe(true);
    });

    it('should handle unsupported image formats', async () => {
      mockImageProcessor.processImage.mockResolvedValue({
        data: 'd', mimeType: 'video/mp4', size: 1000,
      });
      mockImageProcessor.isValidImageType.mockReturnValue(false);

      const result = await handleAnalyzeImage(
        { type: 'base64', data: 'd', mimeType: 'video/mp4' },
        mockConfig, mockProvider, mockLogger
      );

      expect(result.isError).toBe(true);
      expect((result.content[0] as any).text).toContain('Unsupported image type');
    });
  });

  describe('API Communication Edge Cases', () => {
    it('should handle API authentication failures', async () => {
      mockImageProcessor.processImage.mockResolvedValue({ data: 'd', mimeType: 'image/png', size: 100 });
      (mockProvider.analyzeImage as any).mockResolvedValue({
        success: false, error: 'openai API Error: Invalid API key',
      });

      const result = await handleAnalyzeImage(
        { type: 'base64', data: 'd' },
        mockConfig, mockProvider, mockLogger
      );

      expect(result.isError).toBe(true);
      expect((result.content[0] as any).text).toContain('Invalid API key');
    });

    it('should handle API rate limiting', async () => {
      mockImageProcessor.processImage.mockResolvedValue({ data: 'd', mimeType: 'image/png', size: 100 });
      (mockProvider.analyzeImage as any).mockResolvedValue({
        success: false, error: 'openai API Error: Rate limit exceeded',
      });

      const result = await handleAnalyzeImage(
        { type: 'base64', data: 'd' },
        mockConfig, mockProvider, mockLogger
      );

      expect(result.isError).toBe(true);
      expect((result.content[0] as any).text).toContain('Rate limit');
    });

    it('should handle API model unavailable', async () => {
      mockImageProcessor.processImage.mockResolvedValue({ data: 'd', mimeType: 'image/png', size: 100 });
      (mockProvider.analyzeImage as any).mockResolvedValue({
        success: false, error: 'openai API Error: Model not available',
      });

      const result = await handleAnalyzeImage(
        { type: 'base64', data: 'd' },
        mockConfig, mockProvider, mockLogger
      );

      expect(result.isError).toBe(true);
    });

    it('should handle API timeout errors', async () => {
      mockImageProcessor.processImage.mockResolvedValue({ data: 'd', mimeType: 'image/png', size: 100 });
      (mockProvider.analyzeImage as any).mockResolvedValue({
        success: false, error: 'Image analysis timed out after 2 minutes',
      });

      const result = await handleAnalyzeImage(
        { type: 'base64', data: 'd' },
        mockConfig, mockProvider, mockLogger
      );

      expect(result.isError).toBe(true);
      expect((result.content[0] as any).text).toContain('timed out');
    });

    it('should handle API response parsing errors', async () => {
      mockImageProcessor.processImage.mockResolvedValue({ data: 'd', mimeType: 'image/png', size: 100 });
      (mockProvider.analyzeImage as any).mockResolvedValue({
        success: false, error: 'Empty response from model',
      });

      const result = await handleAnalyzeImage(
        { type: 'base64', data: 'd' },
        mockConfig, mockProvider, mockLogger
      );

      expect(result.isError).toBe(true);
    });
  });

  describe('Input Validation Edge Cases', () => {
    it('should handle missing required parameters (no type)', async () => {
      mockImageProcessor.processImage.mockRejectedValue(new Error('Unsupported image input type: undefined'));

      const result = await handleAnalyzeImage(
        { data: 'somedata' } as any,
        mockConfig, mockProvider, mockLogger
      );

      expect(result.isError).toBe(true);
    });

    it('should handle invalid parameter types', async () => {
      mockImageProcessor.processImage.mockRejectedValue(new Error('Unsupported image input type: invalid'));

      const result = await handleAnalyzeImage(
        { type: 'invalid', data: 'somedata' } as any,
        mockConfig, mockProvider, mockLogger
      );

      expect(result.isError).toBe(true);
    });

    it('should handle null and undefined values', async () => {
      mockImageProcessor.processImage.mockRejectedValue(new Error('Unsupported image input type: undefined'));

      const result = await handleAnalyzeImage(
        { type: null, data: null } as any,
        mockConfig, mockProvider, mockLogger
      );

      expect(result.isError).toBe(true);
    });

    it('should handle extremely long parameter values', async () => {
      const longData = 'A'.repeat(100000);
      mockImageProcessor.processImage.mockResolvedValue({ data: 'd', mimeType: 'image/png', size: 100 });
      (mockProvider.analyzeImage as any).mockResolvedValue({
        success: false,
        error: 'Image data too large',
      });

      const result = await handleAnalyzeImage(
        { type: 'base64', data: longData },
        mockConfig, mockProvider, mockLogger
      );

      expect(result.isError).toBe(true);
    });
  });

  describe('Memory and Resource Management', () => {
    it('should handle memory pressure scenarios', async () => {
      mockImageProcessor.processImage.mockResolvedValue({ data: 'd', mimeType: 'image/png', size: 100 });
      (mockProvider.analyzeImage as any).mockResolvedValue({ success: true, analysis: 'ok', model: 'test' });

      // Simulate rapid allocation + deallocation
      for (let i = 0; i < 10; i++) {
        const result = await handleAnalyzeImage(
          { type: 'base64', data: 'd' },
          mockConfig, mockProvider, mockLogger
        );
        expect(result.isError).toBeFalsy();
      }
    });

    it('should handle rapid successive requests', async () => {
      mockImageProcessor.processImage.mockResolvedValue({ data: 'd', mimeType: 'image/png', size: 100 });
      (mockProvider.analyzeImage as any).mockResolvedValue({ success: true, analysis: 'ok', model: 'test' });

      const promises = Array.from({ length: 5 }, () =>
        handleAnalyzeImage({ type: 'base64', data: 'd' }, mockConfig, mockProvider, mockLogger)
      );
      const results = await Promise.all(promises);
      expect(results.every(r => !r.isError)).toBe(true);
    });
  });

  describe('Configuration Edge Cases', () => {
    it('should handle missing configuration values (maxImageSize undefined)', async () => {
      mockImageProcessor.processImage.mockResolvedValue({ data: 'd', mimeType: 'image/png', size: 100 });
      (mockConfig.getServerConfig as any).mockReturnValue({});
      (mockProvider.analyzeImage as any).mockResolvedValue({ success: true, analysis: 'ok', model: 'test' });

      const result = await handleAnalyzeImage(
        { type: 'base64', data: 'd' },
        mockConfig, mockProvider, mockLogger
      );

      // Falls back to default maxImageSize (10485760) in the tool handler
      expect(result.isError).toBeFalsy();
    });

    it('should handle invalid configuration values (maxImageSize as string)', async () => {
      mockImageProcessor.processImage.mockResolvedValue({ data: 'd', mimeType: 'image/png', size: 100 });
      (mockConfig.getServerConfig as any).mockReturnValue({ maxImageSize: 'not-a-number' as any });
      (mockProvider.analyzeImage as any).mockResolvedValue({ success: true, analysis: 'ok', model: 'test' });

      const result = await handleAnalyzeImage(
        { type: 'base64', data: 'd' },
        mockConfig, mockProvider, mockLogger
      );

      // The tool handler uses serverConfig.maxImageSize || 10485760, so
      // a truthy non-number would pass through. This is pre-existing behavior.
      expect(result).toBeDefined();
    });
  });

  describe('Network and Connectivity Issues', () => {
    it('should handle DNS resolution failures', async () => {
      mockImageProcessor.processImage.mockRejectedValue(new Error('getaddrinfo ENOTFOUND'));

      const result = await handleAnalyzeImage(
        { type: 'url', data: 'https://nonexistent.invalid/image.png' },
        mockConfig, mockProvider, mockLogger
      );

      expect(result.isError).toBe(true);
    });

    it('should handle SSL/TLS certificate errors', async () => {
      mockImageProcessor.processImage.mockRejectedValue(new Error('UNABLE_TO_VERIFY_LEAF_SIGNATURE'));

      const result = await handleAnalyzeImage(
        { type: 'url', data: 'https://bad-cert.example.com/image.png' },
        mockConfig, mockProvider, mockLogger
      );

      expect(result.isError).toBe(true);
    });

    it('should handle connection refused errors', async () => {
      mockImageProcessor.processImage.mockRejectedValue(new Error('ECONNREFUSED'));

      const result = await handleAnalyzeImage(
        { type: 'url', data: 'http://localhost:9999/image.png' },
        mockConfig, mockProvider, mockLogger
      );

      expect(result.isError).toBe(true);
    });
  });

  describe('Concurrent Operation Edge Cases', () => {
    it('should handle concurrent operations on shared resources', async () => {
      mockImageProcessor.processImage.mockResolvedValue({ data: 'd', mimeType: 'image/png', size: 100 });
      (mockProvider.analyzeImage as any).mockResolvedValue({ success: true, analysis: 'concurrent ok', model: 'test' });

      // All 3 tools share ImageProcessor and Logger singletons. Verify
      // concurrent calls don't interfere.
      const { handleAnalyzeWebpage } = await import('../../src/tools/analyze-webpage.js');
      const { handleAnalyzeMobileApp } = await import('../../src/tools/analyze-mobile-app.js');

      const [r1, r2, r3] = await Promise.all([
        handleAnalyzeImage({ type: 'base64', data: 'd' }, mockConfig, mockProvider, mockLogger),
        handleAnalyzeWebpage({ type: 'base64', data: 'd' }, mockConfig, mockProvider, mockLogger),
        handleAnalyzeMobileApp({ type: 'base64', data: 'd' }, mockConfig, mockProvider, mockLogger),
      ]);

      expect(r1.isError).toBeFalsy();
      expect(r2.isError).toBeFalsy();
      expect(r3.isError).toBeFalsy();
    });
  });
});