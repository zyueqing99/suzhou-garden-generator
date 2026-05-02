# Requirements

## Functional Requirements

### Project Lifecycle

- Users can create a new project with default garden parameters.
- Users can update project parameters and custom prompt text.
- Users can reopen saved projects from a history list.
- Users can export project state as JSON.

### Baseline Preview

- The SVG concept plan is visible before AI generation.
- The SVG concept plan remains visible after AI failure.
- SVG and PNG export work without AI generation.

### AI Generation

- Users can generate a text-to-image result.
- Users can upload a reference image for image-to-image generation.
- Users can edit the current AI image when one exists.
- Successful generations are stored in project history.
- Failed generations store a structured error.

### Proxy Safety

- The proxy rejects missing prompts.
- The proxy rejects oversized request bodies.
- The proxy rejects unsafe image URLs.
- The proxy can require an access token when configured.

## Acceptance Criteria

- `npm test` passes.
- `npm run build` passes.
- A new project can be saved, reopened, and exported.
- AI failure does not remove the visible SVG plan.
- Provider credentials are never exposed to browser code.
