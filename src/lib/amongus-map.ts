// Backrooms-style map — large, maze-like, dim, with many interconnected rooms
// Inspired by classic Backrooms: monotonous walls, tight corridors, big open halls

export type TaskType = 'wires' | 'swipe' | 'asteroids' | 'numbers' | 'progressbar' | 'memory' | 'dial' | 'timing' | 'sliding' | 'simon'
export type SabotageType = 'reactor' | 'o2' | 'lights' | 'comms' | 'doors'

export interface Rect { x: number; y: number; w: number; h: number }
export interface TaskZone { id: string; name: string; room: string; type: TaskType; x: number; y: number; w: number; h: number }
export interface SabotageZone { id: string; type: SabotageType; name: string; room: string; x: number; y: number; w: number; h: number }

// Much larger map: 2400 x 1600 (4x bigger than before)
export const MAP_WIDTH = 2400
export const MAP_HEIGHT = 1600

export const COLORS = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#06b6d4', '#3b82f6', '#8b5cf6', '#ec4899', '#f43f5e', '#84cc16', '#14b8a6', '#a855f7']

// Backrooms-style rooms — mix of large halls and small chambers
export const ROOMS: (Rect & { name: string })[] = [
  // Central hub (Cafeteria) - large
  { name: 'Cafeteria',     x: 1000, y: 700,  w: 400, h: 280 },
  // North wing
  { name: 'MedBay',        x: 1050, y: 380,  w: 300, h: 200 },
  { name: 'Engine',        x: 600,  y: 200,  w: 360, h: 240 },
  { name: 'Weapons',       x: 1450, y: 200,  w: 300, h: 220 },
  { name: 'Navigation',    x: 1900, y: 200,  w: 360, h: 240 },
  // South wing
  { name: 'Storage',       x: 1050, y: 1080, w: 300, h: 220 },
  { name: 'Reactor',       x: 600,  y: 1180, w: 360, h: 240 },
  { name: 'Electrical',    x: 1450, y: 1140, w: 300, h: 220 },
  { name: 'O2',            x: 1900, y: 1180, w: 360, h: 240 },
  // West wing
  { name: 'Security',      x: 200,  y: 700,  w: 320, h: 200 },
  { name: 'Admin',         x: 100,  y: 1000, w: 280, h: 200 },
  // East wing
  { name: 'Communications',x: 1750, y: 700,  w: 320, h: 220 },
  { name: 'Vault',         x: 2100, y: 1000, w: 250, h: 200 },
  // Extra rooms for more players
  { name: 'Laboratory',    x: 200,  y: 380,  w: 280, h: 220 },
  { name: 'Archives',      x: 2100, y: 420,  w: 250, h: 200 },
  { name: 'Workshop',      x: 100,  y: 1300, w: 280, h: 200 },
  { name: 'Greenhouse',    x: 2100, y: 1300, w: 250, h: 200 },
]

// Corridors connecting rooms — each overlaps BOTH rooms it connects, centered on room edges
export const CORRIDORS: Rect[] = [
  // Cafeteria <-> MedBay (both centered at x=1200, vertical)
  { x: 1160, y: 560, w: 80, h: 140 },   // overlaps MedBay bottom (y=580) and Cafeteria top (y=700)
  // Cafeteria <-> Storage (both centered at x=1200, vertical)
  { x: 1160, y: 960, w: 80, h: 140 },   // overlaps Cafeteria bottom (y=980) and Storage top (y=1080)
  // Cafeteria <-> Security (horizontal, y=800 is center of both)
  { x: 480, y: 765, w: 540, h: 70 },    // overlaps Security right (x=520) and Cafeteria left (x=1000)
  // Cafeteria <-> Communications (horizontal, y=800)
  { x: 1380, y: 765, w: 400, h: 70 },   // overlaps Cafeteria right (x=1400) and Comms left (x=1750)

  // MedBay <-> Engine (MedBay center-left y=480, Engine center-right y=320 — need L-shape)
  // Horizontal at y=480 from MedBay left (1050) to x=780
  { x: 780, y: 445, w: 270, h: 70 },    // overlaps MedBay left and reaches Engine x-range
  // Vertical at x=780 from y=320 to y=480 — overlaps Engine (x:600-960, y:200-440)
  { x: 745, y: 320, w: 70, h: 160 },    // overlaps Engine bottom area

  // MedBay <-> Weapons (MedBay center-right y=480, Weapons center-left y=310 — L-shape)
  { x: 1350, y: 445, w: 180, h: 70 },   // horizontal from MedBay right to Weapons x-range
  { x: 1475, y: 310, w: 70, h: 140 },   // vertical up to Weapons left center (y=310)

  // Weapons <-> Navigation (horizontal at y=310, both centers)
  { x: 1750, y: 275, w: 150, h: 70 },   // overlaps Weapons right (x=1750) and Nav left (x=1900)

  // Engine <-> Laboratory (Engine center-left y=320, Lab center-right y=490 — L-shape)
  { x: 480, y: 320, w: 120, h: 70 },    // horizontal from Engine left (x=600) to Lab x-range
  { x: 445, y: 320, w: 70, h: 170 },    // vertical down to Lab right center (y=490)

  // Laboratory <-> Security (vertical at x=340)
  { x: 300, y: 560, w: 80, h: 160 },    // overlaps Lab bottom (y=600) and Security top (y=700)

  // Security <-> Admin (Security center-bottom x=360, Admin center-top x=240 — L-shape)
  { x: 240, y: 880, w: 120, h: 70 },    // horizontal from Admin top to Security x-range
  { x: 325, y: 880, w: 70, h: 120 },    // vertical from y=880 to Security bottom (y=900) and Admin top (y=1000)

  // Admin <-> Workshop (vertical at x=240)
  { x: 200, y: 1180, w: 80, h: 140 },   // overlaps Admin bottom (y=1200) and Workshop top (y=1300)

  // Admin <-> Reactor (Admin center-right y=1100, Reactor center-left y=1300 — L-shape)
  { x: 380, y: 1065, w: 260, h: 70 },   // horizontal from Admin right (x=380) toward Reactor
  { x: 565, y: 1100, w: 70, h: 220 },   // vertical down to Reactor left center (y=1300)

  // Workshop <-> Reactor (horizontal at y=1400)
  { x: 380, y: 1365, w: 220, h: 70 },   // overlaps Workshop right (x=380) and Reactor left (x=600)

  // Reactor <-> Storage (Reactor center-right y=1300, Storage center-left y=1190 — L-shape)
  { x: 960, y: 1265, w: 120, h: 70 },   // horizontal from Reactor right (x=960) toward Storage
  { x: 1015, y: 1190, w: 70, h: 100 },  // vertical up to Storage left center (y=1190)

  // Storage <-> Electrical (horizontal at y=1190)
  { x: 1350, y: 1155, w: 100, h: 70 },  // overlaps Storage right (x=1350) and Electrical left (x=1450)

  // Electrical <-> O2 (horizontal at y=1250)
  { x: 1750, y: 1215, w: 150, h: 70 },  // overlaps Electrical right (x=1750) and O2 left (x=1900)

  // Communications <-> Vault (Comms center-right y=810, Vault center-left y=1100 — L-shape)
  { x: 2070, y: 775, w: 80, h: 70 },    // horizontal from Comms right (x=2070)
  { x: 2070, y: 775, w: 70, h: 330 },   // vertical down to Vault left center (y=1100)

  // Communications <-> Archives (Comms center-right y=810, Archives center-left y=520 — L-shape)
  { x: 2070, y: 520, w: 70, h: 290 },   // vertical up from Comms area to Archives left center (y=520)

  // Archives <-> Navigation (Archives center-top y=420, Nav center-bottom y=440 — close enough)
  { x: 2080, y: 420, w: 80, h: 80 },    // vertical connecting Archives top and Nav bottom

  // O2 <-> Greenhouse (O2 center-bottom y=1420, Greenhouse center-top y=1300 — L-shape)
  { x: 2080, y: 1300, w: 80, h: 140 },  // vertical from Greenhouse top up to O2 bottom

  // Vault <-> Greenhouse (vertical at x=2225)
  { x: 2185, y: 1180, w: 80, h: 140 },  // overlaps Vault bottom (y=1200) and Greenhouse top (y=1300)

  // Extra decorative corridors
  { x: 540, y: 200, w: 80, h: 200 },
  { x: 1750, y: 200, w: 80, h: 75 },
  { x: 600, y: 950, w: 80, h: 230 },
  { x: 1700, y: 920, w: 80, h: 220 },
]

export const WALKABLE: Rect[] = [...ROOMS, ...CORRIDORS]

// Task zones — each with a SPECIFIC type (variety across all 17 zones)
export const TASK_ZONES: TaskZone[] = [
  { id: 'task-1',  name: 'Empty Garbage',    room: 'Cafeteria',      type: 'swipe',       x: 1060, y: 760, w: 60, h: 60 },
  { id: 'task-2',  name: 'Submit Scan',      room: 'MedBay',         type: 'progressbar', x: 1100, y: 420, w: 60, h: 60 },
  { id: 'task-3',  name: 'Align Engine',     room: 'Engine',         type: 'numbers',     x: 660,  y: 240, w: 60, h: 60 },
  { id: 'task-4',  name: 'Start Reactor',    room: 'Reactor',        type: 'dial',        x: 660,  y: 1220, w: 60, h: 60 },
  { id: 'task-5',  name: 'Watch Cameras',    room: 'Security',       type: 'simon',       x: 240,  y: 740, w: 60, h: 60 },
  { id: 'task-6',  name: 'Chart Course',     room: 'Navigation',     type: 'timing',      x: 1960, y: 240, w: 60, h: 60 },
  { id: 'task-7',  name: 'Fix Wiring',       room: 'Electrical',     type: 'wires',       x: 1510, y: 1180, w: 60, h: 60 },
  { id: 'task-8',  name: 'Fuel Engines',     room: 'Storage',        type: 'progressbar', x: 1110, y: 1120, w: 60, h: 60 },
  { id: 'task-9',  name: 'Swipe Card',       room: 'Admin',          type: 'swipe',       x: 140,  y: 1040, w: 60, h: 60 },
  { id: 'task-10', name: 'Download Data',    room: 'Communications', type: 'sliding',     x: 1790, y: 740, w: 60, h: 60 },
  { id: 'task-11', name: 'Clear Asteroids',  room: 'Weapons',        type: 'asteroids',   x: 1510, y: 240, w: 60, h: 60 },
  { id: 'task-12', name: 'Clean O2 Filter',  room: 'O2',             type: 'wires',       x: 1960, y: 1220, w: 60, h: 60 },
  { id: 'task-13', name: 'Analyze Sample',   room: 'Laboratory',     type: 'memory',      x: 240,  y: 420, w: 60, h: 60 },
  { id: 'task-14', name: 'Sort Files',       room: 'Archives',       type: 'sliding',     x: 2150, y: 460, w: 60, h: 60 },
  { id: 'task-15', name: 'Repair Tool',      room: 'Workshop',       type: 'dial',        x: 140,  y: 1340, w: 60, h: 60 },
  { id: 'task-16', name: 'Water Plants',     room: 'Greenhouse',     type: 'timing',      x: 2150, y: 1340, w: 60, h: 60 },
  { id: 'task-17', name: 'Open Vault',       room: 'Vault',          type: 'simon',       x: 2150, y: 1040, w: 60, h: 60 },
]

// Sabotage zones — positioned INSIDE their respective rooms (verified against ROOMS layout)
export const SABOTAGE_ZONES: SabotageZone[] = [
  // Reactor room: x:600, y:1180, w:360, h:240
  { id: 'reactor-fix-1', type: 'reactor', name: 'Reactor Panel A', room: 'Reactor',    x: 650, y: 1220, w: 50, h: 50 },
  { id: 'reactor-fix-2', type: 'reactor', name: 'Reactor Panel B', room: 'Reactor',    x: 870, y: 1380, w: 50, h: 50 },
  // O2 room: x:1900, y:1180, w:360, h:240 ; Admin room: x:700, y:280, w:180, h:180
  { id: 'o2-fix-1',      type: 'o2',      name: 'O2 Panel A',      room: 'O2',          x: 1950, y: 1220, w: 50, h: 50 },
  { id: 'o2-fix-2',      type: 'o2',      name: 'O2 Panel B',      room: 'Admin',       x: 730, y: 310, w: 50, h: 50 },
  // Electrical room: x:1450, y:1140, w:300, h:220
  { id: 'lights-fix',    type: 'lights',  name: 'Breaker Box',     room: 'Electrical',  x: 1490, y: 1180, w: 50, h: 50 },
  // Communications room: x:1750, y:700, w:320, h:220
  { id: 'comms-fix',     type: 'comms',   name: 'Comms Relay',     room: 'Communications', x: 1790, y: 740, w: 50, h: 50 },
]

// Vent positions — impostors can travel between vents (press G near a vent)
export const VENT_ZONES: { id: string; room: string; x: number; y: number }[] = [
  { id: 'vent-1',  room: 'Cafeteria',      x: 1180, y: 880 },
  { id: 'vent-2',  room: 'Engine',         x: 700,  y: 260 },
  { id: 'vent-3',  room: 'Reactor',        x: 700,  y: 1380 },
  { id: 'vent-4',  room: 'Electrical',     x: 1550, y: 1300 },
  { id: 'vent-5',  room: 'Navigation',     x: 2000, y: 260 },
  { id: 'vent-6',  room: 'Security',       x: 280,  y: 760 },
  { id: 'vent-7',  room: 'Communications', x: 1830, y: 850 },
  { id: 'vent-8',  room: 'Storage',        x: 1150, y: 1200 },
  { id: 'vent-9',  room: 'MedBay',         x: 1150, y: 440 },
  { id: 'vent-10', room: 'Weapons',        x: 1550, y: 260 },
]

// Emergency button in cafeteria center
export const EMERGENCY_BUTTON = { x: 1200, y: 840, w: 50, h: 50 }

export const KILL_DISTANCE = 80
export const REPORT_DISTANCE = 120
export const EMERGENCY_DISTANCE = 60

export function isWalkable(x: number, y: number): boolean {
  for (const r of WALKABLE) {
    if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) return true
  }
  return false
}

// Very lenient collision: only check center point + small radius on axes
// This prevents getting stuck in doorways while still blocking walls
export function canMoveTo(x: number, y: number, r: number = 5): boolean {
  return (
    isWalkable(x, y) &&
    isWalkable(x - r, y) &&
    isWalkable(x + r, y) &&
    isWalkable(x, y - r) &&
    isWalkable(x, y + r)
  )
}

export function roomAt(x: number, y: number): string {
  for (const r of ROOMS) {
    if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) return r.name
  }
  return 'Corridor'
}

export function findTaskNear(x: number, y: number): TaskZone | null {
  let nearest: TaskZone | null = null
  let nearestDist = 80
  for (const t of TASK_ZONES) {
    const cx = t.x + t.w / 2, cy = t.y + t.h / 2
    const dx = x - cx, dy = y - cy
    const d = Math.sqrt(dx * dx + dy * dy)
    if (d < nearestDist) { nearestDist = d; nearest = t }
  }
  return nearest
}

export function findSabotageFixNear(x: number, y: number): SabotageZone | null {
  let nearest: SabotageZone | null = null
  let nearestDist = 80
  for (const z of SABOTAGE_ZONES) {
    const cx = z.x + z.w / 2, cy = z.y + z.h / 2
    const dx = x - cx, dy = y - cy
    const d = Math.sqrt(dx * dx + dy * dy)
    if (d < nearestDist) { nearestDist = d; nearest = z }
  }
  return nearest
}

// Find nearby vent within 60px (for impostor vent travel)
export function findVentNear(x: number, y: number): { id: string; room: string; x: number; y: number } | null {
  let nearest: { id: string; room: string; x: number; y: number } | null = null
  let nearestDist = 60
  for (const v of VENT_ZONES) {
    const dx = x - v.x, dy = y - v.y
    const d = Math.sqrt(dx * dx + dy * dy)
    if (d < nearestDist) { nearestDist = d; nearest = v }
  }
  return nearest
}

export function isNearEmergencyButton(x: number, y: number): boolean {
  const cx = EMERGENCY_BUTTON.x + EMERGENCY_BUTTON.w / 2
  const cy = EMERGENCY_BUTTON.y + EMERGENCY_BUTTON.h / 2
  const dx = x - cx, dy = y - cy
  return Math.sqrt(dx * dx + dy * dy) < EMERGENCY_DISTANCE
}
