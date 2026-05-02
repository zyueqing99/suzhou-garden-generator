import { Plus, Trash2 } from 'lucide-react';
import type { GardenProject } from '../domain/project';

interface ProjectHistoryProps {
  projects: GardenProject[];
  activeProjectId: string;
  onCreateProject: () => void;
  onOpenProject: (projectId: string) => void;
  onDeleteProject: (projectId: string) => void;
}

export function ProjectHistory({ projects, activeProjectId, onCreateProject, onOpenProject, onDeleteProject }: ProjectHistoryProps) {
  return (
    <section className="project-history" aria-label="项目历史">
      <div className="project-history-header">
        <h2>项目历史</h2>
        <button type="button" onClick={onCreateProject} aria-label="新建项目">
          <Plus size={16} aria-hidden="true" />
        </button>
      </div>
      <div className="project-list">
        {projects.map((project) => (
          <article className={project.id === activeProjectId ? 'project-list-item active' : 'project-list-item'} key={project.id}>
            <button type="button" onClick={() => onOpenProject(project.id)}>
              <strong>{project.name}</strong>
              <span>{new Date(project.updatedAt).toLocaleString()}</span>
            </button>
            <button type="button" onClick={() => onDeleteProject(project.id)} aria-label={`删除 ${project.name}`}>
              <Trash2 size={15} aria-hidden="true" />
            </button>
          </article>
        ))}
      </div>
    </section>
  );
}
