# Local Development

## Install

```bash
npm install
```

## Run Frontend And Dev Proxy

```bash
npm run dev
```

## Run Production-Style Local Server

```bash
cp .env.example .env.local
VECTOR_ENGINE_API_KEY="your-key" npm run serve
```

## Verify

```bash
npm test
npm run build
```

## Troubleshooting

- Missing API key: set `VECTOR_ENGINE_API_KEY`.
- Provider timeout: increase `VECTOR_ENGINE_TIMEOUT_MS` or retry later.
- Reference image rejected: reduce file size under `IMAGE_PROXY_MAX_BODY_BYTES`.
