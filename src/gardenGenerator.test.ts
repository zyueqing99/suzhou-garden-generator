import { describe, expect, it } from 'vitest';
import { generateGardenPlan, type GardenParameters } from './gardenGenerator';
import { createRuleLayoutContext } from './ruleLayout';
import type { RequirementConfirmation } from './requirementConfirmation';
import type { SiteAnalysisData, SiteMarkup } from './siteAnalysis';

const baseParameters: GardenParameters = {
  courtyardScale: 62,
  waterRatio: 36,
  rockDensity: 42,
  plantingDensity: 58,
  pathCurvature: 52,
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
  functionalNeeds: '茶庭停留，保留月洞门入口',
  stylePreference: '典雅厅堂',
  landscapeElements: '水院为核',
  waterRatio: '36%',
  rockRatio: '42%',
  structureTypes: '亭、曲桥',
  plantPreference: '竹、松、枫',
};

function ruleContext(parameters: GardenParameters) {
  return createRuleLayoutContext({ parameters, siteMarkup, siteAnalysis, requirementConfirmation });
}

describe('generateGardenPlan', () => {
  it('returns a deterministic named plan with bounded SVG elements', () => {
    const first = generateGardenPlan(baseParameters, 7);
    const second = generateGardenPlan(baseParameters, 7);

    expect(first).toEqual(second);
    expect(first.name).toContain('水院');
    expect(first.elements.length).toBeGreaterThan(12);
    expect(first.elements.every((element) => element.x >= 0 && element.x <= first.width)).toBe(true);
    expect(first.elements.every((element) => element.y >= 0 && element.y <= first.height)).toBe(true);
  });

  it('responds to dense planting and rock parameters', () => {
    const sparse = generateGardenPlan({ ...baseParameters, plantingDensity: 10, rockDensity: 10 }, 3);
    const dense = generateGardenPlan({ ...baseParameters, plantingDensity: 90, rockDensity: 90 }, 3);

    const sparsePlants = sparse.elements.filter((element) => element.kind === 'plant').length;
    const densePlants = dense.elements.filter((element) => element.kind === 'plant').length;
    const sparseRocks = sparse.elements.filter((element) => element.kind === 'rock').length;
    const denseRocks = dense.elements.filter((element) => element.kind === 'rock').length;

    expect(densePlants).toBeGreaterThan(sparsePlants);
    expect(denseRocks).toBeGreaterThan(sparseRocks);
  });

  it('keeps the no-site generation path deterministic and explanation-free', () => {
    const plan = generateGardenPlan(baseParameters, 13);

    expect(plan).toEqual(generateGardenPlan(baseParameters, 13));
    expect(plan.ruleExplanations).toBeUndefined();
    expect(plan.elements.every((element) => !element.sourceRule)).toBe(true);
  });

  it('adds rule-based elements and explanations when site context is provided', () => {
    const plan = generateGardenPlan(baseParameters, 13, ruleContext(baseParameters));

    expect(plan.elements.some((element) => element.id === 'site-boundary-reference' && element.layer === 'base')).toBe(true);
    expect(plan.elements.some((element) => element.id === 'building-footprint-reference' && element.layer === 'building')).toBe(true);
    expect(plan.elements.some((element) => element.sourceRule === 'neighbor-bamboo-screen')).toBe(true);
    expect(plan.ruleExplanations?.some((explanation) => explanation.summary.includes('竹影障景'))).toBe(true);
  });

  it('uses rule context water ratio to change the generated water court area', () => {
    const dryParameters = { ...baseParameters, waterRatio: 18 };
    const wetParameters = { ...baseParameters, waterRatio: 78 };
    const dry = generateGardenPlan(dryParameters, 13, ruleContext(dryParameters));
    const wet = generateGardenPlan(wetParameters, 13, ruleContext(wetParameters));
    const dryWater = dry.elements.find((element) => element.id === 'rule-water-court');
    const wetWater = wet.elements.find((element) => element.id === 'rule-water-court');

    expect((wetWater?.width ?? 0) * (wetWater?.height ?? 0)).toBeGreaterThan((dryWater?.width ?? 0) * (dryWater?.height ?? 0));
  });
});
