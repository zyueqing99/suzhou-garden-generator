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

  it('renders site markup first and keeps AI and SVG previews below the confirmation area', () => {
    const project = createDefaultProject({ now: '2026-05-02T10:00:00.000Z', seed: 21, name: '布局调整' });
    const markup = renderToStaticMarkup(<GardenWorkspace project={project} onProjectChange={vi.fn()} onGenerationAdded={vi.fn()} />);

    expect(markup.indexOf('地块图标记工作区')).toBeLessThan(markup.indexOf('场地解析与需求确认'));
    expect(markup.indexOf('场地解析与需求确认')).toBeLessThan(markup.indexOf('AI 图像结果'));
    expect(markup.indexOf('场地解析与需求确认')).toBeLessThan(markup.indexOf('规则方案基线预览'));
  });

  it('renders site analysis labels in Chinese instead of raw data keys', () => {
    const project = createDefaultProject({ now: '2026-05-02T10:00:00.000Z', seed: 23, name: '解析展示' });
    const markup = renderToStaticMarkup(<GardenWorkspace project={project} onProjectChange={vi.fn()} onGenerationAdded={vi.fn()} />);

    expect(markup).toContain('地块边界');
    expect(markup).toContain('建筑轮廓');
    expect(markup).toContain('主入口');
    expect(markup).toContain('建筑主观景面');
    expect(markup).toContain('相邻界面');
    expect(markup).toContain('借景方向');
    expect(markup).toContain('需遮挡方向');
    expect(markup).not.toContain('siteBoundary');
    expect(markup).not.toContain('buildingFootprint');
  });

  it('marks boundary editing as the active site tool and explains canvas editing', () => {
    const project = createDefaultProject({ now: '2026-05-02T10:00:00.000Z', seed: 22, name: '边界编辑' });
    const markup = renderToStaticMarkup(<GardenWorkspace project={project} onProjectChange={vi.fn()} onGenerationAdded={vi.fn()} />);

    expect(markup).toContain('aria-pressed="true"');
    expect(markup).toContain('在地块图上点击添加边界点');
    expect(markup.match(/class="tool-button/g)).toHaveLength(4);
    expect(markup).toContain('绘制建筑轮廓');
    expect(markup).toContain('标记主入口');
    expect(markup).toContain('标记建筑主观景面');
  });

  it('explains that confirmed site boundary drawing is locked', () => {
    const project = createDefaultProject({ now: '2026-05-02T10:00:00.000Z', seed: 24, name: '边界锁定' });
    const markup = renderToStaticMarkup(
      <GardenWorkspace
        project={{
          ...project,
          siteImage: { name: 'site.png', url: 'data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22/%3E' },
          siteMarkup: {
            boundary: [
              { x: 10, y: 10 },
              { x: 80, y: 10 },
              { x: 80, y: 80 },
            ],
            buildingFootprint: [],
          },
        }}
        onProjectChange={vi.fn()}
        onGenerationAdded={vi.fn()}
      />,
    );

    expect(markup).toContain('地块边界已确认');
    expect(markup).toContain('如需重绘，请先清除当前标记');
  });
});
