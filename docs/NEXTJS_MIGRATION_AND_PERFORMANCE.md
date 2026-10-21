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


## Preliminary CI bundle snapshot

These are build-output sizes from the CI run for the existing Vite app and this Next.js preview. They are useful as a reference, but **they are not a runtime performance comparison** because the Next.js editor is dynamically imported and its chunk is not included in the route's reported first-load JS.

| Build output | Raw size | Gzip size |
| --- | ---: | ---: |
| Vite main entry JS | 486.64 kB | 149.31 kB |
| Vite lazy CodeEditor chunk | 510.87 kB | 171.51 kB |
| Next.js shared first-load JS (reported) | 103 kB | Not reported by this build summary |
| Next.js `/editor` route chunk (reported) | 1.37 kB | Not reported by this build summary |

Next.js also defers the complete editor app to a client-only dynamic chunk, so the editor's actual time-to-usable and total transferred JS must be measured in a deployed browser. Do not treat the smaller initial route figure alone as proof of a faster editor. Capture at least five cold and warm loads per app on the same test machine and network, then compare medians for FCP/LCP, CLS, total blocking time, transferred JS, editor usable time, and collaboration sync-ready time.


### Latest CI JavaScript inventory

The CI build currently reports 25 Next.js client JavaScript chunks totaling **1,724.7 KiB raw / 544.3 KiB gzip**. The route summary reports `/editor` at 1.37 kB with 103 kB of shared first-load JavaScript (the route summary does not provide gzip sizes). For the existing Vite build, the reported JS chunks are approximately **1,121.6 kB raw / 357.5 kB gzip** across the main entry, lazy CodeEditor, Yjs, Hocuspocus, and collaboration-state chunks.

These are not apples-to-apples startup payloads: the CodeEditor is lazy in Vite, and Next.js also splits its framework and route chunks. The inventory does show that the Next.js build currently emits more total client JavaScript, so we must not assume an overall size improvement. The key question is whether the initial transfer and time until the canvas is usable improve enough to offset additional chunks/runtime. Use browser network traces and at least five comparable cold/warm runs before deciding.
