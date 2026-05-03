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

### 场地几何上下文

- `siteBounds`：地块边界包围盒。
- `buildingBounds`：建筑轮廓包围盒。
- `mainEntranceSide`：入口方位。
- `mainViewSide`：建筑主观景面方位。
- `neighborSide`：邻里界面方位。
- `borrowedViewDirection`：借景方向。
- `requiresScreening`：需要遮挡的方向集合。
- `quietZones`：可安静停留的候选区域集合，由入口、建筑、邻里界面、主视线和可用空地共同推断，不固定为某个角落。
- `scaleProfile`：由 `courtyardScale` 派生的小、中、大地块适配档位。

坐标仍以当前 SVG viewBox 为目标坐标系。地块图标记的 0-100 百分比坐标在上下文生成阶段映射到 SVG 坐标。

### 空间参数上下文

`RuleLayoutContext` 必须完整保留并归一化左侧空间参数，不能只包含地图标注。建议增加：

- `parameters`：原始 `GardenParameters`，作为导出和规则解释的事实来源。
- `scaleProfile`：由 `courtyardScale` 派生，控制整体内缩、元素最大尺寸、可用节点数量。
- `waterProfile`：优先由 `waterRatio` 派生，包含目标水面占比和主水院尺寸档位；`courtyardScale` 只提供可用空间上限和必要收缩约束。
- `rockProfile`：由 `rockDensity` 派生，包含石组数量、石组尺度和是否强化主景叠石。
- `plantingProfile`：由 `plantingDensity` 派生，包含植物组团数量、遮挡带密度和框景植物密度。
- `pathProfile`：由 `pathCurvature` 派生，控制路径折点数量、偏移幅度和直视入口的转折强度。
- `styleProfile`：由 `buildingStyle` 派生，控制建筑标签、屋面表达、厅堂/书斋/小筑的空间气质。
- `focalProfile`：由 `focalPoint` 派生，控制水院、叠山、亭榭三类核心景点的规则优先级。
- `requirementProfile`：由 `requirementConfirmation` 派生，覆盖或补充左侧参数，例如构筑物类型、植物倾向和功能需求。

参数归一化后进入规则执行器。规则动作不得直接写固定数量或固定尺寸，而应读取这些 profile 计算布局结果。

## 参数符合性策略

SVG 是否符合左侧空间参数，靠“规则触发”和“规则动作参数化”共同保证：

- `waterRatio` 不只影响 summary，必须作为 `water` 元素面积的第一优先控制参数。第一期用目标水面占 SVG 可用庭院区域的近似比例控制水院宽高。
- `courtyardScale` 对水面只作为适配约束：当目标水面无法放入可用庭院区域时，才按空间上限收缩水院，并在 `RuleExplanation` 中说明“因地块尺度收缩”。
- `rockDensity` 必须影响 `rock` 元素数量和石组尺度。`focalPoint === 'rockery'` 时，叠石规则优先级提高，并把更多石组聚集到主景区域。
- `plantingDensity` 必须影响植物组团数量、竹林遮挡带密度和框景植物数量。邻里界面遮挡规则仍由场地触发，但密度由该参数控制。
- `pathCurvature` 必须影响路径折点偏移和转折强度。入口直视时一定产生转折，但高曲度生成更明显的折线路径。
- `courtyardScale` 必须影响整体布局的留白、元素尺寸上限和可启用节点数量。小尺度优先保留必要元素，降低构筑物和水体尺度。
- `buildingStyle` 必须影响建筑元素的文本、比例或 variant，例如 `classic` 偏厅堂，`compact` 偏小筑，`scholar` 偏书斋。
- `focalPoint` 必须影响规则优先级和元素组合：`pond` 强化水院，`rockery` 强化叠山，`pavilion` 强化亭榭。
- `requirementConfirmation` 中的手动文字优先级高于参数派生默认值；当用户写明构筑物或植物偏好时，规则解释和元素选择需要体现这些偏好。

当场地标注和空间参数冲突时，按以下优先级处理：

1. 安全几何约束：元素必须落在可用庭院区域内，并避开建筑主体。
2. 用户显式场地标注：入口、主观景面、建筑轮廓和邻里界面优先。
3. 用户显式需求确认：手动填写的构筑物、植物和功能偏好优先。
4. 左侧空间参数：水体、叠石、植物、游线曲度、风格和核心景点控制强度与数量。
5. 内置苏式规则默认值：仅在信息不足时补足布局。

每条 `RuleExplanation` 需要记录主要参数影响，例如“水体占比 38% 约束水院为中小尺度”或“游线曲度 58% 使入口路径产生两段转折”，让 SVG 和 JSON 都能解释参数如何生效。

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

第一期内置规则建议覆盖 5 类行为：

1. **邻里界面遮挡**
   如果西侧或东侧为邻里界面，则沿该侧布置竹林和景墙，标注“竹影障景”。

2. **入口障景转折**
   如果入口到庭院核心近似直视，则在入口内侧设置障景墙或植物组团，使主路径先转折再入园。

3. **水院尺度适配**
   优先根据 `waterRatio` 确定水院目标面积；`courtyardScale` 只在可用空间不足时作为上限约束收缩水面，避免占满场地。

4. **构筑物组合**
   根据 `structureTypes` 或当前 `focalPoint` 生成亭、廊、桥组合：水院有桥，茶庭有月洞门，主景点可配亭。

5. **植物与框景**
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
4. `path`：路径、入口转折。
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
- 茶庭节点：小圆形或方形铺装节点，可由后续规则放入合适的安静候选区，不固定在东南角。
- 视线箭头：从建筑主观景面指向水院或框景点，红褐色箭头，标注“主观景视线”。
- 文字说明：导出 SVG 中直接包含中文标签，JSON 中同步输出解释文本。

## AI Prompt 接入

生成 AI 图像时，现有 prompt 继续作为基础。如果存在规则布局结果，追加规则解释和关键空间关系：

```text
规则化空间关系：
- 西侧以竹林和景墙形成竹影障景。
- 入口内侧设置障景墙，使路径转折后进入庭院核心。
- 水院尺度由水体占比控制，植物和叠石数量由对应密度参数控制。
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
  验证地块和建筑包围盒、方位推断、入口直视、quiet zones 推断。

- `suzhouRules.test.ts`
  验证典型规则命中：西侧邻里界面生成竹林、景墙和“竹影障景”；入口直视核心时生成障景墙和路径折点；水体、叠石、植物、构筑物数量受左侧空间参数约束。

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
