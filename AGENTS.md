# Agent Instructions

This repository is **Nightfall**, a server-authoritative, real-time social deduction game (Werewolf / Ma Sói) featuring an isometric 3D canvas rendering and interactive lobby phases.

## 🚀 How to Run the Project

You can run both the frontend and backend servers concurrently with a single one-line command from the root folder:

```powershell
npm start
```
* **Frontend Access:** `http://localhost:5173` (Vite client)
* **Backend Access:** `http://localhost:5050` (Express + Socket.IO server)

---

### Seeded Admin Account:
* **Username:** `admin`
* **Password:** `admin123`

---

### Manual Launch (Separate Terminals):

#### 1. Authoritative Backend Server (`server/`)
* **Terminal Command:**
  ```powershell
  cd server
  npm run dev
  ```
* **Primary Stack:** Node.js, Express, Socket.IO, SQLite (`better-sqlite3` v12.4.5)

#### 2. Interactive Frontend Client (`root/`)
* **Terminal Command:**
  ```powershell
  npm run dev
  ```
* **Primary Stack:** Vite, React, Tailwind CSS, Framer Motion, Three.js

---

## 📂 Core Source Files
* 🖥️ **[src/App.jsx](file:///E:/Game/src/App.jsx):** Router configurations and core layouts.
* 🎮 **[src/pages/Game.jsx](file:///E:/Game/src/pages/Game.jsx):** Game lobby interface, Chat panels, and Admin coordination HUD.
* 🗺️ **[src/game/Village3D.jsx](file:///E:/Game/src/game/Village3D.jsx):** Isometric 3D canvas ground, client-side boundary coordinate tracking, and user mesh animations.
* 💇 **[src/components/VillagerSprite.jsx](file:///E:/Game/src/components/VillagerSprite.jsx):** Custom layered SVGs for visual profile avatars.
* 🛡️ **[server/index.js](file:///E:/Game/server/index.js):** Real-time Socket.IO communication dispatchers, authoritative movement bounding, and phase synchronizers.
* 💾 **[server/db.js](file:///E:/Game/server/db.js):** SQLite database engine, schemas, and seeding.

---

<!-- HARNESS:BEGIN -->
## Harness

This repo uses Harness. Before work, read:

- `README.md`
- `docs/HARNESS.md`
- `docs/FEATURE_INTAKE.md`
- `docs/ARCHITECTURE.md`
- `docs/CONTEXT_RULES.md`
- `docs/product/intake.md`
- `docs/product/overview.md`
- `docs/product/gameplay.md`
- `docs/product/network.md`

Use the Rust Harness CLI at `scripts/bin/harness-cli` as the main operational tool.
<!-- HARNESS:END -->
