# 场地图标注驱动 AI 方案生成实施计划

> **给自动化执行者：** 必须使用 `superpowers:subagent-driven-development`（推荐）或 `superpowers:executing-plans` 按任务逐步执行。本计划使用复选框（`- [ ]`）跟踪步骤。

**目标：** 删除 SVG 中间流程，改成“放大场地图标注 → 截取带标注图片 → 组合场地解析 JSON、生成控制和苏州园林规则 → 调用 `gpt-image-2` 出图”的主流程。

**架构：** 保留现有 React/Vite 应用和本地项目存储。生成来源从 `GardenPlan` / `GardenPreview` 切换为 `SiteMarkup`、Canvas 标注截图、场地图 prompt 构建器和本地方案说明生成器。

**技术栈：** React 19、TypeScript、Vite、Vitest、浏览器 Canvas API、现有 VectorEngine 图像代理。

---

## 文件结构

- 修改 `src/siteAnalysis.ts`：继续使用现有 `siteMarkup` 数据结构，用户可见语义从“建筑主观景面”调整为“景观方向”。
- 新建 `src/siteMarkupCapture.ts`：把上传场地图和标注覆盖层绘制成 PNG data URL，用作 `gpt-image-2` 参考图。
- 新建 `src/planExplanation.ts`：根据 `SiteAnalysisData`、`GardenParameters` 和项目名称生成本地方案说明。
- 修改 `src/aiImageClient.ts`：删除对 `GardenPlan` prompt 的依赖，新增 `buildSiteImagePrompt`。
- 修改 `src/exporters.ts`：删除 SVG 导出工具，新增 data URL 图片导出。
- 修改 `src/components/GardenWorkspace.tsx`：删除 SVG 预览流程，右侧改成 `场地标注 / 生成方案 / 方案说明` 三个标签页，并从带标注场地图生成 AI 图。
- 修改 `src/components/GardenWorkspace.test.tsx`：删除 SVG 断言，改为覆盖场地图标注工作流。
- 修改 `src/aiImageClient.test.ts`、`src/siteAnalysis.test.ts`，新增 `src/siteMarkupCapture.test.ts`、`src/planExplanation.test.ts`。
- 修改 `docs/architecture/overview.md`：把架构数据流更新为新的 AI 优先流程。

---

### 任务 1：新增带标注场地图截图模块

**文件：**
- 新建：`src/siteMarkupCapture.ts`
- 测试：`src/siteMarkupCapture.test.ts`

**关键要求：** `captureAnnotatedSiteImage()` 必须返回一张新的 PNG data URL。这张新图由“上传的场地图原图 + 标注覆盖层”合成，后续 AI 请求只能使用这张带标注的新图，不能直接把上传的场地图原图传给 `gpt-image-2`。

- [ ] **步骤 1：写失败测试**

新建 `src/siteMarkupCapture.test.ts`：

```ts
import { describe, expect, it } from 'vitest';
import { buildSiteMarkupSvg } from './siteMarkupCapture';
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
  it('从归一化标注坐标生成覆盖层 SVG', () => {
    const svg = buildSiteMarkupSvg(markup, { width: 1000, height: 600 });

    expect(svg).toContain('<svg');
    expect(svg).toContain('points="100,72 900,72 860,528 140,528"');
    expect(svg).toContain('points="350,108 720,108 720,228 350,228"');
    expect(svg).toContain('主入口');
    expect(svg).toContain('景观方向');
  });

  it('覆盖层 SVG 不包含原图地址，避免误把原图当成生成输入', () => {
    const svg = buildSiteMarkupSvg(markup, { width: 1000, height: 600 });

    expect(svg).not.toContain('data:image/png;base64');
    expect(svg).toContain('景观方向');
  });
});
```

- [ ] **步骤 2：运行测试并确认失败**

运行：

```bash
npm test -- src/siteMarkupCapture.test.ts
```

预期：失败，因为 `src/siteMarkupCapture.ts` 还不存在。

- [ ] **步骤 3：实现截图辅助模块**

新建 `src/siteMarkupCapture.ts`：

```ts
import type { SiteMarkup, SitePoint } from './siteAnalysis';

export interface SiteMarkupCaptureSize {
  width: number;
  height: number;
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

  // 返回的是新合成的带标注 PNG，不是上传场地图原图。
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

- [ ] **步骤 4：运行测试并确认通过**

运行：

```bash
npm test -- src/siteMarkupCapture.test.ts
```

预期：通过。

- [ ] **步骤 5：提交**

```bash
git add src/siteMarkupCapture.ts src/siteMarkupCapture.test.ts
git commit -m "feat: add annotated site image capture"
```

---

### 任务 2：新增本地方案说明生成器

**文件：**
- 新建：`src/planExplanation.ts`
- 测试：`src/planExplanation.test.ts`

- [ ] **步骤 1：写失败测试**

新建 `src/planExplanation.test.ts`：

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
```

- [ ] **步骤 2：运行测试并确认失败**

```bash
npm test -- src/planExplanation.test.ts
```

预期：失败，因为 `src/planExplanation.ts` 还不存在。

- [ ] **步骤 3：实现说明生成器**

新建 `src/planExplanation.ts`：

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

- [ ] **步骤 4：运行测试并确认通过**

```bash
npm test -- src/planExplanation.test.ts
```

预期：通过。

- [ ] **步骤 5：提交**

```bash
git add src/planExplanation.ts src/planExplanation.test.ts
git commit -m "feat: add local plan explanation generator"
```

---

### 任务 3：用场地图 prompt 替换旧规则方案 prompt

**文件：**
- 修改：`src/aiImageClient.ts`
- 测试：`src/aiImageClient.test.ts`

- [ ] **步骤 1：写失败测试**

把 `src/aiImageClient.test.ts` 前三个 prompt 测试替换为 `buildSiteImagePrompt` 测试。保留后面的请求构造、响应解析和错误解析测试。

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
  it('从带标注场地图约束构建图像生成 prompt', () => {
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
});
```

- [ ] **步骤 2：运行测试并确认失败**

```bash
npm test -- src/aiImageClient.test.ts
```

预期：失败，因为 `buildSiteImagePrompt` 还没有导出。

- [ ] **步骤 3：实现新的 prompt 构建器**

在 `src/aiImageClient.ts` 中删除 `GardenPlan` 导入、`buildGardenImagePrompt` 和旧 `buildImagePrompt`，新增：

```ts
import type { GenerationError } from './domain/project';
import type { GardenParameters } from './gardenGenerator';
import type { SiteAnalysisData } from './siteAnalysis';

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

保留 `buildAiImageRequest`、`requestAiImage` 和响应解析函数。

- [ ] **步骤 4：运行测试并确认通过**

```bash
npm test -- src/aiImageClient.test.ts
```

预期：通过。

- [ ] **步骤 5：提交**

```bash
git add src/aiImageClient.ts src/aiImageClient.test.ts
git commit -m "feat: build prompts from annotated site images"
```

---

### 任务 4：用图片 data URL 导出替换 SVG 导出

**文件：**
- 修改：`src/exporters.ts`

**边界说明：** 本任务只负责“导出已有图片 data URL”。它不负责合成带标注场地图。带标注场地图必须由任务 1 的 `captureAnnotatedSiteImage()` 生成，并在任务 5 的生成请求中传给 `gpt-image-2`。

- [ ] **步骤 1：替换导出工具**

把 `src/exporters.ts` 改为：

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

- [ ] **步骤 2：运行类型检查并确认旧引用失败**

```bash
npm run typecheck
```

预期：失败，`GardenWorkspace.tsx` 仍在引用 `downloadSvg` 和 `downloadPng`。

- [ ] **步骤 3：暂不单独提交**

这个任务会导致类型检查失败，不单独提交。继续任务 5，等 `GardenWorkspace.tsx` 一起改完后再提交。

---

### 任务 5：把 `GardenWorkspace` 重构为右侧三标签工作台

**文件：**
- 修改：`src/components/GardenWorkspace.tsx`
- 修改：`src/exporters.ts`
- 测试：`src/components/GardenWorkspace.test.tsx`

- [ ] **步骤 1：替换工作台测试**

把 `src/components/GardenWorkspace.test.tsx` 中断言旧 SVG 流程的测试改为：

```ts
it('渲染场地图标注驱动的工作台标签，并移除 SVG 预览流程', () => {
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

it('在右侧主窗口中渲染上传后的放大场地图', () => {
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

删除或重写所有断言 `规则方案基线预览`、`SVG平面`、SVG 预览顺序的测试。

- [ ] **步骤 2：运行测试并确认失败**

```bash
npm test -- src/components/GardenWorkspace.test.tsx
```

预期：失败，因为组件还在渲染 SVG 流程。

- [ ] **步骤 3：更新导入和顶层状态**

在 `src/components/GardenWorkspace.tsx` 中删除 `downloadPng`、`downloadSvg`、`GardenPreview`、`generateGardenPlan`、`createRuleLayoutContext`、`hasUsableSiteContext` 的导入，新增：

```ts
import { buildAiImageRequest, buildSiteImagePrompt, normalizeUnknownGenerationError, requestAiImage } from '../aiImageClient';
import { type PlanExplanationSection, buildPlanExplanation } from '../planExplanation';
import { captureAnnotatedSiteImage } from '../siteMarkupCapture';
import { downloadImageDataUrl, downloadJson } from '../exporters';
import type { GardenParameters } from '../gardenGenerator';
import type { ReactNode, RefObject } from 'react';
```

用下面状态替换 SVG ref 和旧状态：

```ts
const [activeTab, setActiveTab] = useState<'markup' | 'result' | 'explanation'>('markup');
const [status, setStatus] = useState('请上传场地图并在右侧大图中完成标注');
const [aiImageUrl, setAiImageUrl] = useState<string | null>(project.generations.find((generation) => generation.imageUrl)?.imageUrl ?? null);
const [aiStatus, setAiStatus] = useState('AI 方案图尚未生成');
const [isGeneratingImage, setIsGeneratingImage] = useState(false);
const [activeTool, setActiveTool] = useState<SiteMarkupTool>('boundary');
const siteCanvasRef = useRef<HTMLDivElement | null>(null);
```

- [ ] **步骤 4：替换生成逻辑**

删除旧 `handleGenerate` 和 `handleAiGenerate`，改为：

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

这里的 `annotatedImageUrl` 是 `captureAnnotatedSiteImage()` 合成的新 PNG data URL，包含场地图原图和标注覆盖层。不要把 `project.siteImage.url` 直接传给 `referenceImageUrl`。

- [ ] **步骤 5：统一“景观方向”文案**

把 `mainViewSide` 的用户可见文案改为“景观方向”，字段名保留兼容：

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

第四个工具按钮改为：

```tsx
<ToolButton icon={<ScanLine size={17} aria-hidden="true" />} label="标记景观方向" active={activeTool === 'mainViewSide'} onClick={() => onToolChange('mainViewSide')} />
```

- [ ] **步骤 6：替换 JSX 为左侧控制和右侧标签页**

保留 `TopAppBar` 和 `ProcessStepper`，把 `.workspace-grid` 内部替换为左侧控制区和右侧主窗口。右侧必须只通过 `场地标注` 标签执行标注：

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
        canExportPng={Boolean(aiImageUrl)}
        onParameterChange={updateParameter}
        onGenerate={() => void handleGenerate()}
        onExportPng={() => aiImageUrl && downloadImageDataUrl(aiImageUrl, filename)}
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

- [ ] **步骤 7：新增工作台小组件**

在 `GardenWorkspace.tsx` 中新增 `WorkspaceTabs`、`SiteImageUploader`、`SiteMarkupStage`、`GeneratedResultStage`、`ExplanationStage`。这些组件的职责如下：

- `WorkspaceTabs`：渲染 `场地标注 / 生成方案 / 方案说明` 三个标签。
- `SiteImageUploader`：处理左侧上传和移除。
- `SiteMarkupStage`：只在右侧放大场地图中接收点击标注。
- `GeneratedResultStage`：展示 AI 方案图或生成状态。
- `ExplanationStage`：展示场地解析 JSON 和本地方案说明。

- [ ] **步骤 8：更新 `GenerationControls` 参数并移除 SVG 导出按钮**

`GenerationControls` 接收 `canGenerate`、`isGenerating`、`canExportPng`、`onExportPng`、`onExportJson`，删除 `onExportSvg`。底部按钮应为：

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

- [ ] **步骤 9：运行聚焦测试**

```bash
npm test -- src/components/GardenWorkspace.test.tsx src/aiImageClient.test.ts src/siteMarkupCapture.test.ts src/planExplanation.test.ts
```

预期：通过。

- [ ] **步骤 10：提交**

```bash
git add src/components/GardenWorkspace.tsx src/components/GardenWorkspace.test.tsx src/exporters.ts
git commit -m "feat: replace svg workflow with site image tabs"
```

---

### 任务 6：更新新工作台样式

**文件：**
- 修改：`src/styles.css`
- 测试：`src/components/GardenWorkspace.test.tsx`

- [ ] **步骤 1：删除 SVG 专属样式并新增场地图标签页样式**

删除只服务 `.plan-stage`、`.plan-canvas`、`.garden-svg`、`.svg-label`、`.svg-note`、`.ai-image-panel`、`.view-toggle` 的样式。新增：

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

- [ ] **步骤 2：运行测试和类型检查**

```bash
npm test -- src/components/GardenWorkspace.test.tsx
npm run typecheck
```

预期：通过。

- [ ] **步骤 3：提交**

```bash
git add src/styles.css
git commit -m "style: support site image generation workspace"
```

---

### 任务 7：清理用户可见的 SVG 流程引用

**文件：**
- 修改：`src/components/ErrorNotice.tsx`
- 修改：`docs/architecture/overview.md`
- 测试：`src/components/GardenWorkspace.test.tsx`

- [ ] **步骤 1：更新错误提示文案**

把 `src/components/ErrorNotice.tsx` 中：

```tsx
<span>{error.retryable ? '可以稍后重试，规则方案仍可导出。' : '请调整配置或请求后再试。'}</span>
```

改为：

```tsx
<span>{error.retryable ? '可以稍后重试，场地图标注和生成参数已保留。' : '请调整配置或请求后再试。'}</span>
```

- [ ] **步骤 2：更新架构文档**

把 `docs/architecture/overview.md` 的数据流改为：

```md
数据流：

1. UI 保存上传的场地图和归一化后的 `SiteMarkup`。
2. `createSiteAnalysis(markup)` 推导结构化场地约束。
3. `captureAnnotatedSiteImage` 把上传场地图和标注覆盖层绘制成 PNG data URL。
4. `buildSiteImagePrompt` 组合场地解析、生成控制、自定义方向和内置苏州园林规则。
5. `requestAiImage` 请求 `/api/images/generate`。
6. 代理服务调用 VectorEngine，并返回标准化图像响应。
7. 前端保存生成记录，并渲染本地方案说明栏目。
```

- [ ] **步骤 3：搜索残留的用户可见 SVG 流程**

```bash
rg -n "SVG平面|导出 SVG|规则方案基线预览|规则方案仍可导出|GardenPreview|downloadSvg|downloadPng\\(" src docs/architecture
```

预期：`src/` 中没有匹配；历史规格文档保留旧决策说明，不作为本次清理范围。

- [ ] **步骤 4：运行聚焦测试**

```bash
npm test -- src/components/GardenWorkspace.test.tsx
```

预期：通过。

- [ ] **步骤 5：提交**

```bash
git add src/components/ErrorNotice.tsx docs/architecture/overview.md
git commit -m "docs: update architecture for site markup generation"
```

---

### 任务 8：完整验证和收尾

**文件：**
- 只修改验证失败所必需的文件。

- [ ] **步骤 1：运行全部测试**

```bash
npm test
```

预期：通过。

- [ ] **步骤 2：运行类型检查**

```bash
npm run typecheck
```

预期：通过。

- [ ] **步骤 3：运行生产构建**

```bash
npm run build
```

预期：通过，`vite build` 完成。

- [ ] **步骤 4：启动开发服务器**

```bash
npm run dev -- --port 5173
```

预期：Vite 在 `http://localhost:5173/` 提供服务。如果 5173 被占用，改用 `--port 5174`。

- [ ] **步骤 5：手动浏览器检查**

确认以下行为：

- 页面能看到上传场地图入口。
- 右侧标签为 `场地标注`、`生成方案`、`方案说明`。
- 上传后的场地图出现在右侧放大标注区域。
- 四个标注工具可见且可切换。
- 必需标注未完成时，`生成方案` 不可用。
- 页面不再出现用户可见的 SVG 预览和 SVG 导出按钮。

- [ ] **步骤 6：提交最终修复**

如果验证过程中做了修复：

```bash
git add src docs
git commit -m "fix: complete site markup generation verification"
```

如果没有额外修改，不创建空提交。
