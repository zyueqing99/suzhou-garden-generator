import { describe, expect, it } from 'vitest';
import {
  isSafeImageUrl,
  normalizeProxyError,
  readJsonBodyWithLimit,
  resolveMaxBodyBytes,
  resolveVectorTimeoutMs,
} from './vectorEngineImageHandler.mjs';

describe('VectorEngine image handler', () => {
  it('uses a long default timeout for slow image generation jobs', () => {
    expect(resolveVectorTimeoutMs(undefined)).toBe(300000);
  });

  it('uses a 5MB default request body limit', () => {
    expect(resolveMaxBodyBytes(undefined)).toBe(5242880);
  });

  it('rejects private and local image URLs', () => {
    expect(isSafeImageUrl('http://localhost:3000/a.png')).toBe(false);
    expect(isSafeImageUrl('http://127.0.0.1/a.png')).toBe(false);
    expect(isSafeImageUrl('http://10.0.0.1/a.png')).toBe(false);
    expect(isSafeImageUrl('https://example.com/a.png')).toBe(true);
    expect(isSafeImageUrl('data:image/png;base64,abc')).toBe(true);
  });

  it('maps timeout errors to structured retryable proxy errors', () => {
    expect(normalizeProxyError(new Error('VectorEngine request timed out after 300s'))).toEqual({
      code: 'provider_timeout',
      message: 'Image generation timed out. You can retry; the site markup and generation controls are preserved.',
      retryable: true,
    });
  });

  it('rejects request bodies above the configured limit', async () => {
    const request = ReadableStream.from([Buffer.from('{"prompt":"'), Buffer.alloc(20, 'a'), Buffer.from('"}')]);

    await expect(readJsonBodyWithLimit(request, 10)).rejects.toMatchObject({
      code: 'request_too_large',
    });
  });
});
