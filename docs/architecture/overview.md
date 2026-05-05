# Architecture Overview

The app has three boundaries:

1. React frontend for project editing, site image markup, AI generation controls, local explanations, and exports.
2. Browser storage repository for local-first project persistence.
3. Node image proxy for VectorEngine calls and provider secret isolation.

数据流：

1. UI 保存上传的场地图和归一化后的 `SiteMarkup`。
2. `createSiteAnalysis(markup)` 推导结构化场地约束。
3. `captureAnnotatedSiteImage` 把上传场地图和标注覆盖层绘制成 PNG data URL。
4. `buildSiteImagePrompt` 组合场地解析、生成控制、自定义方向和内置苏州园林规则。
5. `requestAiImage` 请求 `/api/images/generate`。
6. 代理服务调用 VectorEngine，并返回标准化图像响应。
7. 前端保存生成记录，并渲染本地方案说明栏目。
