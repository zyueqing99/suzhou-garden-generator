# suzhou-garden-generator

苏式庭院景观概念方案生成器。左侧调节庭院参数和 AI 提示词，右侧生成 GPT Image 方案图，并支持导出规则 SVG/PNG。

## Scripts

```bash
npm run dev
npm run build
npm test
```

## VectorEngine Image Proxy

浏览器端不直接持有 VectorEngine key。生产式本地运行请使用内置代理：

```bash
VECTOR_ENGINE_API_KEY="your-key" npm run serve
```

可选环境变量：

- `PORT`：代理服务端口，默认 `4174`。
- `VECTOR_ENGINE_BASE_URL`：默认 `https://api.vectorengine.cn`。
- `VECTOR_ENGINE_TIMEOUT_MS`：图像接口超时，默认 `300000`。

代理接口：

- `POST /api/images/generate`
- 生成：转发到 `/v1/images/generations`，模型 `gpt-image-2`。
- 编辑：优先转发到 `/v1/images/edits`；不可用时降级为 `gpt-image-2-all` 参考图生成。

VectorEngine 可能返回 `data[].url` 或 `data[].b64_json`，前端两种都会显示。
