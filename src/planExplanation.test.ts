import { describe, expect, it } from 'vitest';
import type { GardenParameters } from './gardenGenerator';
import { buildPlanExplanation } from './planExplanation';
import type { SiteAnalysisData } from './siteAnalysis';

const parameters: GardenParameters = {
  courtyardScale: 64,
  waterRatio: 42,
  rockDensity: 55,
  plantingDensity: 68,
  pathCurvature: 58,
  buildingStyle: 'classic',
  focalPoint: 'pond',
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

describe('planExplanation', () => {
  it('根据场地解析和生成控制生成固定栏目说明', () => {
    const explanation = buildPlanExplanation({
      projectName: '苏式庭院方案',
      siteAnalysis,
      parameters,
      customPrompt: '强调茶庭收束。',
    });

    expect(explanation).toHaveLength(7);
    expect(explanation.map((item) => item.title)).toEqual([
      '总体布局说明',
      '功能分区说明',
      '动线说明',
      '景观节点说明',
      '苏州园林手法',
      '周边关系回应',
      '可落地性提醒',
    ]);
    expect(explanation[0].body).toContain('苏式庭院方案');
    expect(explanation[0].body).toContain('水景比例 42%');
    expect(explanation[5].body).toContain('西侧');
  });
});
