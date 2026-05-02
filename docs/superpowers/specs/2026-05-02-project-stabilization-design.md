# Project Stabilization Design

**Date:** 2026-05-02
**Project:** Suzhou Garden Generator
**Status:** Draft for review

## Goal

Turn the current prototype into a maintainable, safe, and development-ready MVP by defining the missing product loop, documentation baseline, architecture boundaries, third-party integration contract, error handling model, and engineering workflow.

## Current State

The project is a Vite + React single-page app with a local Node HTTP proxy for VectorEngine image generation. The app can generate a deterministic SVG garden plan from slider parameters, send prompts to the image provider, display one AI image result, and export SVG/PNG from the rule-generated plan.

The current implementation is useful as a prototype, but it lacks the product and engineering structures needed for stable follow-up development:

- No project persistence or history.
- No authentication or access boundary around the image proxy.
- No visible non-AI design fallback when image generation fails.
- No request size limits or source image URL controls in the proxy.
- No server-side type checking.
- Minimal README only; no design, architecture, third-party, workflow, task, or operational docs.
- Tests cover a small set of pure functions, but not end-to-end product flows.

## Stabilization Principles

1. The deterministic SVG garden plan is the baseline deliverable. AI image generation is an enhancement, not the only usable result.
2. A "project" is the central product object. Users should be able to create, reopen, revise, and export prior work.
3. The image proxy must be treated as a privileged backend service because it holds provider credentials and spends paid quota.
4. Third-party integration behavior must be documented as a contract, including request shape, response shape, fallback behavior, timeouts, and common errors.
5. Development should proceed from documented requirements and small verified changes, not ad hoc UI edits.

## Product Scope

### In Scope

- Document the product goal, MVP workflow, and non-goals.
- Introduce a project persistence model.
- Add a project history experience.
- Preserve the rule-generated SVG preview as a visible fallback.
- Improve AI generation error handling and retry messaging.
- Add proxy safety controls.
- Add documentation for third-party VectorEngine usage.
- Add engineering workflow docs and quality gates.
- Add test coverage for the main product loop and proxy error paths.

### Out of Scope For First Stabilization Pass

- Multi-user team collaboration.
- Payments or quota billing UI.
- Full cloud deployment with managed database.
- Advanced asset library management.
- Real architectural CAD/BIM export.
- High-fidelity image editing tools.

## Target MVP Workflow

1. User opens the app.
2. User creates a new garden project.
3. App immediately shows a rule-generated SVG concept plan.
4. User adjusts parameters, style, focal point, and prompt direction.
5. App saves project draft state locally.
6. User optionally uploads a reference image.
7. User requests AI generation.
8. App shows progress and preserves the SVG fallback.
9. If AI succeeds, app stores the generated image as a project asset.
10. If AI fails, app shows a categorized error and leaves the SVG plan usable.
11. User can reopen previous projects from a history view.
12. User can export SVG, PNG, and a project JSON package.

## Architecture

### Frontend

The frontend remains a React application. It should be split into clear modules:

- `src/domain/project.ts`: Project, generation, and asset types.
- `src/domain/projectRepository.ts`: Persistence interface.
- `src/storage/localProjectRepository.ts`: Local storage or IndexedDB implementation.
- `src/aiImageClient.ts`: Browser client for backend image API.
- `src/gardenGenerator.ts`: Deterministic rule-based garden plan generation.
- `src/App.tsx`: Composition and screen-level state only.
- `src/components/ProjectHistory.tsx`: Project list and reopen workflow.
- `src/components/GardenWorkspace.tsx`: Main editing/generation workspace.
- `src/components/ErrorNotice.tsx`: Structured error display.

Initial persistence should use browser storage to keep the MVP simple. IndexedDB is preferred if generated image metadata or project payloads grow beyond localStorage comfort. The repository interface should hide that choice from UI components.

### Backend Proxy

The Node proxy remains the only holder of `VECTOR_ENGINE_API_KEY`. It should provide a small API surface:

- `POST /api/images/generate`: Create an image from prompt and optional internal reference asset.
- `GET /api/health`: Return runtime readiness without exposing secrets.

Before deployment or shared-network usage, the proxy must add:

- API access token or session authentication.
- Request body size limit.
- Rate limiting.
- URL allowlist or removal of arbitrary remote URL fetching.
- Structured error responses.
- Provider timeout and retry policy.

For the local-only phase, the server must still reject oversized request bodies and unsafe URL schemes.

## Data Model

### GardenProject

```ts
export interface GardenProject {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  seed: number;
  parameters: GardenParameters;
  customPrompt: string;
  referenceAssetId?: string;
  generations: ImageGeneration[];
}
```

### ImageGeneration

```ts
export interface ImageGeneration {
  id: string;
  projectId: string;
  createdAt: string;
  mode: 'generate' | 'edit';
  status: 'pending' | 'succeeded' | 'failed';
  prompt: string;
  provider: 'vectorengine';
  model: 'gpt-image-2' | 'gpt-image-2-all';
  imageUrl?: string;
  error?: GenerationError;
}
```

### GenerationError

```ts
export interface GenerationError {
  code:
    | 'missing_api_key'
    | 'invalid_request'
    | 'request_too_large'
    | 'provider_timeout'
    | 'provider_rate_limited'
    | 'provider_rejected_prompt'
    | 'provider_unavailable'
    | 'empty_provider_response'
    | 'unknown_error';
  message: string;
  retryable: boolean;
  requestId?: string;
}
```

## Third-Party Integration Contract

The project uses VectorEngine as an OpenAI-compatible image provider.

Required environment variables:

- `VECTOR_ENGINE_API_KEY`: Secret provider API key.
- `VECTOR_ENGINE_BASE_URL`: Optional provider base URL, default `https://api.vectorengine.cn`.
- `VECTOR_ENGINE_TIMEOUT_MS`: Optional timeout, default `300000`.
- `IMAGE_PROXY_ACCESS_TOKEN`: Required when the proxy is reachable by other devices or users.
- `IMAGE_PROXY_MAX_BODY_BYTES`: Optional request size limit, default `5242880`.

Supported provider calls:

- Text-to-image: `POST /v1/images/generations`, model `gpt-image-2`.
- Image edit: `POST /v1/images/edits`, model `gpt-image-2`.
- Edit fallback: `POST /v1/images/generations`, model `gpt-image-2-all`, with reference image input.

Response handling:

- Accept `data[].url`.
- Accept `data[].b64_json`.
- Reject empty responses with `empty_provider_response`.
- Preserve raw provider payload in development logs only; do not expose secrets or large payloads in UI.

Fallback behavior:

- If `/v1/images/edits` fails, the proxy may fall back to `gpt-image-2-all` reference generation.
- If all AI generation fails, the frontend keeps the rule-generated SVG plan visible and exportable.

## Error Handling

Errors should be normalized at the backend boundary and mapped to user-safe frontend messages.

Examples:

- Missing API key: "Image service is not configured. Set `VECTOR_ENGINE_API_KEY` on the proxy server."
- Request too large: "The reference image is too large. Use an image under the configured limit."
- Timeout: "Image generation timed out. You can retry, or export the rule-generated concept plan."
- Rate limit: "The image provider is busy or rate limited. Retry later."
- Empty response: "The provider returned no image. The rule-generated concept plan is still available."

Each failed generation should be recorded in the project history with its prompt, timestamp, error code, and retryability.

## Security Requirements

1. The browser must never receive `VECTOR_ENGINE_API_KEY`.
2. The proxy must not fetch arbitrary internal or private network URLs from user input.
3. Uploaded reference images must be validated by type and size.
4. Requests must be capped before buffering into memory.
5. Shared or deployed environments must require authentication before spending provider quota.
6. Provider errors must be sanitized before display.

## Documentation Set

Create and maintain these docs:

- `docs/product/product-brief.md`: Product goal, users, MVP workflow, non-goals.
- `docs/product/requirements.md`: Functional requirements and acceptance criteria.
- `docs/architecture/overview.md`: Frontend, proxy, storage, and data flow architecture.
- `docs/architecture/data-model.md`: Project, generation, asset, and error models.
- `docs/architecture/vectorengine-integration.md`: Provider contract, env vars, endpoints, fallback behavior.
- `docs/operations/local-development.md`: Install, env setup, running, testing, troubleshooting.
- `docs/workflow/development-workflow.md`: Branching, commit style, review, quality gates.
- `docs/workflow/task-log.md`: Feature/task decision log with date, owner, status, and links.
- `.env.example`: Safe environment variable template.

## Testing Strategy

### Unit Tests

- Garden generation determinism and parameter effects.
- Prompt construction.
- AI response parsing.
- Project repository save/load/update/delete behavior.
- Error normalization.
- Request size and URL safety helpers.

### Integration Tests

- Image proxy rejects missing prompt.
- Image proxy rejects oversized body.
- Image proxy rejects unsafe image URLs.
- Image proxy maps provider timeout to structured error.
- Image proxy handles provider `url` and `b64_json` payloads.

### UI Tests

- New project shows visible SVG baseline.
- Parameter change updates project draft.
- AI failure leaves SVG export available.
- Successful generation appears in project history.
- Reopened project restores parameters, prompt, and generation records.

## Engineering Workflow

Each functional change should follow this loop:

1. Update or create the relevant requirement/design doc.
2. Write failing tests for the behavior.
3. Implement the smallest change that satisfies the tests.
4. Run `npm test`.
5. Run `npm run build`.
6. Update task log and documentation.
7. Commit only related files.

Quality gates before merging:

- `npm test` passes.
- `npm run build` passes.
- No provider secrets in tracked files.
- New behavior has acceptance criteria.
- User-facing errors are structured and actionable.

## Implementation Phases

### Phase 1: Documentation Baseline

Create the documentation set listed above and add `.env.example`. This phase does not change runtime behavior.

### Phase 2: Project Persistence

Introduce `GardenProject`, repository interfaces, local persistence, project history UI, and project JSON export.

### Phase 3: Fallback-First Workspace

Make the SVG plan visible as the baseline preview, keep AI output as an enhancement, and ensure failed AI calls never block export.

### Phase 4: Proxy Safety

Add request size limits, URL validation, optional access token authentication, structured error mapping, and proxy integration tests.

### Phase 5: Workflow Hardening

Add CI, lint/format rules, server verification, E2E tests, and task log discipline.

## Acceptance Criteria

- A new developer can understand the product goal, architecture, third-party integration, and local setup from docs alone.
- A user can create, save, reopen, and export a garden project.
- AI generation failure still leaves a visible, exportable garden concept.
- The image proxy rejects unauthenticated shared access when configured.
- The image proxy rejects oversized request bodies.
- The image proxy does not fetch unsafe user-controlled URLs.
- Tests cover the primary project lifecycle and proxy error paths.
- `npm test` and `npm run build` pass before completion claims.

## Open Decisions

1. Persistence backend for the next pass: local browser storage first, or introduce a real backend database immediately.
2. Authentication scope: local shared-token protection first, or full user accounts.
3. Generated image storage: keep provider URLs, store base64 locally, or add object storage.
4. Project history UI shape: sidebar list, separate dashboard, or route-based project index.

## Recommendation

Use a local-first stabilization path:

1. Write the documentation baseline.
2. Add local project persistence and history.
3. Expose SVG fallback as the always-available baseline.
4. Harden the proxy enough for safe local/shared development.
5. Add CI and broader tests.

This keeps scope controlled while directly addressing the current blockers for follow-up development.
