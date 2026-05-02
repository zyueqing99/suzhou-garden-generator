import type { GardenProject } from './project';

export interface ProjectRepository {
  list(): Promise<GardenProject[]>;
  load(id: string): Promise<GardenProject | null>;
  save(project: GardenProject): Promise<void>;
  delete(id: string): Promise<void>;
}
