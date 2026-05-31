# System Architecture: Nightfall (Werewolf Game)

This document specifies the concrete folder structure, layer dependencies, real-time synchronization flows, and boundary validation rules of the Nightfall project.

---

## 📂 Repository Structure

The project separates the client UI layer from the state-authoritative backend server.

```text
E:\Game/
├── src/                      # React Frontend Client
│   ├── main.jsx              # Mount point and global bindings
│   ├── App.jsx               # Router & state manager
│   ├── index.css             # Design tokens & core styles
│   ├── context/
│   │   └── AuthContext.jsx   # Client authentication state (JWT caching)
│   ├── components/
│   │   ├── ProtectedRoute.jsx# Restricts access to authenticated clients
│   │   └── VillagerSprite.jsx# 2D preview avatar generator (layered SVGs)
│   ├── game/
│   │   └── Village3D.jsx     # Three.js 3D Isometric grid & player animations
│   └── pages/
│       ├── Login.jsx         # Access terminal
│       ├── Register.jsx      # Sign-up & Character Customizer creator
│       └── Game.jsx          # Live board lobby, chat, and admin HUD
│
├── server/                   # Authoritative Node.js Backend
│   ├── index.js              # HTTP/Socket.IO Server, real-time loop coordinator
│   ├── db.js                 # SQLite database adapter & player persistence
│   ├── nightfall.db          # SQLite persistent database file (WAL mode)
│   └── routes/
│       └── auth.js           # REST authentication API (Signup / Login)
```

---

## 🔄 Real-Time State Synchronization Flow

The game runs on a **Server-Authoritative** model. The frontend acts as a pure renderer, sending user input commands and rendering the broadcasted server state.

### Player Movement Flow
```text
[Client Key Press WASD]
  │
  ├─► [Local Boundary Clipping] (0-1200, 0-800)
  │
  ├─► [Emit player:move {x, y}]
  │
  ▼
[Socket.IO Server]
  │
  ├─► [Verify Authentication Token]
  ├─► [Update Authoritative gameState]
  ├─► [Clip Bounds Authoritatively]
  │
  ▼
[Broadcast player:moved {id, x, y} to room]
  │
  ▼
[Other Clients]
  │
  └─► [Animate Mesh from current position to target {x, y} smoothly]
```

---

## 🛡️ Parse-First Boundary Rule

To prevent cheating and client-side injections, all data crossing the API/Socket boundaries must be parsed and sanitized.

### 1. HTTP Boundaries (`/api/auth`)
* All request bodies in `/api/auth/register` must be validated:
  * `username`: Non-empty, sanitized string, alphanumeric only, length `[3, 20]`.
  * `email`: Optional, validated format.
  * `password`: Enforce strength limits.
  * `gender`, `hairStyle`, `hairColor`: Checked against defined lists of options (`HAIR_STYLES`, `HAIR_COLORS`) to ensure only correct assets are created in the database.

### 2. Socket Boundaries (`io.use`)
* **Connection Handshake:** Each socket connection must present a valid JWT payload. Connections failing JWT signature checks are instantly closed.
* **Coordinate Boundaries:** Coordinates received in `player:move` must be verified on the server:
  ```javascript
  p.x = Math.max(0, Math.min(1200, data.x));
  p.y = Math.max(0, Math.min(800, data.y));
  ```
* **Text Limits:** Incoming chat strings must be trimmed, sanitized of code/tags, and sliced at a strict max length of `200` characters.

---

## 🧬 Component Layer Dependency Rule

To prevent monolithic clutter and circular dependencies, code must respect strict boundaries:

1. **`Three.js` Village Canvas (`Village3D.jsx`)** must never directly manipulate the HTTP auth state or Socket.IO events. It should receive player coordinates and states exclusively through React props or light callbacks, keeping the 3D visual renderer decoupled.
2. **`db.js`** is a self-contained database provider. It must never reference `index.js`, routing structures, or any active WebSockets.
3. **`AuthContext.jsx`** serves as a security cache. It provides the current user context down the tree and should not manage or listen to the real-time gameplay Socket states.
