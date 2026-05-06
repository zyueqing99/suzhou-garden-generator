import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createDefaultProject, type GardenProject } from '../domain/project';
import { createLocalProjectRepository } from './localProjectRepository';

const store = new Map<string, string>();

beforeEach(() => {
  store.clear();
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      store.set(key, value);
    },
    removeItem: (key: string) => {
      store.delete(key);
    },
  });
});

describe('createLocalProjectRepository', () => {
  it('saves and lists projects with newest updated project first', async () => {
    const repository = createLocalProjectRepository('test-projects');
    const older = createDefaultProject({ now: '2026-05-01T10:00:00.000Z', seed: 1, name: 'Older' });
    const newer = createDefaultProject({ now: '2026-05-02T10:00:00.000Z', seed: 2, name: 'Newer' });

    await repository.save(older);
    await repository.save(newer);

    await repository.save({ ...older, updatedAt: '2026-05-03T10:00:00.000Z' });

    expect((await repository.list()).map((project) => project.name)).toEqual(['Older', 'Newer']);
  });

  it('loads a saved project by id', async () => {
    const repository = createLocalProjectRepository('test-projects');
    const project = createDefaultProject({ now: '2026-05-02T10:00:00.000Z', seed: 7, name: 'Water Garden' });

    await repository.save(project);

    expect(await repository.load(project.id)).toEqual(project);
  });

  it('deletes a saved project by id', async () => {
    const repository = createLocalProjectRepository('test-projects');
    const project = createDefaultProject({ now: '2026-05-02T10:00:00.000Z', seed: 7, name: 'Water Garden' });

    await repository.save(project);
    await repository.delete(project.id);

    expect(await repository.load(project.id)).toBeNull();
    expect(await repository.list()).toEqual([]);
  });

  it('preserves site markup and requirement confirmation data', async () => {
    const repository = createLocalProjectRepository('test-projects');
    const project: GardenProject = {
      ...createDefaultProject({ now: '2026-05-02T10:00:00.000Z', seed: 9, name: 'Site Project' }),
      siteImage: { name: 'site.png', url: 'data:image/png;base64,abc' },
      siteMarkup: {
        boundary: [{ x: 12, y: 18 }],
        buildingFootprint: [{ x: 44, y: 28 }],
        mainEntrance: { kind: 'mainEntrance' as const, point: { x: 15, y: 82 } },
      },
      requirementConfirmation: {
        functionalNeeds: '接待与游赏',
        stylePreference: '典雅厅堂',
        landscapeElements: '水院为核',
        waterRatio: '38%',
        rockRatio: '46%',
        structureTypes: '厅堂、连廊、景亭',
        plantPreference: '松、竹、枫',
      },
    };

    await repository.save(project);

    expect(await repository.load(project.id)).toEqual(project);
  });

  it('drops stale missing API key generation failures from saved projects', async () => {
    const repository = createLocalProjectRepository('test-projects');
    const project: GardenProject = {
      ...createDefaultProject({ now: '2026-05-02T10:00:00.000Z', seed: 10, name: 'Recovered Project' }),
      generations: [
        {
          id: 'missing-key-failure',
          projectId: 'garden-10',
          createdAt: '2026-05-02T10:02:00.000Z',
          mode: 'generate',
          status: 'failed',
          prompt: 'test prompt',
          provider: 'vectorengine',
          model: 'gpt-image-2',
          error: {
            code: 'missing_api_key',
            message: 'Missing VECTOR_ENGINE_API_KEY on local proxy server.',
            retryable: false,
          },
        },
        {
          id: 'timeout-failure',
          projectId: 'garden-10',
          createdAt: '2026-05-02T10:01:00.000Z',
          mode: 'generate',
          status: 'failed',
          prompt: 'test prompt',
          provider: 'vectorengine',
          model: 'gpt-image-2',
          error: {
            code: 'provider_timeout',
            message: 'Image generation timed out.',
            retryable: true,
          },
        },
      ],
    };

    await repository.save(project);

    const loaded = await repository.load(project.id);
    expect(loaded?.generations.map((generation) => generation.id)).toEqual(['timeout-failure']);
  });

  it('drops stale pre-refactor generation failure messages from saved projects', async () => {
    const repository = createLocalProjectRepository('test-projects');
    const project: GardenProject = {
      ...createDefaultProject({ now: '2026-05-02T10:00:00.000Z', seed: 11, name: 'Refactored Project' }),
      generations: [
        {
          id: 'old-rule-failure',
          projectId: 'garden-11',
          createdAt: '2026-05-02T10:02:00.000Z',
          mode: 'generate',
          status: 'failed',
          prompt: 'test prompt',
          provider: 'vectorengine',
          model: 'gpt-image-2',
          error: {
            code: 'unknown_error',
            message: 'Image generation failed. The rule-generated concept plan is still available.',
            retryable: true,
          },
        },
        {
          id: 'new-timeout',
          projectId: 'garden-11',
          createdAt: '2026-05-02T10:01:00.000Z',
          mode: 'generate',
          status: 'failed',
          prompt: 'test prompt',
          provider: 'vectorengine',
          model: 'gpt-image-2',
          error: {
            code: 'provider_timeout',
            message: 'Image generation timed out. You can retry; the site markup and generation controls are preserved.',
            retryable: true,
          },
        },
      ],
    };

    await repository.save(project);

    const loaded = await repository.load(project.id);
    expect(loaded?.generations.map((generation) => generation.id)).toEqual(['new-timeout']);
  });
});
