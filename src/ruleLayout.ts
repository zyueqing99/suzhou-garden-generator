import type { GardenParameters } from './gardenGenerator';
import { PLAN_HEIGHT, PLAN_WIDTH } from './gardenGenerator';
import type { RequirementConfirmation } from './requirementConfirmation';
import type { SiteAnalysisData, SiteMarkup, SitePoint } from './siteAnalysis';

export type LayoutSide = 'north' | 'east' | 'south' | 'west' | 'unknown';
export type ScreeningDirection = Exclude<LayoutSide, 'unknown'> | 'entry';

export interface LayoutPoint {
  x: number;
  y: number;
}

export interface LayoutBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ScaleProfile {
  name: 'small' | 'medium' | 'large';
  value: number;
  inset: number;
  maxFeatureRatio: number;
}

export interface WaterProfile {
  targetRatio: number;
  sizeName: 'small' | 'medium' | 'large';
}

export interface RockProfile {
  density: number;
  count: number;
  scale: number;
  emphasizeRockery: boolean;
}

export interface PlantingProfile {
  density: number;
  groupCount: number;
  screenDensity: number;
  frameCount: number;
}

export interface PathProfile {
  curvature: number;
  bendCount: number;
  offset: number;
}

export interface StyleProfile {
  style: GardenParameters['buildingStyle'];
  buildingLabel: string;
  structureMood: string;
}

export interface FocalProfile {
  focalPoint: GardenParameters['focalPoint'];
  priority: 'water' | 'rockery' | 'pavilion';
}

export interface RequirementProfile {
  functionalNeeds: string;
  structureTypes: string;
  plantPreference: string;
  explicitStructures: string[];
  explicitPlants: string[];
}

export interface QuietZone {
  id: string;
  x: number;
  y: number;
  side: LayoutSide;
}

export interface RuleLayoutContext {
  width: number;
  height: number;
  parameters: GardenParameters;
  siteMarkup: SiteMarkup;
  siteAnalysis: SiteAnalysisData;
  requirementConfirmation: RequirementConfirmation;
  boundaryPoints: LayoutPoint[];
  buildingPoints: LayoutPoint[];
  siteBounds: LayoutBounds;
  buildingBounds?: LayoutBounds;
  mainEntranceSide: LayoutSide;
  mainViewSide: LayoutSide;
  neighborSide: LayoutSide;
  borrowedViewDirection: LayoutSide;
  requiresScreening: ScreeningDirection[];
  quietZones: QuietZone[];
  scaleProfile: ScaleProfile;
  waterProfile: WaterProfile;
  rockProfile: RockProfile;
  plantingProfile: PlantingProfile;
  pathProfile: PathProfile;
  styleProfile: StyleProfile;
  focalProfile: FocalProfile;
  requirementProfile: RequirementProfile;
}

export interface CreateRuleLayoutContextInput {
  parameters: GardenParameters;
  siteMarkup: SiteMarkup;
  siteAnalysis: SiteAnalysisData;
  requirementConfirmation: RequirementConfirmation;
}

const FALLBACK_SITE_BOUNDS: LayoutBounds = { x: 42, y: 42, width: 996, height: 676 };

export function createRuleLayoutContext({
  parameters,
  siteMarkup,
  siteAnalysis,
  requirementConfirmation,
}: CreateRuleLayoutContextInput): RuleLayoutContext {
  const boundaryPoints = mapSitePoints(siteMarkup.boundary);
  const buildingPoints = mapSitePoints(siteMarkup.buildingFootprint);
  const siteBounds = boundaryPoints.length >= 3 ? boundsFromPoints(boundaryPoints) : FALLBACK_SITE_BOUNDS;
  const buildingBounds = buildingPoints.length >= 3 ? boundsFromPoints(buildingPoints) : undefined;
  const mainEntranceSide = parseSide(siteAnalysis.mainEntrance);
  const mainViewSide = parseSide(siteAnalysis.mainViewSide);
  const neighborSide = parseSide(siteAnalysis.neighborInterface);
  const borrowedViewDirection = parseBorrowedViewSide(siteAnalysis.borrowedViewDirection);
  const requiresScreening = parseScreening(siteAnalysis.screeningRequired);
  const scaleProfile = createScaleProfile(parameters.courtyardScale);

  return {
    width: PLAN_WIDTH,
    height: PLAN_HEIGHT,
    parameters,
    siteMarkup,
    siteAnalysis,
    requirementConfirmation,
    boundaryPoints,
    buildingPoints,
    siteBounds,
    buildingBounds,
    mainEntranceSide,
    mainViewSide,
    neighborSide,
    borrowedViewDirection,
    requiresScreening,
    quietZones: createQuietZones(siteBounds, mainEntranceSide),
    scaleProfile,
    waterProfile: createWaterProfile(parameters.waterRatio),
    rockProfile: createRockProfile(parameters.rockDensity, parameters.focalPoint),
    plantingProfile: createPlantingProfile(parameters.plantingDensity),
    pathProfile: createPathProfile(parameters.pathCurvature),
    styleProfile: createStyleProfile(parameters.buildingStyle),
    focalProfile: createFocalProfile(parameters.focalPoint),
    requirementProfile: createRequirementProfile(requirementConfirmation),
  };
}

export function hasUsableSiteContext(context: RuleLayoutContext | undefined): context is RuleLayoutContext {
  return Boolean(context && (context.boundaryPoints.length >= 3 || context.buildingPoints.length >= 3 || context.requiresScreening.length > 0));
}

function mapSitePoints(points: SitePoint[]): LayoutPoint[] {
  return points.map((point) => ({
    x: roundLayout((point.x / 100) * PLAN_WIDTH),
    y: roundLayout((point.y / 100) * PLAN_HEIGHT),
  }));
}

function boundsFromPoints(points: LayoutPoint[]): LayoutBounds {
  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);

  return {
    x: roundLayout(minX),
    y: roundLayout(minY),
    width: roundLayout(maxX - minX),
    height: roundLayout(maxY - minY),
  };
}

function parseScreening(values: string[]): ScreeningDirection[] {
  const directions = values.flatMap((value): ScreeningDirection[] => {
    if (value.includes('入口')) {
      return ['entry'];
    }

    const side = parseSide(value);
    return side === 'unknown' ? [] : [side];
  });

  return Array.from(new Set(directions));
}

function parseSide(value: string): LayoutSide {
  if (value.includes('南')) {
    return 'south';
  }
  if (value.includes('北')) {
    return 'north';
  }
  if (value.includes('西')) {
    return 'west';
  }
  if (value.includes('东')) {
    return 'east';
  }
  return 'unknown';
}

function parseBorrowedViewSide(value: string): LayoutSide {
  if (value.includes('西')) {
    return 'west';
  }
  if (value.includes('东')) {
    return 'east';
  }
  return parseSide(value);
}

function createScaleProfile(value: number): ScaleProfile {
  const name = value < 40 ? 'small' : value < 72 ? 'medium' : 'large';
  return {
    name,
    value,
    inset: value < 40 ? 78 : value < 72 ? 60 : 46,
    maxFeatureRatio: value < 40 ? 0.34 : value < 72 ? 0.46 : 0.56,
  };
}

function createWaterProfile(waterRatio: number): WaterProfile {
  return {
    targetRatio: clamp(waterRatio, 0, 100) / 100,
    sizeName: waterRatio < 30 ? 'small' : waterRatio < 56 ? 'medium' : 'large',
  };
}

function createRockProfile(rockDensity: number, focalPoint: GardenParameters['focalPoint']): RockProfile {
  return {
    density: rockDensity,
    count: Math.round(2 + clamp(rockDensity, 0, 100) / 18),
    scale: 0.82 + clamp(rockDensity, 0, 100) / 130,
    emphasizeRockery: focalPoint === 'rockery',
  };
}

function createPlantingProfile(plantingDensity: number): PlantingProfile {
  const density = clamp(plantingDensity, 0, 100);
  return {
    density,
    groupCount: Math.round(4 + density / 12),
    screenDensity: Math.round(2 + density / 28),
    frameCount: Math.round(2 + density / 24),
  };
}

function createPathProfile(pathCurvature: number): PathProfile {
  const curvature = clamp(pathCurvature, 0, 100);
  return {
    curvature,
    bendCount: Math.round(1 + curvature / 35),
    offset: 44 + curvature * 1.4,
  };
}

function createStyleProfile(style: GardenParameters['buildingStyle']): StyleProfile {
  const styleNames = {
    classic: { buildingLabel: '厅堂', structureMood: '典雅厅堂' },
    compact: { buildingLabel: '小筑', structureMood: '紧凑小筑' },
    scholar: { buildingLabel: '书斋', structureMood: '书斋园居' },
  };

  return { style, ...styleNames[style] };
}

function createFocalProfile(focalPoint: GardenParameters['focalPoint']): FocalProfile {
  const priority = {
    pond: 'water',
    rockery: 'rockery',
    pavilion: 'pavilion',
  } as const;

  return { focalPoint, priority: priority[focalPoint] };
}

function createRequirementProfile(requirement: RequirementConfirmation): RequirementProfile {
  const combinedStructures = `${requirement.structureTypes} ${requirement.functionalNeeds}`;
  const combinedPlants = `${requirement.plantPreference} ${requirement.functionalNeeds}`;

  return {
    functionalNeeds: requirement.functionalNeeds,
    structureTypes: requirement.structureTypes,
    plantPreference: requirement.plantPreference,
    explicitStructures: uniqueMatches(combinedStructures, ['亭', '廊', '桥', '曲桥', '月洞门']),
    explicitPlants: uniqueMatches(combinedPlants, ['竹', '松', '枫', '莲', '梅']),
  };
}

function uniqueMatches(source: string, tokens: string[]) {
  return tokens.filter((token) => source.includes(token) && !tokens.some((other) => other !== token && other.includes(token) && source.includes(other)));
}

function createQuietZones(bounds: LayoutBounds, entranceSide: LayoutSide): QuietZone[] {
  const marginX = bounds.width * 0.18;
  const marginY = bounds.height * 0.18;
  const zones: QuietZone[] = [
    { id: 'quiet-northwest', x: bounds.x + marginX, y: bounds.y + marginY, side: 'north' },
    { id: 'quiet-northeast', x: bounds.x + bounds.width - marginX, y: bounds.y + marginY, side: 'north' },
    { id: 'quiet-southwest', x: bounds.x + marginX, y: bounds.y + bounds.height - marginY, side: 'south' },
    { id: 'quiet-southeast', x: bounds.x + bounds.width - marginX, y: bounds.y + bounds.height - marginY, side: 'south' },
  ];

  const filtered = zones.filter((zone) => zone.side !== entranceSide);
  return filtered.length >= 2 ? filtered : zones;
}

function roundLayout(value: number) {
  return Math.round(value * 10) / 10;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}
