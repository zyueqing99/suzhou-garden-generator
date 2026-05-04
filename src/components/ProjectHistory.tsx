import { List, Plus, Trash2 } from 'lucide-react';
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
        <button className="history-create-button" type="button" onClick={onCreateProject}>
          <Plus size={16} aria-hidden="true" />
          新建项目
        </button>
        <h2>项目历史</h2>
      </div>

      <div className="project-list">
        {projects.map((project) => (
          <article className={project.id === activeProjectId ? 'project-list-item active' : 'project-list-item'} key={project.id}>
            <button className="project-card-button" type="button" onClick={() => onOpenProject(project.id)}>
              <span className="project-thumbnail" aria-hidden="true">
                <span />
              </span>
              <span className="project-card-copy">
                <strong>{project.name}</strong>
                <span>{new Date(project.updatedAt).toLocaleString()}</span>
              </span>
            </button>
            <button className="project-delete-button" type="button" onClick={() => onDeleteProject(project.id)} aria-label={`删除 ${project.name}`}>
              <Trash2 size={15} aria-hidden="true" />
            </button>
          </article>
        ))}
      </div>

      <button className="history-all-button" type="button">
        <List size={16} aria-hidden="true" />
        查看全部项目
      </button>
    </section>
  );
}
