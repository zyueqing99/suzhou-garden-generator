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

  it('renders site image upload, markup tools, analysis data, and editable requirements', () => {
    const project = createDefaultProject({ now: '2026-05-02T10:00:00.000Z', seed: 18, name: '地块推演' });
    const markup = renderToStaticMarkup(<GardenWorkspace project={project} onProjectChange={vi.fn()} onGenerationAdded={vi.fn()} />);

    expect(markup).toContain('上传地块图');
    expect(markup).toContain('绘制地块边界');
    expect(markup).toContain('绘制建筑轮廓');
    expect(markup).toContain('标记主入口');
    expect(markup).toContain('标记建筑主观景面');
    expect(markup).toContain('场地解析数据');
    expect(markup).toContain('需求清单');
    expect(markup).toContain('功能需求');
    expect(markup).toContain('植物倾向');
  });
});
