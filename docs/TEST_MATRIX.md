# Test Matrix: Nightfall Validation Control Panel

This matrix tracks the validation expectations and test proof status for the primary capabilities of the Nightfall game.

---

## 🚦 Status Values

| Status | Meaning |
| --- | --- |
| **planned** | Requirement defined, but no test/evidence has been configured yet |
| **in_progress**| Tests are actively being written or verification is undergoing |
| **manual_qa** | Manually verified through local developer testing & network simulations |
| **proven** | Automated tests exist (Unit / Integration / E2E) and pass successfully |

---

## 📊 Verification Matrix

| Area | Feature Behavior | Unit | Integration | E2E | Status | Verification & Evidence |
| :--- | :--- | :---: | :---: | :---: | :---: | :--- |
| **Auth** | Database auto-initializes and seeds default Admin profile on startup | ❌ | ✅ | ❌ | **manual_qa** | SQLite db triggers `initSchema()` on first load; prints `✅ Admin account created`. Verified in `server/db.js`. |
| **Auth** | Sign-up handles password encrypting via bcrypt and returns valid sign tokens | ❌ | ✅ | ❌ | **manual_qa** | Verified `/api/auth/register` creates db row with hashed key, returns Signed JWT. |
| **Avatar** | Previews layer customization options dynamically bottom-to-top | ✅ | ❌ | ❌ | **manual_qa** | Tested layered SVGs rendering with customized options in `components/VillagerSprite.jsx`. |
| **Movement**| Authoritative coordinate clipping blocks players from exiting map boundaries | ✅ | ✅ | ❌ | **manual_qa** | Server clips incoming coords strictly to standard boundaries `[0, 1200]` and `[0, 800]`. |
| **Movement**| Socket.IO updates broadcast player moves to room immediately | ❌ | ✅ | ✅ | **manual_qa** | Verified multi-client browser testing showing real-time canvas mesh translations. |
| **Chat** | Spams throttled to 10s intervals; text sliced at 200 characters | ✅ | ✅ | ❌ | **manual_qa** | Backend trims chat and forces strict character slicing. Cooldown throttles client emission. |
| **Game Flow**| Game phases follow exact order; Admin panel starts and skips cycles properly | ❌ | ✅ | ✅ | **manual_qa** | Admin hud emits `admin:startGame` / `admin:nextPhase` transitions synced via WebSocket. |

---

## 🧪 Verification Rules

1. **Unit Proofs:** Verify calculation bounds (e.g. 10s cooldown comparisons, coordinate bounding clips, layered SVG configurations).
2. **Integration Proofs:** Verify SQLite interactions, password crypt integrity, token validations, and standard client-server socket event dispatches.
3. **E2E Proofs:** Conduct multi-client connection flow simulations, check responsive UI transitions, and verify Three.js mesh canvas updates.
