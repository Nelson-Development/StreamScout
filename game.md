# Game Concept Document: Project Borehole (Working Title)

## 1. Executive Summary

**Project Borehole** is a 2D, top-down/side-scrolling mining and resource-management game built using modern web technologies (Angular, Phaser 3, and Supabase). The player operates a specialized drilling vehicle, digging deep into a procedurally generated underground map to extract valuable ores. The player must balance their cargo space, fuel levels, and hull integrity, returning to the surface to sell resources and buy vehicle upgrades to dig even deeper.

---

## 2. The Core Gameplay Loop

The game relies on a highly addictive, four-step loop that drives player progression:

1. **Dig:** Drill down through varying subterranean layers using keyboard controls.
2. **Collect:** Extract various ores (Copper, Gold, Diamonds) while managing fuel consumption and preventing fall/crash damage.
3. **Return & Sell:** Fly back to the surface before running out of fuel to unload cargo and convert ores into cash.
4. **Upgrade:** Spend cash at the surface shop to upgrade the vehicle's stats, unlocking the ability to survive deeper, harsher layers.

---

## 3. Core Mechanics & Systems

### A. The Mining Grid (Phaser 3)

- **Tile-Based Destruction:** The underground world is a grid of 64x64 pixel tiles. Moving the drill vehicle against a breakable tile triggers the drilling state, destroying the tile and giving rewards based on its type.
- **Procedural Distribution:** Tiles are generated mathematically based on depth. Upper layers consist of soft dirt and cheap ores; middle layers feature tough stone and mid-tier metals; deep layers feature unbreakable bedrock and ultra-rare gems.

### B. Vehicle Vital Stats

- **Fuel (Timer Mechanism):** Moving and drilling consumes fuel. If fuel reaches 0, the vehicle breaks down, forcing an emergency recovery that penalizes the player (losing current cargo and a cash fine).
- **Cargo Space (Inventory Limit):** The vehicle can only hold a maximum number of ore units. Once full, the player can still dig, but no more ore will be collected.
- **Hull Integrity (Health):** Falling too fast or hitting hard objects damages the hull. If health hits 0, the vehicle explodes, resulting in a respawn penalty.

### C. The Surface Economy (Angular Overlay)

- **The Mineral Depot:** Automatically unloads all inventory items and sells them instantly for their current market value.
- **The Upgrade Garage:** An interactive storefront where players click to level up individual vehicle modules.

---

## 4. Economy & Progression Matrix

To give the game long-term appeal, upgrades are linearly gated by cost and performance requirements:

| Upgrade Module   | Enhances                | Gameplay Impact                                              |
| :--------------- | :---------------------- | :----------------------------------------------------------- |
| **Drill Bit**    | Digging Speed           | Allows the player to chew through harder rock layers faster. |
| **Fuel Tank**    | Maximum Fuel Capacity   | Extends the time the player can spend underground.           |
| **Cargo Bay**    | Maximum Inventory Slots | Allows the player to collect more ore per trip.              |
| **Engine**       | Vertical Flight Power   | Increases upward flight thrust for faster return trips.      |
| **Hull Plating** | Maximum Health          | Reduces damage taken from high-speed impacts.                |

---

## 5. Technical Architecture

The architecture intentionally separates heavy game-rendering logic from UI layout state to make development clean and scalable:

- **Backend / Persistence Layer (Supabase):** Saves the user's permanent profile data. Saves wallet size, upgrade tiers, and highest depth score to a PostgreSQL database.
- **UI & State Layer (Angular):** Manages the wrapper application. Handles user login, responsive HUD overlays, and the Upgrade Garage interface.
- **Game Engine Layer (Phaser 3):** An isolated system nested within an Angular standalone component. Manages physics, inputs, animations, and tilemap rendering.

---

## 6. Minimum Viable Product (MVP) Milestones

- [ ] **Milestone 1:** Basic Angular component rendering an empty Phaser canvas context.
- [ ] **Milestone 2:** Generates a 2D tile grid of dirt and a few static ore tiles.
- [ ] **Milestone 3:** Add player physics, basic movement, and the ability to delete a tile when moving into it.
- [ ] **Milestone 4:** Add a basic Angular HUD tracking fuel and money variables that decrement/increment based on Phaser events.
- [ ] **Milestone 5:** Connect a local mock save state, eventually converting it to live Supabase backend tables.
