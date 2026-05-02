# Project Stabilization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stabilize the Suzhou Garden Generator prototype into a maintainable MVP with documented workflows, project persistence, visible SVG fallback, safer image proxy behavior, and verifiable quality gates.

**Architecture:** Keep the existing Vite + React frontend and Node HTTP proxy. Add a local-first project domain and repository layer on the frontend, treat the SVG plan as the baseline deliverable, and harden the proxy with request limits, URL safety, optional token auth, and structured errors. Documentation and tests are first-class deliverables for every phase.

**Tech Stack:** React 19, TypeScript 5, Vite 7, Vitest 3, Node ESM HTTP server, browser localStorage for the first persistence pass, VectorEngine image API through the local proxy.

---

## File Structure

- Create: `.env.example`
  - Safe local environment template for proxy configuration.
- Create: `docs/product/product-brief.md`
  - Product goal, target users, MVP workflow, and non-goals.
- Create: `docs/product/requirements.md`
  - Functional requirements and acceptance criteria.
- Create: `docs/architecture/overview.md`
  - Frontend, proxy, storage, and VectorEngine data flow.
- Create: `docs/architecture/data-model.md`
  - `GardenProject`, `ImageGeneration`, `GenerationError`, and repository contracts.
- Create: `docs/architecture/vectorengine-integration.md`
  - Provider endpoints, request/response handling, fallback behavior, env vars, and known errors.
- Create: `docs/operations/local-development.md`
  - Install, run, test, build, environment setup, and troubleshooting.
- Create: `docs/workflow/development-workflow.md`
  - Branching, commits, review, testing, and merge gates.
- Create: `docs/workflow/task-log.md`
  - Dated task/decision log.
- Create: `src/domain/project.ts`
  - Project, generation, error, and default project factory.
- Create: `src/domain/projectRepository.ts`
  - Repository interface.
- Create: `src/storage/localProjectRepository.ts`
  - localStorage-backed project repository.
- Create: `src/storage/localProjectRepository.test.ts`
  - Repository persistence tests.
- Create: `src/components/ErrorNotice.tsx`
  - Structured generation error display.
- Create: `src/components/ProjectHistory.tsx`
  - History list and project reopen controls.
- Create: `src/components/GardenWorkspace.tsx`
  - Main editor/generation/export workspace extracted from `App`.
- Modify: `src/App.tsx`
  - Replace single in-memory state with project repository loading and screen composition.
- Modify: `src/styles.css`
  - Add history/workspace/fallback layout styles and make SVG baseline visible.
- Modify: `src/exporters.ts`
  - Add project JSON export.
- Modify: `src/aiImageClient.ts`
  - Normalize API errors into `GenerationError`.
- Modify: `server/vectorEngineImageHandler.mjs`
  - Add body size cap, optional auth token, URL safety checks, structured error responses.
- Modify: `server/vectorEngineImageHandler.d.mts`
  - Export new helper signatures used by tests.
- Modify: `server/vectorEngineImageHandler.test.mjs`
  - Expand proxy tests for request limits and URL safety.
- Modify: `tsconfig.json`
  - Include server type declarations or add an explicit server-check plan.
- Modify: `package.json`
  - Add `typecheck`, optional `test:watch`, and CI-friendly scripts.

---

## Task 1: Documentation Baseline

**Files:**
- Create: `.env.example`
- Create: `docs/product/product-brief.md`
- Create: `docs/product/requirements.md`
- Create: `docs/architecture/overview.md`
- Create: `docs/architecture/data-model.md`
- Create: `docs/architecture/vectorengine-integration.md`
- Create: `docs/operations/local-development.md`
- Create: `docs/workflow/development-workflow.md`
- Create: `docs/workflow/task-log.md`

- [ ] **Step 1: Create `.env.example`**

```env
# Required for AI image generation through the local proxy.
VECTOR_ENGINE_API_KEY=

# Optional. Defaults to https://api.vectorengine.cn.
VECTOR_ENGINE_BASE_URL=https://api.vectorengine.cn

# Optional. Defaults to 300000.
VECTOR_ENGINE_TIMEOUT_MS=300000

# Required when the proxy is reachable by other devices or users.
IMAGE_PROXY_ACCESS_TOKEN=

# Optional. Defaults to 5242880.
IMAGE_PROXY_MAX_BODY_BYTES=5242880
```

- [ ] **Step 2: Create `docs/product/product-brief.md`**

```markdown
# Product Brief

## Product Goal

Suzhou Garden Generator helps designers quickly produce a Suzhou-style courtyard concept plan. The deterministic SVG plan is the baseline output, and AI image generation is an optional visual enhancement.

## Target Users

- Landscape designers preparing early concept options.
- Architecture teams exploring courtyard composition.
- Product reviewers who need saved iterations and exportable artifacts.

## MVP Workflow

1. Create a garden project.
2. Adjust spatial parameters, style, focal point, and prompt direction.
3. Review the visible rule-generated SVG concept plan.
4. Optionally upload a reference image.
5. Generate or edit an AI image.
6. Save generated results into the project history.
7. Reopen previous projects.
8. Export SVG, PNG, and project JSON.

## Non-Goals

- Multi-user collaboration.
- Billing or quota management.
- Production cloud deployment.
- CAD/BIM-grade geometry export.
- Advanced image editor tooling.
```

- [ ] **Step 3: Create `docs/product/requirements.md`**

```markdown
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
```

- [ ] **Step 4: Create architecture and operations docs**

Create the files below with the following content:

```markdown
<!-- docs/architecture/overview.md -->
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
```

```markdown
<!-- docs/architecture/data-model.md -->
# Data Model

`GardenProject` is the central object. It owns parameters, prompt text, the deterministic seed, and image generation history.

`ImageGeneration` records every AI attempt, including failures. Failed attempts preserve prompt text, provider, model, error code, retryability, and timestamp.

`ProjectRepository` abstracts persistence so the first implementation can use localStorage and a later implementation can move to a backend database without rewriting UI components.
```

```markdown
<!-- docs/architecture/vectorengine-integration.md -->
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
```

```markdown
<!-- docs/operations/local-development.md -->
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
```

```markdown
<!-- docs/workflow/development-workflow.md -->
# Development Workflow

1. Start from a documented requirement.
2. Write or update tests before implementation.
3. Implement one focused change.
4. Run `npm test`.
5. Run `npm run build`.
6. Update docs and `docs/workflow/task-log.md`.
7. Commit related files only.

Commit style:

- `docs: ...`
- `feat: ...`
- `fix: ...`
- `test: ...`
- `chore: ...`
```

```markdown
<!-- docs/workflow/task-log.md -->
# Task Log

| Date | Status | Area | Summary | Evidence |
| --- | --- | --- | --- | --- |
| 2026-05-02 | Planned | Stabilization | Add docs, persistence, fallback preview, proxy safety, and quality gates. | `docs/superpowers/specs/2026-05-02-project-stabilization-design.md` |
```

- [ ] **Step 5: Run documentation smoke check**

Run:

```bash
rg -n "TB[D]|TO[D]O|FIXM[E]|fill i[n]|待[定]|占[位]" .env.example docs
```

Expected: command exits with no matches.

- [ ] **Step 6: Commit documentation baseline**

```bash
git add .env.example docs/product docs/architecture docs/operations docs/workflow
git commit -m "docs: add project documentation baseline"
```

---

## Task 2: Project Domain And Local Repository

**Files:**
- Create: `src/domain/project.ts`
- Create: `src/domain/projectRepository.ts`
- Create: `src/storage/localProjectRepository.ts`
- Create: `src/storage/localProjectRepository.test.ts`

- [ ] **Step 1: Write failing repository tests**

Create `src/storage/localProjectRepository.test.ts`:

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createDefaultProject } from '../domain/project';
import { createLocalProjectRepository } from './localProjectRepository';

const store = new Map<string, string>();

beforeEach(() => {
  store.clear();
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      store.set(key, value);
    },
    removeItem: (key: string) => {
      store.delete(key);
    },
  });
});

describe('createLocalProjectRepository', () => {
  it('saves and lists projects with newest updated project first', async () => {
    const repository = createLocalProjectRepository('test-projects');
    const older = createDefaultProject({ now: '2026-05-01T10:00:00.000Z', seed: 1, name: 'Older' });
    const newer = createDefaultProject({ now: '2026-05-02T10:00:00.000Z', seed: 2, name: 'Newer' });

    await repository.save(older);
    await repository.save(newer);

    await repository.save({ ...older, updatedAt: '2026-05-03T10:00:00.000Z' });

    expect((await repository.list()).map((project) => project.name)).toEqual(['Older', 'Newer']);
  });

  it('loads a saved project by id', async () => {
    const repository = createLocalProjectRepository('test-projects');
    const project = createDefaultProject({ now: '2026-05-02T10:00:00.000Z', seed: 7, name: 'Water Garden' });

    await repository.save(project);

    expect(await repository.load(project.id)).toEqual(project);
  });

  it('deletes a saved project by id', async () => {
    const repository = createLocalProjectRepository('test-projects');
    const project = createDefaultProject({ now: '2026-05-02T10:00:00.000Z', seed: 7, name: 'Water Garden' });

    await repository.save(project);
    await repository.delete(project.id);

    expect(await repository.load(project.id)).toBeNull();
    expect(await repository.list()).toEqual([]);
  });
});
```

- [ ] **Step 2: Run repository test and verify it fails**

Run:

```bash
npm test -- src/storage/localProjectRepository.test.ts
```

Expected: FAIL because `../domain/project` and `./localProjectRepository` do not exist.

- [ ] **Step 3: Create project domain types**

Create `src/domain/project.ts`:

```ts
import type { GardenParameters } from '../gardenGenerator';

export type GenerationStatus = 'pending' | 'succeeded' | 'failed';
export type GenerationMode = 'generate' | 'edit';
export type GenerationProvider = 'vectorengine';
export type GenerationModel = 'gpt-image-2' | 'gpt-image-2-all';

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

export interface ImageGeneration {
  id: string;
  projectId: string;
  createdAt: string;
  mode: GenerationMode;
  status: GenerationStatus;
  prompt: string;
  provider: GenerationProvider;
  model: GenerationModel;
  imageUrl?: string;
  error?: GenerationError;
}

export interface GardenProject {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  seed: number;
  parameters: GardenParameters;
  customPrompt: string;
  referenceImage?: {
    name: string;
    url: string;
  };
  generations: ImageGeneration[];
}

export const defaultGardenParameters: GardenParameters = {
  courtyardScale: 64,
  waterRatio: 38,
  rockDensity: 46,
  plantingDensity: 62,
  pathCurvature: 58,
  buildingStyle: 'classic',
  focalPoint: 'pond',
};

export const defaultCustomPrompt =
  '画面以苏州古典园林平面概念图为主，强化水院、粉墙黛瓦、太湖石与曲折游线。风格克制、清雅，适合建筑方案汇报。';

export interface CreateDefaultProjectOptions {
  now?: string;
  seed?: number;
  name?: string;
}

export function createDefaultProject(options: CreateDefaultProjectOptions = {}): GardenProject {
  const now = options.now ?? new Date().toISOString();
  const seed = options.seed ?? Date.now();

  return {
    id: `garden-${seed}`,
    name: options.name ?? '苏式庭院方案',
    createdAt: now,
    updatedAt: now,
    seed,
    parameters: defaultGardenParameters,
    customPrompt: defaultCustomPrompt,
    generations: [],
  };
}

export function touchProject(project: GardenProject, now = new Date().toISOString()): GardenProject {
  return { ...project, updatedAt: now };
}
```

- [ ] **Step 4: Create repository interface**

Create `src/domain/projectRepository.ts`:

```ts
import type { GardenProject } from './project';

export interface ProjectRepository {
  list(): Promise<GardenProject[]>;
  load(id: string): Promise<GardenProject | null>;
  save(project: GardenProject): Promise<void>;
  delete(id: string): Promise<void>;
}
```

- [ ] **Step 5: Create localStorage repository**

Create `src/storage/localProjectRepository.ts`:

```ts
import type { GardenProject } from '../domain/project';
import type { ProjectRepository } from '../domain/projectRepository';

const DEFAULT_STORAGE_KEY = 'suzhou-garden-projects';

export function createLocalProjectRepository(storageKey = DEFAULT_STORAGE_KEY): ProjectRepository {
  return {
    async list() {
      return readProjects(storageKey).sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
    },
    async load(id) {
      return readProjects(storageKey).find((project) => project.id === id) ?? null;
    },
    async save(project) {
      const projects = readProjects(storageKey);
      const nextProjects = [project, ...projects.filter((item) => item.id !== project.id)];
      writeProjects(storageKey, nextProjects);
    },
    async delete(id) {
      writeProjects(storageKey, readProjects(storageKey).filter((project) => project.id !== id));
    },
  };
}

function readProjects(storageKey: string): GardenProject[] {
  const raw = localStorage.getItem(storageKey);
  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(isGardenProject) : [];
  } catch {
    return [];
  }
}

function writeProjects(storageKey: string, projects: GardenProject[]) {
  localStorage.setItem(storageKey, JSON.stringify(projects));
}

function isGardenProject(value: unknown): value is GardenProject {
  if (!value || typeof value !== 'object') {
    return false;
  }

  return (
    'id' in value &&
    typeof value.id === 'string' &&
    'name' in value &&
    typeof value.name === 'string' &&
    'createdAt' in value &&
    typeof value.createdAt === 'string' &&
    'updatedAt' in value &&
    typeof value.updatedAt === 'string' &&
    'parameters' in value &&
    typeof value.parameters === 'object' &&
    'customPrompt' in value &&
    typeof value.customPrompt === 'string' &&
    'generations' in value &&
    Array.isArray(value.generations)
  );
}
```

- [ ] **Step 6: Run repository test and verify it passes**

Run:

```bash
npm test -- src/storage/localProjectRepository.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit project domain and repository**

```bash
git add src/domain/project.ts src/domain/projectRepository.ts src/storage/localProjectRepository.ts src/storage/localProjectRepository.test.ts
git commit -m "feat: add local project repository"
```

---

## Task 3: Project History And Workspace State

**Files:**
- Create: `src/components/ProjectHistory.tsx`
- Create: `src/components/GardenWorkspace.tsx`
- Create: `src/components/ErrorNotice.tsx`
- Modify: `src/App.tsx`
- Modify: `src/exporters.ts`
- Modify: `src/styles.css`

- [ ] **Step 1: Add project JSON export**

Modify `src/exporters.ts` by adding this export before `downloadBlob`:

```ts
export function downloadJson(data: unknown, filename: string) {
  const source = JSON.stringify(data, null, 2);
  const blob = new Blob([source], { type: 'application/json;charset=utf-8' });
  downloadBlob(blob, `${filename}.json`);
}
```

- [ ] **Step 2: Create structured error notice component**

Create `src/components/ErrorNotice.tsx`:

```tsx
import type { GenerationError } from '../domain/project';

interface ErrorNoticeProps {
  error: GenerationError;
}

export function ErrorNotice({ error }: ErrorNoticeProps) {
  return (
    <div className="error-notice" role="alert">
      <strong>{error.message}</strong>
      <span>{error.retryable ? '可以稍后重试，规则方案仍可导出。' : '请调整配置或请求后再试。'}</span>
    </div>
  );
}
```

- [ ] **Step 3: Create project history component**

Create `src/components/ProjectHistory.tsx`:

```tsx
import { Plus, Trash2 } from 'lucide-react';
import type { GardenProject } from '../domain/project';

interface ProjectHistoryProps {
  projects: GardenProject[];
  activeProjectId: string;
  onCreateProject: () => void;
  onOpenProject: (projectId: string) => void;
  onDeleteProject: (projectId: string) => void;
}

export function ProjectHistory({ projects, activeProjectId, onCreateProject, onOpenProject, onDeleteProject }: ProjectHistoryProps) {
  return (
    <section className="project-history" aria-label="项目历史">
      <div className="project-history-header">
        <h2>项目历史</h2>
        <button type="button" onClick={onCreateProject} aria-label="新建项目">
          <Plus size={16} aria-hidden="true" />
        </button>
      </div>
      <div className="project-list">
        {projects.map((project) => (
          <article className={project.id === activeProjectId ? 'project-list-item active' : 'project-list-item'} key={project.id}>
            <button type="button" onClick={() => onOpenProject(project.id)}>
              <strong>{project.name}</strong>
              <span>{new Date(project.updatedAt).toLocaleString()}</span>
            </button>
            <button type="button" onClick={() => onDeleteProject(project.id)} aria-label={`删除 ${project.name}`}>
              <Trash2 size={15} aria-hidden="true" />
            </button>
          </article>
        ))}
      </div>
    </section>
  );
}
```

- [ ] **Step 4: Extract workspace component**

Create `src/components/GardenWorkspace.tsx` by moving the current controls and preview from `src/App.tsx` into a controlled component with this public interface:

```tsx
import type { GardenProject, ImageGeneration } from '../domain/project';
import type { BuildingStyle, FocalPoint, GardenParameters } from '../gardenGenerator';

interface GardenWorkspaceProps {
  project: GardenProject;
  onProjectChange: (project: GardenProject) => void;
  onGenerationAdded: (generation: ImageGeneration) => void;
}
```

Use this update helper inside the component:

```ts
const updateParameter = <K extends keyof GardenParameters>(key: K, value: GardenParameters[K]) => {
  onProjectChange({
    ...project,
    updatedAt: new Date().toISOString(),
    parameters: { ...project.parameters, [key]: value },
  });
};
```

When AI generation succeeds, append:

```ts
onGenerationAdded({
  id: `generation-${Date.now()}`,
  projectId: project.id,
  createdAt: new Date().toISOString(),
  mode,
  status: 'succeeded',
  prompt,
  provider: 'vectorengine',
  model: request.mode === 'edit' ? 'gpt-image-2-all' : 'gpt-image-2',
  imageUrl: result.imageUrl,
});
```

When AI generation fails, append:

```ts
const generationError = normalizeUnknownGenerationError(error);
onGenerationAdded({
  id: `generation-${Date.now()}`,
  projectId: project.id,
  createdAt: new Date().toISOString(),
  mode,
  status: 'failed',
  prompt,
  provider: 'vectorengine',
  model: request.mode === 'edit' ? 'gpt-image-2-all' : 'gpt-image-2',
  error: generationError,
});
```

- [ ] **Step 5: Add client error normalization helper**

Modify `src/aiImageClient.ts` to export:

```ts
import type { GenerationError } from './domain/project';

export function normalizeUnknownGenerationError(error: unknown): GenerationError {
  if (error && typeof error === 'object' && 'code' in error && 'message' in error && 'retryable' in error) {
    const candidate = error as GenerationError;
    return candidate;
  }

  return {
    code: 'unknown_error',
    message: error instanceof Error ? error.message : 'AI 图像生成失败',
    retryable: true,
  };
}
```

- [ ] **Step 6: Replace `App` with repository-backed composition**

Modify `src/App.tsx` to:

```tsx
import { useEffect, useMemo, useState } from 'react';
import { GardenWorkspace } from './components/GardenWorkspace';
import { ProjectHistory } from './components/ProjectHistory';
import { createDefaultProject, type GardenProject, type ImageGeneration } from './domain/project';
import { createLocalProjectRepository } from './storage/localProjectRepository';
import './styles.css';

const repository = createLocalProjectRepository();

export default function App() {
  const [projects, setProjects] = useState<GardenProject[]>([]);
  const [activeProject, setActiveProject] = useState<GardenProject>(() => createDefaultProject());

  useEffect(() => {
    void repository.list().then((savedProjects) => {
      if (savedProjects.length > 0) {
        setProjects(savedProjects);
        setActiveProject(savedProjects[0]);
        return;
      }

      const project = createDefaultProject();
      setProjects([project]);
      setActiveProject(project);
      void repository.save(project);
    });
  }, []);

  const activeProjectId = activeProject.id;

  const saveProject = async (project: GardenProject) => {
    setActiveProject(project);
    setProjects((current) => [project, ...current.filter((item) => item.id !== project.id)].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt)));
    await repository.save(project);
  };

  const handleCreateProject = () => {
    const project = createDefaultProject();
    void saveProject(project);
  };

  const handleOpenProject = async (projectId: string) => {
    const project = await repository.load(projectId);
    if (project) {
      setActiveProject(project);
    }
  };

  const handleDeleteProject = async (projectId: string) => {
    await repository.delete(projectId);
    const remaining = await repository.list();
    if (remaining.length === 0) {
      const project = createDefaultProject();
      await repository.save(project);
      setProjects([project]);
      setActiveProject(project);
      return;
    }

    setProjects(remaining);
    if (activeProjectId === projectId) {
      setActiveProject(remaining[0]);
    }
  };

  const handleGenerationAdded = (generation: ImageGeneration) => {
    void saveProject({
      ...activeProject,
      updatedAt: generation.createdAt,
      generations: [generation, ...activeProject.generations],
    });
  };

  const sortedProjects = useMemo(() => projects.sort((left, right) => right.updatedAt.localeCompare(left.updatedAt)), [projects]);

  return (
    <main className="app-shell">
      <ProjectHistory
        projects={sortedProjects}
        activeProjectId={activeProject.id}
        onCreateProject={handleCreateProject}
        onOpenProject={handleOpenProject}
        onDeleteProject={handleDeleteProject}
      />
      <GardenWorkspace project={activeProject} onProjectChange={(project) => void saveProject(project)} onGenerationAdded={handleGenerationAdded} />
    </main>
  );
}
```

- [ ] **Step 7: Run build and fix component extraction compile errors**

Run:

```bash
npm run build
```

Expected: PASS after all imports, props, and moved JSX are consistent.

- [ ] **Step 8: Commit project history and workspace**

```bash
git add src/App.tsx src/components/ErrorNotice.tsx src/components/ProjectHistory.tsx src/components/GardenWorkspace.tsx src/exporters.ts src/styles.css src/aiImageClient.ts
git commit -m "feat: add project history workspace"
```

---

## Task 4: Visible SVG Fallback

**Files:**
- Modify: `src/components/GardenWorkspace.tsx`
- Modify: `src/styles.css`

- [ ] **Step 1: Update workspace preview layout**

In `src/components/GardenWorkspace.tsx`, ensure `GardenPreview` is rendered in a visible baseline panel, not in an `aria-hidden` export-only container:

```tsx
<div className="preview-canvas">
  <section className="svg-baseline-panel" aria-label="规则方案基线预览">
    <GardenPreview plan={plan} svgRef={svgRef} />
  </section>
  <section className="ai-image-panel" aria-label="AI 图像结果">
    {aiImageUrl ? (
      <img src={aiImageUrl} alt={`${plan.name} AI 生成图`} />
    ) : (
      <div className="ai-placeholder">
        <WandSparkles size={34} aria-hidden="true" />
        <span>AI 图像未生成时，左侧规则方案仍可导出</span>
      </div>
    )}
    <div className="ai-panel-footer">
      <p>{aiStatus}</p>
    </div>
  </section>
</div>
```

- [ ] **Step 2: Replace hidden SVG CSS**

Modify `src/styles.css`:

```css
.preview-canvas {
  min-height: 0;
  display: grid;
  grid-template-columns: minmax(320px, 0.9fr) minmax(0, 1.1fr);
  gap: 14px;
  padding: 16px;
  background: #f2eee4;
  border: 1px solid #d3c8b5;
  border-radius: 8px;
}

.svg-baseline-panel,
.ai-image-panel {
  min-width: 0;
  display: grid;
  gap: 10px;
  align-content: center;
}

.garden-svg {
  display: block;
  width: 100%;
  aspect-ratio: 1080 / 760;
  border-radius: 4px;
  box-shadow: 0 18px 50px rgba(38, 38, 32, 0.18);
  background: #f7f4ec;
}

@media (max-width: 1100px) {
  .preview-canvas {
    grid-template-columns: 1fr;
  }
}
```

Remove:

```css
.svg-export-source {
  display: none;
}
```

- [ ] **Step 3: Run build**

Run:

```bash
npm run build
```

Expected: PASS.

- [ ] **Step 4: Commit visible fallback**

```bash
git add src/components/GardenWorkspace.tsx src/styles.css
git commit -m "feat: show svg fallback preview"
```

---

## Task 5: Proxy Safety And Structured Errors

**Files:**
- Modify: `server/vectorEngineImageHandler.mjs`
- Modify: `server/vectorEngineImageHandler.d.mts`
- Modify: `server/vectorEngineImageHandler.test.mjs`
- Modify: `src/aiImageClient.ts`

- [ ] **Step 1: Expand proxy tests**

Add tests to `server/vectorEngineImageHandler.test.mjs`:

```js
import { describe, expect, it } from 'vitest';
import {
  isSafeImageUrl,
  normalizeProxyError,
  readJsonBodyWithLimit,
  resolveMaxBodyBytes,
  resolveVectorTimeoutMs,
} from './vectorEngineImageHandler.mjs';

describe('VectorEngine image handler', () => {
  it('uses a long default timeout for slow image generation jobs', () => {
    expect(resolveVectorTimeoutMs(undefined)).toBe(300000);
  });

  it('uses a 5MB default request body limit', () => {
    expect(resolveMaxBodyBytes(undefined)).toBe(5242880);
  });

  it('rejects private and local image URLs', () => {
    expect(isSafeImageUrl('http://localhost:3000/a.png')).toBe(false);
    expect(isSafeImageUrl('http://127.0.0.1/a.png')).toBe(false);
    expect(isSafeImageUrl('http://10.0.0.1/a.png')).toBe(false);
    expect(isSafeImageUrl('https://example.com/a.png')).toBe(true);
    expect(isSafeImageUrl('data:image/png;base64,abc')).toBe(true);
  });

  it('maps timeout errors to structured retryable proxy errors', () => {
    expect(normalizeProxyError(new Error('VectorEngine request timed out after 300s'))).toEqual({
      code: 'provider_timeout',
      message: 'Image generation timed out. You can retry, or export the rule-generated concept plan.',
      retryable: true,
    });
  });

  it('rejects request bodies above the configured limit', async () => {
    const request = ReadableStream.from([Buffer.from('{"prompt":"'), Buffer.alloc(20, 'a'), Buffer.from('"}')]);

    await expect(readJsonBodyWithLimit(request, 10)).rejects.toMatchObject({
      code: 'request_too_large',
    });
  });
});
```

- [ ] **Step 2: Run proxy tests and verify they fail**

Run:

```bash
npm test -- server/vectorEngineImageHandler.test.mjs
```

Expected: FAIL because the new exports do not exist.

- [ ] **Step 3: Add body limit and structured proxy error helpers**

Modify `server/vectorEngineImageHandler.mjs`:

```js
const maxBodyBytes = resolveMaxBodyBytes(process.env.IMAGE_PROXY_MAX_BODY_BYTES);
const proxyAccessToken = process.env.IMAGE_PROXY_ACCESS_TOKEN;

export function resolveMaxBodyBytes(value) {
  return parsePositiveInteger(value, 5242880);
}

export function normalizeProxyError(error) {
  const message = error instanceof Error ? error.message : String(error);

  if (error && typeof error === 'object' && 'code' in error) {
    return error;
  }

  if (message.includes('timed out')) {
    return {
      code: 'provider_timeout',
      message: 'Image generation timed out. You can retry, or export the rule-generated concept plan.',
      retryable: true,
    };
  }

  return {
    code: 'unknown_error',
    message: 'Image generation failed. The rule-generated concept plan is still available.',
    retryable: true,
  };
}

export function isSafeImageUrl(value) {
  if (typeof value !== 'string') {
    return false;
  }

  if (value.startsWith('data:image/png;base64,') || value.startsWith('data:image/jpeg;base64,') || value.startsWith('data:image/webp;base64,')) {
    return true;
  }

  try {
    const url = new URL(value);
    if (url.protocol !== 'https:') {
      return false;
    }

    const hostname = url.hostname.toLowerCase();
    return !(
      hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      hostname === '0.0.0.0' ||
      hostname.startsWith('10.') ||
      hostname.startsWith('192.168.') ||
      /^172\.(1[6-9]|2\d|3[0-1])\./.test(hostname)
    );
  } catch {
    return false;
  }
}

export async function readJsonBodyWithLimit(request, limitBytes = maxBodyBytes) {
  const chunks = [];
  let totalBytes = 0;

  for await (const chunk of request) {
    const buffer = Buffer.from(chunk);
    totalBytes += buffer.length;
    if (totalBytes > limitBytes) {
      throw {
        code: 'request_too_large',
        message: 'The reference image is too large. Use an image under the configured limit.',
        retryable: false,
      };
    }
    chunks.push(buffer);
  }

  const body = Buffer.concat(chunks).toString('utf8');
  return body ? JSON.parse(body) : {};
}
```

- [ ] **Step 4: Wire helpers into request handling**

In `handleImageRequest`, add token validation before reading the body:

```js
if (proxyAccessToken && request.headers.authorization !== `Bearer ${proxyAccessToken}`) {
  sendProxyError(response, 401, {
    code: 'invalid_request',
    message: 'Image proxy authorization failed.',
    retryable: false,
  });
  return;
}
```

Replace:

```js
const body = await readJsonBody(request);
```

With:

```js
const body = await readJsonBodyWithLimit(request);
```

Before `requestImageEdit(body, prompt)`, reject unsafe image URLs:

```js
if (mode === 'edit' && body.imageUrl && !isSafeImageUrl(body.imageUrl)) {
  sendProxyError(response, 400, {
    code: 'invalid_request',
    message: 'Reference image URL is not allowed.',
    retryable: false,
  });
  return;
}
```

Replace the catch block with:

```js
const proxyError = normalizeProxyError(error);
sendProxyError(response, proxyError.code === 'request_too_large' ? 413 : 500, proxyError);
```

Add:

```js
function sendProxyError(response, status, error) {
  sendJson(response, status, { error });
}
```

Remove the old private `readJsonBody` function after all callers use `readJsonBodyWithLimit`.

- [ ] **Step 5: Update declaration file**

Modify `server/vectorEngineImageHandler.d.mts`:

```ts
import type { IncomingMessage, ServerResponse } from 'node:http';

export function handleImageRequest(request: IncomingMessage, response: ServerResponse): Promise<void>;
export function resolveVectorTimeoutMs(value: string | undefined): number;
export function resolveMaxBodyBytes(value: string | undefined): number;
export function isSafeImageUrl(value: unknown): boolean;
export function normalizeProxyError(error: unknown): { code: string; message: string; retryable: boolean };
export function readJsonBodyWithLimit(request: AsyncIterable<Buffer | Uint8Array | string>, limitBytes?: number): Promise<unknown>;
```

- [ ] **Step 6: Update frontend structured error extraction**

Modify `extractErrorMessage` or add `extractGenerationError` in `src/aiImageClient.ts` so `{ error: { code, message, retryable } }` is preserved by `normalizeUnknownGenerationError`.

Use:

```ts
export function extractGenerationError(payload: unknown): GenerationError | null {
  if (!payload || typeof payload !== 'object' || !('error' in payload)) {
    return null;
  }

  const error = payload.error;
  if (!error || typeof error !== 'object') {
    return null;
  }

  if ('code' in error && 'message' in error && 'retryable' in error && typeof error.code === 'string' && typeof error.message === 'string' && typeof error.retryable === 'boolean') {
    return error as GenerationError;
  }

  return null;
}
```

Then in `requestAiImage`, before throwing a generic `Error`, throw the structured object when available:

```ts
if (!response.ok) {
  throw extractGenerationError(payload) ?? new Error(extractErrorMessage(payload) ?? `图像生成失败：HTTP ${response.status}`);
}
```

- [ ] **Step 7: Run proxy and client tests**

Run:

```bash
npm test -- server/vectorEngineImageHandler.test.mjs src/aiImageClient.test.ts
```

Expected: PASS.

- [ ] **Step 8: Commit proxy safety**

```bash
git add server/vectorEngineImageHandler.mjs server/vectorEngineImageHandler.d.mts server/vectorEngineImageHandler.test.mjs src/aiImageClient.ts src/aiImageClient.test.ts
git commit -m "fix: harden image proxy requests"
```

---

## Task 6: Quality Gates And Server Verification

**Files:**
- Modify: `package.json`
- Modify: `tsconfig.json`
- Create: `server/vectorEngineImageHandler.types.test-d.ts`
- Modify: `docs/workflow/development-workflow.md`

- [ ] **Step 1: Add scripts**

Modify `package.json` scripts:

```json
{
  "scripts": {
    "dev": "vite --host 0.0.0.0",
    "serve": "npm run build && node server/vectorEngineProxy.mjs",
    "build": "tsc && vite build",
    "preview": "vite preview --host 0.0.0.0",
    "test": "vitest run",
    "typecheck": "tsc --noEmit"
  }
}
```

- [ ] **Step 2: Include declaration checks in TypeScript**

Modify `tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["DOM", "DOM.Iterable", "ES2020"],
    "allowJs": false,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "allowSyntheticDefaultImports": true,
    "strict": true,
    "forceConsistentCasingInFileNames": true,
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx"
  },
  "include": ["src", "server/**/*.d.mts"],
  "references": []
}
```

- [ ] **Step 3: Add server declaration type smoke test**

Create `server/vectorEngineImageHandler.types.test-d.ts`:

```ts
import type { IncomingMessage, ServerResponse } from 'node:http';
import {
  handleImageRequest,
  isSafeImageUrl,
  normalizeProxyError,
  readJsonBodyWithLimit,
  resolveMaxBodyBytes,
  resolveVectorTimeoutMs,
} from './vectorEngineImageHandler.mjs';

declare const request: IncomingMessage;
declare const response: ServerResponse;

const timeout: number = resolveVectorTimeoutMs(undefined);
const bodyLimit: number = resolveMaxBodyBytes(undefined);
const safe: boolean = isSafeImageUrl('https://example.com/a.png');
const error: { code: string; message: string; retryable: boolean } = normalizeProxyError(new Error('failed'));

void timeout;
void bodyLimit;
void safe;
void error;
void handleImageRequest(request, response);
void readJsonBodyWithLimit(request, 1024);
```

- [ ] **Step 4: Update workflow docs with final gates**

Append to `docs/workflow/development-workflow.md`:

```markdown
## Required Verification Before Completion

Run these commands before claiming implementation work is complete:

```bash
npm test
npm run typecheck
npm run build
```

Do not commit generated `dist/`, local `.env*`, screenshots, or provider responses.
```

- [ ] **Step 5: Run final verification**

Run:

```bash
npm test
npm run typecheck
npm run build
```

Expected: all commands exit 0.

- [ ] **Step 6: Commit quality gates**

```bash
git add package.json package-lock.json tsconfig.json server/vectorEngineImageHandler.types.test-d.ts docs/workflow/development-workflow.md
git commit -m "chore: add quality gates"
```

---

## Self-Review Checklist

- Spec coverage:
  - Documentation baseline: Task 1.
  - Project persistence/history: Tasks 2 and 3.
  - Visible SVG fallback: Task 4.
  - Proxy auth/request limit/URL safety/errors: Task 5.
  - Server verification and workflow gates: Task 6.
- Placeholder scan:
  - Run `rg -n "TB[D]|TO[D]O|FIXM[E]|fill i[n]|待[定]|占[位]" docs/superpowers/plans/2026-05-02-project-stabilization.md`.
  - Expected: no matches.
- Type consistency:
  - `GardenProject`, `ImageGeneration`, and `GenerationError` are defined once in `src/domain/project.ts`.
  - `ProjectRepository` is the only persistence interface consumed by UI.
  - Proxy structured errors map into frontend `GenerationError`.

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-05-02-project-stabilization.md`.

Two execution options:

1. Subagent-Driven (recommended): dispatch a fresh subagent per task, review between tasks, faster iteration.
2. Inline Execution: execute tasks in this session using executing-plans, batch execution with checkpoints.
