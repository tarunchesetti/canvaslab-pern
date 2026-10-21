# Next.js migration and performance experiment

## Current stage: editor preview

The Next.js App Router preview now loads the existing CanvasLab application at `/editor`. The editor is loaded with a client-only dynamic import because it depends on browser APIs, React Flow, Yjs, and the Hocuspocus WebSocket provider. This preserves the existing editor behavior while allowing the route shell to be served by Next.js.

## Architecture and safety

- Keep the current Vite client and its Netlify deployment unchanged while testing.
- Keep the Render API, collaboration service, and Neon database unchanged.
- Use same-origin `/api/*` rewrites to the existing API by default. Set `CANVASLAB_API_ORIGIN` only for a different API origin.
- Client environment overrides are `NEXT_PUBLIC_API_URL` and `NEXT_PUBLIC_COLLAB_URL`; leave them unset to use the same-origin API route and existing hosted collaboration service.
- Do not cache authenticated API responses or board content publicly.
- CodeMirror remains lazy-loaded within code nodes; the full editor is dynamically loaded only on the editor route.

## Validation and rollout

1. CI must pass for the existing Vite client, server, and Next.js build/lint.
2. Deploy Next.js as a separate preview using `next-client/` as the project root; do not change the existing Netlify site's build settings.
3. Test sign-in/sign-up, password reset URL handling, board create/open/rename/delete, drawing, erasing, shapes, resizing, text/code/checklists, invitations, role permissions, remote cursors, reconnect/reload, and two-user live synchronization.
4. Compare production builds under the same browser, device, network, and test board. Take at least five measurements per app and compare medians for FCP, LCP, CLS, total blocking time, JS transferred, editor usable time, and collaboration sync-ready time.
5. Switch production only if feature parity is confirmed and the performance results are meaningfully better. Otherwise retain Vite and use the measurements to guide targeted optimizations.

## Known limitation

This is a migration preview, not a claim that Next.js is faster. The editor currently runs as a client-side app within the Next.js shell. Server rendering is appropriate for public, non-sensitive pages; the authenticated interactive canvas must stay client-side. The separate preview deployment and end-to-end collaboration checks are required before production use.
