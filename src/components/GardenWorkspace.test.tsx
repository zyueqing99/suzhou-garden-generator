import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { createDefaultProject } from '../domain/project';
import { GardenWorkspace } from './GardenWorkspace';

describe('GardenWorkspace', () => {
  it('renders the active project and fallback preview controls', () => {
    const project = createDefaultProject({ now: '2026-05-02T10:00:00.000Z', seed: 11, name: '留园水院' });
    const markup = renderToStaticMarkup(<GardenWorkspace project={project} onProjectChange={vi.fn()} onGenerationAdded={vi.fn()} />);

    expect(markup).toContain('留园水院');
    expect(markup).toContain('生成 AI 图像');
    expect(markup).toContain('导出 JSON');
    expect(markup).toContain('规则方案基线预览');
  });
});
