# CanvasLab rendering strategy

CanvasLab uses a hybrid rendering model. Choose rendering per route and data freshness, not one strategy for the whole application.

| Area | Strategy | Reason |
| --- | --- | --- |
| Public landing page (/) | Static generation (SSG) | Public, stable content can be pre-rendered, cached at the CDN and indexed. |
| Login / registration (/login) | Static route shell + client-side auth | The shell and metadata can be pre-rendered. The existing auth flow depends on browser state and interactive forms, so it remains client-side. |
| Whiteboard editor (/editor) | Client-side rendering for the editor bundle | React Flow, browser APIs, Yjs and Hocuspocus need the browser. The route shell can still be pre-rendered by Next.js. |
| Board list and workspace state | Client-side data and interactions initially | The current dashboard is inside the existing React app and depends on the authenticated session. Do not claim SSR until it is split into a server-aware route and session forwarding is implemented. |
| Public help, feature, or template pages (future) | SSG or ISR | Use static generation for stable content; use ISR if content changes and needs scheduled/on-demand revalidation. |
| Request-specific, authorized server data (future) | SSR / dynamic rendering | Use where the server must render fresh data per request, forwarding session cookies safely and enforcing permissions on the API. |
| Live collaboration | Client-side updates over Yjs/Hocuspocus | Presence, cursors and shared document updates are interactive and real-time; SSR does not replace the collaboration transport. |

## Important implementation notes

- The Next.js App Router uses Server Components by default. Static route shells and metadata can be generated without sending their code to the browser.
- The editor wrapper deliberately uses a dynamic import with SSR disabled for the existing editor. Keep that boundary until browser-only dependencies are separated and tested.
- The existing Netlify configuration currently builds the Vite client directory. Adding Next.js routes does not switch production traffic to Next.js; deployment must be changed separately and validated before attributing production performance improvements to this migration.
- Avoid caching authenticated or user-specific responses in a shared CDN cache. Do not put secrets or privileged database access in Client Components.
- After the Next.js app is deployed, verify route output from the build, test login/reset/invite flows, test multi-user collaboration and refresh/reconnect, then compare mobile Lighthouse/PageSpeed results against the Vite baseline.
