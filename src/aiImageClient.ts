import type { GenerationError } from './domain/project';
import type { GardenParameters, GardenPlan } from './gardenGenerator';

export type AiImageMode = 'generate' | 'edit';

export interface AiImageRequest {
  mode: AiImageMode;
  prompt: string;
  size: string;
  quality: string;
  format: string;
  imageUrl?: string;
  n?: number;
}

export interface AiImageResult {
  imageUrl: string;
  raw: unknown;
}

export function buildGardenImagePrompt(plan: GardenPlan, parameters: GardenParameters) {
  const focal = {
    pond: '水院',
    rockery: '叠山',
    pavilion: '亭榭',
  }[parameters.focalPoint];

  const building = {
    classic: '典雅厅堂',
    compact: '紧凑小筑',
    scholar: '书斋园居',
  }[parameters.buildingStyle];

  return [
    `苏式庭院景观概念方案：${plan.name}`,
    'Create a refined top-down landscape concept plan, not a photorealistic perspective render.',
    `Core scene: ${focal}, building style: ${building}.`,
    `Spatial parameters: courtyard scale ${parameters.courtyardScale}%, water ratio ${parameters.waterRatio}%, rock density ${parameters.rockDensity}%, planting density ${parameters.plantingDensity}%, path curvature ${parameters.pathCurvature}%.`,
    'Include whitewashed walls, dark tiled roofs, moon gate, winding stone path, pond, Taihu rocks, pavilion, bamboo, pine, maple, lotus, and subtle annotations.',
    'Style: elegant Suzhou classical garden masterplan, muted ink-and-mineral palette, clean composition, architecture-friendly presentation board.',
  ].join('\n');
}

export async function requestAiImage(request: AiImageRequest): Promise<AiImageResult> {
  const response = await fetch('/api/images/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request),
  });

  const payload = await readResponsePayload(response);
  if (!response.ok) {
    throw extractGenerationError(payload) ?? new Error(extractErrorMessage(payload) ?? `图像生成失败：HTTP ${response.status}`);
  }

  const imageUrl = extractImageUrl(payload);
  if (!imageUrl) {
    throw new Error('图像生成失败：响应中没有可用图片地址');
  }

  return { imageUrl, raw: payload };
}

async function readResponsePayload(response: Response): Promise<unknown> {
  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    return response.json();
  }

  return response.text();
}

export function extractImageUrl(payload: unknown): string | null {
  if (!payload || typeof payload !== 'object') {
    return null;
  }

  const data = 'data' in payload ? payload.data : undefined;
  if (Array.isArray(data)) {
    for (const item of data) {
      if (item && typeof item === 'object') {
        if ('url' in item && typeof item.url === 'string') {
          return item.url;
        }
        if ('b64_json' in item && typeof item.b64_json === 'string') {
          return `data:image/png;base64,${item.b64_json}`;
        }
      }
    }
  }

  const choices = 'choices' in payload ? payload.choices : undefined;
  if (Array.isArray(choices)) {
    for (const choice of choices) {
      const content =
        choice && typeof choice === 'object' && 'message' in choice && choice.message && typeof choice.message === 'object' && 'content' in choice.message
          ? choice.message.content
          : null;
      if (typeof content === 'string') {
        const match = content.match(/https?:\/\/\S+\.(?:png|jpe?g|webp)(?:\?\S*)?/i);
        if (match) {
          return match[0];
        }
      }
    }
  }

  return null;
}

export function extractErrorMessage(payload: unknown): string | null {
  if (typeof payload === 'string') {
    return payload.trim() || null;
  }

  if (!payload || typeof payload !== 'object') {
    return null;
  }

  const error = 'error' in payload ? payload.error : undefined;
  if (typeof error === 'string') {
    return error;
  }
  if (error && typeof error === 'object' && 'message' in error && typeof error.message === 'string') {
    return error.message;
  }

  const message = 'message' in payload ? payload.message : undefined;
  return typeof message === 'string' ? message : null;
}

export function extractGenerationError(payload: unknown): GenerationError | null {
  if (!payload || typeof payload !== 'object' || !('error' in payload)) {
    return null;
  }

  const error = payload.error;
  if (!error || typeof error !== 'object') {
    return null;
  }

  if (
    'code' in error &&
    'message' in error &&
    'retryable' in error &&
    typeof error.code === 'string' &&
    typeof error.message === 'string' &&
    typeof error.retryable === 'boolean'
  ) {
    return error as GenerationError;
  }

  return null;
}

export function normalizeUnknownGenerationError(error: unknown): GenerationError {
  if (error && typeof error === 'object' && 'code' in error && 'message' in error && 'retryable' in error) {
    return error as GenerationError;
  }

  return {
    code: 'unknown_error',
    message: error instanceof Error ? error.message : 'AI 图像生成失败',
    retryable: true,
  };
}
