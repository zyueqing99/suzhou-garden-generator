import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { createDefaultProject } from '../domain/project';
import { GardenWorkspace, getMapEraseAction } from './GardenWorkspace';

describe('GardenWorkspace', () => {
  it('渲染场地图标注驱动的工作台标签，并移除 SVG 预览流程', () => {
    const project = createDefaultProject({ now: '2026-05-05T10:00:00.000Z', seed: 41, name: 'AI 标注方案' });
    const markup = renderToStaticMarkup(<GardenWorkspace project={project} onProjectChange={vi.fn()} onGenerationAdded={vi.fn()} />);

    expect(markup).toContain('场地标注');
    expect(markup).toContain('生成方案');
    expect(markup).toContain('方案说明');
    expect(markup).toContain('上传场地图');
    expect(markup).toContain('标注工具');
    expect(markup).toContain('生成控制');
    expect(markup).not.toContain(['S', 'V', 'G', '平面'].join(''));
    expect(markup).not.toContain(['导出', ' S', 'V', 'G'].join(''));
    expect(markup).not.toContain(['规则方案', '基线预览'].join(''));
  });

  it('在右侧主窗口中渲染上传后的放大场地图', () => {
    const project = createDefaultProject({ now: '2026-05-05T10:00:00.000Z', seed: 42, name: '大图标注' });
    const markup = renderToStaticMarkup(
      <GardenWorkspace
        project={{
          ...project,
          siteImage: { name: 'site.png', url: 'data:image/png;base64,abc' },
        }}
        onProjectChange={vi.fn()}
        onGenerationAdded={vi.fn()}
      />,
    );

    const stageStart = markup.indexOf('aria-label="放大场地图标注');
    const controlsStart = markup.indexOf('aria-label="左侧生成控制"');

    expect(stageStart).toBeGreaterThan(-1);
    expect(controlsStart).toBeGreaterThan(-1);
    expect(markup.slice(stageStart)).toContain('当前上传的场地图');
    expect(markup.slice(stageStart)).toContain('site-markup-overlay');
  });

  it('将方案说明渲染到右侧边栏，并保留 PNG/JSON 导出入口', () => {
    const project = createDefaultProject({ now: '2026-05-05T10:00:00.000Z', seed: 44, name: '说明导出' });
    const markup = renderToStaticMarkup(<GardenWorkspace project={project} onProjectChange={vi.fn()} onGenerationAdded={vi.fn()} />);
    const tablistStart = markup.indexOf('aria-label="右侧主窗口标签"');
    const sidebarStart = markup.indexOf('aria-label="右侧方案说明边栏"');

    expect(markup).toContain('生成方案');
    expect(markup).toContain('方案说明');
    expect(sidebarStart).toBeGreaterThan(-1);
    expect(sidebarStart).toBeGreaterThan(tablistStart);
    expect(markup.slice(tablistStart, sidebarStart)).not.toContain('方案说明');
    expect(markup.slice(sidebarStart)).toContain('总体布局说明');
    expect(markup).toContain('导出 PNG');
    expect(markup).toContain('导出 JSON');
    expect(markup).not.toContain('编辑当前图像');
    expect(markup).not.toContain(['导出', ' S', 'V', 'G'].join(''));
  });

  it('完成关键标注后启用生成方案按钮', () => {
    const project = createDefaultProject({ now: '2026-05-05T10:00:00.000Z', seed: 43, name: '生成方案' });
    const markup = renderToStaticMarkup(
      <GardenWorkspace
        project={{
          ...project,
          siteImage: { name: 'site.png', url: 'data:image/png;base64,abc' },
          siteMarkup: {
            boundary: [
              { x: 10, y: 10 },
              { x: 90, y: 10 },
              { x: 90, y: 90 },
            ],
            buildingFootprint: [
              { x: 30, y: 20 },
              { x: 70, y: 20 },
              { x: 70, y: 40 },
            ],
            mainEntrance: { kind: 'mainEntrance', point: { x: 18, y: 82 } },
          },
        }}
        onProjectChange={vi.fn()}
        onGenerationAdded={vi.fn()}
      />,
    );

    expect(markup).toContain('生成方案');
    expect(markup).toContain('擦除地块边界');
    expect(markup).not.toContain('disabled="">生成方案</button>');
  });

  it('缺少关键标注时仍允许点击生成方案以触发缺项提示', () => {
    const project = createDefaultProject({ now: '2026-05-05T10:00:00.000Z', seed: 46, name: '缺项提示' });
    const markup = renderToStaticMarkup(<GardenWorkspace project={project} onProjectChange={vi.fn()} onGenerationAdded={vi.fn()} />);

    expect(markup).toContain('aria-disabled="true"');
    expect(markup).not.toContain('disabled="">生成方案</button>');
  });

  it('使用景观方向作为用户可见文案', () => {
    const project = createDefaultProject({ now: '2026-05-05T10:00:00.000Z', seed: 45, name: '景观方向' });
    const markup = renderToStaticMarkup(<GardenWorkspace project={project} onProjectChange={vi.fn()} onGenerationAdded={vi.fn()} />);

    expect(markup).toContain('标记景观方向');
    expect(markup).toContain('景观方向');
    expect(markup).not.toContain('标记建筑主观景面');
  });

  it('为当前工具创建本地擦除动作', () => {
    expect(
      getMapEraseAction('buildingFootprint', {
        boundary: [],
        buildingFootprint: [
          { x: 20, y: 20 },
          { x: 60, y: 20 },
          { x: 60, y: 55 },
        ],
      }),
    ).toEqual({
      tool: 'buildingFootprint',
      label: '擦除建筑轮廓',
    });

    expect(
      getMapEraseAction('mainViewSide', {
        boundary: [],
        buildingFootprint: [],
        mainViewSide: { kind: 'mainViewSide', point: { x: 60, y: 55 } },
      }),
    ).toEqual({
      tool: 'mainViewSide',
      label: '重新标记景观方向',
    });
  });
});
