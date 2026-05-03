# 基于规则的 SVG 矢量图生成设计

## 背景

项目已经完成地块图上传、点击式场地标记、场地解析 JSON 生成和需求确认。下一阶段需要基于地块图、解析 JSON 和设计规则生成 SVG 矢量平面图，并将苏式园林空间语言转化为可计算、可控制、可解释的布局规则。

本设计采用“SVG 可汇报导出 + AI 图像强约束”并重的目标。第一期先让规则 SVG 本身稳定、可解释、可导出，再把规则说明接入 AI 图像提示词。

## 目标

- 基于 `siteMarkup`、`siteAnalysis`、`requirementConfirmation` 和 `GardenParameters` 生成规则化 SVG 平面图。
- 第一版采用半贴合几何：保留用户地块边界和建筑轮廓作为约束底图，园林元素根据包围盒、方位和相对区域生成。
- 内置苏式园林规则，覆盖固定元素组合、基本布局手法、特色空间手法、面积适配、构筑物组合、路径组织、水院布置、植物遮挡、视线框景和文字说明。
- 每个规则生成的元素可追溯到 `sourceRule`，导出 JSON 和 AI prompt 都能解释规则命中原因。
- 规则第一期写在 TypeScript 中，但结构预留未来规则编辑、启停、排序、分类和迁移能力。

## 非目标

- 第一期不实现规则编辑页面。
- 第一期不做严格多边形裁剪、碰撞求解器或专业路径路由。
- 第一期不实现服务端规则库、规则市场或多用户规则管理。
- 第一期不重写 SVG 渲染和导出链路。

## 已确认决策

- 产品目标选择双目标：SVG 本身可汇报、可导出，同时作为 AI 图像生成的强约束输入。
- 几何策略选择半贴合：地块和建筑多边形作为约束底图，布局元素按包围盒和相对方位生成。
- 规则实现选择 TypeScript 内置规则表，但采用接近 JSON 的可序列化定义，预留未来编辑。
- 实现路线选择扩展现有 `GardenPlan` 和 `GardenPreview`，不新建独立 SVG 文档模型。

## 架构

新增一个规则布局层，复用当前生成和渲染链路。

```text
siteMarkup
+ createSiteAnalysis(siteMarkup)
+ requirementConfirmation
+ GardenParameters
        ↓
createRuleLayoutContext()
        ↓
applySuzhouLayoutRules()
        ↓
GardenPlan {
  elements: GardenElement[],
  summary: string[],
  ruleExplanations: RuleExplanation[]
}
        ↓
GardenPreview SVG
        ↓
导出 SVG / PNG / JSON
        ↓
AI prompt 使用 ruleExplanations + SVG 语义摘要
```

建议新增模块：

- `src/ruleLayout.ts`：把地块标记、解析 JSON、用户参数转成可布局上下文。
- `src/suzhouRules.ts`：内置可序列化规则定义和规则执行器。
- `src/gardenGenerator.ts`：保留现有参数式生成能力，新增可选站点上下文输入。
- `src/GardenPreview.tsx`：扩展 SVG 元素渲染，支持视线、遮挡、月洞门、茶庭和规则标注。

`generateGardenPlan` 建议扩展为：

```ts
generateGardenPlan(parameters, seed, siteContext?)
```

没有地块图或场地上下文时继续使用当前默认方案，避免破坏现有 MVP。

## 规则上下文

`RuleLayoutContext` 从现有数据派生，不作为独立持久字段保存。第一期包含：

- `siteBounds`：地块边界包围盒。
- `buildingBounds`：建筑轮廓包围盒。
- `mainEntranceSide`：入口方位。
- `mainViewSide`：建筑主观景面方位。
- `neighborSide`：邻里界面方位。
- `borrowedViewDirection`：借景方向。
- `requiresScreening`：需要遮挡的方向集合。
- `quietCorner`：可安静停留的角落，第一期优先推断东南角。
- `scaleProfile`：由 `courtyardScale` 派生的小、中、大地块适配档位。

坐标仍以当前 SVG viewBox 为目标坐标系。地块图标记的 0-100 百分比坐标在上下文生成阶段映射到 SVG 坐标。

## 可编辑规则定义

第一期规则仍内置于 TypeScript，但定义结构需要可序列化、可编辑、可迁移。

```ts
interface SuzhouRuleDefinition {
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
```

执行入口：

```ts
applySuzhouRules(context, ruleDefinitions)
```

第一期导出：

```ts
export const builtInSuzhouRules: SuzhouRuleDefinition[] = [...]
```

未来可以把同一结构迁移到 `project.ruleSet.overrides`、本地规则预设或服务端规则库。复杂几何仍由 TypeScript executor 完成，规则定义描述触发条件、生成意图和说明文案。

## 第一批规则

第一期内置规则建议覆盖 8 类行为：

1. **主观景面水院**
   如果建筑南侧或东南侧为主观景面，则在该侧布置小尺度水院，并生成从建筑看向水院的视线箭头。

2. **邻里界面遮挡**
   如果西侧或东侧为邻里界面，则沿该侧布置竹林和景墙，标注“竹影障景”。

3. **入口障景转折**
   如果入口到庭院核心近似直视，则在入口内侧设置障景墙或植物组团，使主路径先转折再入园。

4. **东南茶庭 / 园中园**
   如果东南角空间可用，则设置月洞门和茶庭节点，并生成“园中园”说明。

5. **曲折游线**
   从入口到水院、茶庭、建筑之间生成折线路径，避免直线穿越核心空间。

6. **水院尺度适配**
   根据 `courtyardScale` 和 `waterRatio` 控制水院大小；小地块收缩水面，避免占满场地。

7. **构筑物组合**
   根据 `structureTypes` 或当前 `focalPoint` 生成亭、廊、桥组合：水院有桥，茶庭有月洞门，主景点可配亭。

8. **植物与框景**
   主视线两侧用松、枫、竹做框景；邻里界面用竹；水边可放莲。

每条规则输出：

```ts
interface RuleApplication {
  elements: GardenElement[];
  explanation: RuleExplanation;
  summary: string[];
}
```

元素示例：

```ts
{
  id: 'south-view-pond',
  kind: 'water',
  sourceRule: 'main-view-water-court'
}
```

## SVG 元素表达

扩展 `GardenElementKind`：

```ts
type GardenElementKind =
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
```

扩展 `GardenElement`：

```ts
interface GardenElement {
  sourceRule?: string;
  label?: string;
  description?: string;
  layer?: 'base' | 'building' | 'water' | 'path' | 'planting' | 'structure' | 'annotation';
}
```

SVG 图层顺序固定为：

1. `base`：纸底、网格、地块边界、建筑轮廓参考线。
2. `screening`：景墙、竹林、遮挡带。
3. `water`：水院、池岸、桥。
4. `path`：曲折游线、入口转折。
5. `planting`：松、竹、枫、莲、框景植物。
6. `structure`：亭、廊、月洞门、茶庭节点。
7. `annotation`：视线箭头、规则标签、空间说明。

视觉表达：

- 地块边界：用户标记多边形，深绿虚线，作为约束底图。
- 建筑轮廓：用户建筑多边形包围盒生成建筑块，同时保留原轮廓虚线。
- 水院：椭圆或柔和池形，依据主观景面方位布置在建筑外侧。
- 竹影障景：邻里界面侧生成竹林线和景墙短线，标注“竹影障景”。
- 入口障景：入口内侧放短景墙或植物组团，并让路径产生折点。
- 月洞门：扩展当前 `gate` 的 moon variant，放在茶庭入口。
- 茶庭节点：小圆形或方形铺装节点，标注“茶庭 / 园中园”。
- 视线箭头：从建筑主观景面指向水院或框景点，红褐色箭头，标注“主观景视线”。
- 文字说明：导出 SVG 中直接包含中文标签，JSON 中同步输出解释文本。

## AI Prompt 接入

生成 AI 图像时，现有 prompt 继续作为基础。如果存在规则布局结果，追加规则解释和关键空间关系：

```text
规则化空间关系：
- 建筑南侧布置小尺度水院，从厅堂形成主观景视线。
- 西侧以竹林和景墙形成竹影障景。
- 入口内侧设置障景墙，使路径转折后进入庭院核心。
- 东南角以月洞门组织茶庭，形成园中园。
```

AI prompt 使用 `ruleExplanations` 生成，不单独拼写另一套文案，避免 SVG 与 AI 说明不一致。

## 导出

SVG 和 PNG 导出继续使用当前 exporter。JSON 导出包含项目数据、规则布局结果和规则命中解释，便于追溯和未来规则编辑。

建议 `GardenPlan` 扩展：

```ts
interface GardenPlan {
  ruleExplanations?: RuleExplanation[];
}
```

## 测试策略

- `ruleLayout.test.ts`
  验证地块和建筑包围盒、方位推断、入口直视、quiet corner 推断。

- `suzhouRules.test.ts`
  验证典型规则命中：南侧主观景面生成水院和视线箭头；西侧邻里界面生成竹林、景墙和“竹影障景”；入口直视核心时生成障景墙和路径折点；东南角可用时生成月洞门、茶庭和“园中园”。

- `gardenGenerator.test.ts`
  验证无地块图时保持现有生成结果；有地块上下文时输出规则布局元素和解释。

- `GardenPreview.test.tsx`
  验证 SVG 中能渲染新元素和中文标注。

实现完成后运行：

```bash
npm test
npm run typecheck
npm run build
```

并使用浏览器检查 SVG 预览在桌面和窄屏下无文本或元素重叠。

## 风险与约束

- 半贴合几何不是完整 CAD 级布局，异形地块可能出现局部视觉不精确；第一期用约束底图和说明降低误解。
- 规则定义可编辑，但第一期没有编辑 UI；需要避免把业务逻辑写死成无法迁移的自由函数。
- 中文 SVG 标签需要保持可读和不重叠；复杂布局下可能需要后续增加标签避让。
- AI 图像仍可能弱化 SVG 中的空间关系，因此 prompt 需要引用规则解释，并优先使用 SVG 作为约束图。
