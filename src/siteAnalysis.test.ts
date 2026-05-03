import { describe, expect, it } from 'vitest';
import {
  appendSiteMarkupPoint,
  clearSiteMarkupByTool,
  createSiteAnalysis,
  createSiteMarker,
  normalizeSitePoint,
  type SiteMarkup,
} from './siteAnalysis';

describe('siteAnalysis', () => {
  it('creates structured site analysis from confirmed markup', () => {
    const markup: SiteMarkup = {
      boundary: [
        { x: 8, y: 18 },
        { x: 92, y: 14 },
        { x: 88, y: 84 },
        { x: 12, y: 90 },
      ],
      buildingFootprint: [
        { x: 32, y: 18 },
        { x: 70, y: 18 },
        { x: 70, y: 38 },
        { x: 32, y: 38 },
      ],
      mainEntrance: createSiteMarker('mainEntrance', { x: 14, y: 82 }),
      mainViewSide: createSiteMarker('mainViewSide', { x: 58, y: 68 }),
    };

    expect(createSiteAnalysis(markup)).toEqual({
      siteBoundary: '已确认',
      buildingFootprint: '已确认',
      mainEntrance: '西南侧',
      mainViewSide: '建筑南侧',
      neighborInterface: '西侧',
      borrowedViewDirection: '东南侧',
      screeningRequired: ['西侧', '入口直视方向'],
    });
  });

  it('keeps incomplete required markup visible', () => {
    expect(createSiteAnalysis({ boundary: [], buildingFootprint: [] })).toMatchObject({
      siteBoundary: '待确认',
      buildingFootprint: '待确认',
      mainEntrance: '待标记',
      mainViewSide: '待标记',
      neighborInterface: '待判断',
      borrowedViewDirection: '待判断',
      screeningRequired: [],
    });
  });

  it('normalizes points and updates markup by active tool immutably', () => {
    const markup: SiteMarkup = { boundary: [], buildingFootprint: [] };
    const withBoundary = appendSiteMarkupPoint(markup, 'boundary', { x: 12.345, y: 101 });
    const withEntrance = appendSiteMarkupPoint(withBoundary, 'mainEntrance', { x: -5, y: 84 });

    expect(normalizeSitePoint({ x: 12.345, y: 101 })).toEqual({ x: 12.3, y: 100 });
    expect(markup.boundary).toEqual([]);
    expect(withBoundary.boundary).toEqual([{ x: 12.3, y: 100 }]);
    expect(withEntrance.mainEntrance).toEqual(createSiteMarker('mainEntrance', { x: 0, y: 84 }));
    expect(clearSiteMarkupByTool(withEntrance, 'boundary').boundary).toEqual([]);
  });

  it('keeps adding boundary points after the site boundary has enough points to close', () => {
    const markup: SiteMarkup = {
      boundary: [
        { x: 10, y: 10 },
        { x: 80, y: 10 },
        { x: 80, y: 80 },
      ],
      buildingFootprint: [],
    };

    expect(appendSiteMarkupPoint(markup, 'boundary', { x: 10, y: 80 }).boundary).toEqual([
      { x: 10, y: 10 },
      { x: 80, y: 10 },
      { x: 80, y: 80 },
      { x: 10, y: 80 },
    ]);
  });
});
