import { createRef } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { GardenPreview } from './GardenPreview';
import type { GardenPlan } from './gardenGenerator';

const plan: GardenPlan = {
  name: '规则测试方案',
  width: 1080,
  height: 760,
  seed: 8,
  summary: [],
  elements: [
    { id: 'annotation', kind: 'viewArrow', x: 200, y: 160, points: [{ x: 200, y: 160 }, { x: 420, y: 360 }], label: '主观景视线', layer: 'annotation' },
    { id: 'structure', kind: 'moonGate', x: 700, y: 220, width: 72, height: 72, label: '月洞门', layer: 'structure' },
    { id: 'planting', kind: 'plant', x: 520, y: 390, radius: 24, variant: 'pine', layer: 'planting' },
    { id: 'path', kind: 'path', x: 110, y: 620, points: [{ x: 110, y: 620 }, { x: 310, y: 460 }], layer: 'path' },
    { id: 'water', kind: 'water', x: 370, y: 290, width: 220, height: 118, layer: 'water' },
    { id: 'screening', kind: 'bambooScreen', x: 120, y: 180, width: 34, height: 360, label: '竹影障景', layer: 'screening' },
    { id: 'base', kind: 'wall', x: 80, y: 80, width: 920, height: 600, points: [{ x: 80, y: 80 }, { x: 1000, y: 80 }, { x: 1000, y: 680 }], layer: 'base' },
    { id: 'screen-wall', kind: 'screenWall', x: 180, y: 540, width: 104, height: 18, label: '入口障景', layer: 'screening' },
    { id: 'tea-node', kind: 'courtyardNode', x: 760, y: 300, width: 96, height: 72, label: '茶庭', layer: 'structure' },
  ],
};

describe('GardenPreview', () => {
  it('renders rule elements in fixed layer order', () => {
    const markup = renderToStaticMarkup(<GardenPreview plan={plan} svgRef={createRef<SVGSVGElement>()} />);

    expect(markup.indexOf('data-layer="base"')).toBeLessThan(markup.indexOf('data-layer="screening"'));
    expect(markup.indexOf('data-layer="screening"')).toBeLessThan(markup.indexOf('data-layer="water"'));
    expect(markup.indexOf('data-layer="water"')).toBeLessThan(markup.indexOf('data-layer="path"'));
    expect(markup.indexOf('data-layer="path"')).toBeLessThan(markup.indexOf('data-layer="planting"'));
    expect(markup.indexOf('data-layer="planting"')).toBeLessThan(markup.indexOf('data-layer="structure"'));
    expect(markup.indexOf('data-layer="structure"')).toBeLessThan(markup.indexOf('data-layer="annotation"'));
  });

  it('renders new rule SVG symbols and Chinese labels', () => {
    const markup = renderToStaticMarkup(<GardenPreview plan={plan} svgRef={createRef<SVGSVGElement>()} />);

    expect(markup).toContain('data-kind="bambooScreen"');
    expect(markup).toContain('data-kind="screenWall"');
    expect(markup).toContain('data-kind="moonGate"');
    expect(markup).toContain('data-kind="courtyardNode"');
    expect(markup).toContain('data-kind="viewArrow"');
    expect(markup).toContain('竹影障景');
    expect(markup).toContain('主观景视线');
  });
});
