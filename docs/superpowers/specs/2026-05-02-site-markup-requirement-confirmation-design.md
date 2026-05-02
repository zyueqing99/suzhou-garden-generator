# 地块图标记与需求确认设计

## 背景

当前页面提供“底稿 / 参考图”上传能力，并用空间参数、风格设定和自定义提示词生成苏式庭院概念方案。新需求要求将上传入口改为“地块图”，让用户在图上标记场地约束，并在生成图纸前确认设计任务，避免系统脱离用户输入自行发挥。

## 目标

- 将原“底稿 / 参考图”入口改为“上传地块图”。
- 上传后在页面展示地块图，并提供点击式标记工具。
- 根据标记结果生成结构化场地解析数据。
- 以“需求清单卡片”展示并允许编辑生成前需要确认的设计任务。
- AI 图像生成时带入地块图、场地解析数据和需求确认数据。

## 非目标

- 本轮不实现 CAD 式完整绘制编辑器，不支持拖拽点、框选、多选、吸附和复杂撤销栈。
- 本轮不新增后端存储，项目仍使用现有 `localStorage` 项目仓库。
- 本轮不移除旧项目数据中的 `referenceImage` 字段；为兼容历史数据，类型层面可暂时保留。

## 页面结构

采用工作台式三栏方案。

左侧控制面板保留现有参数、风格、AI 提示词、生成和导出操作，并将“底稿 / 参考图”区替换为“地块图”上传区。标记工具也放在左侧控制面板，包含：

- 绘制地块边界
- 绘制建筑轮廓
- 标记主入口
- 标记建筑主观景面
- 清除当前标记

右侧预览区域调整为三栏工作区：

1. 地块图标记区：展示上传地块图和 SVG 标记层。
2. 确认卡片区：展示场地解析数据和可编辑需求清单。
3. 生成预览区：保留现有 SVG 规则方案和 AI 图像结果。

窄屏下三栏按现有响应式模式折叠为单列，避免内容重叠。

## 标记交互

地块图标记区使用百分比坐标，坐标范围为 `0` 到 `100`。点击位置会根据地块图容器尺寸转换为 `{ x, y }`，因此图片响应式缩放后仍能正确叠加。

标记规则：

- 默认工具是“绘制地块边界”。
- “绘制地块边界”连续点击追加边界点。
- “绘制建筑轮廓”连续点击追加建筑轮廓点。
- “标记主入口”点击后设置单个入口点，再次点击覆盖旧入口点。
- “标记建筑主观景面”点击后设置单个观景面点，再次点击覆盖旧观景面点。
- “清除当前标记”只清除当前工具对应的数据。

地块边界和建筑轮廓达到至少 3 个点时，解析状态显示“已确认”；不足 3 个点时显示“待确认”。

## 数据模型

在 `GardenProject` 上新增以下字段：

```ts
interface SiteImage {
  name: string;
  url: string;
}

interface SitePoint {
  x: number;
  y: number;
}

interface SiteMarker {
  kind: 'mainEntrance' | 'mainViewSide';
  point: SitePoint;
}

interface SiteMarkup {
  boundary: SitePoint[];
  buildingFootprint: SitePoint[];
  mainEntrance?: SiteMarker;
  mainViewSide?: SiteMarker;
}

interface RequirementConfirmation {
  functionalNeeds: string;
  stylePreference: string;
  landscapeElements: string;
  waterRatio: string;
  rockRatio: string;
  structureTypes: string;
  plantPreference: string;
}
```

`GardenProject` 新增：

```ts
siteImage?: SiteImage;
siteMarkup?: SiteMarkup;
requirementConfirmation?: RequirementConfirmation;
```

`referenceImage` 暂时保留，用于兼容旧项目；新 UI 和新 AI 生成逻辑使用 `siteImage`。

## 场地解析数据

场地解析数据由 `siteMarkup` 派生，不作为独立持久字段保存。页面展示以下结构：

```json
{
  "siteBoundary": "已确认",
  "buildingFootprint": "已确认",
  "mainEntrance": "西南侧",
  "mainViewSide": "建筑南侧",
  "neighborInterface": "西侧",
  "borrowedViewDirection": "东南侧",
  "screeningRequired": ["西侧", "入口直视方向"]
}
```

推断规则保持轻量：

- `siteBoundary` 根据边界点数量判断“已确认”或“待确认”。
- `buildingFootprint` 根据建筑轮廓点数量判断“已确认”或“待确认”。
- `mainEntrance` 根据入口点所在区域输出方位。
- `mainViewSide` 根据观景点相对位置输出建筑侧向。
- `neighborInterface` 根据地块边界整体偏向推断西侧或东侧；无足够点位时显示“待判断”。
- `borrowedViewDirection` 根据主观景面点输出方位；无点位时显示“待判断”。
- `screeningRequired` 包含相邻界面和入口直视方向；缺少对应输入时不生成该项。

## 需求确认模块

需求清单卡片包含 7 项：

- 功能需求
- 风格偏好
- 景观元素
- 水景比例
- 山石比例
- 构筑物类型
- 植物倾向

首次进入时，默认值由现有 `GardenParameters` 映射生成：

- `courtyardScale` 生成“紧凑游赏与停留”或“舒展游赏与会客”。
- `buildingStyle` 生成风格偏好。
- `focalPoint` 生成景观元素和构筑物类型。
- `waterRatio` 生成水景比例。
- `rockDensity` 生成山石比例。
- `plantingDensity` 生成植物倾向。

用户编辑需求清单后，结果保存到 `requirementConfirmation`。已有手动编辑值时，不因参数变化强制覆盖；如果用户从未编辑过，则继续使用参数派生的默认值。

## AI 生成数据流

生成 AI 图像时：

1. 使用现有规则方案提示词作为基础。
2. 如果存在地块图，将 `siteImage.url` 作为图生图参考输入。
3. 将场地解析 JSON 追加到提示词。
4. 将需求确认 JSON 追加到提示词。
5. 保存生成记录时保留最终提示词，便于追溯。

## 测试策略

- 新增 `siteAnalysis.test.ts`，验证点位到结构化解析的映射、坐标归一化、追加点和清除当前标记。
- 新增 `requirementConfirmation.test.ts`，验证参数到默认需求清单的映射，以及手动编辑值不会被默认值覆盖。
- 扩展 `GardenWorkspace` 渲染测试，验证页面包含“上传地块图”“标记工具”“场地解析数据”“需求清单”。
- 实现完成后运行：

```bash
npm test
npm run typecheck
npm run build
```

- 使用浏览器打开本地开发页面，检查桌面三栏和窄屏单列布局，不出现文本或控件重叠。

## 风险与约束

- 点击式标记不是完整绘图编辑器，用户如果点错只能清除当前工具并重标。
- 方位推断是轻量规则，不等同专业测绘分析；页面应把结果作为设计输入确认，而不是绝对测量结论。
- 上传图片以 Data URL 存入本地项目，较大图片会增加 `localStorage` 压力；本轮沿用现有参考图上传模式，不单独引入压缩流程。
