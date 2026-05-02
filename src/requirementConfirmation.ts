import type { BuildingStyle, FocalPoint, GardenParameters } from './gardenGenerator';

export interface RequirementConfirmation {
  functionalNeeds: string;
  stylePreference: string;
  landscapeElements: string;
  waterRatio: string;
  rockRatio: string;
  structureTypes: string;
  plantPreference: string;
}

export type RequirementConfirmationKey = keyof RequirementConfirmation;

export function createDefaultRequirementConfirmation(parameters: GardenParameters): RequirementConfirmation {
  return {
    functionalNeeds: parameters.courtyardScale > 70 ? '舒展游赏与会客' : '紧凑游赏与停留',
    stylePreference: styleLabel[parameters.buildingStyle],
    landscapeElements: focalLabel[parameters.focalPoint],
    waterRatio: `${parameters.waterRatio}%`,
    rockRatio: `${parameters.rockDensity}%`,
    structureTypes: parameters.focalPoint === 'pavilion' ? '亭榭与连廊' : '厅堂、连廊、景亭',
    plantPreference: parameters.plantingDensity > 60 ? '松、竹、枫与水生植物偏密配置' : '松、竹、枫点景配置',
  };
}

export function resolveRequirementConfirmation(parameters: GardenParameters, existing?: RequirementConfirmation): RequirementConfirmation {
  return existing ?? createDefaultRequirementConfirmation(parameters);
}

export function updateRequirementConfirmation(
  confirmation: RequirementConfirmation,
  key: RequirementConfirmationKey,
  value: string,
): RequirementConfirmation {
  return { ...confirmation, [key]: value };
}

const styleLabel: Record<BuildingStyle, string> = {
  classic: '典雅厅堂',
  compact: '紧凑小筑',
  scholar: '书斋园居',
};

const focalLabel: Record<FocalPoint, string> = {
  pond: '水院为核',
  rockery: '叠山为核',
  pavilion: '亭榭为核',
};
