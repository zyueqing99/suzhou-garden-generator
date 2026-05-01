import { describe, expect, it } from 'vitest';
import { generateGardenPlan, type GardenParameters } from './gardenGenerator';

const baseParameters: GardenParameters = {
  courtyardScale: 62,
  waterRatio: 36,
  rockDensity: 42,
  plantingDensity: 58,
  pathCurvature: 52,
  buildingStyle: 'classic',
  focalPoint: 'pond',
};

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
});
