import { describe, it, expect, beforeEach, vi } from 'vitest';
import { handleAnalyzeMobileApp } from '../../src/tools/analyze-mobile-app.js';
import { ImageProcessor } from '../../src/utils/image-processor.js';
import { Logger } from '../../src/utils/logger.js';
import type { Config } from '../../src/config/index.js';
import type { VisionProvider } from '../../src/types/index.js';

vi.mock('../../src/utils/image-processor.js');
vi.mock('../../src/utils/logger.js');

const MockedImageProcessor = vi.mocked(ImageProcessor);

describe('handleAnalyzeMobileApp', () => {
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

  it('should successfully analyze mobile app screenshot with default settings', async () => {
    mockImageProcessor.processImage.mockResolvedValue({ data: 'd', mimeType: 'image/png', size: 100 });
    (mockProvider.analyzeImage as any).mockResolvedValue({ success: true, analysis: 'Mobile analysis', model: 'test' });

    const result = await handleAnalyzeMobileApp(
      { type: 'base64', data: 'd' },
      mockConfig, mockProvider, mockLogger
    );

    expect(result).toEqual({ content: [{ type: 'text', text: 'Mobile analysis' }] });
    // Default platform is auto-detect, default format is json
    expect(mockProvider.analyzeImage).toHaveBeenCalledWith(
      'd', 'image/png', expect.stringContaining('identify the platform'),
      expect.objectContaining({ format: 'json', maxTokens: 4000 })
    );
  });

  it('should analyze mobile app with iOS platform specified', async () => {
    mockImageProcessor.processImage.mockResolvedValue({ data: 'd', mimeType: 'image/png', size: 100 });
    (mockProvider.analyzeImage as any).mockResolvedValue({ success: true, analysis: 'iOS', model: 'test' });

    await handleAnalyzeMobileApp(
      { type: 'base64', data: 'd', platform: 'ios' },
      mockConfig, mockProvider, mockLogger
    );

    expect(mockProvider.analyzeImage).toHaveBeenCalledWith(
      'd', 'image/png', expect.stringContaining('This appears to be an IOS app'),
      expect.any(Object)
    );
  });

  it('should analyze mobile app with Android platform specified', async () => {
    mockImageProcessor.processImage.mockResolvedValue({ data: 'd', mimeType: 'image/png', size: 100 });
    (mockProvider.analyzeImage as any).mockResolvedValue({ success: true, analysis: 'Android', model: 'test' });

    await handleAnalyzeMobileApp(
      { type: 'base64', data: 'd', platform: 'android' },
      mockConfig, mockProvider, mockLogger
    );

    expect(mockProvider.analyzeImage).toHaveBeenCalledWith(
      'd', 'image/png', expect.stringContaining('This appears to be an ANDROID app'),
      expect.any(Object)
    );
  });

  it('should analyze mobile app with auto-detect platform', async () => {
    mockImageProcessor.processImage.mockResolvedValue({ data: 'd', mimeType: 'image/png', size: 100 });
    (mockProvider.analyzeImage as any).mockResolvedValue({ success: true, analysis: 'Auto', model: 'test' });

    await handleAnalyzeMobileApp(
      { type: 'base64', data: 'd', platform: 'auto-detect' },
      mockConfig, mockProvider, mockLogger
    );

    expect(mockProvider.analyzeImage).toHaveBeenCalledWith(
      'd', 'image/png', expect.stringContaining('identify the platform'),
      expect.any(Object)
    );
  });

  it('should analyze mobile app with different focus areas', async () => {
    const focusAssertions: Record<string, string> = {
      'ui-design': 'Focus specifically on UI design elements',
      'user-experience': 'Focus specifically on user experience',
      'navigation': 'Focus specifically on navigation patterns',
      'accessibility': 'Focus specifically on accessibility features',
      'performance': 'Focus specifically on performance indicators',
      'onboarding': 'Focus specifically on onboarding elements',
    };

    for (const focus of Object.keys(focusAssertions)) {
      mockImageProcessor.processImage.mockResolvedValue({ data: 'd', mimeType: 'image/png', size: 100 });
      (mockProvider.analyzeImage as any).mockResolvedValue({ success: true, analysis: 'x', model: 'test' });

      await handleAnalyzeMobileApp(
        { type: 'base64', data: 'd', focusArea: focus },
        mockConfig, mockProvider, mockLogger
      );

      const call = (mockProvider.analyzeImage as any).mock.calls[(mockProvider.analyzeImage as any).mock.calls.length - 1];
      expect(call[2]).toContain(focusAssertions[focus]);

      vi.clearAllMocks();
      MockedImageProcessor.getInstance = vi.fn(() => mockImageProcessor);
    }
  });

  it('should handle UX heuristics disabled', async () => {
    mockImageProcessor.processImage.mockResolvedValue({ data: 'd', mimeType: 'image/png', size: 100 });
    (mockProvider.analyzeImage as any).mockResolvedValue({ success: true, analysis: 'No heuristics', model: 'test' });

    await handleAnalyzeMobileApp(
      { type: 'base64', data: 'd', includeUXHeuristics: false },
      mockConfig, mockProvider, mockLogger
    );

    const call = (mockProvider.analyzeImage as any).mock.calls[(mockProvider.analyzeImage as any).mock.calls.length - 1];
    expect(call[2]).not.toContain("Nielsen");
  });

  it('should handle text format output', async () => {
    mockImageProcessor.processImage.mockResolvedValue({ data: 'd', mimeType: 'image/png', size: 100 });
    (mockProvider.analyzeImage as any).mockResolvedValue({ success: true, analysis: 'Text', model: 'test' });

    await handleAnalyzeMobileApp(
      { type: 'base64', data: 'd', format: 'text' },
      mockConfig, mockProvider, mockLogger
    );

    expect(mockProvider.analyzeImage).toHaveBeenCalledWith(
      'd', 'image/png', expect.any(String),
      expect.objectContaining({ format: 'text' })
    );
  });

  it('should handle URL input for mobile app screenshots', async () => {
    mockImageProcessor.processImage.mockResolvedValue({ data: 'urlb64', mimeType: 'image/png', size: 500 });
    (mockProvider.analyzeImage as any).mockResolvedValue({ success: true, analysis: 'URL mobile', model: 'test' });

    const result = await handleAnalyzeMobileApp(
      { type: 'url', data: 'https://example.com/app.png' },
      mockConfig, mockProvider, mockLogger
    );

    expect(mockImageProcessor.processImage).toHaveBeenCalledWith({
      type: 'url', data: 'https://example.com/app.png', mimeType: undefined,
    });
    expect(result).toEqual({ content: [{ type: 'text', text: 'URL mobile' }] });
  });

  it('should handle analysis errors gracefully', async () => {
    mockImageProcessor.processImage.mockResolvedValue({ data: 'd', mimeType: 'image/png', size: 100 });
    (mockProvider.analyzeImage as any).mockResolvedValue({ success: false, error: 'Provider error' });

    const result = await handleAnalyzeMobileApp(
      { type: 'base64', data: 'd' },
      mockConfig, mockProvider, mockLogger
    );

    expect(result).toEqual({
      content: [{ type: 'text', text: 'Error: Provider error' }],
      isError: true,
    });
  });
});