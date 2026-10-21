# CanvasLab Next.js migration and performance experiment

## Current status

This is a parallel migration preview under `next-client/`. The existing Vite app, Netlify build configuration, Express API, Render collaboration service, and Neon database are deliberately untouched. Do not point production traffic at this preview yet.

The first preview validates the Next.js App Router/build/deployment shape. It is not yet a migrated editor, so it cannot establish an editor performance improvement on its own.

## Migration principles

1. Keep the working Vite deployment as the control and rollback target.
2. Port the existing app in small slices; preserve the original light neutral/green theme and all current interactions.
3. Keep the React Flow/Yjs/Hocuspocus editor client-side. Load the editor only on board routes and only after the route shell is ready.
4. Keep public content static (SSG); render request-specific protected data dynamically where it provides a real benefit; use ISR only for public content that can tolerate a bounded freshness window.
5. Never cache user-specific board data publicly. Continue enforcing permissions in the Express API.
6. Keep the current API, collaboration service, and Neon schema. Proxy `/api/*` through Next.js to preserve a same-origin browser request and session-cookie behavior.
7. Keep all services on free tiers if the required Next.js runtime and performance are compatible.

## Editor loading strategy

- Use a lightweight server-rendered route shell and metadata.
- Put the React Flow canvas and browser-dependent collaboration lifecycle in a Client Component.
- Use a loading boundary/skeleton while the editor chunk is downloaded.
- Lazy-load secondary UI (template gallery, collaboration panel, optional code-editor features) only when opened, after verifying their current import/lifecycle behavior.
- Avoid loading Yjs/Hocuspocus providers before a board route and authorization are ready.
- Do not defer code required for the first usable canvas interaction; measure interaction readiness, not only the first paint.
- Avoid broad global providers and hydration of static content that does not need client state.

## Performance experiment

Measure the same production-like build and same network/device conditions before and after each migration slice. Do not compare local development mode with a production build.

Record at least:
- cold navigation to a board URL and warm navigation
- time to first contentful paint (FCP)
- largest contentful paint (LCP), where applicable
- total blocking time (TBT) and cumulative layout shift (CLS)
- JavaScript transferred and initial route chunk sizes
- time from navigation until the canvas is usable
- time until the board is synchronized and a second collaborator is visible
- errors, reconnection behavior, and persistence after refresh

Run at least five measurements per scenario and compare medians. Record browser, device, viewport, throttling, commit SHA, and deployment URL. Treat performance as improved only if repeated measurements show a meaningful gain without regressions in collaboration or correctness.

## Acceptance gates before switching production

- All existing authentication, board CRUD, sharing/invitations, drawing, erasing, shapes, text, code, checklist, resizing, live cursors, presence, and persistence flows pass.
- Direct navigation and refresh work for every route.
- No duplicate WebSocket connections, hydration errors, blank pages, or private-data cache leaks.
- CI production build, tests, and lint pass.
- Netlify/Next.js runtime support, API rewrites, cookie forwarding, and free-tier limits are verified.
- The existing Vite deployment remains available until the Next.js editor passes these gates.
