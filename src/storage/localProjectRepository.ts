import type { GardenProject } from '../domain/project';
import type { ProjectRepository } from '../domain/projectRepository';

const DEFAULT_STORAGE_KEY = 'suzhou-garden-projects';

export function createLocalProjectRepository(storageKey = DEFAULT_STORAGE_KEY): ProjectRepository {
  return {
    async list() {
      return readProjects(storageKey).sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
    },
    async load(id) {
      return readProjects(storageKey).find((project) => project.id === id) ?? null;
    },
    async save(project) {
      const projects = readProjects(storageKey);
      const nextProjects = [sanitizeProject(project), ...projects.filter((item) => item.id !== project.id)];
      writeProjects(storageKey, nextProjects);
    },
    async delete(id) {
      writeProjects(
        storageKey,
        readProjects(storageKey).filter((project) => project.id !== id),
      );
    },
  };
}

function readProjects(storageKey: string): GardenProject[] {
  const raw = localStorage.getItem(storageKey);
  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(isGardenProject).map(sanitizeProject) : [];
  } catch {
    return [];
  }
}

function sanitizeProject(project: GardenProject): GardenProject {
  return {
    ...project,
    generations: project.generations.filter((generation) => {
      if (generation.error?.code === 'missing_api_key') {
        return false;
      }

      return !generation.error?.message.includes('rule-generated concept plan');
    }),
  };
}

function writeProjects(storageKey: string, projects: GardenProject[]) {
  localStorage.setItem(storageKey, JSON.stringify(projects));
}

function isGardenProject(value: unknown): value is GardenProject {
  if (!value || typeof value !== 'object') {
    return false;
  }

  return (
    'id' in value &&
    typeof value.id === 'string' &&
    'name' in value &&
    typeof value.name === 'string' &&
    'createdAt' in value &&
    typeof value.createdAt === 'string' &&
    'updatedAt' in value &&
    typeof value.updatedAt === 'string' &&
    'parameters' in value &&
    typeof value.parameters === 'object' &&
    'customPrompt' in value &&
    typeof value.customPrompt === 'string' &&
    'generations' in value &&
    Array.isArray(value.generations)
  );
}
