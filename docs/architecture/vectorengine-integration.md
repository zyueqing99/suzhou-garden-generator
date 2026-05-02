# VectorEngine Integration

The browser never calls VectorEngine directly. It calls `/api/images/generate`, and the local proxy attaches `VECTOR_ENGINE_API_KEY`.

Provider calls:

- `POST /v1/images/generations` with model `gpt-image-2`.
- `POST /v1/images/edits` with model `gpt-image-2`.
- Fallback `POST /v1/images/generations` with model `gpt-image-2-all`.

Accepted image response shapes:

- `data[].url`
- `data[].b64_json`

Proxy errors must be returned as:

```json
{
  "error": {
    "code": "provider_timeout",
    "message": "Image generation timed out.",
    "retryable": true
  }
}
```
