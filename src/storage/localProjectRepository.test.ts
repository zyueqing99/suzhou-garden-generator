import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createDefaultProject } from '../domain/project';
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
});
