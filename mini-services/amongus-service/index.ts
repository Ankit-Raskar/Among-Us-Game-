import { createServer } from 'http'
import { Server } from 'socket.io'

const httpServer = createServer()
const io = new Server(httpServer, {
  path: '/',
  cors: { origin: '*', methods: ['GET', 'POST'] },
  pingTimeout: 60000,
  pingInterval: 25000,
})

// ---------- Types ----------
type Role = 'crewmate' | 'impostor'
type GamePhase = 'lobby' | 'playing' | 'meeting' | 'gameover'

interface Player {
  id: string
  name: string
  color: string
  x: number
  y: number
  role: Role | null
  alive: boolean
  tasksCompleted: number
  tasksTotal: number
  killCooldown: number
  isHost: boolean
  votedFor: string | null
  ready: boolean
  completedTaskIds: string[]  // track which task zones this player has completed
}

interface SabotageState {
  type: 'reactor' | 'o2' | 'lights' | 'comms' | 'doors' | null
  startTime: number
  endTime: number
  fixedBy: string[]
  fixRequired: number
  fixedPanelIds: string[]
}

interface Room {
  code: string
  players: Map<string, Player>
  phase: GamePhase
  hostId: string
  impostorCount: number
  taskList: { id: string; room: string; name: string; type: string }[]
  meetingCaller: string | null
  meetingReason: 'emergency' | 'body' | null
  meetingEndTime: number
  votingEndTime: number
  winner: 'crew' | 'impostor' | null
  bodyReported: string | null
  sabotage: SabotageState
  lastSabotageTime: number
}

const rooms = new Map<string, Room>()

const COLORS = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#06b6d4', '#3b82f6', '#8b5cf6', '#ec4899', '#f43f5e', '#84cc16', '#14b8a6', '#a855f7']
const ROOM_NAMES = ['Cafeteria', 'Engine', 'Reactor', 'Security', 'MedBay', 'Navigation', 'Electrical', 'Storage']
const TASK_TYPES = ['wires', 'swipe', 'asteroids', 'numbers', 'progressbar', 'memory'] as const
type TaskType = typeof TASK_TYPES[number]
const TASK_NAMES: Record<TaskType, string[]> = {
  wires: ['Fix Wiring', 'Calibrate Distributor'],
  swipe: ['Swipe Card', 'Authorize Transaction'],
  asteroids: ['Clear Asteroids', 'Destroy Comets'],
  numbers: ['Start Reactor', 'Enter Code'],
  progressbar: ['Download Data', 'Upload Data'],
  memory: ['Inspect Sample', 'Sort Samples'],
}

function genCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let code = ''
  do {
    code = ''
    for (let i = 0; i < 5; i++) code += chars[Math.floor(Math.random() * chars.length)]
  } while (rooms.has(code))
  return code
}

function genId(): string {
  return Math.random().toString(36).substring(2, 10)
}

function buildTaskList(): { id: string; room: string; name: string; type: string }[] {
  const tasks: { id: string; room: string; name: string; type: string }[] = []
  const types = [...TASK_TYPES]
  for (let i = 0; i < 6; i++) {
    const type = types[i % types.length]
    const names = TASK_NAMES[type]
    tasks.push({
      id: genId(),
      room: ROOM_NAMES[Math.floor(Math.random() * ROOM_NAMES.length)],
      name: names[Math.floor(Math.random() * names.length)],
      type,
    })
  }
  return tasks
}

function assignRoles(room: Room) {
  const players = Array.from(room.players.values())
  for (let i = players.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[players[i], players[j]] = [players[j], players[i]]
  }
  const impostorCount = Math.min(room.impostorCount, Math.max(1, Math.floor(players.length / 4)))
  for (let i = 0; i < players.length; i++) {
    players[i].role = i < impostorCount ? 'impostor' : 'crewmate'
    players[i].tasksTotal = i < impostorCount ? 0 : room.taskList.length
    players[i].tasksCompleted = 0
    players[i].alive = true
    players[i].killCooldown = i < impostorCount ? 15000 : 0
    players[i].x = 1200 + Math.random() * 200 - 100
    players[i].y = 840 + Math.random() * 200 - 100
    players[i].completedTaskIds = []
  }
}

function totalTasksComplete(room: Room): number {
  let done = 0
  for (const p of room.players.values()) if (p.role === 'crewmate') done += p.tasksCompleted
  return done
}

function totalTasksNeeded(room: Room): number {
  let total = 0
  for (const p of room.players.values()) if (p.role === 'crewmate') total += p.tasksTotal
  return total
}

function aliveCounts(room: Room) {
  let crew = 0, imp = 0
  for (const p of room.players.values()) {
    if (!p.alive) continue
    if (p.role === 'crewmate') crew++
    else if (p.role === 'impostor') imp++
  }
  return { crew, imp: crew > 0 ? imp : 0 }
}

function checkWinCondition(room: Room): 'crew' | 'impostor' | null {
  const { crew, imp } = aliveCounts(room)
  if (imp === 0) return 'crew'
  if (crew === 0) return 'impostor'
  if (crew <= imp) return 'impostor'
  const totalNeeded = totalTasksNeeded(room)
  if (totalNeeded > 0 && totalTasksComplete(room) >= totalNeeded) return 'crew'
  return null
}

function publicRoomState(room: Room) {
  return {
    code: room.code,
    phase: room.phase,
    hostId: room.hostId,
    impostorCount: room.impostorCount,
    players: Array.from(room.players.values()).map(p => ({
      id: p.id, name: p.name, color: p.color, x: p.x, y: p.y, role: p.role,
      alive: p.alive, tasksCompleted: p.tasksCompleted, tasksTotal: p.tasksTotal,
      killCooldown: p.killCooldown, isHost: p.isHost, ready: p.ready, votedFor: p.votedFor,
      completedTaskIds: p.completedTaskIds || [],
    })),
    taskList: room.taskList,
    meetingCaller: room.meetingCaller,
    meetingReason: room.meetingReason,
    meetingEndTime: room.meetingEndTime,
    votingEndTime: room.votingEndTime,
    winner: room.winner,
    bodyReported: room.bodyReported,
    totalTasksComplete: totalTasksComplete(room),
    totalTasksNeeded: totalTasksNeeded(room),
    sabotage: room.sabotage,
  }
}

function emitRoomState(room: Room) {
  io.to(room.code).emit('state', publicRoomState(room))
}

function endGame(room: Room, winner: 'crew' | 'impostor') {
  room.phase = 'gameover'
  room.winner = winner
  emitRoomState(room)
}

function resetForLobby(room: Room) {
  room.phase = 'lobby'
  room.meetingCaller = null
  room.meetingReason = null
  room.winner = null
  room.bodyReported = null
  room.sabotage = { type: null, startTime: 0, endTime: 0, fixedBy: [], fixRequired: 0, fixedPanelIds: [] }
  room.lastSabotageTime = 0
  for (const p of room.players.values()) {
    p.role = null
    p.alive = true
    p.tasksCompleted = 0
    p.tasksTotal = 0
    p.killCooldown = 0
    p.votedFor = null
    p.ready = false
    p.completedTaskIds = []
  }
}

function findRoomBySocket(socketId: string): Room | undefined {
  for (const room of rooms.values()) if (room.players.has(socketId)) return room
  return undefined
}

function startMeeting(room: Room, callerId: string, reason: 'emergency' | 'body', bodyId?: string) {
  room.phase = 'meeting'
  room.meetingCaller = callerId
  room.meetingReason = reason
  room.bodyReported = bodyId || null
  room.sabotage = { type: null, startTime: 0, endTime: 0, fixedBy: [], fixRequired: 0, fixedPanelIds: [] }
  for (const p of room.players.values()) p.votedFor = null
  room.meetingEndTime = Date.now() + 20000
  room.votingEndTime = Date.now() + 45000
  for (const p of room.players.values()) {
    p.x = 1200 + Math.random() * 300 - 150
    p.y = 840 + Math.random() * 200 - 100
  }
  emitRoomState(room)
  setTimeout(() => { if (room.phase === 'meeting') resolveVoting(room) }, 45000)
}

function resolveVoting(room: Room) {
  const alive = Array.from(room.players.values()).filter(p => p.alive)
  const tally = new Map<string, number>()
  let skips = 0
  for (const p of alive) {
    if (p.votedFor === 'skip') skips++
    else if (p.votedFor) tally.set(p.votedFor, (tally.get(p.votedFor) || 0) + 1)
  }
  let maxVotes = skips
  let ejected: Player | null = null
  let tie = false
  for (const [pid, count] of tally.entries()) {
    if (count > maxVotes) { maxVotes = count; ejected = room.players.get(pid) || null; tie = false }
    else if (count === maxVotes) tie = true
  }
  let ejectedName: string | null = null
  let wasImpostor = false
  if (ejected && !tie && maxVotes > 0) {
    ejected.alive = false
    ejectedName = ejected.name
    wasImpostor = ejected.role === 'impostor'
  }
  io.to(room.code).emit('vote-result', { ejectedName, wasImpostor, tie, skipped: !ejected && !tie })
  const winner = checkWinCondition(room)
  if (winner) setTimeout(() => endGame(room, winner), 3000)
  else {
    setTimeout(() => {
      room.phase = 'playing'
      room.meetingCaller = null
      room.meetingReason = null
      room.bodyReported = null
      for (const p of room.players.values()) {
        if (p.role === 'impostor' && p.alive) p.killCooldown = 10000
        p.votedFor = null
      }
      emitRoomState(room)
    }, 4000)
  }
}

io.on('connection', (socket) => {
  console.log(`[socket] connected: ${socket.id}`)

  socket.on('create-room', ({ name, color }: { name: string; color: string }) => {
    for (const [code, room] of rooms.entries()) {
      if (room.players.has(socket.id)) {
        room.players.delete(socket.id)
        if (room.players.size === 0) rooms.delete(code)
        else if (room.hostId === socket.id) {
          room.hostId = Array.from(room.players.keys())[0]
          const nh = room.players.get(room.hostId); if (nh) nh.isHost = true
        }
        emitRoomState(room)
      }
    }
    const code = genCode()
    const player: Player = {
      id: socket.id, name: name || 'Player', color: color || COLORS[Math.floor(Math.random() * COLORS.length)],
      x: 1200, y: 840, role: null, alive: true, tasksCompleted: 0, tasksTotal: 0, killCooldown: 0,
      isHost: true, ready: false, votedFor: null, completedTaskIds: [],
    }
    const room: Room = {
      code, players: new Map([[socket.id, player]]), phase: 'lobby', hostId: socket.id,
      impostorCount: 1, taskList: buildTaskList(), meetingCaller: null, meetingReason: null,
      meetingEndTime: 0, votingEndTime: 0, winner: null, lastKillTime: 0, bodyReported: null,
      sabotage: { type: null, startTime: 0, endTime: 0, fixedBy: [], fixRequired: 0, fixedPanelIds: [] },
      lastSabotageTime: 0,
    }
    rooms.set(code, room)
    socket.join(code)
    socket.emit('room-created', { code })
    emitRoomState(room)
    console.log(`[room] created ${code} by ${player.name}`)
  })

  socket.on('join-room', ({ code, name, color }: { code: string; name: string; color: string }) => {
    const upper = (code || '').toUpperCase().trim()
    const room = rooms.get(upper)
    if (!room) { socket.emit('error-msg', { message: 'Room not found' }); return }
    if (room.phase !== 'lobby') { socket.emit('error-msg', { message: 'Game already in progress' }); return }
    if (room.players.size >= 12) { socket.emit('error-msg', { message: 'Room is full' }); return }
    for (const [c, r] of rooms.entries()) {
      if (r.players.has(socket.id)) {
        r.players.delete(socket.id)
        if (r.players.size === 0) rooms.delete(c)
        else if (r.hostId === socket.id) {
          r.hostId = Array.from(r.players.keys())[0]
          const nh = r.players.get(r.hostId); if (nh) nh.isHost = true
        }
        emitRoomState(r)
      }
    }
    const player: Player = {
      id: socket.id, name: name || 'Player', color: color || COLORS[Math.floor(Math.random() * COLORS.length)],
      x: 1200, y: 840, role: null, alive: true, tasksCompleted: 0, tasksTotal: 0, killCooldown: 0,
      isHost: false, ready: false, votedFor: null, completedTaskIds: [],
    }
    room.players.set(socket.id, player)
    socket.join(upper)
    socket.emit('joined', { code: upper })
    emitRoomState(room)
    console.log(`[room] ${player.name} joined ${upper}`)
  })

  socket.on('set-ready', ({ ready }: { ready: boolean }) => {
    const room = findRoomBySocket(socket.id); if (!room || room.phase !== 'lobby') return
    const p = room.players.get(socket.id); if (p) { p.ready = ready; emitRoomState(room) }
  })

  socket.on('set-impostor-count', ({ count }: { count: number }) => {
    const room = findRoomBySocket(socket.id); if (!room || room.phase !== 'lobby') return
    if (room.hostId !== socket.id) return
    room.impostorCount = Math.max(1, Math.min(3, count))
    emitRoomState(room)
  })

  socket.on('start-game', () => {
    const room = findRoomBySocket(socket.id); if (!room || room.phase !== 'lobby') return
    if (room.hostId !== socket.id) return
    if (room.players.size < 3) { socket.emit('error-msg', { message: 'Need at least 3 players to start' }); return }
    // Require ALL non-host players to be ready
    const notReady = Array.from(room.players.values()).filter(p => !p.isHost && !p.ready)
    if (notReady.length > 0) {
      socket.emit('error-msg', { message: `${notReady.length} player(s) not ready: ${notReady.map(p => p.name).join(', ')}` })
      return
    }
    room.taskList = buildTaskList()
    assignRoles(room)
    room.phase = 'playing'
    room.lastSabotageTime = 0
    emitRoomState(room)
    for (const p of room.players.values()) io.to(p.id).emit('role-assigned', { role: p.role })
    console.log(`[game] started in ${room.code}`)
  })

  socket.on('move', ({ x, y }: { x: number; y: number }) => {
    const room = findRoomBySocket(socket.id); if (!room || room.phase !== 'playing') return
    const p = room.players.get(socket.id); if (!p || !p.alive) return
    p.x = Math.max(20, Math.min(2380, x))
    p.y = Math.max(20, Math.min(1580, y))
  })

  socket.on('complete-task', ({ taskId }: { taskId: string }) => {
    const room = findRoomBySocket(socket.id); if (!room || room.phase !== 'playing') return
    const p = room.players.get(socket.id); if (!p || !p.alive || p.role !== 'crewmate') return
    // Prevent completing the same task twice
    if (!p.completedTaskIds) p.completedTaskIds = []
    if (p.completedTaskIds.includes(taskId)) return
    p.completedTaskIds.push(taskId)
    p.tasksCompleted = Math.min(p.tasksTotal, p.tasksCompleted + 1)
    emitRoomState(room)
    const winner = checkWinCondition(room); if (winner) endGame(room, winner)
  })

  socket.on('kill', ({ targetId }: { targetId: string }) => {
    const room = findRoomBySocket(socket.id); if (!room || room.phase !== 'playing') return
    const killer = room.players.get(socket.id); const victim = room.players.get(targetId)
    if (!killer || !victim) return
    if (killer.role !== 'impostor' || !killer.alive) return
    if (!victim.alive || victim.role === 'impostor') return
    if (killer.killCooldown > 0) return
    const dx = killer.x - victim.x, dy = killer.y - victim.y
    if (Math.sqrt(dx * dx + dy * dy) > 80) return
    victim.alive = false
    killer.killCooldown = 20000
    killer.x = victim.x; killer.y = victim.y
    emitRoomState(room)
    const winner = checkWinCondition(room); if (winner) endGame(room, winner)
  })

  socket.on('call-meeting', () => {
    const room = findRoomBySocket(socket.id); if (!room || room.phase !== 'playing') return
    const p = room.players.get(socket.id); if (!p || !p.alive) return
    startMeeting(room, p.id, 'emergency')
  })

  socket.on('report-body', () => {
    const room = findRoomBySocket(socket.id); if (!room || room.phase !== 'playing') return
    const p = room.players.get(socket.id); if (!p || !p.alive) return
    let nearest: Player | null = null, nearestDist = 120
    for (const other of room.players.values()) {
      if (other.alive) continue
      const dx = p.x - other.x, dy = p.y - other.y, d = Math.sqrt(dx * dx + dy * dy)
      if (d < nearestDist) { nearestDist = d; nearest = other }
    }
    if (nearest) startMeeting(room, p.id, 'body', nearest.id)
  })

  // ====== Sabotage system ======
  socket.on('sabotage', ({ type }: { type: 'reactor' | 'o2' | 'lights' | 'comms' | 'doors' }) => {
    const room = findRoomBySocket(socket.id); if (!room || room.phase !== 'playing') return
    const p = room.players.get(socket.id)
    if (!p || p.role !== 'impostor' || !p.alive) return
    if (Date.now() - room.lastSabotageTime < 30000) return
    if (room.sabotage.type !== null) return
    room.lastSabotageTime = Date.now()
    const now = Date.now()
    if (type === 'reactor' || type === 'o2') {
      room.sabotage = { type, startTime: now, endTime: now + 45000, fixedBy: [], fixRequired: 2, fixedPanelIds: [] }
    } else if (type === 'lights' || type === 'comms') {
      room.sabotage = { type, startTime: now, endTime: 0, fixedBy: [], fixRequired: 1, fixedPanelIds: [] }
    } else if (type === 'doors') {
      room.sabotage = { type, startTime: now, endTime: now + 10000, fixedBy: [], fixRequired: 0, fixedPanelIds: [] }
      setTimeout(() => {
        if (room.sabotage.type === 'doors' && Date.now() >= room.sabotage.endTime) {
          room.sabotage = { type: null, startTime: 0, endTime: 0, fixedBy: [], fixRequired: 0, fixedPanelIds: [] }
          emitRoomState(room)
        }
      }, 11000)
    }
    emitRoomState(room)
    console.log(`[sabotage] ${p.name} triggered ${type} in ${room.code}`)
  })

  socket.on('fix-sabotage', ({ panelId }: { panelId: string }) => {
    const room = findRoomBySocket(socket.id); if (!room || room.phase !== 'playing') return
    const p = room.players.get(socket.id); if (!p || !p.alive) return
    if (!room.sabotage.type) return
    if (room.sabotage.fixedPanelIds.includes(panelId)) return
    room.sabotage.fixedPanelIds.push(panelId)
    if (room.sabotage.fixedPanelIds.length >= room.sabotage.fixRequired) {
      room.sabotage = { type: null, startTime: 0, endTime: 0, fixedBy: [], fixRequired: 0, fixedPanelIds: [] }
    }
    emitRoomState(room)
    console.log(`[sabotage] ${p.name} fixed panel ${panelId} in ${room.code}`)
  })

  socket.on('vote', ({ targetId }: { targetId: string | 'skip' }) => {
    const room = findRoomBySocket(socket.id); if (!room || room.phase !== 'meeting') return
    const p = room.players.get(socket.id); if (!p || !p.alive) return
    if (Date.now() > room.votingEndTime) return
    p.votedFor = targetId
    emitRoomState(room)
    const alive = Array.from(room.players.values()).filter(x => x.alive)
    if (alive.every(x => x.votedFor !== null)) resolveVoting(room)
  })

  socket.on('back-to-lobby', () => {
    const room = findRoomBySocket(socket.id); if (!room || room.phase !== 'gameover') return
    if (room.hostId !== socket.id) return
    resetForLobby(room); emitRoomState(room)
  })

  socket.on('chat', ({ message }: { message: string }) => {
    const room = findRoomBySocket(socket.id); if (!room) return
    const p = room.players.get(socket.id); if (!p) return
    if (room.phase === 'meeting' && !p.alive) return
    const cleanMsg = (message || '').slice(0, 200)
    io.to(room.code).emit('chat', { playerId: p.id, name: p.name, color: p.color, message: cleanMsg, timestamp: Date.now() })
  })

  socket.on('disconnect', () => {
    console.log(`[socket] disconnected: ${socket.id}`)
    for (const [code, room] of rooms.entries()) {
      if (room.players.has(socket.id)) {
        const wasHost = room.hostId === socket.id
        room.players.delete(socket.id)
        if (room.players.size === 0) { rooms.delete(code); continue }
        if (wasHost) {
          room.hostId = Array.from(room.players.keys())[0]
          const nh = room.players.get(room.hostId); if (nh) nh.isHost = true
        }
        if (room.phase === 'playing') {
          const winner = checkWinCondition(room); if (winner) endGame(room, winner)
        }
        emitRoomState(room)
      }
    }
  })
})

// Cooldown ticker (1s)
setInterval(() => {
  for (const room of rooms.values()) {
    if (room.phase !== 'playing') continue
    for (const p of room.players.values()) {
      if (p.killCooldown > 0) p.killCooldown = Math.max(0, p.killCooldown - 1000)
    }
    if (room.sabotage.type === 'reactor' || room.sabotage.type === 'o2') {
      if (room.sabotage.endTime > 0 && Date.now() >= room.sabotage.endTime) {
        endGame(room, 'impostor'); continue
      }
    }
    emitRoomState(room)
  }
}, 1000)

// Position broadcast (30Hz)
setInterval(() => {
  for (const room of rooms.values()) {
    if (room.phase === 'playing') {
      io.to(room.code).emit('positions', Array.from(room.players.values()).map(p => ({ id: p.id, x: p.x, y: p.y })))
    }
  }
}, 50)

const PORT = 3003
httpServer.listen(PORT, () => console.log(`[amongus-service] listening on :${PORT}`))
