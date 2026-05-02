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

## Required Verification Before Completion

Run these commands before claiming implementation work is complete:

```bash
npm test
npm run typecheck
npm run build
```

Do not commit generated `dist/`, local `.env*`, screenshots, or provider responses.
