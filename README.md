# CanvasLab

A collaborative whiteboard and shared code canvas built as a PERN portfolio project. The design focuses on real-time collaboration, conflict-safe editing, relational access control, and a clear, keyboard-friendly workspace.

## Current milestone

The React board prototype is running locally. It supports draggable canvas objects, editable sticky notes and TypeScript blocks, local autosave, and responsive canvas controls. It does not yet have an Express API, PostgreSQL persistence, accounts, invitations, or live collaboration. The UI labels this as a solo/local preview so those capabilities are not implied before they exist.

The architecture and implementation sequence are documented in [RADIO.md](RADIO.md).

## Run the client

Requirements: Node.js 20.19+ or 22.12+.

```powershell
npm install --prefix client
npm run dev --prefix client
```

Open the local URL printed by Vite. To verify the current client build:

```powershell
npm run build --prefix client
```

Board content is currently stored in this browser's local storage. It is not shared between browsers or devices.

## Planned milestones

1. Add the TypeScript Express API and PostgreSQL schema.
2. Implement accounts, board metadata, and owner/editor/viewer permissions.
3. Add Yjs/Hocuspocus collaboration with PostgreSQL-backed document persistence.
4. Verify simultaneous editing, reconnect recovery, and access enforcement with tests.
5. Deploy the client, API, and database; document the architecture and tradeoffs.
