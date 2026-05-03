import { describe, expect, it } from 'vitest';
import { createRuleLayoutContext, type RuleLayoutContext } from './ruleLayout';
import { applySuzhouRules, builtInSuzhouRules } from './suzhouRules';
import type { GardenParameters } from './gardenGenerator';
import type { RequirementConfirmation } from './requirementConfirmation';
import type { SiteAnalysisData, SiteMarkup } from './siteAnalysis';

const baseParameters: GardenParameters = {
  courtyardScale: 64,
  waterRatio: 38,
  rockDensity: 46,
  plantingDensity: 62,
  pathCurvature: 58,
  buildingStyle: 'classic',
  focalPoint: 'pond',
};

const siteMarkup: SiteMarkup = {
  boundary: [
    { x: 10, y: 18 },
    { x: 90, y: 18 },
    { x: 88, y: 88 },
    { x: 12, y: 90 },
  ],
  buildingFootprint: [
    { x: 32, y: 18 },
    { x: 70, y: 18 },
    { x: 70, y: 36 },
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
  functionalNeeds: '茶庭停留',
  stylePreference: '典雅厅堂',
  landscapeElements: '水院为核',
  waterRatio: '38%',
  rockRatio: '46%',
  structureTypes: '曲桥',
  plantPreference: '竹、松、枫',
};

function context(
  parameters: Partial<GardenParameters> = {},
  requirement: Partial<RequirementConfirmation> = {},
  analysis: Partial<SiteAnalysisData> = {},
): RuleLayoutContext {
  return createRuleLayoutContext({
    parameters: { ...baseParameters, ...parameters },
    siteMarkup,
    siteAnalysis: { ...siteAnalysis, ...analysis },
    requirementConfirmation: { ...requirementConfirmation, ...requirement },
  });
}

describe('applySuzhouRules', () => {
  it('exports serializable built-in rule definitions', () => {
    expect(builtInSuzhouRules.every((rule) => rule.schemaVersion === 1 && rule.enabled)).toBe(true);
    expect(builtInSuzhouRules.map((rule) => rule.id)).toContain('neighbor-bamboo-screen');
  });

  it('creates bamboo and screen wall elements for west neighbor screening', () => {
    const result = applySuzhouRules(context());

    expect(result.elements.some((element) => element.kind === 'bambooScreen' && element.sourceRule === 'neighbor-bamboo-screen')).toBe(true);
    expect(result.elements.some((element) => element.kind === 'screenWall' && element.sourceRule === 'neighbor-bamboo-screen')).toBe(true);
    expect(result.explanations.some((explanation) => explanation.summary.includes('竹影障景'))).toBe(true);
  });

  it('creates a stronger entry turn when path curvature is high', () => {
    const low = applySuzhouRules(context({ pathCurvature: 12 }));
    const high = applySuzhouRules(context({ pathCurvature: 96 }));
    const lowPath = low.elements.find((element) => element.id === 'entry-turn-path');
    const highPath = high.elements.find((element) => element.id === 'entry-turn-path');

    expect(low.elements.some((element) => element.kind === 'screenWall' && element.sourceRule === 'entry-screen-turn')).toBe(true);
    expect((highPath?.points?.length ?? 0)).toBeGreaterThan(lowPath?.points?.length ?? 0);
    expect(high.explanations.find((explanation) => explanation.ruleId === 'entry-screen-turn')?.parameters).toContain('游线曲度 96%');
  });

  it('sizes water primarily from water ratio and explains scale caps', () => {
    const smallWater = applySuzhouRules(context({ waterRatio: 20, courtyardScale: 84 }));
    const largeWater = applySuzhouRules(context({ waterRatio: 82, courtyardScale: 84 }));
    const cappedWater = applySuzhouRules(context({ waterRatio: 92, courtyardScale: 24 }));
    const smallPond = smallWater.elements.find((element) => element.id === 'rule-water-court');
    const largePond = largeWater.elements.find((element) => element.id === 'rule-water-court');

    expect((largePond?.width ?? 0) * (largePond?.height ?? 0)).toBeGreaterThan((smallPond?.width ?? 0) * (smallPond?.height ?? 0));
    expect(cappedWater.explanations.find((explanation) => explanation.ruleId === 'main-view-water-court')?.summary).toContain('因地块尺度收缩');
  });

  it('uses rock and planting density to control generated counts', () => {
    const sparse = applySuzhouRules(context({ rockDensity: 10, plantingDensity: 10 }));
    const dense = applySuzhouRules(context({ rockDensity: 90, plantingDensity: 90 }));

    expect(dense.elements.filter((element) => element.kind === 'rock')).toHaveLength(7);
    expect(sparse.elements.filter((element) => element.kind === 'rock')).toHaveLength(3);
    expect(dense.elements.filter((element) => element.kind === 'plant').length).toBeGreaterThan(sparse.elements.filter((element) => element.kind === 'plant').length);
  });

  it('prioritizes pavilion and moon gate from focal point and explicit requirements', () => {
    const result = applySuzhouRules(
      context(
        { focalPoint: 'pavilion' },
        {
          functionalNeeds: '茶庭停留，入口要月洞门',
          structureTypes: '亭、月洞门',
        },
      ),
    );

    expect(result.elements.some((element) => element.kind === 'pavilion' && element.sourceRule === 'structure-combination')).toBe(true);
    expect(result.elements.some((element) => element.kind === 'moonGate' && element.sourceRule === 'structure-combination')).toBe(true);
    expect(result.explanations.find((explanation) => explanation.ruleId === 'structure-combination')?.summary).toContain('月洞门');
  });
});
