import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { createDefaultProject } from '../domain/project';
import { ProjectHistory } from './ProjectHistory';

describe('ProjectHistory', () => {
  it('renders second-version project history cards with a create action', () => {
    const projects = [
      createDefaultProject({ now: '2026-05-04T10:30:00.000Z', seed: 41, name: '苏式庭院方案' }),
      createDefaultProject({ now: '2026-05-02T16:45:00.000Z', seed: 42, name: '雅集水院方案' }),
    ];

    const markup = renderToStaticMarkup(
      <ProjectHistory projects={projects} activeProjectId={projects[0].id} onCreateProject={vi.fn()} onOpenProject={vi.fn()} onDeleteProject={vi.fn()} />,
    );

    expect(markup).toContain('新建项目');
    expect(markup).toContain('查看全部项目');
    expect(markup.match(/class="project-thumbnail/g)).toHaveLength(2);
    expect(markup).toContain('苏式庭院方案');
    expect(markup).toContain('雅集水院方案');
  });

  it('marks the active project in the second-version history rail', () => {
    const project = createDefaultProject({ now: '2026-05-02T10:00:00.000Z', seed: 11, name: '留园水院' });
    const markup = renderToStaticMarkup(
      <ProjectHistory projects={[project]} activeProjectId={project.id} onCreateProject={vi.fn()} onOpenProject={vi.fn()} onDeleteProject={vi.fn()} />,
    );

    expect(markup).toContain('project-list-item active');
    expect(markup).toContain('留园水院');
  });
});
