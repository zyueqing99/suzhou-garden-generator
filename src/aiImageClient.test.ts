import { describe, expect, it } from 'vitest';
import { buildAiImageRequest, buildSiteImagePrompt, extractErrorMessage, extractGenerationError, extractImageUrl } from './aiImageClient';
import type { GardenParameters } from './gardenGenerator';
import type { SiteAnalysisData } from './siteAnalysis';

const parameters: GardenParameters = {
  courtyardScale: 72,
  waterRatio: 45,
  rockDensity: 54,
  plantingDensity: 66,
  pathCurvature: 58,
  buildingStyle: 'scholar',
  focalPoint: 'pavilion',
};

const siteAnalysis: SiteAnalysisData = {
  siteBoundary: '已确认',
  buildingFootprint: '已确认',
  mainEntrance: '西南侧',
  mainViewSide: '建筑南侧',
  neighborInterface: '西侧',
  borrowedViewDirection: '东南侧',
  screeningRequired: ['西侧', '入口直视方向'],
};

describe('aiImageClient', () => {
  it('从带标注场地图约束构建图像生成 prompt', () => {
    const prompt = buildSiteImagePrompt({
      projectName: '苏式庭院方案',
      siteAnalysis,
      parameters,
      customDirection: '强调茶庭收束',
    });

    expect(prompt).toContain('Use the provided annotated site image as the primary constraint');
    expect(prompt).toContain('场地解析 JSON');
    expect(prompt).toContain('"mainEntrance": "西南侧"');
    expect(prompt).toContain('water ratio 45%');
    expect(prompt).toContain('曲径通幽');
    expect(prompt).toContain('强调茶庭收束');
    expect(prompt).not.toContain('SVG');
  });

  it('uses reference images for image-to-image generation when provided', () => {
    expect(buildAiImageRequest({ mode: 'generate', prompt: 'garden', referenceImageUrl: 'data:image/png;base64,abc' })).toMatchObject({
      mode: 'edit',
      prompt: 'garden',
      imageUrl: 'data:image/png;base64,abc',
    });

    expect(buildAiImageRequest({ mode: 'generate', prompt: 'garden', referenceImageUrl: null })).toMatchObject({
      mode: 'generate',
      prompt: 'garden',
      imageUrl: undefined,
    });
  });

  it('extracts generated image URLs from provider responses', () => {
    expect(extractImageUrl({ data: [{ url: 'https://example.com/a.webp' }] })).toBe('https://example.com/a.webp');
    expect(extractImageUrl({ data: [{ b64_json: 'abc' }] })).toBe('data:image/png;base64,abc');
    expect(extractImageUrl({ choices: [{ message: { content: 'https://example.com/from-content.png' } }] })).toBe('https://example.com/from-content.png');
  });

  it('extracts provider error messages from common response shapes', () => {
    expect(extractErrorMessage({ error: 'missing key' })).toBe('missing key');
    expect(extractErrorMessage({ error: { message: 'bad prompt' } })).toBe('bad prompt');
    expect(extractErrorMessage({ message: 'rate limited' })).toBe('rate limited');
  });

  it('extracts structured generation errors from proxy responses', () => {
    expect(
      extractGenerationError({
        error: {
          code: 'provider_timeout',
          message: 'Image generation timed out.',
          retryable: true,
        },
      }),
    ).toEqual({
      code: 'provider_timeout',
      message: 'Image generation timed out.',
      retryable: true,
    });
  });
});
