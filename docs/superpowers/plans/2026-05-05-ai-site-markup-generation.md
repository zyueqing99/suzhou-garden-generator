# AI Site Markup Generation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the SVG-centered workflow with a site-image markup workflow that sends an annotated site image, site analysis JSON, generation controls, and Suzhou garden rules to `gpt-image-2`.

**Architecture:** Keep the existing React/Vite app and local project repository. Move the generation source from `GardenPlan`/`GardenPreview` to `SiteMarkup` plus a deterministic Canvas capture module, a site-image prompt builder, and a local explanation generator.

**Tech Stack:** React 19, TypeScript, Vite, Vitest, browser Canvas API, existing VectorEngine image proxy.

---

## File Structure

- Modify `src/siteAnalysis.ts`: keep the current data shape, rename user-facing meaning from `mainViewSide` to landscape direction in labels and tests, and keep normalized point data as the source of truth.
- Create `src/siteMarkupCapture.ts`: draw the uploaded site image plus markup overlay into a PNG data URL for `gpt-image-2` reference input.
- Create `src/planExplanation.ts`: generate local plan explanation sections from `SiteAnalysisData`, `GardenParameters`, and project name.
- Modify `src/aiImageClient.ts`: remove `GardenPlan` prompt dependency and add `buildSiteImagePrompt`.
- Modify `src/exporters.ts`: remove SVG export helpers and add data URL image export.
- Modify `src/components/GardenWorkspace.tsx`: remove SVG preview flow; add right-side tabs for `场地标注`、`生成方案`、`方案说明`; generate from annotated site image.
- Modify `src/components/GardenWorkspace.test.tsx`: replace SVG assertions with site-markup workflow assertions.
- Modify `src/aiImageClient.test.ts`, `src/siteAnalysis.test.ts`, and add `src/siteMarkupCapture.test.ts`, `src/planExplanation.test.ts`.
- Modify `docs/architecture/overview.md`: update data flow to match the new AI-first workflow.

---

### Task 1: Add Annotated Site Image Capture

**Files:**
- Create: `src/siteMarkupCapture.ts`
- Test: `src/siteMarkupCapture.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/siteMarkupCapture.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { buildSiteMarkupSvg, createAnnotatedSiteImagePayload } from './siteMarkupCapture';
import type { SiteMarkup } from './siteAnalysis';

const markup: SiteMarkup = {
  boundary: [
    { x: 10, y: 12 },
    { x: 90, y: 12 },
    { x: 86, y: 88 },
    { x: 14, y: 88 },
  ],
  buildingFootprint: [
    { x: 35, y: 18 },
    { x: 72, y: 18 },
    { x: 72, y: 38 },
    { x: 35, y: 38 },
  ],
  mainEntrance: { kind: 'mainEntrance', point: { x: 18, y: 82 } },
  mainViewSide: { kind: 'mainViewSide', point: { x: 64, y: 64 } },
};

describe('siteMarkupCapture', () => {
  it('builds an overlay svg from normalized markup coordinates', () => {
    const svg = buildSiteMarkupSvg(markup, { width: 1000, height: 600 });

    expect(svg).toContain('<svg');
    expect(svg).toContain('points="100,72 900,72 860,528 140,528"');
    expect(svg).toContain('points="350,108 720,108 720,228 350,228"');
    expect(svg).toContain('主入口');
    expect(svg).toContain('景观方向');
  });

  it('creates a serializable generation payload from image, markup, and analysis', () => {
    const payload = createAnnotatedSiteImagePayload({
      imageUrl: 'data:image/png;base64,abc',
      markup,
      width: 1000,
      height: 600,
    });

    expect(payload.imageUrl).toBe('data:image/png;base64,abc');
    expect(payload.overlaySvg).toContain('景观方向');
    expect(payload.dimensions).toEqual({ width: 1000, height: 600 });
  });
});
```

- [ ] **Step 2: Run the tests and verify they fail**

Run:

```bash
npm test -- src/siteMarkupCapture.test.ts
```

Expected: FAIL because `src/siteMarkupCapture.ts` does not exist.

- [ ] **Step 3: Implement the capture helpers**

Create `src/siteMarkupCapture.ts`:

```ts
import type { SiteMarkup, SitePoint } from './siteAnalysis';

export interface SiteMarkupCaptureSize {
  width: number;
  height: number;
}

export interface AnnotatedSiteImagePayload {
  imageUrl: string;
  overlaySvg: string;
  dimensions: SiteMarkupCaptureSize;
}

export function createAnnotatedSiteImagePayload({
  imageUrl,
  markup,
  width,
  height,
}: {
  imageUrl: string;
  markup: SiteMarkup;
  width: number;
  height: number;
}): AnnotatedSiteImagePayload {
  return {
    imageUrl,
    overlaySvg: buildSiteMarkupSvg(markup, { width, height }),
    dimensions: { width, height },
  };
}

export async function captureAnnotatedSiteImage({
  imageUrl,
  markup,
  width = 1536,
  height = 1024,
}: {
  imageUrl: string;
  markup: SiteMarkup;
  width?: number;
  height?: number;
}): Promise<string> {
  const image = await loadImage(imageUrl);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (!context) {
    throw new Error('无法生成带标注场地图：浏览器不支持 Canvas');
  }

  context.fillStyle = '#f7f4ec';
  context.fillRect(0, 0, width, height);
  context.drawImage(image, 0, 0, width, height);
  drawMarkup(context, markup, { width, height });

  return canvas.toDataURL('image/png');
}

export function buildSiteMarkupSvg(markup: SiteMarkup, size: SiteMarkupCaptureSize): string {
  const boundary = pointsToPixelAttribute(markup.boundary, size);
  const building = pointsToPixelAttribute(markup.buildingFootprint, size);
  const entrance = markup.mainEntrance ? pointToPixel(markup.mainEntrance.point, size) : null;
  const view = markup.mainViewSide ? pointToPixel(markup.mainViewSide.point, size) : null;

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size.width}" height="${size.height}" viewBox="0 0 ${size.width} ${size.height}">`,
    boundary ? `<polygon points="${boundary}" fill="rgba(19,97,76,0.10)" stroke="#0f5a47" stroke-width="4"/>` : '',
    building ? `<polygon points="${building}" fill="rgba(58,95,122,0.14)" stroke="#315f7a" stroke-width="4"/>` : '',
    entrance ? `<circle cx="${entrance.x}" cy="${entrance.y}" r="14" fill="#d8a338" stroke="#4e3510" stroke-width="4"/><text x="${entrance.x + 18}" y="${entrance.y + 6}" font-size="24" fill="#4e3510">主入口</text>` : '',
    view ? `<path d="M ${view.x} ${view.y - 20} L ${view.x + 18} ${view.y + 16} L ${view.x - 18} ${view.y + 16} Z" fill="#0f5a47"/><text x="${view.x + 22}" y="${view.y + 8}" font-size="24" fill="#0f5a47">景观方向</text>` : '',
    '</svg>',
  ].join('');
}

function drawMarkup(context: CanvasRenderingContext2D, markup: SiteMarkup, size: SiteMarkupCaptureSize) {
  drawPolygon(context, markup.boundary, size, '#0f5a47', 'rgba(19,97,76,0.10)');
  drawPolygon(context, markup.buildingFootprint, size, '#315f7a', 'rgba(58,95,122,0.14)');

  if (markup.mainEntrance) {
    const point = pointToPixel(markup.mainEntrance.point, size);
    context.fillStyle = '#d8a338';
    context.strokeStyle = '#4e3510';
    context.lineWidth = 4;
    context.beginPath();
    context.arc(point.x, point.y, 14, 0, Math.PI * 2);
    context.fill();
    context.stroke();
    drawLabel(context, '主入口', point.x + 18, point.y + 6, '#4e3510');
  }

  if (markup.mainViewSide) {
    const point = pointToPixel(markup.mainViewSide.point, size);
    context.fillStyle = '#0f5a47';
    context.beginPath();
    context.moveTo(point.x, point.y - 20);
    context.lineTo(point.x + 18, point.y + 16);
    context.lineTo(point.x - 18, point.y + 16);
    context.closePath();
    context.fill();
    drawLabel(context, '景观方向', point.x + 22, point.y + 8, '#0f5a47');
  }
}

function drawPolygon(context: CanvasRenderingContext2D, points: SitePoint[], size: SiteMarkupCaptureSize, strokeStyle: string, fillStyle: string) {
  if (points.length === 0) {
    return;
  }

  const first = pointToPixel(points[0], size);
  context.beginPath();
  context.moveTo(first.x, first.y);
  for (const point of points.slice(1)) {
    const pixel = pointToPixel(point, size);
    context.lineTo(pixel.x, pixel.y);
  }
  if (points.length >= 3) {
    context.closePath();
    context.fillStyle = fillStyle;
    context.fill();
  }
  context.strokeStyle = strokeStyle;
  context.lineWidth = 4;
  context.stroke();
}

function drawLabel(context: CanvasRenderingContext2D, label: string, x: number, y: number, color: string) {
  context.font = '24px sans-serif';
  context.fillStyle = color;
  context.fillText(label, x, y);
}

function pointsToPixelAttribute(points: SitePoint[], size: SiteMarkupCaptureSize) {
  return points.map((point) => {
    const pixel = pointToPixel(point, size);
    return `${pixel.x},${pixel.y}`;
  }).join(' ');
}

function pointToPixel(point: SitePoint, size: SiteMarkupCaptureSize) {
  return {
    x: Math.round((point.x / 100) * size.width),
    y: Math.round((point.y / 100) * size.height),
  };
}

async function loadImage(url: string): Promise<HTMLImageElement> {
  const image = new Image();
  image.decoding = 'async';
  image.src = url;
  await image.decode();
  return image;
}
```

- [ ] **Step 4: Run the tests and verify they pass**

Run:

```bash
npm test -- src/siteMarkupCapture.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/siteMarkupCapture.ts src/siteMarkupCapture.test.ts
git commit -m "feat: add annotated site image capture"
```

---

### Task 2: Add Local Plan Explanation Generator

**Files:**
- Create: `src/planExplanation.ts`
- Test: `src/planExplanation.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/planExplanation.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { buildPlanExplanation } from './planExplanation';
import type { GardenParameters } from './gardenGenerator';
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
  it('builds fixed local explanation sections from site analysis and controls', () => {
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
```

- [ ] **Step 2: Run the tests and verify they fail**

Run:

```bash
npm test -- src/planExplanation.test.ts
```

Expected: FAIL because `src/planExplanation.ts` does not exist.

- [ ] **Step 3: Implement the explanation generator**

Create `src/planExplanation.ts`:

```ts
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
```

- [ ] **Step 4: Run the tests and verify they pass**

Run:

```bash
npm test -- src/planExplanation.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/planExplanation.ts src/planExplanation.test.ts
git commit -m "feat: add local plan explanation generator"
```

---

### Task 3: Replace GardenPlan Prompt With Site-Image Prompt

**Files:**
- Modify: `src/aiImageClient.ts`
- Test: `src/aiImageClient.test.ts`

- [ ] **Step 1: Write the failing prompt tests**

Replace the first three prompt tests in `src/aiImageClient.test.ts` with:

```ts
import { describe, expect, it } from 'vitest';
import { buildAiImageRequest, buildSiteImagePrompt, extractErrorMessage, extractGenerationError, extractImageUrl } from './aiImageClient';
import type { GardenParameters } from './gardenGenerator';
import type { SiteAnalysisData } from './siteAnalysis';

const parameters: GardenParameters = {
  courtyardScale: 72,
  waterRatio: 45,
  rockDensity: 54,
  plantingDensity: 66,
  pathCurvature: 58,
  buildingStyle: 'scholar',
  focalPoint: 'pavilion',
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

describe('aiImageClient', () => {
  it('builds a prompt from annotated site image constraints', () => {
    const prompt = buildSiteImagePrompt({
      projectName: '苏式庭院方案',
      siteAnalysis,
      parameters,
      customDirection: '强调茶庭收束',
    });

    expect(prompt).toContain('Use the provided annotated site image as the primary constraint');
    expect(prompt).toContain('场地解析 JSON');
    expect(prompt).toContain('"mainEntrance": "西南侧"');
    expect(prompt).toContain('water ratio 45%');
    expect(prompt).toContain('曲径通幽');
    expect(prompt).toContain('强调茶庭收束');
    expect(prompt).not.toContain('SVG');
  });
```

Keep the existing request, extraction, and error tests below this new test.

- [ ] **Step 2: Run the tests and verify they fail**

Run:

```bash
npm test -- src/aiImageClient.test.ts
```

Expected: FAIL because `buildSiteImagePrompt` is not exported.

- [ ] **Step 3: Update the prompt builder**

In `src/aiImageClient.ts`, remove imports of `GardenPlan`, remove `buildGardenImagePrompt`, remove the old `buildImagePrompt`, and add:

```ts
import type { GenerationError } from './domain/project';
import type { GardenParameters } from './gardenGenerator';
import type { SiteAnalysisData } from './siteAnalysis';

export type AiImageMode = 'generate' | 'edit';

export interface SiteImagePromptInput {
  projectName: string;
  siteAnalysis: SiteAnalysisData;
  parameters: GardenParameters;
  customDirection: string;
}

export function buildSiteImagePrompt({ projectName, siteAnalysis, parameters, customDirection }: SiteImagePromptInput) {
  const focal = {
    pond: 'water courtyard',
    rockery: 'rockery garden',
    pavilion: 'pavilion court',
  }[parameters.focalPoint];

  const building = {
    classic: 'classic Suzhou hall',
    compact: 'compact courtyard building',
    scholar: 'scholar garden studio',
  }[parameters.buildingStyle];

  const promptLines = [
    `Suzhou garden concept generation for project: ${projectName}.`,
    'Use the provided annotated site image as the primary constraint. Preserve the parcel boundary, building footprint, main entrance, and marked landscape direction.',
    'Generate a refined top-down landscape concept plan, not a photorealistic perspective render.',
    `场地解析 JSON:\n${JSON.stringify(siteAnalysis, null, 2)}`,
    `Generation controls: courtyard scale ${parameters.courtyardScale}%, water ratio ${parameters.waterRatio}%, rock density ${parameters.rockDensity}%, planting density ${parameters.plantingDensity}%, path curvature ${parameters.pathCurvature}%, focal space ${focal}, building style ${building}.`,
    'Suzhou garden rules: 曲径通幽, 入口障景, 借景, 对景, 框景, 漏景, 叠石理水, 小中见大, 粉墙黛瓦, 月洞门, 水院展开, 茶庭收束.',
    'Visual style: architecture presentation board, delicate ink-and-mineral palette, readable plan annotations, calm professional composition.',
  ];

  const trimmedDirection = customDirection.trim();
  if (trimmedDirection) {
    promptLines.push(`User image direction:\n${trimmedDirection}`);
  }

  return promptLines.join('\n');
}
```

Keep `buildAiImageRequest`, `requestAiImage`, and response helpers unchanged.

- [ ] **Step 4: Run the tests and verify they pass**

Run:

```bash
npm test -- src/aiImageClient.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/aiImageClient.ts src/aiImageClient.test.ts
git commit -m "feat: build prompts from annotated site images"
```

---

### Task 4: Replace SVG Export With Image Data URL Export

**Files:**
- Modify: `src/exporters.ts`

- [ ] **Step 1: Write a focused implementation change**

Replace `src/exporters.ts` with:

```ts
export function downloadImageDataUrl(dataUrl: string, filename: string) {
  const link = document.createElement('a');
  link.href = dataUrl;
  link.download = `${filename}.png`;
  document.body.appendChild(link);
  link.click();
  link.remove();
}

export function downloadJson(data: unknown, filename: string) {
  const source = JSON.stringify(data, null, 2);
  const blob = new Blob([source], { type: 'application/json;charset=utf-8' });
  downloadBlob(blob, `${filename}.json`);
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
```

- [ ] **Step 2: Run typecheck and verify downstream references fail**

Run:

```bash
npm run typecheck
```

Expected: FAIL in `GardenWorkspace.tsx` while it still imports `downloadSvg` and `downloadPng`.

- [ ] **Step 3: Leave the failure for Task 5**

Do not commit this task alone if typecheck fails. Carry it into Task 5 and commit once `GardenWorkspace.tsx` is updated.

---

### Task 5: Rebuild GardenWorkspace Around Right-Side Tabs

**Files:**
- Modify: `src/components/GardenWorkspace.tsx`
- Modify: `src/exporters.ts`
- Test: `src/components/GardenWorkspace.test.tsx`

- [ ] **Step 1: Replace workspace tests with new business-flow assertions**

Update the first two tests in `src/components/GardenWorkspace.test.tsx` to assert the new tabs and absence of SVG:

```ts
it('renders the site-markup driven workspace tabs without SVG preview flow', () => {
  const project = createDefaultProject({ now: '2026-05-05T10:00:00.000Z', seed: 41, name: 'AI 标注方案' });
  const markup = renderToStaticMarkup(<GardenWorkspace project={project} onProjectChange={vi.fn()} onGenerationAdded={vi.fn()} />);

  expect(markup).toContain('场地标注');
  expect(markup).toContain('生成方案');
  expect(markup).toContain('方案说明');
  expect(markup).toContain('上传场地图');
  expect(markup).toContain('生成控制');
  expect(markup).not.toContain('SVG平面');
  expect(markup).not.toContain('导出 SVG');
  expect(markup).not.toContain('规则方案基线预览');
});

it('renders uploaded site image in the right-side markup stage', () => {
  const project = createDefaultProject({ now: '2026-05-05T10:00:00.000Z', seed: 42, name: '大图标注' });
  const markup = renderToStaticMarkup(
    <GardenWorkspace
      project={{
        ...project,
        siteImage: { name: 'site.png', url: 'data:image/png;base64,abc' },
      }}
      onProjectChange={vi.fn()}
      onGenerationAdded={vi.fn()}
    />,
  );

  const stageStart = markup.indexOf('aria-label="放大场地图标注"');
  const controlsStart = markup.indexOf('aria-label="左侧生成控制"');

  expect(stageStart).toBeGreaterThan(-1);
  expect(controlsStart).toBeGreaterThan(-1);
  expect(markup.slice(stageStart)).toContain('当前上传的场地图');
  expect(markup.slice(stageStart)).toContain('绘制地块边界');
});
```

Remove or rewrite tests that assert `规则方案基线预览`, `SVG平面`, and SVG preview ordering.

- [ ] **Step 2: Run the workspace tests and verify they fail**

Run:

```bash
npm test -- src/components/GardenWorkspace.test.tsx
```

Expected: FAIL because the component still renders the SVG workflow.

- [ ] **Step 3: Update imports and top-level state**

In `src/components/GardenWorkspace.tsx`, remove imports of `downloadPng`, `downloadSvg`, `GardenPreview`, `generateGardenPlan`, `createRuleLayoutContext`, and `hasUsableSiteContext`. Add:

```ts
import { buildAiImageRequest, buildSiteImagePrompt, normalizeUnknownGenerationError, requestAiImage } from '../aiImageClient';
import { type PlanExplanationSection, buildPlanExplanation } from '../planExplanation';
import { captureAnnotatedSiteImage } from '../siteMarkupCapture';
import { downloadImageDataUrl, downloadJson } from '../exporters';
import type { GardenParameters } from '../gardenGenerator';
import type { ReactNode, RefObject } from 'react';
```

Replace the SVG ref and status state with:

```ts
const [activeTab, setActiveTab] = useState<'markup' | 'result' | 'explanation'>('markup');
const [status, setStatus] = useState('请上传场地图并在右侧大图中完成标注');
const [aiImageUrl, setAiImageUrl] = useState<string | null>(project.generations.find((generation) => generation.imageUrl)?.imageUrl ?? null);
const [aiStatus, setAiStatus] = useState('AI 方案图尚未生成');
const [isGeneratingImage, setIsGeneratingImage] = useState(false);
const [activeTool, setActiveTool] = useState<SiteMarkupTool>('boundary');
const siteCanvasRef = useRef<HTMLDivElement | null>(null);
```

- [ ] **Step 4: Replace generation logic**

Replace `handleGenerate` and `handleAiGenerate` with:

```ts
const explanation = useMemo(
  () => buildPlanExplanation({ projectName: project.name, siteAnalysis, parameters: project.parameters, customPrompt: project.customPrompt }),
  [project.name, siteAnalysis, project.parameters, project.customPrompt],
);

const canGenerate = Boolean(project.siteImage) && siteMarkup.boundary.length >= 3 && siteMarkup.buildingFootprint.length >= 3 && Boolean(siteMarkup.mainEntrance);

const handleGenerate = async () => {
  if (!project.siteImage || !canGenerate) {
    setStatus('请先上传场地图，并确认地块边界、建筑轮廓和主入口。');
    return;
  }

  setIsGeneratingImage(true);
  setAiStatus('正在截取带标注场地图并生成 AI 方案...');

  try {
    const annotatedImageUrl = await captureAnnotatedSiteImage({
      imageUrl: project.siteImage.url,
      markup: siteMarkup,
    });
    const prompt = buildSiteImagePrompt({
      projectName: project.name,
      siteAnalysis,
      parameters: project.parameters,
      customDirection: project.customPrompt,
    });
    const request = buildAiImageRequest({
      mode: 'generate',
      prompt,
      referenceImageUrl: annotatedImageUrl,
      currentImageUrl: null,
    });
    const result = await requestAiImage(request);

    setAiImageUrl(result.imageUrl);
    setAiStatus('AI 方案图生成完成');
    setStatus('已根据带标注场地图生成方案');
    setActiveTab('result');
    onGenerationAdded({
      id: `generation-${Date.now()}`,
      projectId: project.id,
      createdAt: new Date().toISOString(),
      mode: 'generate',
      status: 'succeeded',
      prompt,
      provider: 'vectorengine',
      model: request.mode === 'edit' ? 'gpt-image-2-all' : 'gpt-image-2',
      imageUrl: result.imageUrl,
    });
  } catch (error) {
    const generationError = normalizeUnknownGenerationError(error);
    setAiStatus(generationError.message);
    onGenerationAdded({
      id: `generation-${Date.now()}`,
      projectId: project.id,
      createdAt: new Date().toISOString(),
      mode: 'generate',
      status: 'failed',
      prompt: buildSiteImagePrompt({
        projectName: project.name,
        siteAnalysis,
        parameters: project.parameters,
        customDirection: project.customPrompt,
      }),
      provider: 'vectorengine',
      model: 'gpt-image-2',
      error: generationError,
    });
  } finally {
    setIsGeneratingImage(false);
  }
};
```

Remove the old edit-current-image action from the visible flow.

- [ ] **Step 5: Rename the user-facing landscape direction labels**

Update the `mainViewSide` labels in `GardenWorkspace.tsx` so the UI says 景观方向 while the stored field name remains compatible:

```ts
const activeToolLabel: Record<SiteMarkupTool, string> = {
  boundary: '绘制地块边界',
  buildingFootprint: '绘制建筑轮廓',
  mainEntrance: '标记主入口',
  mainViewSide: '标记景观方向',
};

const activeToolHint: Record<SiteMarkupTool, string> = {
  boundary: '在放大场地图上点击添加边界点，至少 3 个点可确认边界。',
  buildingFootprint: '在放大场地图上点击添加建筑轮廓点，至少 3 个点可确认轮廓。',
  mainEntrance: '在放大场地图上点击一次标记主入口位置。',
  mainViewSide: '在放大场地图上点击一次标记主要景观方向。',
};

const redrawActionLabel: Record<SiteMarkupTool, string> = {
  boundary: '重新绘制地块边界',
  buildingFootprint: '重新绘制建筑轮廓',
  mainEntrance: '重新标记主入口',
  mainViewSide: '重新标记景观方向',
};

const siteAnalysisLabels: Record<keyof SiteAnalysisData, string> = {
  siteBoundary: '地块边界',
  buildingFootprint: '建筑轮廓',
  mainEntrance: '主入口',
  mainViewSide: '景观方向',
  neighborInterface: '相邻界面',
  borrowedViewDirection: '借景方向',
  screeningRequired: '需遮挡方向',
};
```

Also change the fourth `ToolButton` label to:

```tsx
<ToolButton icon={<ScanLine size={17} aria-hidden="true" />} label="标记景观方向" active={activeTool === 'mainViewSide'} onClick={() => onToolChange('mainViewSide')} />
```

- [ ] **Step 6: Replace JSX with left controls and right tabs**

Keep `TopAppBar` and `ProcessStepper`, then replace the inner `.workspace-grid` contents with a left control aside and right main stage:

```tsx
<div className="workspace-grid site-generation-grid">
  <aside className="workspace-controls" aria-label="左侧生成控制">
    <section className="control-card site-upload-panel" aria-label="场地图上传">
      <div className="card-title-row">
        <div>
          <h2>场地图</h2>
          <p>上传后在右侧大图中标注</p>
        </div>
        <ChevronDown size={16} aria-hidden="true" />
      </div>
      <SiteImageUploader siteImage={project.siteImage} onUpload={handleSiteUpload} onRemove={() => updateSiteImage(undefined)} />
    </section>

    <section className="control-card site-tools-panel" aria-label="标注工具">
      <h2>标注工具</h2>
      <SiteToolButtons activeTool={activeTool} onToolChange={setActiveTool} ariaLabel="放大场地图标注工具" className="site-tool-grid" />
      {mapEraseAction ? (
        <button className="site-erase-button" type="button" onClick={() => updateSiteMarkup(clearSiteMarkupByTool(siteMarkup, mapEraseAction.tool))}>
          <X size={16} aria-hidden="true" />
          {mapEraseAction.label}
        </button>
      ) : null}
      <SiteAnalysisSummary siteAnalysis={siteAnalysis} />
      <p className="site-edit-hint">{activeSiteEditHint}</p>
    </section>

    <section className="control-card generation-controls">
      <h2>生成控制</h2>
      <GenerationControls
        parameters={project.parameters}
        seed={project.seed}
        canGenerate={canGenerate}
        isGenerating={isGeneratingImage}
        onParameterChange={updateParameter}
        onGenerate={() => void handleGenerate()}
        onExportPng={() => aiImageUrl && downloadImageDataUrl(aiImageUrl, filename)}
        canExportPng={Boolean(aiImageUrl)}
        onExportJson={() => downloadJson({ project, siteAnalysis, generationControls: project.parameters, explanation }, filename)}
      />
      {latestError ? <ErrorNotice error={latestError} /> : null}
    </section>
  </aside>

  <section className="site-stage" aria-label="右侧主窗口">
    <WorkspaceTabs activeTab={activeTab} onTabChange={setActiveTab} />
    {activeTab === 'markup' ? (
      <SiteMarkupStage
        siteImage={project.siteImage}
        siteMarkup={siteMarkup}
        activeTool={activeTool}
        siteCanvasRef={siteCanvasRef}
        onUpload={handleSiteUpload}
        onCanvasClick={handleSiteCanvasClick}
        onCanvasKeyDown={handleSiteCanvasKeyDown}
      />
    ) : null}
    {activeTab === 'result' ? <GeneratedResultStage imageUrl={aiImageUrl} status={aiStatus} /> : null}
    {activeTab === 'explanation' ? <ExplanationStage explanation={explanation} siteAnalysis={siteAnalysis} status={status} /> : null}
  </section>
</div>
```

- [ ] **Step 7: Add the small workspace subcomponents**

Add these helper components in `GardenWorkspace.tsx` below `ProcessStepper`:

```tsx
function WorkspaceTabs({
  activeTab,
  onTabChange,
}: {
  activeTab: 'markup' | 'result' | 'explanation';
  onTabChange: (tab: 'markup' | 'result' | 'explanation') => void;
}) {
  const tabs = [
    ['markup', '场地标注'],
    ['result', '生成方案'],
    ['explanation', '方案说明'],
  ] as const;

  return (
    <div className="workspace-tabs" role="tablist" aria-label="右侧主窗口标签">
      {tabs.map(([tab, label]) => (
        <button className={activeTab === tab ? 'active' : undefined} type="button" role="tab" aria-selected={activeTab === tab} key={tab} onClick={() => onTabChange(tab)}>
          {label}
        </button>
      ))}
    </div>
  );
}

function SiteImageUploader({
  siteImage,
  onUpload,
  onRemove,
}: {
  siteImage: GardenProject['siteImage'];
  onUpload: (file: File | undefined) => void;
  onRemove: () => void;
}) {
  if (siteImage) {
    return (
      <div className="reference-file-row">
        <span>{siteImage.name}</span>
        <button type="button" onClick={onRemove}>
          <X size={16} aria-hidden="true" />
          移除
        </button>
      </div>
    );
  }

  return (
    <label className="upload-dropzone">
      <ImagePlus size={22} aria-hidden="true" />
      <span>上传场地图</span>
      <input type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => onUpload(event.target.files?.[0])} />
    </label>
  );
}

function SiteMarkupStage({
  siteImage,
  siteMarkup,
  activeTool,
  siteCanvasRef,
  onUpload,
  onCanvasClick,
  onCanvasKeyDown,
}: {
  siteImage: GardenProject['siteImage'];
  siteMarkup: SiteMarkup;
  activeTool: SiteMarkupTool;
  siteCanvasRef: RefObject<HTMLDivElement | null>;
  onUpload: (file: File | undefined) => void;
  onCanvasClick: (event: React.MouseEvent<HTMLDivElement>) => void;
  onCanvasKeyDown: (event: React.KeyboardEvent<HTMLDivElement>) => void;
}) {
  if (!siteImage) {
    return (
      <div className="empty-site-stage">
        <ImagePlus size={30} aria-hidden="true" />
        <label>
          上传场地图
          <input type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => onUpload(event.target.files?.[0])} />
        </label>
      </div>
    );
  }

  return (
    <div
      ref={siteCanvasRef}
      className="site-canvas site-canvas-large"
      role="button"
      tabIndex={0}
      aria-label={`放大场地图标注：${activeToolLabel[activeTool]}`}
      onClick={onCanvasClick}
      onKeyDown={onCanvasKeyDown}
    >
      <img src={siteImage.url} alt="当前上传的场地图" />
      <SiteMarkupOverlay markup={siteMarkup} />
    </div>
  );
}

function GeneratedResultStage({ imageUrl, status }: { imageUrl: string | null; status: string }) {
  return (
    <section className="generated-result-stage" aria-label="生成方案结果">
      {imageUrl ? <img src={imageUrl} alt="AI 生成的苏式庭院方案图" /> : <p>{status}</p>}
    </section>
  );
}

function ExplanationStage({
  explanation,
  siteAnalysis,
  status,
}: {
  explanation: PlanExplanationSection[];
  siteAnalysis: SiteAnalysisData;
  status: string;
}) {
  return (
    <section className="explanation-stage" aria-label="方案说明">
      <p>{status}</p>
      <DataCard title="场地解析 JSON" data={siteAnalysis} />
      <div className="explanation-list">
        {explanation.map((item) => (
          <details open key={item.title}>
            <summary>
              <Layers size={17} aria-hidden="true" />
              {item.title}
              <ChevronDown size={15} aria-hidden="true" />
            </summary>
            <p>{item.body}</p>
          </details>
        ))}
      </div>
    </section>
  );
}
```

- [ ] **Step 8: Update `GenerationControls` props and remove SVG export button**

Change the component signature to include `canGenerate`, `isGenerating`, `canExportPng`, `onExportPng`, and `onExportJson`, and remove `onExportSvg`. The final action buttons should be:

```tsx
<button className="primary-action" type="button" onClick={onGenerate} disabled={!canGenerate || isGenerating}>
  <WandSparkles size={18} aria-hidden="true" />
  {isGenerating ? '生成中' : '生成方案'}
</button>
<button type="button" onClick={onExportPng} disabled={!canExportPng}>
  <ImageDown size={18} aria-hidden="true" />
  导出 PNG
</button>
<button type="button" onClick={onExportJson}>
  <FileJson size={18} aria-hidden="true" />
  导出 JSON
</button>
```

- [ ] **Step 9: Run focused tests**

Run:

```bash
npm test -- src/components/GardenWorkspace.test.tsx src/aiImageClient.test.ts src/siteMarkupCapture.test.ts src/planExplanation.test.ts
```

Expected: PASS.

- [ ] **Step 10: Commit**

```bash
git add src/components/GardenWorkspace.tsx src/components/GardenWorkspace.test.tsx src/exporters.ts
git commit -m "feat: replace svg workflow with site image tabs"
```

---

### Task 6: Update Styles for the New Workspace

**Files:**
- Modify: `src/styles.css`
- Test: `src/components/GardenWorkspace.test.tsx`

- [ ] **Step 1: Remove SVG-specific styles and add tabbed site stage styles**

In `src/styles.css`, remove styles that only support `.plan-stage`, `.plan-canvas`, `.garden-svg`, `.svg-label`, `.svg-note`, `.ai-image-panel`, and `.view-toggle` if they are no longer referenced. Add:

```css
.site-generation-grid {
  grid-template-columns: 320px minmax(0, 1fr);
}

.site-stage {
  display: grid;
  grid-template-rows: auto minmax(0, 1fr);
  min-width: 0;
  min-height: 0;
  overflow: hidden;
  background: rgba(255, 253, 248, 0.9);
  border: 1px solid #ded6c8;
  border-radius: 8px;
}

.workspace-tabs {
  display: flex;
  gap: 18px;
  padding: 0 16px;
  border-bottom: 1px solid #e2d9ca;
}

.workspace-tabs button {
  position: relative;
  min-height: 48px;
  padding: 0 2px;
  color: #6f6a60;
  background: transparent;
  border: 0;
  border-radius: 0;
}

.workspace-tabs button.active {
  color: #1f634e;
  font-weight: 800;
}

.workspace-tabs button.active::after {
  content: "";
  position: absolute;
  right: 0;
  bottom: -1px;
  left: 0;
  height: 3px;
  background: #1f634e;
}

.site-canvas-large {
  width: 100%;
  height: 100%;
  min-height: 620px;
  aspect-ratio: auto;
  border: 0;
  border-radius: 0;
}

.empty-site-stage,
.generated-result-stage,
.explanation-stage {
  display: grid;
  align-content: start;
  gap: 16px;
  min-height: 0;
  padding: 18px;
  overflow: auto;
}

.empty-site-stage {
  place-items: center;
  align-content: center;
  color: #555449;
  background: #f8f5ee;
}

.empty-site-stage label {
  display: inline-grid;
  place-items: center;
  min-height: 42px;
  padding: 0 14px;
  color: #fffdf8;
  background: #1f634e;
  border-radius: 6px;
  cursor: pointer;
}

.generated-result-stage img {
  display: block;
  width: 100%;
  max-height: calc(100vh - 210px);
  object-fit: contain;
  background: #f7f4ec;
  border: 1px solid #e1d8ca;
  border-radius: 8px;
}
```

- [ ] **Step 2: Run tests and typecheck**

Run:

```bash
npm test -- src/components/GardenWorkspace.test.tsx
npm run typecheck
```

Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/styles.css
git commit -m "style: support site image generation workspace"
```

---

### Task 7: Remove Dead SVG User Flow References

**Files:**
- Modify: `src/components/ErrorNotice.tsx`
- Modify: `docs/architecture/overview.md`
- Test: `src/components/GardenWorkspace.test.tsx`

- [ ] **Step 1: Update retry copy**

Change `src/components/ErrorNotice.tsx` retry copy from:

```tsx
<span>{error.retryable ? '可以稍后重试，规则方案仍可导出。' : '请调整配置或请求后再试。'}</span>
```

to:

```tsx
<span>{error.retryable ? '可以稍后重试，场地图标注和生成参数已保留。' : '请调整配置或请求后再试。'}</span>
```

- [ ] **Step 2: Update architecture overview**

Replace the data flow in `docs/architecture/overview.md` with:

```md
Data flow:

1. UI stores the uploaded site image and normalized `SiteMarkup`.
2. `createSiteAnalysis(markup)` derives structured site constraints.
3. `captureAnnotatedSiteImage` renders the uploaded site image plus markup overlay into a PNG data URL.
4. `buildSiteImagePrompt` combines site analysis, generation controls, custom direction, and built-in Suzhou garden rules.
5. `requestAiImage` posts to `/api/images/generate`.
6. The proxy calls VectorEngine and returns a normalized image response.
7. The frontend stores the generation record and renders local plan explanation sections.
```

- [ ] **Step 3: Run a repository search for user-visible SVG flow**

Run:

```bash
rg -n "SVG平面|导出 SVG|规则方案基线预览|规则方案仍可导出|GardenPreview|downloadSvg|downloadPng\\(" src docs/architecture
```

Expected: no matches in `src/`; historical spec files under `docs/superpowers/specs/2026-05-03-*` and `2026-05-04-*` may still mention old SVG decisions.

- [ ] **Step 4: Run focused tests**

Run:

```bash
npm test -- src/components/GardenWorkspace.test.tsx
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/ErrorNotice.tsx docs/architecture/overview.md
git commit -m "docs: update architecture for site markup generation"
```

---

### Task 8: Full Verification and Cleanup

**Files:**
- Modify only files required by failing checks.

- [ ] **Step 1: Run all tests**

Run:

```bash
npm test
```

Expected: PASS.

- [ ] **Step 2: Run typecheck**

Run:

```bash
npm run typecheck
```

Expected: PASS.

- [ ] **Step 3: Run production build**

Run:

```bash
npm run build
```

Expected: PASS and `vite build` completes.

- [ ] **Step 4: Start the dev server**

Run:

```bash
npm run dev -- --port 5173
```

Expected: Vite serves the app at `http://localhost:5173/`. If port 5173 is occupied, rerun with `--port 5174`.

- [ ] **Step 5: Manual browser check**

Open the served app and verify:

- Upload control is visible.
- Right-side tabs show `场地标注`、`生成方案`、`方案说明`.
- Uploaded site image appears in the right-side large markup area.
- The four markup tools render and can be selected.
- `生成方案` is disabled until required markup exists.
- No user-visible SVG preview or SVG export button appears.

- [ ] **Step 6: Commit final fixes**

If verification required changes:

```bash
git add src docs
git commit -m "fix: complete site markup generation verification"
```

If verification required no changes, do not create an empty commit.
