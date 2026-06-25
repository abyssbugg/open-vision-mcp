import { describe, it, expect, beforeEach, vi } from 'vitest';
import { handleAnalyzeImage } from '../../src/tools/analyze-image.js';
import { ImageProcessor } from '../../src/utils/image-processor.js';
import { Logger } from '../../src/utils/logger.js';
import type { Config } from '../../src/config/index.js';
import type { VisionProvider } from '../../src/types/index.js';

// Mock ImageProcessor (singleton) and Logger (singleton)
vi.mock('../../src/utils/image-processor.js');
vi.mock('../../src/utils/logger.js');

const MockedImageProcessor = vi.mocked(ImageProcessor);

describe('handleAnalyzeImage', () => {
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

    mockLogger = {
      info: vi.fn(),
      debug: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
    } as any;

    mockImageProcessor = {
      processImage: vi.fn(),
      isValidImageType: vi.fn(() => true),
    };
    MockedImageProcessor.getInstance = vi.fn(() => mockImageProcessor);
  });

  describe('input types', () => {
    it('should successfully analyze image with base64 input', async () => {
      const mockProcessedImage = { data: 'base64imagedata', mimeType: 'image/png', size: 1000 };
      const mockAnalysisResult = {
        success: true,
        analysis: 'This is a detailed image analysis',
        model: 'test-model',
        usage: { promptTokens: 50, completionTokens: 100, totalTokens: 150 },
      };

      mockImageProcessor.processImage.mockResolvedValue(mockProcessedImage);
      (mockProvider.analyzeImage as any).mockResolvedValue(mockAnalysisResult);

      const args = {
        type: 'base64',
        data: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
        mimeType: 'image/png',
        prompt: 'Analyze this image',
        format: 'text',
        maxTokens: 2000,
        temperature: 0.5,
      };

      const result = await handleAnalyzeImage(args, mockConfig, mockProvider, mockLogger);

      expect(mockImageProcessor.processImage).toHaveBeenCalledWith({
        type: 'base64',
        data: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
        mimeType: 'image/png',
      });

      expect(mockProvider.analyzeImage).toHaveBeenCalledWith(
        'base64imagedata',
        'image/png',
        'Analyze this image',
        { format: 'text', maxTokens: 2000, temperature: 0.5, prompt: 'Analyze this image' }
      );

      expect(result).toEqual({
        content: [{ type: 'text', text: 'This is a detailed image analysis' }],
      });
    });

    it('should successfully analyze image with file input', async () => {
      const mockProcessedImage = { data: 'base64fromfile', mimeType: 'image/jpeg', size: 2000 };
      const mockAnalysisResult = { success: true, analysis: 'File image analysis', model: 'test-model' };

      mockImageProcessor.processImage.mockResolvedValue(mockProcessedImage);
      (mockProvider.analyzeImage as any).mockResolvedValue(mockAnalysisResult);

      const result = await handleAnalyzeImage(
        { type: 'file', data: '/path/to/image.jpg' },
        mockConfig, mockProvider, mockLogger
      );

      expect(mockImageProcessor.processImage).toHaveBeenCalledWith({
        type: 'file', data: '/path/to/image.jpg', mimeType: undefined,
      });

      expect(mockProvider.analyzeImage).toHaveBeenCalledWith(
        'base64fromfile',
        'image/jpeg',
        'Analyze this image in detail. Describe what you see, including objects, people, text, and any notable features.',
        {}
      );

      expect(result).toEqual({
        content: [{ type: 'text', text: 'File image analysis' }],
      });
    });

    it('should successfully analyze image with URL input', async () => {
      const mockProcessedImage = { data: 'base64fromurl', mimeType: 'image/webp', size: 3000 };
      const mockAnalysisResult = { success: true, analysis: 'URL image analysis', model: 'test-model' };

      mockImageProcessor.processImage.mockResolvedValue(mockProcessedImage);
      (mockProvider.analyzeImage as any).mockResolvedValue(mockAnalysisResult);

      const result = await handleAnalyzeImage(
        { type: 'url', data: 'https://example.com/image.webp', format: 'json' },
        mockConfig, mockProvider, mockLogger
      );

      expect(mockImageProcessor.processImage).toHaveBeenCalledWith({
        type: 'url', data: 'https://example.com/image.webp', mimeType: undefined,
      });

      expect(mockProvider.analyzeImage).toHaveBeenCalledWith(
        'base64fromurl',
        'image/webp',
        'Analyze this image in detail. Describe what you see, including objects, people, text, and any notable features.',
        { format: 'json' }
      );

      expect(result).toEqual({
        content: [{ type: 'text', text: 'URL image analysis' }],
      });
    });
  });

  describe('validation', () => {
    it('should reject unsupported image types', async () => {
      const mockProcessedImage = { data: 'basedata', mimeType: 'application/pdf', size: 1000 };
      mockImageProcessor.processImage.mockResolvedValue(mockProcessedImage);
      mockImageProcessor.isValidImageType.mockReturnValue(false);

      const result = await handleAnalyzeImage(
        { type: 'base64', data: 'basedata', mimeType: 'application/pdf' },
        mockConfig, mockProvider, mockLogger
      );

      expect(result).toEqual({
        content: [{ type: 'text', text: 'Error: Unsupported image type: application/pdf' }],
        isError: true,
      });
    });

    it('should reject images that exceed maximum size', async () => {
      const mockProcessedImage = { data: 'largedata', mimeType: 'image/png', size: 20971520 };
      mockImageProcessor.processImage.mockResolvedValue(mockProcessedImage);
      (mockConfig.getServerConfig as any).mockReturnValue({ maxImageSize: 10485760 });

      const result = await handleAnalyzeImage(
        { type: 'base64', data: 'largedata' },
        mockConfig, mockProvider, mockLogger
      );

      expect(result).toEqual({
        content: [{ type: 'text', text: 'Error: Image size 20971520 exceeds maximum allowed size 10485760' }],
        isError: true,
      });
    });
  });

  describe('error handling', () => {
    it('should handle image processing errors', async () => {
      mockImageProcessor.processImage.mockRejectedValue(new Error('Failed to process image'));

      const result = await handleAnalyzeImage(
        { type: 'file', data: '/nonexistent/file.jpg' },
        mockConfig, mockProvider, mockLogger
      );

      expect(result).toEqual({
        content: [{ type: 'text', text: 'Error: Failed to process image' }],
        isError: true,
      });
    });

    it('should handle provider API errors', async () => {
      const mockProcessedImage = { data: 'basedata', mimeType: 'image/png', size: 1000 };
      mockImageProcessor.processImage.mockResolvedValue(mockProcessedImage);
      (mockProvider.analyzeImage as any).mockResolvedValue({
        success: false, error: 'API rate limit exceeded',
      });

      const result = await handleAnalyzeImage(
        { type: 'base64', data: 'basedata' },
        mockConfig, mockProvider, mockLogger
      );

      expect(result).toEqual({
        content: [{ type: 'text', text: 'Error: API rate limit exceeded' }],
        isError: true,
      });
    });

    it('should handle cases where analysis result has no content', async () => {
      const mockProcessedImage = { data: 'basedata', mimeType: 'image/png', size: 1000 };
      mockImageProcessor.processImage.mockResolvedValue(mockProcessedImage);
      (mockProvider.analyzeImage as any).mockResolvedValue({ success: true, analysis: undefined });

      const result = await handleAnalyzeImage(
        { type: 'base64', data: 'basedata' },
        mockConfig, mockProvider, mockLogger
      );

      expect(result).toEqual({
        content: [{ type: 'text', text: 'No analysis available' }],
      });
    });
  });

  describe('defaults', () => {
    it('should use default options when not provided', async () => {
      const mockProcessedImage = { data: 'basedata', mimeType: 'image/png', size: 1000 };
      const mockAnalysisResult = { success: true, analysis: 'Analysis with defaults', model: 'test-model' };
      mockImageProcessor.processImage.mockResolvedValue(mockProcessedImage);
      (mockProvider.analyzeImage as any).mockResolvedValue(mockAnalysisResult);

      await handleAnalyzeImage(
        { type: 'base64', data: 'basedata' },
        mockConfig, mockProvider, mockLogger
      );

      expect(mockProvider.analyzeImage).toHaveBeenCalledWith(
        'basedata',
        'image/png',
        'Analyze this image in detail. Describe what you see, including objects, people, text, and any notable features.',
        {}
      );
    });
  });
});