# 第二版原型图 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the second-version workspace prototype that matches the provided reference layout while preserving existing project, generation, and export behavior.

**Architecture:** Keep `GardenWorkspace` as the main orchestration component and `ProjectHistory` as the project sidebar. Update render structure and CSS to create a top app bar, process bar, left history rail, control column, central plan canvas, and right explanation panel without changing the domain model or backend API.

**Tech Stack:** React 19, TypeScript, Vite, Vitest server-side rendering tests, lucide-react icons, existing CSS.

---

## File Structure

- Modify `src/App.tsx`: wrap the current shell with the v2 app frame and move project history beside the workspace inside the new layout.
- Modify `src/components/ProjectHistory.tsx`: render the narrower second-version project history with thumbnail cards while keeping callbacks unchanged.
- Modify `src/components/GardenWorkspace.tsx`: reorganize controls, preview, explanation, and exports into the second-version workspace.
- Modify `src/components/GardenWorkspace.test.tsx`: add failing tests for the v2 structure and preserve behavior assertions.
- Modify `src/components/ProjectHistory.test.tsx`: add failing tests for the v2 project card structure.
- Modify `src/styles.css`: replace the old three-column MVP layout with the second-version visual layout and responsive fallbacks.

## Task 1: V2 Workspace Structure Tests

**Files:**
- Modify: `src/components/GardenWorkspace.test.tsx`

- [ ] **Step 1: Write the failing test**

Add this test near the top of the `GardenWorkspace` describe block:

```tsx
it('renders the second-version workspace regions from the prototype', () => {
  const project = createDefaultProject({ now: '2026-05-04T10:00:00.000Z', seed: 31, name: '第二版方案' });
  const markup = renderToStaticMarkup(<GardenWorkspace project={project} onProjectChange={vi.fn()} onGenerationAdded={vi.fn()} />);

  expect(markup).toContain('场地解析');
  expect(markup).toContain('需求确认');
  expect(markup).toContain('园林规则');
  expect(markup).toContain('方案生成');
  expect(markup).toContain('方案预览');
  expect(markup).toContain('综合平面图');
  expect(markup).toContain('SVG平面');
  expect(markup).toContain('方案解释');
  expect(markup).toContain('输出内容');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/components/GardenWorkspace.test.tsx`

Expected: FAIL because `园林规则`, `SVG平面`, `方案解释`, or `输出内容` are not present in the old UI.

- [ ] **Step 3: Keep failure output for implementation**

Read the failure and confirm it is missing expected second-version markup rather than a test syntax error.

## Task 2: V2 Project History Test

**Files:**
- Modify: `src/components/ProjectHistory.test.tsx`

- [ ] **Step 1: Write the failing test**

Add this test:

```tsx
it('renders second-version project history cards with a create action', () => {
  const projects = [
    createDefaultProject({ now: '2026-05-04T10:30:00.000Z', seed: 41, name: '苏式庭院方案' }),
    createDefaultProject({ now: '2026-05-02T16:45:00.000Z', seed: 42, name: '雅集水院方案' }),
  ];

  const markup = renderToStaticMarkup(
    <ProjectHistory projects={projects} activeProjectId={projects[0].id} onCreateProject={vi.fn()} onOpenProject={vi.fn()} onDeleteProject={vi.fn()} />,
  );

  expect(markup).toContain('新建项目');
  expect(markup).toContain('查看全部项目');
  expect(markup.match(/class="project-thumbnail/g)).toHaveLength(2);
  expect(markup).toContain('苏式庭院方案');
  expect(markup).toContain('雅集水院方案');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test -- src/components/ProjectHistory.test.tsx`

Expected: FAIL because the current project history uses compact icon-only create controls and no thumbnail cards.

## Task 3: Implement Workspace Markup

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/components/GardenWorkspace.tsx`

- [ ] **Step 1: Add v2 shell in `App.tsx`**

Render a top-level `main.app-shell.v2-shell`, keep `ProjectHistory` first, and keep `GardenWorkspace` second. Do not change callbacks or repository logic.

- [ ] **Step 2: Reorganize `GardenWorkspace`**

Replace the old sidebar-plus-preview fragment with:

- `section.workspace-shell`
- `header.top-app-bar`
- `nav.stepper`
- `div.workspace-grid`
- `aside.workspace-controls`
- `section.plan-stage`
- `aside.explanation-panel`

Keep all existing handlers and export calls. Add small helper components inside the same file:

- `TopAppBar`
- `ProcessStepper`
- `SiteAnalysisSummary`
- `RequirementSummary`
- `GenerationControls`
- `PlanToolbar`
- `ExplanationPanel`
- `OutputChecklist`

- [ ] **Step 3: Run focused workspace test**

Run: `npm test -- src/components/GardenWorkspace.test.tsx`

Expected: PASS for the new v2 structure and existing behavior tests.

## Task 4: Implement Project History Markup

**Files:**
- Modify: `src/components/ProjectHistory.tsx`

- [ ] **Step 1: Replace the old collapsible sidebar markup**

Render:

- `section.project-history`
- top `button.history-create-button` with visible text `新建项目`
- heading `项目历史`
- list of `article.project-list-item`
- `div.project-thumbnail` inside each project card
- bottom `button.history-all-button` with visible text `查看全部项目`

Keep delete buttons accessible and keep `onOpenProject`, `onCreateProject`, `onDeleteProject` unchanged.

- [ ] **Step 2: Run focused project history test**

Run: `npm test -- src/components/ProjectHistory.test.tsx`

Expected: PASS.

## Task 5: Implement V2 CSS

**Files:**
- Modify: `src/styles.css`

- [ ] **Step 1: Replace old layout CSS**

Create the second-version layout:

- global warm off-white background
- `.app-shell` as a vertical shell
- `.workspace-grid` as `280px minmax(640px, 1fr) 340px`
- `.project-history` as a fixed visual rail
- `.workspace-controls`, `.plan-stage`, `.explanation-panel` as sibling panels
- central `.plan-canvas` with large SVG preview

- [ ] **Step 2: Add responsive fallbacks**

At desktop widths below `1280px`, stack the right panel below the central plan. At tablet/mobile widths below `920px`, stack project history, controls, canvas, and explanations into one column.

- [ ] **Step 3: Run full UI tests**

Run: `npm test`

Expected: all test files pass.

## Task 6: Verification

**Files:**
- No code changes expected unless verification reveals a defect.

- [ ] **Step 1: Run production build**

Run: `npm run build`

Expected: TypeScript compilation and Vite build complete with exit code 0.

- [ ] **Step 2: Start or reuse dev server**

Run: `npm run dev`

Expected: Vite serves the app at `http://localhost:5188/`.

- [ ] **Step 3: Verify HTTP page response**

Run: `curl -I http://localhost:5188/`

Expected: `HTTP/1.1 200 OK`.

- [ ] **Step 4: Inspect final diff**

Run: `git diff --stat && git diff -- src/App.tsx src/components/GardenWorkspace.tsx src/components/ProjectHistory.tsx src/styles.css`

Expected: changes are scoped to v2 prototype UI and tests.
