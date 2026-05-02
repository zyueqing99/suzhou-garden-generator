# Architecture Overview

The app has three boundaries:

1. React frontend for project editing, SVG preview, AI generation controls, and exports.
2. Browser storage repository for local-first project persistence.
3. Node image proxy for VectorEngine calls and provider secret isolation.

Data flow:

1. UI updates `GardenProject.parameters`.
2. `generateGardenPlan(parameters, seed)` derives the SVG plan.
3. `buildImagePrompt` derives provider prompt text.
4. `requestAiImage` posts to `/api/images/generate`.
5. The proxy calls VectorEngine and returns a normalized response.
6. The frontend stores the generation record on the active project.
