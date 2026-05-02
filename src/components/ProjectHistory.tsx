import { ChevronsLeft, ChevronsRight, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import type { GardenProject } from '../domain/project';

interface ProjectHistoryProps {
  projects: GardenProject[];
  activeProjectId: string;
  onCreateProject: () => void;
  onOpenProject: (projectId: string) => void;
  onDeleteProject: (projectId: string) => void;
}

export function ProjectHistory({ projects, activeProjectId, onCreateProject, onOpenProject, onDeleteProject }: ProjectHistoryProps) {
  const [isExpanded, setIsExpanded] = useState(true);

  return (
    <section className={isExpanded ? 'project-history' : 'project-history collapsed'} aria-label="项目历史">
      <div className="project-history-header">
        {isExpanded ? <h2>项目历史</h2> : null}
        <button
          type="button"
          onClick={() => setIsExpanded((current) => !current)}
          aria-label={isExpanded ? '收起项目历史' : '展开项目历史'}
          aria-expanded={isExpanded}
        >
          {isExpanded ? <ChevronsLeft size={16} aria-hidden="true" /> : <ChevronsRight size={16} aria-hidden="true" />}
        </button>
        <button type="button" onClick={onCreateProject} aria-label="新建项目">
          <Plus size={16} aria-hidden="true" />
        </button>
      </div>
      {isExpanded ? (
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
      ) : null}
    </section>
  );
}
