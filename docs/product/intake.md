# Spec Intake: Nightfall (Werewolf Game)

Date: 2026-05-31

## Source

- **User spec file:** `todo-werewolf.md` (located in project root)
- **Active Codebase:** React (frontend) + Node/Express (backend)

## Project Summary

**Nightfall** is an immersive, multi-player social deduction game based on the Classic Werewolf (Ma Sói) board game. It features:
1. A realtime interactive frontend utilizing **Vite + React** and a stylized **Three.js** isometric village map.
2. A custom-layer character customization pipeline.
3. A robust Node.js backend using **Express, SQLite (`better-sqlite3`), and Socket.IO** for state-machine synchronization and player communication.
4. Active, real-time game flows, vote controls, narration engines, and a comprehensive Admin (Host) control dashboard.

---

## Technical Stack & Surfaces

- **Frontend Surface:** Single Page Application (browser)
  - Runtime/Framework: React, Vite
  - Styling: Tailwind CSS, custom design tokens, neon glow effects
  - Animation: Framer Motion
  - Visual Layer: Three.js (Isometric Grid 30x30 village map)
- **Backend Surface:** Headless API & WebSocket Server
  - Runtime: Node.js (v25.9.0)
  - Web Server: Express (CORS enabled)
  - Real-time Comms: Socket.IO
  - Database: SQLite (via `better-sqlite3` v12.4.5)
  - Security/Authentication: JSON Web Tokens (JWT) + bcryptjs

---

## Core Domains

### 1. Game Flow State Machine
The game cycles through:
`LOBBY` -> `ROLE_REVEAL` -> `NIGHT_PHASES` (Cupid, Seer, Guard, Werewolf, Witch) -> `DAY_PHASES` (Narration, Death, Discussion, Vote, Defense, Revote, Execution) -> `WIN_CHECK` -> `GAME_OVER`.

### 2. Role Engine (10 Roles)
- **Werewolf (Sói):** Eliminates 1 player per night.
- **Seer (Tiên Tri):** Investigates 1 player's alignment per night.
- **Witch (Phù Thủy):** 1 life potion + 1 death potion (once per game).
- **Hunter (Thợ Săn):** Shoots 1 player upon death.
- **Guard (Bảo Vệ):** Protects 1 player per night (no repeat targets consecutively).
- **Cupid:** Links 2 players in love on Night 1.
- **Angel (Thiên Sứ):** Wins if killed/voted out on round 1.
- **Elder (Già Làng):** 2 lives; if voted out by villagers, special roles lose powers.
- **Jester (Thằng Ngốc):** Wins if voted out by village.
- **Villager (Dân Thường):** Standard townsperson with deductive vote.

### 3. WebSocket Event Map
- **Client → Server:** `room:create`, `room:join`, `room:ready`, `room:leave`, `game:action`, `vote:cast`, `vote:revote`, `chat:send`, `player:move`, `admin:start`, `admin:next`, `admin:kick`
- **Server → Client:** `room:state`, `room:playerJoined`, `room:playerLeft`, `game:started`, `role:reveal`, `phase:update`, `action:request`, `action:result`, `narration:display`, `vote:update`, `vote:result`, `chat:message`, `player:moved`, `death:announce`, `game:over`, `error`

### 4. Character Customization (Sprite Sheet Pipeline)
Stackable render layers (bottom-to-top):
1. `body` (skin color)
2. `outfit_bottom` (pants/skirt)
3. `outfit_top` (shirt)
4. `hair_back` (long hair layer)
5. `head` (face features)
6. `hair_front` (main hairstyle)
7. `accessory_face` (glasses/mask)
8. `accessory_head` (hat)

---

## Candidate Product Docs

List of contract documents created under `docs/product/`:

| File | Purpose |
| --- | --- |
| `docs/product/overview.md` | Core product capabilities, design tokens, and user stories. |
| `docs/product/gameplay.md` | Complete Game State Machine, role breakdown, and distribution rules. |
| `docs/product/network.md` | WebSocket event definitions and JSON payload schemas. |

---

## Validation Shape

| Layer | Expected Proof |
| --- | --- |
| **Unit** | Test calculations (role distributions, movement boundaries, time-interval logic). |
| **Integration** | DB operations (user signup, JWT token generation), Socket event handling. |
| **E2E** | Multi-client connection simulation, Lobby room setup, Voting cycle progression. |
