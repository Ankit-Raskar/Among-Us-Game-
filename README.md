# 🚀 Among Us 3D Multiplayer

A complete real-time multiplayer Among Us clone with **3D characters** (Backrooms-style close 3rd-person camera), **mouse-controlled camera**, **sound effects**, **6 unique task mini-games**, and **impostor sabotage system**. Built with Next.js 16, Socket.io, and Three.js.

## ✨ Features

### 🎮 Core Gameplay
- **Multiplayer** — Up to 12 players per room, real-time sync via Socket.io
- **3D Backrooms-style Camera** — Close 3rd-person view with tall walls, ceilings, and dim moody lighting
- **🖱️ Mouse-Controlled Camera** — Drag mouse to rotate, scroll wheel to zoom (plus arrow keys)
- **3D Characters** — Each player is a 3D capsule character with body, visor, backpack, and legs
- **3D Spaceship Map** — 12 rooms with walls, corridors, glowing task pads, decorative pipes, and an emergency button
- **Player Flashlight** — A PointLight follows your character, lighting up the area around you
- **Pulsing Task Pads** — Yellow task pads glow and pulse to attract attention
- **Grid Floor** — Subtle grid lines on the floor for depth perception
- **Starfield Background** with dynamic lighting and shadows

### 🔊 Sound Effects (Web Audio API — no files needed)
- **Footsteps** — Plays while moving
- **Task Complete** — Triumphant 3-note chord
- **Kill** — Noise burst + low sawtooth
- **Body Report** — Descending square wave alarm
- **Emergency Meeting** — Multi-tone alert
- **Vote** — Click sound
- **Eject** — Dramatic descending tones + noise
- **Win/Lose** — Victory fanfare or defeat tones
- **Sabotage Start** — Low alarm + noise
- **Sabotage Fixed** — Rising tones
- **Warning** — Beeps for errors in mini-games
- **Wire Connect** — Pleasant chime
- **Asteroid Hit** — Noise burst + tone
- **Memory Beeps** — Different pitch per button
- **Ambient Hum** — Low drone during gameplay (55Hz + 82.5Hz)
- **Join/Leave/Ready/Start** — UI feedback sounds

### 🎯 6 Unique Task Mini-Games (each task zone has a specific type)
1. **Wires** — Connect matching colored wires
2. **Swipe Card** — Drag a card across a track at the right speed
3. **Asteroids** — Click falling asteroids before they reach the bottom
4. **Numbers** — Memorize a 5-digit code, then enter it
5. **Progress Bar** — Hold to download, release on error warnings
6. **Memory** — Watch a sequence of glowing buttons, then repeat it

### 🔪 Impostor Sabotage System (just like Among Us)
Press **V** to open the sabotage menu (impostor only):
- **☢️ Reactor Meltdown** — Crew has 45s to fix 2 panels or impostors win
- **🫁 Oxygen Depleted** — Crew has 45s to fix 2 panels or impostors win
- **💡 Lights Off** — Reduces crew visibility (flashlight dims) until fixed at Electrical
- **📡 Comms Down** — Hides crew task list until fixed at Communications
- **🚪 Lock Doors** — Doors locked for 10 seconds

### 🎯 Game Mechanics
- **Roles**: 1-3 impostors (configurable by host), rest are crewmates
- **Movement**: WASD with collision detection, mobile joystick
- **Tasks**: Crewmates complete tasks to win
- **Kill**: Impostors kill crewmates (Q key, 20s cooldown)
- **Emergency Meeting**: Press F near the red button in Cafeteria
- **Body Report**: Press R near a dead body
- **Fix Sabotage**: Press T near a red fix panel
- **Voting**: Discussion (20s) → Voting (25s) → Ejection with skip option
- **Win Conditions**:
  - Crewmates: Complete all tasks OR eject all impostors
  - Impostors: Crewmate count ≤ impostor count OR all crewmates dead OR reactor/O2 sabotage expires

## 📦 Tech Stack
- **Frontend**: Next.js 16 (App Router), TypeScript, Tailwind CSS, Three.js
- **Backend**: Socket.io mini-service (Node/Bun)
- **Audio**: Web Audio API (no external sound files needed)
- **Gateway**: Caddy reverse proxy

## 🚀 Getting Started

### Prerequisites
- Node.js 18+ or [Bun](https://bun.sh/)

### Installation

```bash
# Install frontend dependencies
bun install

# Install backend dependencies
cd mini-services/amongus-service
bun install
cd ../..
```

### Running the Game

**Terminal 1 — Start the Socket.io backend:**
```bash
cd mini-services/amongus-service
bun run dev
# Server runs on http://localhost:3003
```

**Terminal 2 — Start the Next.js frontend:**
```bash
bun run dev
# App runs on http://localhost:3000
```

Open http://localhost:3000 in your browser and play!

## 🎮 How to Play

1. **One player creates a game** — Click CREATE, pick a nickname + color, get a 5-letter room code
2. **Share the code with friends** — They click JOIN, enter the code, pick name/color
3. **Ready up** — Non-host players click GET READY
4. **Host starts the game** — Click START GAME (min 3 players)
5. **Crewmates**: Walk to yellow task zones (press E), solve the mini-game
6. **Impostors**: Press Q near a crewmate to kill (20s cooldown), Press V for sabotage menu
7. **Report bodies** (R) or **call emergency meetings** (F near button)
8. **Fix sabotages** (T) when near red fix panels
9. **Vote** out the impostor or complete all tasks to win!

### Controls
- **WASD** — Move
- **🖱️ Mouse Drag** — Rotate camera (left/right = yaw, up/down = pitch)
- **🖱️ Scroll Wheel** — Zoom in/out (adjusts camera pitch/height)
- **Arrow Keys** — Alternative camera control (Left/Right = yaw, Up/Down = pitch)
- **E** — Use task (when near a yellow task zone)
- **Q** — Kill (impostor only, when near a crewmate)
- **R** — Report body (when near a dead body)
- **F** — Emergency meeting (when near the red button in Cafeteria)
- **T** — Fix sabotage (when near a red fix panel)
- **V** — Open sabotage menu (impostor only)
- **Tab** — Toggle full-screen map
- **M** — Toggle chat (mobile)

## 📁 Project Structure

```
├── src/
│   ├── app/
│   │   ├── layout.tsx           # Root layout with toaster
│   │   └── page.tsx             # Main router (Home/Lobby/Game/Meeting/GameOver)
│   ├── components/
│   │   └── amongus/
│   │       ├── HomeScreen.tsx       # Create/Join with room code
│   │       ├── LobbyScreen.tsx      # Player list, ready system, chat
│   │       ├── GameScreen.tsx       # 3D game with movement, tasks, kill, report, sabotage
│   │       ├── GameScene3D.tsx      # Three.js 3D backrooms-style scene with mouse camera
│   │       ├── TaskMiniGame.tsx     # 6 different task mini-games
│   │       ├── MeetingScreen.tsx    # Discussion + voting UI
│   │       └── GameOverScreen.tsx   # Victory/defeat screen
│   └── lib/
│       ├── amongus-client.ts    # Socket.io client + types
│       ├── amongus-map.ts       # Map definition, collision, task zones, sabotage zones
│       └── sounds.ts            # Web Audio API sound effects (no files needed)
├── mini-services/
│   └── amongus-service/
│       ├── index.ts             # Socket.io game server with sabotage system
│       └── package.json
├── Caddyfile                    # Gateway config
└── package.json
```

## 📝 License
MIT — Free to use, modify, and distribute.
