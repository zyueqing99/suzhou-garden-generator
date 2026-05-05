import type { GardenParameters } from './gardenGenerator';
import type { SiteAnalysisData } from './siteAnalysis';

export interface PlanExplanationSection {
  title: string;
  body: string;
}

export function buildPlanExplanation({
  projectName,
  siteAnalysis,
  parameters,
  customPrompt,
}: {
  projectName: string;
  siteAnalysis: SiteAnalysisData;
  parameters: GardenParameters;
  customPrompt: string;
}): PlanExplanationSection[] {
  const focal = focalLabel[parameters.focalPoint];
  const style = styleLabel[parameters.buildingStyle];
  const screening = siteAnalysis.screeningRequired.length ? siteAnalysis.screeningRequired.join('、') : '待结合现场复核';

  return [
    {
      title: '总体布局说明',
      body: `${projectName}以${focal}为核心组织空间，采用${style}语汇，水景比例 ${parameters.waterRatio}%，植物密度 ${parameters.plantingDensity}%。`,
    },
    {
      title: '功能分区说明',
      body: `建筑轮廓${siteAnalysis.buildingFootprint}，庭院围绕入口、建筑界面与${focal}形成停留、游赏和观景分区。`,
    },
    {
      title: '动线说明',
      body: `主入口位于${siteAnalysis.mainEntrance}，路径曲率 ${parameters.pathCurvature}%，以曲径通幽、障景转折和水院展开组织游线。`,
    },
    {
      title: '景观节点说明',
      body: `主要景观方向为${siteAnalysis.mainViewSide}，借景方向为${siteAnalysis.borrowedViewDirection}，叠石比例 ${parameters.rockDensity}% 用于强化节点层次。`,
    },
    {
      title: '苏州园林手法',
      body: '方案优先使用借景、对景、框景、漏景、障景、叠石理水和小中见大的空间组织方法。',
    },
    {
      title: '周边关系回应',
      body: `相邻界面判断为${siteAnalysis.neighborInterface}，遮挡建议集中在${screening}，通过粉墙、竹影、树阵和景石控制视线。`,
    },
    {
      title: '可落地性提醒',
      body: customPrompt.trim() || '后续需结合实测尺寸、消防疏散、排水坡向和植物耐候性复核方案可行性。',
    },
  ];
}

const focalLabel: Record<GardenParameters['focalPoint'], string> = {
  pond: '水院',
  rockery: '叠山',
  pavilion: '亭榭',
};

const styleLabel: Record<GardenParameters['buildingStyle'], string> = {
  classic: '典雅厅堂',
  compact: '紧凑小筑',
  scholar: '书斋园居',
};
