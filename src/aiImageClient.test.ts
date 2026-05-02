import { describe, expect, it } from 'vitest';
import { buildGardenImagePrompt, extractErrorMessage, extractGenerationError, extractImageUrl } from './aiImageClient';
import type { GardenParameters, GardenPlan } from './gardenGenerator';

const parameters: GardenParameters = {
  courtyardScale: 72,
  waterRatio: 45,
  rockDensity: 54,
  plantingDensity: 66,
  pathCurvature: 58,
  buildingStyle: 'scholar',
  focalPoint: 'pavilion',
};

const plan: GardenPlan = {
  name: '书香亭榭方案',
  width: 1080,
  height: 760,
  seed: 11,
  summary: ['水体占比 45%', '植物密度 66%'],
  elements: [],
};

describe('aiImageClient', () => {
  it('builds a Suzhou garden prompt from plan parameters', () => {
    const prompt = buildGardenImagePrompt(plan, parameters);

    expect(prompt).toContain('苏式庭院');
    expect(prompt).toContain('书香亭榭方案');
    expect(prompt).toContain('亭榭');
    expect(prompt).toContain('top-down');
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
