import type { GardenParameters } from '../gardenGenerator';

export type GenerationStatus = 'pending' | 'succeeded' | 'failed';
export type GenerationMode = 'generate' | 'edit';
export type GenerationProvider = 'vectorengine';
export type GenerationModel = 'gpt-image-2' | 'gpt-image-2-all';

export interface GenerationError {
  code:
    | 'missing_api_key'
    | 'invalid_request'
    | 'request_too_large'
    | 'provider_timeout'
    | 'provider_rate_limited'
    | 'provider_rejected_prompt'
    | 'provider_unavailable'
    | 'empty_provider_response'
    | 'unknown_error';
  message: string;
  retryable: boolean;
  requestId?: string;
}

export interface ImageGeneration {
  id: string;
  projectId: string;
  createdAt: string;
  mode: GenerationMode;
  status: GenerationStatus;
  prompt: string;
  provider: GenerationProvider;
  model: GenerationModel;
  imageUrl?: string;
  error?: GenerationError;
}

export interface GardenProject {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  seed: number;
  parameters: GardenParameters;
  customPrompt: string;
  referenceImage?: {
    name: string;
    url: string;
  };
  generations: ImageGeneration[];
}

export const defaultGardenParameters: GardenParameters = {
  courtyardScale: 64,
  waterRatio: 38,
  rockDensity: 46,
  plantingDensity: 62,
  pathCurvature: 58,
  buildingStyle: 'classic',
  focalPoint: 'pond',
};

export const defaultCustomPrompt =
  '画面以苏州古典园林平面概念图为主，强化水院、粉墙黛瓦、太湖石与曲折游线。风格克制、清雅，适合建筑方案汇报。';

export interface CreateDefaultProjectOptions {
  now?: string;
  seed?: number;
  name?: string;
}

export function createDefaultProject(options: CreateDefaultProjectOptions = {}): GardenProject {
  const now = options.now ?? new Date().toISOString();
  const seed = options.seed ?? Date.now();

  return {
    id: `garden-${seed}`,
    name: options.name ?? '苏式庭院方案',
    createdAt: now,
    updatedAt: now,
    seed,
    parameters: defaultGardenParameters,
    customPrompt: defaultCustomPrompt,
    generations: [],
  };
}

export function touchProject(project: GardenProject, now = new Date().toISOString()): GardenProject {
  return { ...project, updatedAt: now };
}
