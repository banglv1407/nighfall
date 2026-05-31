# Product Contract: Overview & Interface

This document specifies the UI/UX architecture, design systems, visual layers, and core capabilities for the Nightfall (Werewolf) game client.

---

## 🎨 Design System & Colors (Tokens)

The frontend maintains a sleek, premium, immersive dark theme mimicking deep night with glowing neon highlights depending on faction alignments.

### 1. Colors & Neon Glows
- **Primary Background:** `#0a0e1a` (Deep Space Dark)
- **Secondary Background:** `#121829` (Midnight Blue Card)
- **Card Background:** `#1a2035` (Accent Card)
- **Glassmorphism Layer:** `rgba(26, 32, 53, 0.6)` with `backdrop-filter: blur(16px)` and border `rgba(255, 255, 255, 0.08)`
- **Factions & Accents:**
  - **Phe Dân (Village):** `#3b82f6` (Vibrant Blue, glow: `0 0 20px rgba(59, 130, 246, 0.4)`)
  - **Phe Sói (Werewolves):** `#ef4444` (Vibrant Crimson, glow: `0 0 20px rgba(239, 68, 68, 0.4)`)
  - **Third-party (Angel, Jester):** `#f59e0b` (Amber, glow: `0 0 20px rgba(245, 158, 11, 0.4)`)
  - **Cupid (Lovers):** `#ec4899` (Deep Pink)
  - **Success / Heal:** `#10b981` (Emerald Green)
  - **Danger / Kill:** `#dc2626` (Red)

### 2. Typography
- **Display/Headings:** `'Space Grotesk', sans-serif`
- **Body Text:** `'Inter', sans-serif`
- **Monospace logs:** `'JetBrains Mono', monospace`

---

## 💇 Character Customization (Sprite Sheet Pipeline)

Players create and customize their unique character avatar before entering a room. Avatars are generated dynamically by stacking PNG sprites bottom-to-top:

1. **`body` (Layer 0, Required):** Basic physical silhouette and skin tone.
2. **`outfit_bottom` (Layer 1, Required):** Pants, shorts, or skirts.
3. **`outfit_top` (Layer 2, Required):** Shirts, armor, jackets.
4. **`hair_back` (Layer 3, Optional):** Back part of long hairstyles.
5. **`head` (Layer 4, Required):** Facial structures, eyes, expressions.
6. **`hair_front` (Layer 5, Required):** Front bangs and basic hair shape.
7. **`accessory_face` (Layer 6, Optional):** Eyewear, bandages, facepaint.
8. **`accessory_head` (Layer 7, Optional):** Hats, horns, masks.

---

## 🗺️ Isometric Village Map & Movement

When a player enters a room, they are placed in a 2D isometric village grid layout.

- **Grid Dimensions:** 30x30 Chessboard Tile Map.
- **Controls:** WASD keys on keyboard, or direct touch/mouse-click on a target tile.
- **Real-time Synchronization:** Player coordinates are synced instantly across clients using the WebSocket connection.
- **Special Transitions:**
  - When the game state changes to the **Discussion** or **Voting** phase, the map controls are locked.
  - An animation smoothly slides all players over `2.0` seconds to gather in a neat circle at the village center plaza for local assembly.
