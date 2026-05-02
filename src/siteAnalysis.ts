export interface SitePoint {
  x: number;
  y: number;
}

export type SiteMarkerKind = 'mainEntrance' | 'mainViewSide';
export type SiteMarkupTool = 'boundary' | 'buildingFootprint' | 'mainEntrance' | 'mainViewSide';

export interface SiteMarker {
  kind: SiteMarkerKind;
  point: SitePoint;
}

export interface SiteMarkup {
  boundary: SitePoint[];
  buildingFootprint: SitePoint[];
  mainEntrance?: SiteMarker;
  mainViewSide?: SiteMarker;
}

export interface SiteAnalysisData {
  siteBoundary: '已确认' | '待确认';
  buildingFootprint: '已确认' | '待确认';
  mainEntrance: string;
  mainViewSide: string;
  neighborInterface: string;
  borrowedViewDirection: string;
  screeningRequired: string[];
}

export const emptySiteMarkup: SiteMarkup = {
  boundary: [],
  buildingFootprint: [],
};

export function createSiteMarker(kind: SiteMarkerKind, point: SitePoint): SiteMarker {
  return { kind, point: normalizeSitePoint(point) };
}

export function normalizeSitePoint(point: SitePoint): SitePoint {
  return {
    x: clamp(Math.round(point.x * 10) / 10, 0, 100),
    y: clamp(Math.round(point.y * 10) / 10, 0, 100),
  };
}

export function createSiteAnalysis(markup: SiteMarkup): SiteAnalysisData {
  const neighborInterface = inferNeighborInterface(markup.boundary);
  const screeningRequired = [
    ...(neighborInterface === '待判断' ? [] : [neighborInterface]),
    ...(markup.mainEntrance ? ['入口直视方向'] : []),
  ];

  return {
    siteBoundary: markup.boundary.length >= 3 ? '已确认' : '待确认',
    buildingFootprint: markup.buildingFootprint.length >= 3 ? '已确认' : '待确认',
    mainEntrance: markup.mainEntrance ? pointToCompass(markup.mainEntrance.point) : '待标记',
    mainViewSide: markup.mainViewSide ? `建筑${pointToSide(markup.mainViewSide.point)}侧` : '待标记',
    neighborInterface,
    borrowedViewDirection: markup.mainViewSide ? pointToCompass(markup.mainViewSide.point) : '待判断',
    screeningRequired,
  };
}

export function appendSiteMarkupPoint(markup: SiteMarkup, tool: SiteMarkupTool, point: SitePoint): SiteMarkup {
  const normalizedPoint = normalizeSitePoint(point);

  if (tool === 'boundary') {
    if (markup.boundary.length >= 3) {
      return markup;
    }
    return { ...markup, boundary: [...markup.boundary, normalizedPoint] };
  }
  if (tool === 'buildingFootprint') {
    return { ...markup, buildingFootprint: [...markup.buildingFootprint, normalizedPoint] };
  }
  if (tool === 'mainEntrance') {
    return { ...markup, mainEntrance: createSiteMarker('mainEntrance', normalizedPoint) };
  }
  return { ...markup, mainViewSide: createSiteMarker('mainViewSide', normalizedPoint) };
}

export function clearSiteMarkupByTool(markup: SiteMarkup, tool: SiteMarkupTool): SiteMarkup {
  if (tool === 'boundary') {
    return { ...markup, boundary: [] };
  }
  if (tool === 'buildingFootprint') {
    return { ...markup, buildingFootprint: [] };
  }
  if (tool === 'mainEntrance') {
    return { ...markup, mainEntrance: undefined };
  }
  return { ...markup, mainViewSide: undefined };
}

function inferNeighborInterface(boundary: SitePoint[]) {
  if (boundary.length < 3) {
    return '待判断';
  }

  const averageX = boundary.reduce((sum, point) => sum + point.x, 0) / boundary.length;
  return averageX <= 50 ? '西侧' : '东侧';
}

function pointToCompass(point: SitePoint) {
  const vertical = point.y < 38 ? '北' : point.y > 62 ? '南' : '';
  const horizontal = point.x < 38 ? '西' : point.x > 55 ? '东' : '';
  return `${horizontal}${vertical}` ? `${horizontal}${vertical}侧` : '中心';
}

function pointToSide(point: SitePoint) {
  if (point.y >= 55) {
    return '南';
  }
  if (point.y <= 45) {
    return '北';
  }
  return point.x >= 50 ? '东' : '西';
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}
