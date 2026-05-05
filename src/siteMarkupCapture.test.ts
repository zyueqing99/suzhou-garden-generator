import { describe, expect, it } from 'vitest';
import { buildSiteMarkupSvg } from './siteMarkupCapture';
import type { SiteMarkup } from './siteAnalysis';

const markup: SiteMarkup = {
  boundary: [
    { x: 10, y: 12 },
    { x: 90, y: 12 },
    { x: 86, y: 88 },
    { x: 14, y: 88 },
  ],
  buildingFootprint: [
    { x: 35, y: 18 },
    { x: 72, y: 18 },
    { x: 72, y: 38 },
    { x: 35, y: 38 },
  ],
  mainEntrance: { kind: 'mainEntrance', point: { x: 18, y: 82 } },
  mainViewSide: { kind: 'mainViewSide', point: { x: 64, y: 64 } },
};

describe('siteMarkupCapture', () => {
  it('从归一化标注坐标生成覆盖层 SVG', () => {
    const svg = buildSiteMarkupSvg(markup, { width: 1000, height: 600 });

    expect(svg).toContain('<svg');
    expect(svg).toContain('points="100,72 900,72 860,528 140,528"');
    expect(svg).toContain('points="350,108 720,108 720,228 350,228"');
    expect(svg).toContain('主入口');
    expect(svg).toContain('景观方向');
  });

  it('覆盖层 SVG 不包含原图地址，避免误把原图当成生成输入', () => {
    const svg = buildSiteMarkupSvg(markup, { width: 1000, height: 600 });

    expect(svg).not.toContain('data:image/png;base64');
    expect(svg).toContain('景观方向');
  });
});
