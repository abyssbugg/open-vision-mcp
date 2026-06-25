import { describe, it, expect, beforeEach, vi } from 'vitest';
import { handleAnalyzeWebpage } from '../../src/tools/analyze-webpage.js';
import { ImageProcessor } from '../../src/utils/image-processor.js';
import { Logger } from '../../src/utils/logger.js';
import type { Config } from '../../src/config/index.js';
import type { VisionProvider } from '../../src/types/index.js';

vi.mock('../../src/utils/image-processor.js');
vi.mock('../../src/utils/logger.js');

const MockedImageProcessor = vi.mocked(ImageProcessor);

describe('handleAnalyzeWebpage', () => {
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

  it('should successfully analyze webpage screenshot with default settings', async () => {
    mockImageProcessor.processImage.mockResolvedValue({ data: 'base64data', mimeType: 'image/png', size: 1000 });
    (mockProvider.analyzeImage as any).mockResolvedValue({ success: true, analysis: 'Webpage analysis', model: 'test' });

    const result = await handleAnalyzeWebpage(
      { type: 'base64', data: 'base64data', mimeType: 'image/png' },
      mockConfig, mockProvider, mockLogger
    );

    expect(result).toEqual({ content: [{ type: 'text', text: 'Webpage analysis' }] });
    // Default format is 'json' for webpage
    expect(mockProvider.analyzeImage).toHaveBeenCalledWith(
      'base64data', 'image/png', expect.stringContaining('Analyze this webpage screenshot'),
      expect.objectContaining({ format: 'json', maxTokens: 4000 })
    );
  });

  it('should analyze webpage with specific focus area', async () => {
    mockImageProcessor.processImage.mockResolvedValue({ data: 'd', mimeType: 'image/png', size: 100 });
    (mockProvider.analyzeImage as any).mockResolvedValue({ success: true, analysis: 'Layout analysis', model: 'test' });

    await handleAnalyzeWebpage(
      { type: 'base64', data: 'd', focusArea: 'layout' },
      mockConfig, mockProvider, mockLogger
    );

    expect(mockProvider.analyzeImage).toHaveBeenCalledWith(
      'd', 'image/png', expect.stringContaining('Focus specifically on the layout structure'),
      expect.any(Object)
    );
  });

  it('should analyze webpage with accessibility analysis enabled', async () => {
    mockImageProcessor.processImage.mockResolvedValue({ data: 'd', mimeType: 'image/png', size: 100 });
    (mockProvider.analyzeImage as any).mockResolvedValue({ success: true, analysis: 'A11y analysis', model: 'test' });

    await handleAnalyzeWebpage(
      { type: 'base64', data: 'd', includeAccessibility: true, focusArea: 'accessibility' },
      mockConfig, mockProvider, mockLogger
    );

    expect(mockProvider.analyzeImage).toHaveBeenCalledWith(
      'd', 'image/png', expect.stringContaining('accessibility'),
      expect.any(Object)
    );
  });

  it('should analyze webpage with different focus areas', async () => {
    const focusAssertions: Record<string, string> = {
      content: 'Focus specifically on the content',
      navigation: 'Focus specifically on navigation elements',
      forms: 'Focus specifically on form elements',
      interactive: 'Focus specifically on interactive elements',
    };

    for (const focus of Object.keys(focusAssertions)) {
      mockImageProcessor.processImage.mockResolvedValue({ data: 'd', mimeType: 'image/png', size: 100 });
      (mockProvider.analyzeImage as any).mockResolvedValue({ success: true, analysis: 'x', model: 'test' });

      await handleAnalyzeWebpage(
        { type: 'base64', data: 'd', focusArea: focus },
        mockConfig, mockProvider, mockLogger
      );

      const call = (mockProvider.analyzeImage as any).mock.calls[(mockProvider.analyzeImage as any).mock.calls.length - 1];
      expect(call[2]).toContain(focusAssertions[focus]);

      vi.clearAllMocks();
      MockedImageProcessor.getInstance = vi.fn(() => mockImageProcessor);
    }
  });

  it('should handle text format output', async () => {
    mockImageProcessor.processImage.mockResolvedValue({ data: 'd', mimeType: 'image/png', size: 100 });
    (mockProvider.analyzeImage as any).mockResolvedValue({ success: true, analysis: 'Text output', model: 'test' });

    await handleAnalyzeWebpage(
      { type: 'base64', data: 'd', format: 'text' },
      mockConfig, mockProvider, mockLogger
    );

    expect(mockProvider.analyzeImage).toHaveBeenCalledWith(
      'd', 'image/png', expect.any(String),
      expect.objectContaining({ format: 'text' })
    );
  });

  it('should handle URL input for webpage screenshots', async () => {
    mockImageProcessor.processImage.mockResolvedValue({ data: 'urlb64', mimeType: 'image/png', size: 500 });
    (mockProvider.analyzeImage as any).mockResolvedValue({ success: true, analysis: 'URL webpage', model: 'test' });

    const result = await handleAnalyzeWebpage(
      { type: 'url', data: 'https://example.com/page.png' },
      mockConfig, mockProvider, mockLogger
    );

    expect(mockImageProcessor.processImage).toHaveBeenCalledWith({
      type: 'url', data: 'https://example.com/page.png', mimeType: undefined,
    });
    expect(result).toEqual({ content: [{ type: 'text', text: 'URL webpage' }] });
  });

  it('should handle analysis errors gracefully', async () => {
    mockImageProcessor.processImage.mockResolvedValue({ data: 'd', mimeType: 'image/png', size: 100 });
    (mockProvider.analyzeImage as any).mockResolvedValue({ success: false, error: 'Provider error' });

    const result = await handleAnalyzeWebpage(
      { type: 'base64', data: 'd' },
      mockConfig, mockProvider, mockLogger
    );

    expect(result).toEqual({
      content: [{ type: 'text', text: 'Error: Provider error' }],
      isError: true,
    });
  });
});