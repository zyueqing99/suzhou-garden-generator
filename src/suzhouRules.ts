import type { GardenElement } from './gardenGenerator';
import type { LayoutSide, RuleLayoutContext } from './ruleLayout';

export interface SuzhouRuleDefinition {
  schemaVersion: 1;
  id: string;
  name: string;
  enabled: boolean;
  priority: number;
  source: 'built-in' | 'project' | 'user';
  category:
    | 'fixed-combination'
    | 'layout-method'
    | 'spatial-technique'
    | 'area-adaptation'
    | 'structure-combination'
    | 'path-organization'
    | 'water-court'
    | 'plant-screening'
    | 'view-framing'
    | 'text-generation';
  condition: RuleConditionDefinition;
  actions: RuleActionDefinition[];
  explanationTemplate: string;
}

export interface RuleConditionDefinition {
  kind: 'neighbor-side' | 'entry-screening' | 'always' | 'water-profile' | 'structure-profile' | 'plant-profile' | 'rock-profile';
}

export interface RuleActionDefinition {
  kind: string;
}

export interface RuleExplanation {
  ruleId: string;
  ruleName: string;
  category: SuzhouRuleDefinition['category'];
  summary: string;
  parameters: string;
}

export interface RuleApplication {
  elements: GardenElement[];
  explanations: RuleExplanation[];
  summary: string[];
}

type RuleExecutor = (context: RuleLayoutContext, rule: SuzhouRuleDefinition) => RuleApplication | null;

export const builtInSuzhouRules: SuzhouRuleDefinition[] = [
  {
    schemaVersion: 1,
    id: 'neighbor-bamboo-screen',
    name: '邻里界面竹影障景',
    enabled: true,
    priority: 10,
    source: 'built-in',
    category: 'plant-screening',
    condition: { kind: 'neighbor-side' },
    actions: [{ kind: 'create-bamboo-screen' }, { kind: 'create-screen-wall' }],
    explanationTemplate: '沿邻里界面以竹林和景墙形成竹影障景。',
  },
  {
    schemaVersion: 1,
    id: 'entry-screen-turn',
    name: '入口障景转折',
    enabled: true,
    priority: 20,
    source: 'built-in',
    category: 'path-organization',
    condition: { kind: 'entry-screening' },
    actions: [{ kind: 'create-entry-screen' }, { kind: 'create-turning-path' }],
    explanationTemplate: '入口内侧设置障景墙，使游线转折后入园。',
  },
  {
    schemaVersion: 1,
    id: 'main-view-water-court',
    name: '主景水院尺度适配',
    enabled: true,
    priority: 30,
    source: 'built-in',
    category: 'water-court',
    condition: { kind: 'water-profile' },
    actions: [{ kind: 'create-water-court' }],
    explanationTemplate: '水院尺度优先由水体占比控制，并受庭院尺度约束。',
  },
  {
    schemaVersion: 1,
    id: 'structure-combination',
    name: '构筑物组合',
    enabled: true,
    priority: 40,
    source: 'built-in',
    category: 'structure-combination',
    condition: { kind: 'structure-profile' },
    actions: [{ kind: 'create-bridge' }, { kind: 'create-pavilion' }, { kind: 'create-moon-gate' }],
    explanationTemplate: '根据水院、核心景点和需求文字生成亭、桥、月洞门组合。',
  },
  {
    schemaVersion: 1,
    id: 'plant-view-framing',
    name: '植物框景',
    enabled: true,
    priority: 50,
    source: 'built-in',
    category: 'view-framing',
    condition: { kind: 'plant-profile' },
    actions: [{ kind: 'create-frame-plants' }],
    explanationTemplate: '主视线两侧用松、竹、枫框景，水边配置莲。',
  },
  {
    schemaVersion: 1,
    id: 'rockery-density',
    name: '叠石密度',
    enabled: true,
    priority: 60,
    source: 'built-in',
    category: 'spatial-technique',
    condition: { kind: 'rock-profile' },
    actions: [{ kind: 'create-rockery' }],
    explanationTemplate: '叠石数量和尺度由叠石密度控制。',
  },
];

const executors: Record<string, RuleExecutor> = {
  'neighbor-bamboo-screen': applyNeighborBambooScreen,
  'entry-screen-turn': applyEntryScreenTurn,
  'main-view-water-court': applyMainViewWaterCourt,
  'structure-combination': applyStructureCombination,
  'plant-view-framing': applyPlantViewFraming,
  'rockery-density': applyRockeryDensity,
};

export function applySuzhouRules(context: RuleLayoutContext, ruleDefinitions = builtInSuzhouRules): RuleApplication {
  return ruleDefinitions
    .filter((rule) => rule.enabled)
    .sort((a, b) => a.priority - b.priority)
    .reduce<RuleApplication>(
      (result, rule) => {
        const application = executors[rule.id]?.(context, rule);
        if (!application) {
          return result;
        }

        return {
          elements: [...result.elements, ...application.elements],
          explanations: [...result.explanations, ...application.explanations],
          summary: [...result.summary, ...application.summary],
        };
      },
      { elements: [], explanations: [], summary: [] },
    );
}

function applyNeighborBambooScreen(context: RuleLayoutContext, rule: SuzhouRuleDefinition): RuleApplication | null {
  const side = context.neighborSide;
  if (side !== 'west' && side !== 'east') {
    return null;
  }

  const x = side === 'west' ? context.siteBounds.x + 26 : context.siteBounds.x + context.siteBounds.width - 42;
  const y = context.siteBounds.y + context.siteBounds.height * 0.16;
  const height = context.siteBounds.height * 0.66;
  const elements: GardenElement[] = [
    {
      id: `${side}-bamboo-screen`,
      kind: 'bambooScreen',
      x,
      y,
      width: 34,
      height,
      sourceRule: rule.id,
      label: '竹影障景',
      layer: 'screening',
      variant: side,
    },
    {
      id: `${side}-screen-wall`,
      kind: 'screenWall',
      x: side === 'west' ? x + 42 : x - 58,
      y: y + height * 0.28,
      width: 72,
      height: 16,
      sourceRule: rule.id,
      label: '景墙',
      layer: 'screening',
      variant: side,
    },
  ];

  return singleExplanation(rule, elements, `沿${sideName(side)}邻里界面布置竹林与景墙，形成竹影障景。`, `植物密度 ${context.plantingProfile.density}% 控制遮挡带密度 ${context.plantingProfile.screenDensity}`);
}

function applyEntryScreenTurn(context: RuleLayoutContext, rule: SuzhouRuleDefinition): RuleApplication | null {
  if (!context.requiresScreening.includes('entry') && context.mainEntranceSide === 'unknown') {
    return null;
  }

  const entrance = sideAnchor(context, context.mainEntranceSide);
  const center = layoutCenter(context);
  const bendCount = context.pathProfile.bendCount;
  const points = createEntryPathPoints(entrance, center, context.pathProfile.offset, bendCount);
  const screenPoint = points[1] ?? center;
  const elements: GardenElement[] = [
    {
      id: 'entry-screen-wall',
      kind: 'screenWall',
      x: screenPoint.x - 48,
      y: screenPoint.y - 8,
      width: 96,
      height: 16,
      sourceRule: rule.id,
      label: '入口障景',
      layer: 'screening',
    },
    {
      id: 'entry-turn-path',
      kind: 'path',
      x: entrance.x,
      y: entrance.y,
      points,
      sourceRule: rule.id,
      label: '转折游线',
      layer: 'path',
      variant: 'pebble',
    },
  ];

  return singleExplanation(rule, elements, `入口内侧设置障景墙，游线经 ${bendCount} 段转折后进入庭院核心。`, `游线曲度 ${context.pathProfile.curvature}% 形成转折偏移 ${Math.round(context.pathProfile.offset)}`);
}

function applyMainViewWaterCourt(context: RuleLayoutContext, rule: SuzhouRuleDefinition): RuleApplication {
  const availableArea = context.siteBounds.width * context.siteBounds.height;
  const targetArea = availableArea * context.waterProfile.targetRatio * 0.34;
  const maxArea = availableArea * context.scaleProfile.maxFeatureRatio * 0.46;
  const wasCapped = targetArea > maxArea;
  const area = Math.min(targetArea, maxArea);
  const width = Math.min(Math.sqrt(area * 1.9), context.siteBounds.width * 0.68);
  const height = Math.min(area / width, context.siteBounds.height * 0.42);
  const center = waterCenter(context);
  const elements: GardenElement[] = [
    {
      id: 'rule-water-court',
      kind: 'water',
      x: center.x - width / 2,
      y: center.y - height / 2,
      width,
      height,
      sourceRule: rule.id,
      label: '水院',
      description: `水体占比 ${Math.round(context.waterProfile.targetRatio * 100)}%`,
      layer: 'water',
      variant: context.focalProfile.priority === 'water' ? 'primary' : 'quiet',
    },
    {
      id: 'main-view-arrow',
      kind: 'viewArrow',
      x: context.buildingBounds ? context.buildingBounds.x + context.buildingBounds.width / 2 : context.siteBounds.x + context.siteBounds.width * 0.36,
      y: context.buildingBounds ? context.buildingBounds.y + context.buildingBounds.height : context.siteBounds.y + context.siteBounds.height * 0.22,
      points: [
        {
          x: context.buildingBounds ? context.buildingBounds.x + context.buildingBounds.width / 2 : context.siteBounds.x + context.siteBounds.width * 0.36,
          y: context.buildingBounds ? context.buildingBounds.y + context.buildingBounds.height : context.siteBounds.y + context.siteBounds.height * 0.22,
        },
        { x: center.x, y: center.y },
      ],
      sourceRule: rule.id,
      label: '主观景视线',
      layer: 'annotation',
    },
  ];
  const capText = wasCapped ? '，因地块尺度收缩水院' : '';

  return singleExplanation(
    rule,
    elements,
    `水体占比 ${Math.round(context.waterProfile.targetRatio * 100)}% 约束水院为${context.waterProfile.sizeName}尺度${capText}。`,
    `水体占比 ${Math.round(context.waterProfile.targetRatio * 100)}%，庭院尺度 ${context.scaleProfile.value}%`,
  );
}

function applyStructureCombination(context: RuleLayoutContext, rule: SuzhouRuleDefinition): RuleApplication {
  const center = waterCenter(context);
  const wantsPavilion = context.focalProfile.priority === 'pavilion' || context.requirementProfile.explicitStructures.includes('亭');
  const wantsMoonGate =
    context.requirementProfile.explicitStructures.includes('月洞门') || context.requirementProfile.functionalNeeds.includes('茶庭');
  const elements: GardenElement[] = [
    {
      id: 'rule-water-bridge',
      kind: 'bridge',
      x: center.x - 78,
      y: center.y - 12,
      width: 156,
      height: 24,
      rotation: -6,
      sourceRule: rule.id,
      label: '曲桥',
      layer: 'structure',
      variant: 'stone',
    },
  ];

  if (wantsPavilion) {
    elements.push({
      id: 'rule-pavilion',
      kind: 'pavilion',
      x: center.x + context.siteBounds.width * 0.22,
      y: center.y - context.siteBounds.height * 0.18,
      radius: context.focalProfile.priority === 'pavilion' ? 54 : 44,
      sourceRule: rule.id,
      label: '亭',
      text: '亭',
      layer: 'structure',
      variant: context.focalProfile.priority === 'pavilion' ? 'primary' : 'resting',
    });
  }

  if (wantsMoonGate) {
    const zone = context.quietZones[0] ?? { x: context.siteBounds.x + 120, y: context.siteBounds.y + 120 };
    elements.push(
      {
        id: 'rule-moon-gate',
        kind: 'moonGate',
        x: zone.x,
        y: zone.y,
        width: 64,
        height: 64,
        sourceRule: rule.id,
        label: '月洞门',
        layer: 'structure',
      },
      {
        id: 'tea-court-node',
        kind: 'courtyardNode',
        x: zone.x + 88,
        y: zone.y + 34,
        width: 92,
        height: 72,
        sourceRule: rule.id,
        label: '茶庭',
        layer: 'structure',
      },
    );
  }

  const names = ['曲桥', ...(wantsPavilion ? ['亭'] : []), ...(wantsMoonGate ? ['月洞门', '茶庭'] : [])];
  return singleExplanation(rule, elements, `构筑物组合生成${names.join('、')}，回应核心景点和显式需求。`, `核心景点 ${context.parameters.focalPoint}，构筑物需求 ${context.requirementProfile.structureTypes}`);
}

function applyPlantViewFraming(context: RuleLayoutContext, rule: SuzhouRuleDefinition): RuleApplication {
  const center = waterCenter(context);
  const variants = ['pine', 'maple', 'bamboo', 'lotus'];
  const elements = Array.from({ length: context.plantingProfile.groupCount }, (_, index): GardenElement => {
    const side = index % 2 === 0 ? -1 : 1;
    const ring = Math.floor(index / 2);
    return {
      id: `rule-frame-plant-${index}`,
      kind: 'plant',
      x: center.x + side * (112 + ring * 34),
      y: center.y + (index % 4 === 3 ? 32 : -92 + ring * 18),
      radius: 18 + (index % 3) * 4,
      sourceRule: rule.id,
      label: variants[index % variants.length],
      layer: 'planting',
      variant: variants[index % variants.length],
    };
  });

  return singleExplanation(rule, elements, `主视线两侧配置 ${context.plantingProfile.groupCount} 组松、竹、枫和水边莲形成框景。`, `植物密度 ${context.plantingProfile.density}% 控制组团数量 ${context.plantingProfile.groupCount}`);
}

function applyRockeryDensity(context: RuleLayoutContext, rule: SuzhouRuleDefinition): RuleApplication {
  const center = waterCenter(context);
  const elements = Array.from({ length: context.rockProfile.count }, (_, index): GardenElement => {
    const clusterBias = context.rockProfile.emphasizeRockery ? 0.48 : 0.32;
    return {
      id: `rule-rock-${index}`,
      kind: 'rock',
      x: center.x - context.siteBounds.width * clusterBias + index * 34,
      y: center.y - 72 + (index % 3) * 44,
      width: 36 * context.rockProfile.scale + (index % 2) * 10,
      height: 54 * context.rockProfile.scale + (index % 3) * 12,
      rotation: -14 + index * 7,
      sourceRule: rule.id,
      label: '叠石',
      layer: 'structure',
      variant: index % 3 === 0 ? 'taihu' : 'cluster',
    };
  });

  return singleExplanation(rule, elements, `叠石密度 ${context.rockProfile.density}% 生成 ${context.rockProfile.count} 组太湖石${context.rockProfile.emphasizeRockery ? '并强化主景叠山' : ''}。`, `叠石密度 ${context.rockProfile.density}%`);
}

function singleExplanation(rule: SuzhouRuleDefinition, elements: GardenElement[], summary: string, parameters: string): RuleApplication {
  return {
    elements,
    explanations: [
      {
        ruleId: rule.id,
        ruleName: rule.name,
        category: rule.category,
        summary,
        parameters,
      },
    ],
    summary: [summary],
  };
}

function waterCenter(context: RuleLayoutContext) {
  const x = context.siteBounds.x + context.siteBounds.width * 0.55;
  const y =
    context.mainViewSide === 'south'
      ? context.siteBounds.y + context.siteBounds.height * 0.6
      : context.mainViewSide === 'north'
        ? context.siteBounds.y + context.siteBounds.height * 0.4
        : context.siteBounds.y + context.siteBounds.height * 0.54;
  return { x, y };
}

function layoutCenter(context: RuleLayoutContext) {
  return {
    x: context.siteBounds.x + context.siteBounds.width * 0.52,
    y: context.siteBounds.y + context.siteBounds.height * 0.56,
  };
}

function sideAnchor(context: RuleLayoutContext, side: LayoutSide) {
  const bounds = context.siteBounds;
  if (side === 'north') {
    return { x: bounds.x + bounds.width * 0.5, y: bounds.y + 18 };
  }
  if (side === 'east') {
    return { x: bounds.x + bounds.width - 18, y: bounds.y + bounds.height * 0.5 };
  }
  if (side === 'west') {
    return { x: bounds.x + 18, y: bounds.y + bounds.height * 0.5 };
  }
  return { x: bounds.x + bounds.width * 0.18, y: bounds.y + bounds.height - 18 };
}

function createEntryPathPoints(start: { x: number; y: number }, end: { x: number; y: number }, offset: number, bendCount: number) {
  const points = [start];
  for (let index = 0; index < bendCount; index += 1) {
    const progress = (index + 1) / (bendCount + 1);
    const direction = index % 2 === 0 ? 1 : -1;
    points.push({
      x: start.x + (end.x - start.x) * progress + direction * offset,
      y: start.y + (end.y - start.y) * progress - offset * 0.28,
    });
  }
  points.push(end);
  return points;
}

function sideName(side: LayoutSide) {
  return {
    north: '北侧',
    east: '东侧',
    south: '南侧',
    west: '西侧',
    unknown: '待判断',
  }[side];
}
