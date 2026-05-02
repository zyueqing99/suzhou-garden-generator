import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { createDefaultProject } from '../domain/project';
import { ProjectHistory } from './ProjectHistory';

describe('ProjectHistory', () => {
  it('renders a collapse control for the project history sidebar', () => {
    const project = createDefaultProject({ now: '2026-05-02T10:00:00.000Z', seed: 11, name: '留园水院' });
    const markup = renderToStaticMarkup(
      <ProjectHistory projects={[project]} activeProjectId={project.id} onCreateProject={vi.fn()} onOpenProject={vi.fn()} onDeleteProject={vi.fn()} />,
    );

    expect(markup).toContain('aria-label="收起项目历史"');
    expect(markup).toContain('aria-expanded="true"');
  });
});
