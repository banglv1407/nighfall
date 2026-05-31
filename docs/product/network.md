# Product Contract: Network & WebSockets

This document details the complete Socket.IO API, message schemas, and authentication flow for real-time synchronization between the client and server.

---

## 🔒 Socket Authentication Flow

Clients must pass a JWT token during the initial connection handshake.

1. **Client Handshake:**
   ```javascript
   const socket = io('http://localhost:5050', {
     auth: {
       token: localStorage.getItem('token') // User JWT token
     }
   });
   ```
2. **Server Middleware Validation:**
   - Decodes token using `JWT_SECRET`.
   - Rejects connections without a token or with an invalid token.
   - Fetches the user profile (ID, username, gender, hair style, hair color) from the SQLite database.
   - Maps the connection `socket.id` to the user profile and updates the active `gameState.players`.

---

## 📤 Client-to-Server Events (`emit`)

| Event Name | Expected Payload Shape | Description |
|---|---|---|
| **`room:create`** | `{}` | Requests to create a new game room (if applicable). |
| **`room:join`** | `{ roomCode: string }` | Requests to join a specific room lobby. |
| **`room:ready`** | `{ ready: boolean }` | Toggles the player's readiness state. |
| **`room:leave`** | `{}` | Leaving the room or logging off. |
| **`player:move`** | `{ x: number, y: number }` | Sends current map coordinate. Boundary constraints: `x` in `[0, 1200]`, `y` in `[0, 800]`. |
| **`player:interact`**| `{ action: string, emoji: string }` | Triggers a quick emote reaction (e.g. `action: 'wave'`, `emoji: '👋'`). |
| **`chat:send`** | `{ text: string }` | Sends a chat message. Content is truncated at `200` characters. |
| **`vote:cast`** | `{ targetPlayerId: number }` | Votes for a player to be executed during Voting phase. |
| **`vote:revote`** | `{ action: 'kill' \| 'save' }` | Biased voting during the Revote phase. |
| **`admin:startGame`**| `{}` | Starts the game (Admin only). Sets phase to `night`. |
| **`admin:nextPhase`**| `{}` | Manually transitions the phase forward (Admin only). |
| **`admin:reset`** | `{}` | Resets the game state back to Lobby (Admin only). |
| **`admin:kick`** | `{ playerId: number }` | Kicks a player from the lobby (Admin only). |

---

## 📥 Server-to-Client Events (`on`)

| Event Name | Payload Shape | Description |
|---|---|---|
| **`game:state`** | `PublicState` (see below) | Emitted when players connect, disconnect, or join, syncing all player positions and metadata. |
| **`game:phase`** | `{ phase: string }` | Notifies clients of a state change (e.g. `night`, `day`, `vote`). |
| **`player:moved`** | `{ id: string, x: number, y: number }` | Broadcasts specific player's movements to other players in the room. |
| **`player:action`** | `{ id: string, action: string, emoji: string }` | Broadcasts a player's interactive emoji/reaction. |
| **`chat:message`** | `{ username: string, text: string }` | Delivers chat messages to all players in the room. |
| **`narration:display`**| `{ text: string, duration: number }` | Signals the client to display the narrator UI box with the given text. |
| **`narration:clear`**| `{}` | Instructs clients to remove the active narrator overlays. |
| **`death:announce`**| `{ deadPlayerIds: number[] }` | Broadcasts the list of players who died during the night. |
| **`vote:update`** | `{ voterId: number, targetId: number }` | Updates the real-time voting progress. |
| **`vote:result`** | `{ accusedId: number, count: number }` | Reports the final voting outcome. |
| **`game:over`** | `{ winnerFaction: string }` | Signals the end of the game and displays the victory banner. |
| **`error`** | `{ message: string }` | Standard error notification. |

---

## 📦 Data Schema: `PublicState`

```typescript
interface PublicPlayer {
  id: number;
  username: string;
  gender: 'male' | 'female';
  hairStyle: string;
  hairColor: string;
  x: number;
  y: number;
  isAdmin: boolean;
  online: boolean;
}

interface PublicState {
  phase: 'lobby' | 'night' | 'day' | 'vote' | 'gameover';
  players: Record<string, PublicPlayer>; // Key is socket.id
  adminSocketId: string | null;
}
```
