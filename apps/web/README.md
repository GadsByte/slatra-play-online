# apps/web

This directory is the planned destination for the existing Vite/React frontend.

## Why it is still empty

To keep this refactor small and safe, the current frontend remains at the repository root in this pass. The new workspace folders are being scaffolded first so future PRs can move the web app into `apps/web` with mostly mechanical path updates instead of mixing that move with backend and shared-package work.

## Current status

- **Current runnable frontend:** repository root
- **Planned future frontend home:** `apps/web`
- **Current multiplayer state extraction:** `src/features/multiplayer/*`

When the move happens, the root app files will be relocated here and the root package will become orchestration-only.
