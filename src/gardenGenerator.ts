import type { RuleExplanation } from './suzhouRules';
import { applySuzhouRules } from './suzhouRules';
import { hasUsableSiteContext, type RuleLayoutContext } from './ruleLayout';

export type BuildingStyle = 'classic' | 'compact' | 'scholar';
export type FocalPoint = 'pond' | 'rockery' | 'pavilion';

export interface GardenParameters {
  courtyardScale: number;
  waterRatio: number;
  rockDensity: number;
  plantingDensity: number;
  pathCurvature: number;
  buildingStyle: BuildingStyle;
  focalPoint: FocalPoint;
}

export type GardenElementKind =
  | 'wall'
  | 'building'
  | 'water'
  | 'path'
  | 'bridge'
  | 'rock'
  | 'plant'
  | 'pavilion'
  | 'gate'
  | 'label'
  | 'screenWall'
  | 'viewArrow'
  | 'moonGate'
  | 'bambooScreen'
  | 'courtyardNode';

export interface GardenElement {
  id: string;
  kind: GardenElementKind;
  x: number;
  y: number;
  width?: number;
  height?: number;
  radius?: number;
  rotation?: number;
  points?: Array<{ x: number; y: number }>;
  text?: string;
  variant?: string;
  sourceRule?: string;
  label?: string;
  description?: string;
  layer?: 'base' | 'screening' | 'building' | 'water' | 'path' | 'planting' | 'structure' | 'annotation';
}

export interface GardenPlan {
  name: string;
  width: number;
  height: number;
  seed: number;
  summary: string[];
  elements: GardenElement[];
  ruleExplanations?: RuleExplanation[];
}

export const PLAN_WIDTH = 1080;
export const PLAN_HEIGHT = 760;

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function mulberry32(seed: number) {
  let state = seed >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let result = state;
    result = Math.imul(result ^ (result >>> 15), result | 1);
    result ^= result + Math.imul(result ^ (result >>> 7), result | 61);
    return ((result ^ (result >>> 14)) >>> 0) / 4294967296;
  };
}

function numberFromRange(random: () => number, min: number, max: number) {
  return min + random() * (max - min);
}

function pointInBounds(x: number, y: number) {
  return {
    x: clamp(Math.round(x), 0, PLAN_WIDTH),
    y: clamp(Math.round(y), 0, PLAN_HEIGHT),
  };
}

function boundedElement(element: GardenElement): GardenElement {
  const point = pointInBounds(element.x, element.y);
  return {
    ...element,
    x: point.x,
    y: point.y,
    points: element.points?.map((pathPoint) => pointInBounds(pathPoint.x, pathPoint.y)),
  };
}

export function generateGardenPlan(parameters: GardenParameters, seed = Date.now(), ruleContext?: RuleLayoutContext): GardenPlan {
  if (hasUsableSiteContext(ruleContext)) {
    return generateRuleBasedGardenPlan(parameters, seed, ruleContext);
  }

  const random = mulberry32(seed);
  const scale = clamp(parameters.courtyardScale, 20, 100);
  const inset = 42 + (100 - scale) * 0.34;
  const innerWidth = PLAN_WIDTH - inset * 2;
  const innerHeight = PLAN_HEIGHT - inset * 2;
  const waterWidth = 220 + parameters.waterRatio * 3.2;
  const waterHeight = 110 + parameters.waterRatio * 1.85;
  const centerX = PLAN_WIDTH * (parameters.focalPoint === 'rockery' ? 0.55 : 0.51);
  const centerY = PLAN_HEIGHT * (parameters.focalPoint === 'pavilion' ? 0.55 : 0.52);

  const elements: GardenElement[] = [
    {
      id: 'outer-wall',
      kind: 'wall',
      x: inset,
      y: inset,
      width: innerWidth,
      height: innerHeight,
      variant: 'whitewashed',
    },
    {
      id: 'entry-gate',
      kind: 'gate',
      x: inset + innerWidth * 0.08,
      y: inset + innerHeight - 16,
      width: 116,
      height: 34,
      variant: 'moon',
    },
    {
      id: 'main-hall',
      kind: 'building',
      x: inset + innerWidth * 0.16,
      y: inset + 48,
      width: parameters.buildingStyle === 'compact' ? 210 : 268,
      height: parameters.buildingStyle === 'scholar' ? 96 : 112,
      variant: parameters.buildingStyle,
      text: parameters.buildingStyle === 'scholar' ? '书斋' : '厅堂',
    },
    {
      id: 'side-gallery',
      kind: 'building',
      x: inset + innerWidth * 0.73,
      y: inset + 74,
      width: 178,
      height: 82,
      variant: 'gallery',
      text: '廊',
    },
    {
      id: 'central-pond',
      kind: 'water',
      x: centerX - waterWidth / 2,
      y: centerY - waterHeight / 2,
      width: waterWidth,
      height: waterHeight,
      variant: parameters.focalPoint === 'pond' ? 'primary' : 'quiet',
    },
    {
      id: 'zigzag-bridge',
      kind: 'bridge',
      x: centerX - 78,
      y: centerY - 2,
      width: 164,
      height: 28,
      rotation: -8 + random() * 16,
      variant: 'stone',
    },
    {
      id: 'water-pavilion',
      kind: 'pavilion',
      x: centerX + waterWidth * 0.38,
      y: centerY - waterHeight * 0.68,
      radius: parameters.focalPoint === 'pavilion' ? 58 : 45,
      variant: parameters.focalPoint === 'pavilion' ? 'primary' : 'resting',
      text: '亭',
    },
  ];

  const curve = parameters.pathCurvature / 100;
  elements.push({
    id: 'main-path',
    kind: 'path',
    x: inset + innerWidth * 0.12,
    y: inset + innerHeight * 0.86,
    points: [
      { x: inset + innerWidth * 0.12, y: inset + innerHeight * 0.86 },
      { x: centerX - 210 * curve, y: centerY + 168 },
      { x: centerX - 84, y: centerY + 64 },
      { x: centerX + 42, y: centerY + 36 },
      { x: centerX + 198 * curve, y: centerY - 116 },
      { x: inset + innerWidth * 0.78, y: inset + 126 },
    ],
    variant: 'pebble',
  });

  const rockCount = Math.round(4 + parameters.rockDensity / 8);
  for (let index = 0; index < rockCount; index += 1) {
    const nearFocal = parameters.focalPoint === 'rockery' ? 0.72 : 0.42;
    const baseX = random() < nearFocal ? centerX - waterWidth * 0.52 : inset + innerWidth * random();
    const baseY = random() < nearFocal ? centerY - waterHeight * 0.45 : inset + innerHeight * random();
    elements.push({
      id: `rock-${index}`,
      kind: 'rock',
      x: baseX + numberFromRange(random, -74, 74),
      y: baseY + numberFromRange(random, -48, 72),
      width: numberFromRange(random, 32, 66),
      height: numberFromRange(random, 42, 90),
      rotation: numberFromRange(random, -16, 18),
      variant: index % 3 === 0 ? 'taihu' : 'cluster',
    });
  }

  const plantCount = Math.round(7 + parameters.plantingDensity / 5);
  for (let index = 0; index < plantCount; index += 1) {
    const edgeBias = random() < 0.55;
    const x = edgeBias
      ? numberFromRange(random, inset + 68, inset + innerWidth - 68)
      : centerX + numberFromRange(random, -waterWidth * 0.78, waterWidth * 0.78);
    const y = edgeBias
      ? numberFromRange(random, inset + innerHeight * 0.58, inset + innerHeight - 74)
      : centerY + numberFromRange(random, -waterHeight * 0.9, waterHeight * 1.1);
    elements.push({
      id: `plant-${index}`,
      kind: 'plant',
      x,
      y,
      radius: numberFromRange(random, 16, 34),
      variant: ['pine', 'bamboo', 'maple', 'lotus'][index % 4],
    });
  }

  elements.push(
    {
      id: 'borrowed-view',
      kind: 'label',
      x: inset + innerWidth * 0.62,
      y: inset + innerHeight - 46,
      text: '借景窗',
      variant: 'annotation',
    },
    {
      id: 'route-label',
      kind: 'label',
      x: inset + innerWidth * 0.2,
      y: inset + innerHeight * 0.78,
      text: '游线',
      variant: 'annotation',
    },
  );

  const focusName = {
    pond: '水院',
    rockery: '叠山',
    pavilion: '亭榭',
  }[parameters.focalPoint];

  const styleName = {
    classic: '雅集',
    compact: '小筑',
    scholar: '书香',
  }[parameters.buildingStyle];

  return {
    name: `${styleName}${focusName}方案`,
    width: PLAN_WIDTH,
    height: PLAN_HEIGHT,
    seed,
    summary: [
      `庭院尺度 ${scale}%：形成${scale > 70 ? '舒展' : '紧凑'}的游赏空间`,
      `水体占比 ${parameters.waterRatio}%：以池面组织视线和动线`,
      `植物密度 ${parameters.plantingDensity}%：配置松、竹、枫与水生植物`,
      `叠石密度 ${parameters.rockDensity}%：在水岸和转折处形成景观节点`,
    ],
    elements: elements.map(boundedElement),
  };
}

function generateRuleBasedGardenPlan(parameters: GardenParameters, seed: number, ruleContext: RuleLayoutContext): GardenPlan {
  const ruleApplication = applySuzhouRules(ruleContext);
  const baseElements: GardenElement[] = [
    {
      id: 'site-boundary-reference',
      kind: 'wall',
      x: ruleContext.siteBounds.x,
      y: ruleContext.siteBounds.y,
      width: ruleContext.siteBounds.width,
      height: ruleContext.siteBounds.height,
      points: ruleContext.boundaryPoints,
      label: '地块边界',
      layer: 'base',
      variant: 'site-boundary',
    },
  ];

  if (ruleContext.buildingBounds) {
    baseElements.push({
      id: 'building-footprint-reference',
      kind: 'building',
      x: ruleContext.buildingBounds.x,
      y: ruleContext.buildingBounds.y,
      width: ruleContext.buildingBounds.width,
      height: ruleContext.buildingBounds.height,
      points: ruleContext.buildingPoints,
      text: ruleContext.styleProfile.buildingLabel,
      label: '建筑轮廓',
      layer: 'building',
      variant: parameters.buildingStyle,
    });
  }

  const focusName = {
    pond: '水院',
    rockery: '叠山',
    pavilion: '亭榭',
  }[parameters.focalPoint];

  const styleName = {
    classic: '雅集',
    compact: '小筑',
    scholar: '书香',
  }[parameters.buildingStyle];

  return {
    name: `${styleName}${focusName}规则方案`,
    width: PLAN_WIDTH,
    height: PLAN_HEIGHT,
    seed,
    summary: [
      `庭院尺度 ${parameters.courtyardScale}%：规则布局使用${ruleContext.scaleProfile.name === 'large' ? '舒展' : '紧凑'}适配`,
      `水体占比 ${parameters.waterRatio}%：以参数控制水院面积`,
      `植物密度 ${parameters.plantingDensity}%：控制遮挡带和框景植物数量`,
      ...ruleApplication.summary,
    ],
    elements: [...baseElements, ...ruleApplication.elements].map(boundedElement),
    ruleExplanations: ruleApplication.explanations,
  };
}
