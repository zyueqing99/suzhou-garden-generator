import { describe, expect, it } from 'vitest';
import { createRuleLayoutContext } from './ruleLayout';
import type { GardenParameters } from './gardenGenerator';
import type { RequirementConfirmation } from './requirementConfirmation';
import type { SiteAnalysisData, SiteMarkup } from './siteAnalysis';

const parameters: GardenParameters = {
  courtyardScale: 64,
  waterRatio: 38,
  rockDensity: 46,
  plantingDensity: 62,
  pathCurvature: 58,
  buildingStyle: 'scholar',
  focalPoint: 'pond',
};

const siteMarkup: SiteMarkup = {
  boundary: [
    { x: 10, y: 20 },
    { x: 90, y: 20 },
    { x: 86, y: 88 },
    { x: 14, y: 92 },
  ],
  buildingFootprint: [
    { x: 30, y: 18 },
    { x: 70, y: 18 },
    { x: 68, y: 36 },
    { x: 32, y: 38 },
  ],
  mainEntrance: { kind: 'mainEntrance', point: { x: 18, y: 86 } },
  mainViewSide: { kind: 'mainViewSide', point: { x: 58, y: 68 } },
};

const siteAnalysis: SiteAnalysisData = {
  siteBoundary: '已确认',
  buildingFootprint: '已确认',
  mainEntrance: '西南侧',
  mainViewSide: '建筑南侧',
  neighborInterface: '西侧',
  borrowedViewDirection: '东南侧',
  screeningRequired: ['西侧', '入口直视方向'],
};

const requirementConfirmation: RequirementConfirmation = {
  functionalNeeds: '茶庭停留，保留月洞门入口',
  stylePreference: '书斋园居',
  landscapeElements: '水院为核',
  waterRatio: '38%',
  rockRatio: '46%',
  structureTypes: '亭、曲桥',
  plantPreference: '竹、松、枫',
};

describe('createRuleLayoutContext', () => {
  it('maps site percentages into SVG bounds and footprint bounds', () => {
    const context = createRuleLayoutContext({ parameters, siteMarkup, siteAnalysis, requirementConfirmation });

    expect(context.siteBounds).toEqual({ x: 108, y: 152, width: 864, height: 547.2 });
    expect(context.buildingBounds).toEqual({ x: 324, y: 136.8, width: 432, height: 152 });
    expect(context.boundaryPoints[0]).toEqual({ x: 108, y: 152 });
    expect(context.buildingPoints[2]).toEqual({ x: 734.4, y: 273.6 });
  });

  it('parses sides and screening requirements from analysis and markers', () => {
    const context = createRuleLayoutContext({ parameters, siteMarkup, siteAnalysis, requirementConfirmation });

    expect(context.mainEntranceSide).toBe('south');
    expect(context.mainViewSide).toBe('south');
    expect(context.neighborSide).toBe('west');
    expect(context.borrowedViewDirection).toBe('east');
    expect(context.requiresScreening).toEqual(['west', 'entry']);
  });

  it('normalizes rule-driving parameter profiles', () => {
    const context = createRuleLayoutContext({ parameters, siteMarkup, siteAnalysis, requirementConfirmation });

    expect(context.parameters).toEqual(parameters);
    expect(context.scaleProfile).toEqual({ name: 'medium', value: 64, inset: 60, maxFeatureRatio: 0.46 });
    expect(context.waterProfile).toMatchObject({ targetRatio: 0.38, sizeName: 'medium' });
    expect(context.rockProfile).toMatchObject({ density: 46, count: 5 });
    expect(context.plantingProfile).toMatchObject({ density: 62, groupCount: 9, screenDensity: 4 });
    expect(context.pathProfile).toMatchObject({ curvature: 58, bendCount: 3 });
    expect(context.styleProfile).toEqual({ style: 'scholar', buildingLabel: '书斋', structureMood: '书斋园居' });
    expect(context.focalProfile).toEqual({ focalPoint: 'pond', priority: 'water' });
  });

  it('preserves explicit requirement text for rule priority decisions', () => {
    const context = createRuleLayoutContext({ parameters, siteMarkup, siteAnalysis, requirementConfirmation });

    expect(context.requirementProfile.explicitStructures).toEqual(['亭', '曲桥', '月洞门']);
    expect(context.requirementProfile.explicitPlants).toEqual(['竹', '松', '枫']);
    expect(context.requirementProfile.functionalNeeds).toContain('茶庭');
  });

  it('falls back to the default SVG courtyard when boundary is incomplete', () => {
    const context = createRuleLayoutContext({
      parameters: { ...parameters, courtyardScale: 28 },
      siteMarkup: { boundary: [], buildingFootprint: [] },
      siteAnalysis: { ...siteAnalysis, siteBoundary: '待确认', buildingFootprint: '待确认', neighborInterface: '待判断' },
      requirementConfirmation,
    });

    expect(context.siteBounds).toEqual({ x: 42, y: 42, width: 996, height: 676 });
    expect(context.buildingBounds).toBeUndefined();
    expect(context.scaleProfile.name).toBe('small');
    expect(context.quietZones.length).toBeGreaterThan(1);
  });
});
