# 基于规则的 SVG 生成实施计划

> **给智能体执行者：** 必须使用 `superpowers:subagent-driven-development`（推荐）或 `superpowers:executing-plans` 按任务逐项执行本计划。步骤使用复选框（`- [ ]`）语法跟踪进度。

**目标：** 基于地块标记、场地解析、需求确认和庭院参数生成规则化苏式园林 SVG 布局，同时保留现有“只有参数也能生成方案”的路径。

**架构：** 新增 `src/ruleLayout.ts`，把场地与参数数据派生为 `RuleLayoutContext`。新增 `src/suzhouRules.ts`，放置可序列化的内置规则表和规则执行器。然后扩展 `generateGardenPlan(parameters, seed, siteContext?)`，把规则生成的元素、摘要和解释合并进现有 `GardenPlan`，并让 `GardenPreview` 和 AI 提示词复用同一套规则解释。

**技术栈：** TypeScript、React 19、Vitest、Vite、SVG。

---

## 文件结构

- 新建 `src/ruleLayout.ts`：把 `SiteMarkup`、`SiteAnalysisData`、`RequirementConfirmation` 和 `GardenParameters` 转成规则可用的几何上下文和参数 profile。
- 新建 `src/ruleLayout.test.ts`：测试包围盒、方位推断、安静区候选点和参数 profile。
- 新建 `src/suzhouRules.ts`：内置可序列化规则定义、规则执行器、元素创建辅助函数和 `RuleExplanation` 类型。
- 新建 `src/suzhouRules.test.ts`：测试遮挡、入口转折、水院尺寸、构筑物组合、植物配置和参数影响。
- 修改 `src/gardenGenerator.ts`：扩展类型，新增可选场地上下文输入，合并规则结果，并保留无上下文时的确定性输出。
- 修改 `src/gardenGenerator.test.ts`：覆盖向后兼容和规则增强输出。
- 修改 `src/GardenPreview.tsx`：渲染新增 SVG 元素类型，并固定图层顺序。
- 新建 `src/GardenPreview.test.tsx`：用服务端渲染测试新增元素和中文标签。
- 修改 `src/aiImageClient.ts`：从 `GardenPlan.ruleExplanations` 追加规则解释到 AI prompt。
- 修改 `src/aiImageClient.test.ts`：覆盖规则 prompt 复用。
- 修改 `src/components/GardenWorkspace.tsx`：把派生场地上下文传给 `generateGardenPlan`，并在 JSON 导出中包含规则布局结果。
- 修改 `src/components/GardenWorkspace.test.tsx`：在可测试范围内覆盖规则标签预览和 JSON/导出相关展示。

---

### 任务 1：规则布局上下文

**文件：**
- 新建：`src/ruleLayout.ts`
- 新建：`src/ruleLayout.test.ts`

- [ ] **步骤 1：先写失败的上下文测试**

新增 `src/ruleLayout.test.ts`，测试以下行为：
- 百分比坐标能映射到 1080 × 760 的 SVG 坐标系。
- 地块边界和建筑轮廓的包围盒能从多边形点计算出来。
- 能从 `SiteAnalysisData` 解析东西邻里界面、入口方位和建筑主观景面方位。
- 参数 profile 必须保留 `waterRatio`、`rockDensity`、`plantingDensity`、`pathCurvature`、`buildingStyle` 和 `focalPoint`，作为规则触发和规则动作的事实来源。
- 用户显式填写的需求文字必须保留在 `requirementProfile` 中。

运行：`npm test -- src/ruleLayout.test.ts --run`

预期：失败，因为 `src/ruleLayout.ts` 还不存在。

- [ ] **步骤 2：实现上下文派生**

创建 `src/ruleLayout.ts`，导出：
- `RuleLayoutContext`
- `LayoutBounds`
- `LayoutSide`
- 各类参数 profile 类型
- `createRuleLayoutContext(input)`
- `hasUsableSiteContext(context)`

实现细节：
- 使用从 `gardenGenerator.ts` 导出的 `PLAN_WIDTH = 1080` 和 `PLAN_HEIGHT = 760`。
- 百分比点位换算公式：`x = point.x / 100 * width`，`y = point.y / 100 * height`。
- 当地块边界不足 3 个点时，使用默认地块范围 `{ x: 42, y: 42, width: 996, height: 676 }`。
- 只有建筑轮廓至少 3 个点时才生成 `buildingBounds`。
- 用一个小 mapper 解析中文方位字符串：包含 `西`、`东`、`南`、`北` 时分别映射为 `'west'`、`'east'`、`'south'`、`'north'`，否则为 `'unknown'`。
- `scaleProfile.name` 派生规则：小于 40 为 `small`，小于 72 为 `medium`，否则为 `large`。
- 密度类数量使用 clamp 后的值派生，例如植物 `Math.round(4 + plantingDensity / 12)`，叠石 `Math.round(2 + rockDensity / 18)`，路径折点 `Math.round(1 + pathCurvature / 35)`。
- 从地块包围盒角点生成 `quietZones`，并尽量避开与入口同侧的角点。

- [ ] **步骤 3：验证上下文测试通过**

运行：`npm test -- src/ruleLayout.test.ts --run`

预期：通过。

---

### 任务 2：内置苏式规则执行器

**文件：**
- 新建：`src/suzhouRules.ts`
- 新建：`src/suzhouRules.test.ts`
- 修改：`src/gardenGenerator.ts`

- [ ] **步骤 1：先写失败的规则测试**

新增 `src/suzhouRules.test.ts`，断言以下行为：
- 西侧邻里界面会生成 `bambooScreen`、`screenWall`，并生成包含“竹影障景”的 `RuleExplanation`。
- 入口直视时会生成 `screenWall` 和 `path`；当 `pathCurvature` 更高时，路径折点更多。
- `waterRatio` 增大时水体面积变大；`courtyardScale` 只在水面过大时限制尺寸，解释文字要说明“因地块尺度收缩”。
- `rockDensity` 和 `plantingDensity` 更高时，会生成更多 `rock` 和 `plant` 元素。
- `focalPoint: 'pavilion'` 或需求文字包含 `亭` 时生成 `pavilion`；需求文字包含 `月洞门` 时生成 `moonGate`。

运行：`npm test -- src/suzhouRules.test.ts --run`

预期：失败，因为 `src/suzhouRules.ts` 还不存在。

- [ ] **步骤 2：扩展生成器元素类型**

在 `src/gardenGenerator.ts` 中：
- 导出 `PLAN_WIDTH` 和 `PLAN_HEIGHT`。
- 给 `GardenElementKind` 增加 `screenWall`、`viewArrow`、`moonGate`、`bambooScreen` 和 `courtyardNode`。
- 给 `GardenElement` 增加 `sourceRule?: string`、`label?: string`、`description?: string` 和 `layer?: 'base' | 'screening' | 'building' | 'water' | 'path' | 'planting' | 'structure' | 'annotation'`。
- 给 `GardenPlan` 增加 `ruleExplanations?: RuleExplanation[]`，并以 type import 引入 `RuleExplanation`。

- [ ] **步骤 3：实现规则定义和执行器**

创建 `src/suzhouRules.ts`，导出：
- `SuzhouRuleDefinition`
- `RuleExplanation`
- `RuleApplication`
- `builtInSuzhouRules`
- `applySuzhouRules(context, ruleDefinitions = builtInSuzhouRules)`

实现这些内置规则 id：
- `neighbor-bamboo-screen`：东西邻里界面沿边生成竹林和短景墙。
- `entry-screen-turn`：已标记入口时生成入口障景墙和转折卵石路径；转折强度读取 `pathProfile`。
- `main-view-water-court`：水院尺寸优先由 `waterProfile.targetRatio` 控制，再由 `scaleProfile` 给出的可用空间上限限制。
- `structure-combination`：有水院时加桥；核心景点或需求要求时加亭；需求要求茶庭或月洞门时加月洞门。
- `plant-view-framing`：主视线附近生成松、枫、竹框景植物，水边生成莲；数量读取 `plantingProfile`。
- `rockery-density`：根据 `rockProfile` 生成叠石；当 `focalPoint === 'rockery'` 时，把叠石集中到主景区域。

每个生成元素都必须包含 `sourceRule`，并在有用时包含 `label` 或 `description`，同时设置 `layer`。

- [ ] **步骤 4：验证规则测试通过**

运行：`npm test -- src/suzhouRules.test.ts --run`

预期：通过。

---

### 任务 3：把规则接入庭院方案生成

**文件：**
- 修改：`src/gardenGenerator.ts`
- 修改：`src/gardenGenerator.test.ts`
- 修改：`src/components/GardenWorkspace.tsx`

- [ ] **步骤 1：先写失败的生成器集成测试**

在 `src/gardenGenerator.test.ts` 中新增测试，断言：
- `generateGardenPlan(parameters, seed)` 保持确定性，并且没有 `ruleExplanations`，或只有空数组。
- `generateGardenPlan(parameters, seed, context)` 会包含地块边界/建筑轮廓参考元素、带 `sourceRule` 的规则元素和规则解释。
- 规则增强后的水体面积会随 `waterRatio` 改变。

运行：`npm test -- src/gardenGenerator.test.ts --run`

预期：失败，因为第三个参数还不支持。

- [ ] **步骤 2：实现生成器集成**

在 `src/gardenGenerator.ts` 中：
- 把函数签名改为 `generateGardenPlan(parameters, seed = Date.now(), ruleContext?: RuleLayoutContext): GardenPlan`。
- 当 `ruleContext` 缺失或不可用时，保持现有只靠参数生成元素的路径不变。
- 当上下文可用时，先创建地块边界和建筑轮廓/参考底图元素，再执行 `applySuzhouRules`，返回包含底图约束元素和规则生成元素的方案。
- 规则路径不要引入新的随机数，保证输出稳定可复现。
- 把规则应用产生的 summary 追加到现有参数 summary 后面。
- 输出 `ruleExplanations`。

在 `src/components/GardenWorkspace.tsx` 中：
- 使用 `createRuleLayoutContext({ parameters, siteMarkup, siteAnalysis, requirementConfirmation })` 派生 `ruleLayoutContext`。
- 只有当地块上下文可用时，才把它传给 `generateGardenPlan`。
- JSON 导出时通过现有 `downloadJson({ project, plan, siteAnalysis, requirementConfirmation }, filename)` 路径加入 `ruleExplanations`。

- [ ] **步骤 3：验证生成器集成测试通过**

运行：`npm test -- src/gardenGenerator.test.ts --run`

预期：通过。

---

### 任务 4：渲染规则 SVG 元素

**文件：**
- 修改：`src/GardenPreview.tsx`
- 新建：`src/GardenPreview.test.tsx`

- [ ] **步骤 1：先写失败的预览测试**

创建 `src/GardenPreview.test.tsx`，使用 `renderToStaticMarkup` 测试：
- 元素按固定图层顺序渲染：`base` 在 `screening` 前，`screening` 在 `water` 前，`water` 在 `path` 前，`path` 在 `planting` 前，`planting` 在 `structure` 前，`structure` 在 `annotation` 前。
- `bambooScreen`、`screenWall`、`moonGate`、`courtyardNode` 和 `viewArrow` 都能渲染出可见 SVG 标记。
- “竹影障景”“主观景视线”等中文标签能出现在 SVG 中。

运行：`npm test -- src/GardenPreview.test.tsx --run`

预期：失败，因为新增 kind 还没有渲染。

- [ ] **步骤 2：实现预览渲染**

在 `src/GardenPreview.tsx` 中：
- 渲染前按图层顺序排序或分组元素。
- 增加渲染分支：
  - `screenWall`：短白墙矩形/线段，深色描边。
  - `bambooScreen`：重复竹竿线条，并支持可选标签。
  - `moonGate`：圆形门洞符号，沿用现有门的视觉语言。
  - `courtyardNode`：茶庭/停留空间的小铺装节点。
  - `viewArrow`：带箭头 marker 的线和标签。
- 保持已有元素 kind 的渲染逻辑不变。

- [ ] **步骤 3：验证预览测试通过**

运行：`npm test -- src/GardenPreview.test.tsx --run`

预期：通过。

---

### 任务 5：把规则解释接入 AI 提示词

**文件：**
- 修改：`src/aiImageClient.ts`
- 修改：`src/aiImageClient.test.ts`

- [ ] **步骤 1：先写失败的 prompt 测试**

在 `src/aiImageClient.test.ts` 中新增一个带 `ruleExplanations` 的 plan，断言 `buildGardenImagePrompt` 包含：
- `规则化空间关系`
- 来自 plan 的规则解释文字
- 不重复追加用户自定义方向文字

运行：`npm test -- src/aiImageClient.test.ts --run`

预期：失败，因为规则解释尚未被使用。

- [ ] **步骤 2：实现 prompt 扩展**

在 `src/aiImageClient.ts` 中：
- 当 `plan.ruleExplanations?.length` 大于 0 时，让 `buildGardenImagePrompt` 追加 `规则化空间关系：` 段落。
- 使用 `ruleExplanations.map((explanation) => \`- ${explanation.summary}\`)` 作为唯一的规则 prompt 文案来源。
- 保持 `buildImagePrompt` 继续在生成好的基础 prompt 后追加用户自定义方向。

- [ ] **步骤 3：验证 prompt 测试通过**

运行：`npm test -- src/aiImageClient.test.ts --run`

预期：通过。

---

### 任务 6：完整验证

**文件：**
- 只应涉及以上列出的文件。

- [ ] **步骤 1：运行聚焦测试**

运行：

```bash
npm test -- src/ruleLayout.test.ts src/suzhouRules.test.ts src/gardenGenerator.test.ts src/GardenPreview.test.tsx src/aiImageClient.test.ts src/components/GardenWorkspace.test.tsx --run
```

预期：通过。

- [ ] **步骤 2：运行全项目检查**

运行：

```bash
npm test -- --run
npm run typecheck
npm run build
```

预期：通过。

- [ ] **步骤 3：检查 git diff 范围**

运行：

```bash
git diff --stat
git diff -- src/ruleLayout.ts src/suzhouRules.ts src/gardenGenerator.ts src/GardenPreview.tsx src/aiImageClient.ts src/components/GardenWorkspace.tsx
```

预期：diff 只集中在规则布局生成、预览渲染、prompt 接入和测试上。

---

## 自查

- 规格覆盖：本计划覆盖规则上下文、参数符合性、可序列化规则定义、第一批规则行为、SVG 元素表达、AI prompt 复用、通过 plan 纳入 JSON 导出，以及测试策略。
- 占位符扫描：没有 `TBD`、`TODO` 或空泛的“以后补测试”等占位写法。
- 类型一致性：`RuleLayoutContext`、`RuleExplanation`、`GardenElementKind` 和 `GardenPlan.ruleExplanations` 都在后续使用前先定义。
