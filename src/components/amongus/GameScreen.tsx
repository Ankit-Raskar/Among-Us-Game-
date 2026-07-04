'use client'
import { useEffect, useRef, useState } from 'react'
import { getSocket, type RoomState, type ChatMessage, type Role, type Player, type SabotageState } from '@/lib/amongus-client'
import {
  MAP_WIDTH, MAP_HEIGHT, ROOMS, CORRIDORS, TASK_ZONES, SABOTAGE_ZONES, EMERGENCY_BUTTON,
  canMoveTo, roomAt, findTaskNear, findSabotageFixNear, isNearEmergencyButton, findVentNear, VENT_ZONES,
  type TaskZone, type SabotageType,
} from '@/lib/amongus-map'
import { GameScene3D } from './GameScene3D'
import { TaskMiniGame } from './TaskMiniGame'
import { sounds } from '@/lib/sounds'

interface Props {
  room: RoomState
  myId: string
  myRole: Role
  chatMessages: ChatMessage[]
}

export function GameScreen({ room, myId, myRole, chatMessages }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const keysRef = useRef<Set<string>>(new Set())
  const myPlayerRef = useRef(room.players.find(p => p.id === myId))
  const playersRef = useRef<Player[]>(room.players)
  const sabotageRef = useRef<SabotageState | null>(room.sabotage || null)
  const cameraYawRef = useRef<number>(0)
  const lastSendRef = useRef(0)
  const [chatOpen, setChatOpen] = useState(false)
  const [chatInput, setChatInput] = useState('')
  const [activeTask, setActiveTask] = useState<TaskZone | null>(null)
  const [killCooldown, setKillCooldown] = useState(0)
  const [showMap, setShowMap] = useState(false)
  const [showSabotagePanel, setShowSabotagePanel] = useState(false)
  const [showVentPanel, setShowVentPanel] = useState(false)
  const [showMobileKeys, setShowMobileKeys] = useState(true)
  const [now, setNow] = useState(Date.now())

  useEffect(() => { sabotageRef.current = room.sabotage || null }, [room.sabotage])

  useEffect(() => {
    const localMe = myPlayerRef.current
    if (localMe) playersRef.current = room.players.map(p => p.id === myId ? { ...p, x: localMe.x, y: localMe.y } : p)
    else playersRef.current = room.players
  }, [room, myId])

  const actionsRef = useRef<{ tryUseTask: () => void; tryReport: () => void; tryKill: () => void; tryEmergency: () => void; tryFixSabotage: () => void }>({ tryUseTask: () => {}, tryReport: () => {}, tryKill: () => {}, tryEmergency: () => {}, tryFixSabotage: () => {} })

  useEffect(() => {
    const serverMe = room.players.find(p => p.id === myId)
    if (!serverMe) return
    const localMe = myPlayerRef.current
    if (localMe && localMe.id === serverMe.id) myPlayerRef.current = { ...serverMe, x: localMe.x, y: localMe.y }
    else myPlayerRef.current = serverMe
    if (serverMe) setKillCooldown(serverMe.killCooldown)
  }, [room])

  useEffect(() => {
    const s = getSocket()
    const onPositions = (positions: { id: string; x: number; y: number }[]) => {
      const me = myPlayerRef.current; if (!me) return
      const serverMe = positions.find(p => p.id === myId)
      if (serverMe) {
        const dx = me.x - serverMe.x, dy = me.y - serverMe.y
        if (Math.sqrt(dx * dx + dy * dy) > 100) myPlayerRef.current = { ...me, x: serverMe.x, y: serverMe.y }
      }
    }
    s.on('positions', onPositions)
    return () => { s.off('positions', onPositions) }
  }, [myId])

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      keysRef.current.add(e.key.toLowerCase())
      const k = e.key.toLowerCase()
      if (k === 'e') actionsRef.current.tryUseTask()
      else if (k === 'r') actionsRef.current.tryReport()
      else if (k === 'q') actionsRef.current.tryKill()
      else if (k === 'f') actionsRef.current.tryEmergency()
      else if (k === 't') actionsRef.current.tryFixSabotage()
      else if (k === 'g' && myRole === 'impostor') setShowVentPanel(o => !o)
      else if (k === 'v' && myRole === 'impostor') setShowSabotagePanel(o => !o)
      else if (k === 'm') setChatOpen(o => !o)
      else if (k === 'tab') { e.preventDefault(); setShowMap(o => !o) }
    }
    const onKeyUp = (e: KeyboardEvent) => keysRef.current.delete(e.key.toLowerCase())
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    return () => { window.removeEventListener('keydown', onKeyDown); window.removeEventListener('keyup', onKeyUp) }
  }, [])

  useEffect(() => {
    let lastStep = 0
    let rafId = 0
    let lastTime = performance.now()
    // Smooth velocity-based movement using requestAnimationFrame for buttery motion
    const velocity = { x: 0, z: 0 }
    const tick = () => {
      rafId = requestAnimationFrame(tick)
      const now = performance.now()
      const dt = Math.min(0.05, (now - lastTime) / 1000) // cap dt to avoid jumps
      lastTime = now
      const me = myPlayerRef.current
      if (!me || !me.alive || room.phase !== 'playing') return
      let fwd = 0, strafe = 0
      const k = keysRef.current
      if (k.has('w')) fwd += 1
      if (k.has('s')) fwd -= 1
      if (k.has('a')) strafe -= 1
      if (k.has('d')) strafe += 1

      // Camera-relative movement (first-person)
      const yaw = cameraYawRef.current
      const forwardX = Math.sin(yaw)
      const forwardY = Math.cos(yaw)
      const rightX = -Math.cos(yaw)
      const rightY = Math.sin(yaw)

      let dx = forwardX * fwd + rightX * strafe
      let dy = forwardY * fwd + rightY * strafe
      const len = Math.sqrt(dx * dx + dy * dy)
      if (len > 0) { dx = dx / len; dy = dy / len }

      // Target velocity
      const speed = 3.8
      const targetVX = dx * speed
      const targetVY = dy * speed
      // Smooth acceleration — faster lerp for responsiveness, frame-rate independent
      const accelRate = 1 - Math.pow(0.001, dt) // ~12 lerp at 60fps
      velocity.x += (targetVX - velocity.x) * Math.min(1, accelRate)
      velocity.z += (targetVY - velocity.z) * Math.min(1, accelRate)
      // Decelerate when no input
      if (fwd === 0 && strafe === 0) {
        const decelRate = 1 - Math.pow(0.0001, dt)
        velocity.x *= (1 - decelRate)
        velocity.z *= (1 - decelRate)
        if (Math.abs(velocity.x) < 0.05) velocity.x = 0
        if (Math.abs(velocity.z) < 0.05) velocity.z = 0
        if (velocity.x === 0 && velocity.z === 0) return
      }

      // Frame-rate independent movement (multiply by dt)
      const moveX = velocity.x * dt * 60
      const moveY = velocity.z * dt * 60
      const newX = me.x + moveX, newY = me.y + moveY
      let finalX = me.x, finalY = me.y
      if (canMoveTo(newX, me.y, 10)) finalX = newX
      else velocity.x *= 0.5
      if (canMoveTo(finalX, newY, 10)) finalY = newY
      else velocity.z *= 0.5
      if (finalX !== me.x || finalY !== me.y) {
        myPlayerRef.current = { ...me, x: finalX, y: finalY }
        playersRef.current = playersRef.current.map(p => p.id === myId ? { ...p, x: finalX, y: finalY } : p)
        const nowMs = Date.now()
        if (nowMs - lastSendRef.current > 50) { getSocket().emit('move', { x: finalX, y: finalY }); lastSendRef.current = nowMs }
        if (nowMs - lastStep > 320) { sounds.footstep(); lastStep = nowMs }
      }
    }
    rafId = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafId)
  }, [room.phase])

  useEffect(() => { const i = setInterval(() => setNow(Date.now()), 250); return () => clearInterval(i) }, [])

  const tryUseTask = () => {
    const me = myPlayerRef.current
    if (!me || !me.alive || myRole !== 'crewmate') return
    const t = findTaskNear(me.x, me.y)
    if (t) {
      // Check if this task was already completed by me
      const completed = (me as any).completedTaskIds || []
      if (completed.includes(t.id)) return  // already done - don't open
      sounds.click(); setActiveTask(t)
    }
  }
  const tryReport = () => {
    const me = myPlayerRef.current
    if (!me || !me.alive) return
    const body = findBodyNear(me.x, me.y)
    if (body) { sounds.bodyReport(); getSocket().emit('report-body', {}) }
  }
  const tryKill = () => {
    const target = findKillTarget()
    if (target) { sounds.kill(); getSocket().emit('kill', { targetId: target.id }) }
  }
  const tryEmergency = () => {
    const me = myPlayerRef.current
    if (!me || !me.alive) return
    if (isNearEmergencyButton(me.x, me.y)) { sounds.bodyReport(); getSocket().emit('call-meeting', {}) }
  }
  const tryFixSabotage = () => {
    const me = myPlayerRef.current
    if (!me || !me.alive) return
    if (!room.sabotage?.type) return
    const panel = findSabotageFixNear(me.x, me.y)
    if (panel) { sounds.sabotageFix(); getSocket().emit('fix-sabotage', { panelId: panel.id }) }
  }
  const triggerSabotage = (type: SabotageType) => {
    if (myRole !== 'impostor') return
    sounds.sabotage()
    getSocket().emit('sabotage', { type })
    setShowSabotagePanel(false)
  }
  const useVent = (ventId: string) => {
    const vent = VENT_ZONES.find(v => v.id === ventId)
    if (!vent) return
    // Teleport impostor to the selected vent
    sounds.click()
    getSocket().emit('move', { x: vent.x, y: vent.y })
    myPlayerRef.current = { ...myPlayerRef.current!, x: vent.x, y: vent.y }
    playersRef.current = playersRef.current.map(p => p.id === myId ? { ...p, x: vent.x, y: vent.y } : p)
    setShowVentPanel(false)
  }
  actionsRef.current = { tryUseTask, tryReport, tryKill, tryEmergency, tryFixSabotage }

  const findKillTarget = () => {
    if (myRole !== 'impostor') return null
    const me = myPlayerRef.current
    if (!me || !me.alive || me.killCooldown > 0) return null
    let nearest: any = null, nd = 80
    for (const p of room.players) {
      if (p.id === me.id || !p.alive || p.role === 'impostor') continue
      const dx = p.x - me.x, dy = p.y - me.y, d = Math.sqrt(dx * dx + dy * dy)
      if (d < nd) { nd = d; nearest = p }
    }
    return nearest
  }
  const findBodyNear = (x: number, y: number) => {
    let nearest: any = null, nd = 120
    for (const p of room.players) {
      if (p.alive) continue
      const dx = p.x - x, dy = p.y - y, d = Math.sqrt(dx * dx + dy * dy)
      if (d < nd) { nd = d; nearest = p }
    }
    return nearest
  }
  const sendChat = () => { if (!chatInput.trim()) return; getSocket().emit('chat', { message: chatInput.trim() }); setChatInput('') }
  const completeTaskMiniGame = () => {
    if (!activeTask) return
    sounds.taskComplete()
    // Send the task zone's id so the backend can track which task was completed
    getSocket().emit('complete-task', { taskId: activeTask.id })
    setActiveTask(null)
  }

  const me = room.players.find(p => p.id === myId)
  const myRoom = me ? roomAt(me.x, me.y) : ''
  const taskPct = room.totalTasksNeeded > 0 ? Math.floor((room.totalTasksComplete / room.totalTasksNeeded) * 100) : 0
  const myColor = me?.color || '#ef4444'

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      <div className="bg-black/40 backdrop-blur border-b border-white/10 px-4 py-2 flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <span className="text-xs text-white/60">Room:</span>
          <span className="font-mono font-black text-yellow-400 tracking-widest">{room.code}</span>
          <span className="text-xs text-white/60">|</span>
          <span className="text-xs">You are in <span className="font-bold text-white">{myRoom}</span></span>
          <span className="text-xs text-white/40 hidden md:inline">| 🖱️ Click to lock mouse · WASD move · A=left D=right · ESC to release</span>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <div className={`px-3 py-1 rounded-full text-xs font-black ${myRole === 'impostor' ? 'bg-red-500/30 text-red-300 border border-red-500/50' : 'bg-green-500/30 text-green-300 border border-green-500/50'}`}>
            {myRole === 'impostor' ? '🔪 IMPOSTOR' : '✓ CREWMATE'}
          </div>
          {myRole === 'crewmate' && (
            <div className="flex items-center gap-2">
              <span className="text-xs text-white/60">Tasks:</span>
              <div className="w-32 h-3 bg-black/40 rounded-full overflow-hidden border border-white/10">
                <div className="h-full bg-gradient-to-r from-yellow-400 to-green-400 transition-all" style={{ width: taskPct + '%' }} />
              </div>
              <span className="text-xs font-mono">{taskPct}%</span>
            </div>
          )}
          {myRole === 'impostor' && (
            <div className="text-xs">
              <span className="text-white/60">Kill:</span>{' '}
              <span className={killCooldown > 0 ? 'text-red-400 font-bold' : 'text-green-400 font-bold'}>
                {killCooldown > 0 ? Math.ceil(killCooldown / 1000) + 's' : 'READY'}
              </span>
            </div>
          )}
        </div>
      </div>

      <div className="flex-1 flex relative">
        <div ref={containerRef} className="flex-1 relative">
          <GameScene3D myId={myId} myColor={myColor} playersRef={playersRef} sabotageRef={sabotageRef} cameraYawRef={cameraYawRef} />
          <MobileControls
            onMove={(dx, dy) => {
              const k = keysRef.current; k.clear()
              if (dx < 0) k.add('a'); if (dx > 0) k.add('d')
              if (dy < 0) k.add('w'); if (dy > 0) k.add('s')
            }}
            onStop={() => keysRef.current.clear()}
            onAction={(action) => {
              if (action === 'task') tryUseTask()
              else if (action === 'kill') tryKill()
              else if (action === 'report') tryReport()
              else if (action === 'emergency') tryEmergency()
              else if (action === 'fix-sab') tryFixSabotage()
              else if (action === 'sabotage') setShowSabotagePanel(o => !o)
              else if (action === 'map') setShowMap(o => !o)
              else if (action === 'chat') setChatOpen(o => !o)
            }}
            myRole={myRole} killCooldown={killCooldown} sabotageActive={!!room.sabotage?.type}
          />
        </div>

        <div className="hidden md:flex w-64 bg-black/40 border-l border-white/10 flex-col">
          <div className="p-4 border-b border-white/10">
            <h3 className="font-bold mb-2 flex items-center gap-2"><span>📋</span> {myRole === 'crewmate' ? 'Your Tasks' : 'Sabotage Targets'}</h3>
            {myRole === 'crewmate' ? (
              <ul className="text-xs space-y-1.5 max-h-96 overflow-y-auto">
                {TASK_ZONES.map((t) => {
                  const completed = (me as any)?.completedTaskIds?.includes(t.id) ?? false
                  return (
                    <li key={t.id} className={`flex items-start gap-2 ${completed ? 'line-through text-white/30' : 'text-white/80'}`}>
                      <span>{completed ? '✓' : '○'}</span>
                      <div><div className="font-semibold">{t.name}</div><div className="text-white/40 text-[10px]">{t.room} · <span className="text-yellow-400/70 uppercase">{t.type}</span></div></div>
                    </li>
                  )
                })}
              </ul>
            ) : (
              <div className="text-xs text-white/70 space-y-2">
                <p>You are an <span className="text-red-400 font-bold">Impostor</span>. Blend in with crewmates.</p>
                <p>Press <kbd className="bg-white/10 px-1 rounded">Q</kbd> near a crewmate to kill.</p>
                <p>Press <kbd className="bg-white/10 px-1 rounded">V</kbd> to open sabotage menu.</p>
                <p>Survive meetings by lying in chat.</p>
              </div>
            )}
          </div>
          <div className="flex-1 flex flex-col p-4 min-h-0">
            <h3 className="font-bold mb-2 flex items-center gap-2"><span>💬</span> Chat</h3>
            <div className="flex-1 overflow-y-auto space-y-1.5 text-xs mb-2 min-h-0">
              {chatMessages.length === 0 ? <p className="text-xs text-white/30">Chat is muted during gameplay (only during meetings).</p> :
                chatMessages.slice(-20).map((m, i) => (<div key={i}><span className="font-bold" style={{ color: m.color }}>{m.name}:</span> <span className="text-white/70">{m.message}</span></div>))}
            </div>
          </div>
        </div>
      </div>

      <div className="hidden md:flex bg-black/40 border-t border-white/10 px-4 py-2 justify-center gap-3">
        {myRole === 'crewmate' && me?.alive && (
          <button onClick={tryUseTask} className="px-5 py-2 bg-yellow-400 text-black font-bold rounded-lg hover:bg-yellow-300 transition-all">Use Task (E)</button>
        )}
        {myRole === 'impostor' && me?.alive && (
          <button onClick={tryKill} disabled={killCooldown > 0} className="px-5 py-2 bg-red-500 text-white font-bold rounded-lg hover:bg-red-400 transition-all disabled:opacity-40">{killCooldown > 0 ? `Kill (${Math.ceil(killCooldown / 1000)}s)` : 'Kill (Q)'}</button>
        )}
        {me?.alive && (
          <>
            <button onClick={tryReport} className="px-5 py-2 bg-orange-500 text-white font-bold rounded-lg hover:bg-orange-400 transition-all">Report (R)</button>
            <button onClick={tryEmergency} className="px-5 py-2 bg-pink-500 text-white font-bold rounded-lg hover:bg-pink-400 transition-all">Emergency (F)</button>
            {room.sabotage?.type && <button onClick={tryFixSabotage} className="px-5 py-2 bg-red-600 text-white font-bold rounded-lg hover:bg-red-500 transition-all animate-pulse">Fix Sabotage (T)</button>}
          </>
        )}
        {myRole === 'impostor' && me?.alive && (
          <>
            <button onClick={() => setShowSabotagePanel(o => !o)} className="px-5 py-2 bg-purple-600 text-white font-bold rounded-lg hover:bg-purple-500 transition-all">Sabotage (V)</button>
            <button onClick={() => setShowVentPanel(o => !o)} className="px-5 py-2 bg-teal-600 text-white font-bold rounded-lg hover:bg-teal-500 transition-all">Vent (G)</button>
          </>
        )}
        <button onClick={() => setShowMap(o => !o)} className="px-5 py-2 bg-white/10 text-white font-bold rounded-lg hover:bg-white/20 transition-all">Map (Tab)</button>
      </div>

      {/* Mobile controls help toggle */}
      <button
        onClick={() => setShowMobileKeys(o => !o)}
        className="md:hidden fixed top-16 right-2 z-20 w-8 h-8 rounded-full bg-black/60 border border-white/20 text-white text-xs"
      >?</button>

      {/* Mobile key binds help overlay */}
      {showMobileKeys && (
        <div className="md:hidden fixed inset-0 z-30 bg-black/90 p-4 flex items-center justify-center" onClick={() => setShowMobileKeys(false)}>
          <div className="bg-zinc-900 border border-white/10 rounded-2xl p-5 max-w-xs w-full" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-3">
              <h3 className="font-bold text-sm">📱 Mobile Controls</h3>
              <button onClick={() => setShowMobileKeys(false)} className="text-white/50 text-xl">✕</button>
            </div>
            <div className="text-xs space-y-2 text-white/70">
              <div className="flex justify-between"><span>🕹️ Left joystick</span><span className="text-white/50">Move</span></div>
              <div className="flex justify-between"><span>👆 Right side drag</span><span className="text-white/50">Rotate camera</span></div>
              <div className="flex justify-between"><span>🟡 TASK button</span><span className="text-white/50">Use task (E)</span></div>
              <div className="flex justify-between"><span>🔴 KILL button</span><span className="text-white/50">Kill (Q)</span></div>
              <div className="flex justify-between"><span>🟠 REPORT button</span><span className="text-white/50">Report body (R)</span></div>
              <div className="flex justify-between"><span>🩷 EMERGENCY button</span><span className="text-white/50">Emergency meeting (F)</span></div>
              <div className="flex justify-between"><span>🔴 FIX SAB button</span><span className="text-white/50">Fix sabotage (T)</span></div>
              <div className="flex justify-between"><span>🟣 SABOTAGE button</span><span className="text-white/50">Sabotage menu (V)</span></div>
              <div className="flex justify-between"><span>⚪ MAP button</span><span className="text-white/50">View map (Tab)</span></div>
            </div>
            <p className="text-xs text-yellow-400/70 mt-3 text-center">Tap anywhere to close</p>
          </div>
        </div>
      )}

      {activeTask && <TaskMiniGame task={activeTask} taskName={activeTask.name} onClose={() => setActiveTask(null)} onComplete={completeTaskMiniGame} />}
      {showSabotagePanel && myRole === 'impostor' && <SabotagePanel activeSabotage={room.sabotage?.type || null} onTrigger={triggerSabotage} onClose={() => setShowSabotagePanel(false)} />}
      {showVentPanel && myRole === 'impostor' && <VentPanel currentVent={findVentNear(me?.x ?? 0, me?.y ?? 0)} onTravel={useVent} onClose={() => setShowVentPanel(false)} />}
      {room.sabotage?.type && room.phase === 'playing' && <SabotageAlert sabotage={room.sabotage} now={now} myPlayer={me} cameraYaw={cameraYawRef.current} />}
      {showMap && <FullScreenMap room={room} myId={myId} myRole={myRole} onClose={() => setShowMap(false)} />}

      {chatOpen && (
        <div className="fixed inset-0 z-30 bg-black/80 flex items-end md:items-center justify-center p-4" onClick={() => setChatOpen(false)}>
          <div className="bg-zinc-900 border border-white/10 rounded-xl w-full max-w-md h-80 flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="p-3 border-b border-white/10 flex justify-between items-center">
              <h3 className="font-bold">Chat</h3>
              <button onClick={() => setChatOpen(false)} className="text-white/50 hover:text-white">✕</button>
            </div>
            <div className="flex-1 overflow-y-auto p-3 space-y-1.5 text-sm">
              {chatMessages.slice(-50).map((m, i) => (<div key={i}><span className="font-bold" style={{ color: m.color }}>{m.name}:</span> <span className="text-white/80">{m.message}</span></div>))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function MobileControls({ onMove, onStop, onAction, myRole, killCooldown, sabotageActive }: {
  onMove: (dx: number, dy: number) => void
  onStop: () => void
  onAction: (a: 'task' | 'kill' | 'report' | 'emergency' | 'fix-sab' | 'sabotage' | 'map' | 'chat') => void
  myRole: Role
  killCooldown: number
  sabotageActive: boolean
}) {
  const [joystick, setJoystick] = useState<{ x: number; y: number; active: boolean }>({ x: 0, y: 0, active: false })
  const baseRef = useRef<HTMLDivElement>(null)
  const handleTouchStart = (e: React.TouchEvent) => {
    e.preventDefault()
    const rect = baseRef.current?.getBoundingClientRect(); if (!rect) return
    const t = e.touches[0]
    setJoystick({ x: t.clientX - rect.left - rect.width / 2, y: t.clientY - rect.top - rect.height / 2, active: true })
    updateMove(t.clientX - rect.left - rect.width / 2, t.clientY - rect.top - rect.height / 2)
  }
  const handleTouchMove = (e: React.TouchEvent) => {
    e.preventDefault()
    const rect = baseRef.current?.getBoundingClientRect(); if (!rect) return
    const t = e.touches[0]
    const dx = t.clientX - rect.left - rect.width / 2, dy = t.clientY - rect.top - rect.height / 2
    setJoystick({ x: dx, y: dy, active: true }); updateMove(dx, dy)
  }
  const handleTouchEnd = () => { setJoystick({ x: 0, y: 0, active: false }); onStop() }
  const updateMove = (dx: number, dy: number) => {
    const len = Math.sqrt(dx * dx + dy * dy)
    if (len < 5) { onStop(); return }
    onMove(dx / len, dy / len)
  }
  return (
    <div className="md:hidden absolute inset-0 pointer-events-none">
      <div ref={baseRef} className="absolute bottom-4 left-4 w-32 h-32 rounded-full bg-white/5 border-2 border-white/20 pointer-events-auto touch-none"
        onTouchStart={handleTouchStart} onTouchMove={handleTouchMove} onTouchEnd={handleTouchEnd}>
        <div className="absolute w-12 h-12 rounded-full bg-yellow-400/80 border-2 border-white" style={{ left: `calc(50% - 24px + ${joystick.x}px)`, top: `calc(50% - 24px + ${joystick.y}px)` }} />
      </div>
      <div className="absolute bottom-4 right-4 grid grid-cols-2 gap-2 pointer-events-auto">
        {myRole === 'crewmate' && <button onClick={() => onAction('task')} className="w-14 h-14 rounded-full bg-yellow-400 text-black font-bold text-xs shadow-lg active:scale-95">TASK</button>}
        {myRole === 'impostor' && <button onClick={() => onAction('kill')} disabled={killCooldown > 0} className="w-14 h-14 rounded-full bg-red-500 text-white font-bold text-xs shadow-lg active:scale-95 disabled:opacity-40">{killCooldown > 0 ? Math.ceil(killCooldown / 1000) + 's' : 'KILL'}</button>}
        <button onClick={() => onAction('report')} className="w-14 h-14 rounded-full bg-orange-500 text-white font-bold text-xs shadow-lg active:scale-95">REPORT</button>
        <button onClick={() => onAction('emergency')} className="w-14 h-14 rounded-full bg-pink-500 text-white font-bold text-[10px] shadow-lg active:scale-95">EMERGENCY</button>
        {sabotageActive && myRole === 'crewmate' && <button onClick={() => onAction('fix-sab')} className="w-14 h-14 rounded-full bg-red-600 text-white font-bold text-[10px] shadow-lg active:scale-95 animate-pulse">FIX SAB</button>}
        {myRole === 'impostor' && <button onClick={() => onAction('sabotage')} className="w-14 h-14 rounded-full bg-purple-600 text-white font-bold text-[10px] shadow-lg active:scale-95">SABOTAGE</button>}
        <button onClick={() => onAction('map')} className="w-14 h-14 rounded-full bg-white/20 text-white font-bold text-xs shadow-lg active:scale-95">MAP</button>
      </div>
    </div>
  )
}

function VentPanel({ currentVent, onTravel, onClose }: { currentVent: any; onTravel: (ventId: string) => void; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-40 bg-black/80 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-zinc-900 border-2 border-teal-500/50 rounded-2xl p-6 w-full max-w-md shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-xl font-black text-teal-300">🌀 Vent Travel</h3>
          <button onClick={onClose} className="text-white/50 hover:text-white text-2xl">✕</button>
        </div>
        {!currentVent ? (
          <p className="text-sm text-white/50 text-center py-4">You must be standing near a vent to travel. Look for vents on the floor (dark teal circles).</p>
        ) : (
          <>
            <p className="text-sm text-teal-300/70 mb-3 text-center">Current vent: <span className="font-bold">{currentVent.room}</span></p>
            <p className="text-xs text-white/50 mb-4 text-center">Select a destination to travel through the vents:</p>
            <div className="space-y-2 max-h-80 overflow-y-auto">
              {VENT_ZONES.filter(v => v.id !== currentVent.id).map(v => (
                <button key={v.id} onClick={() => onTravel(v.id)}
                  className="w-full flex items-center gap-3 p-3 rounded-lg bg-teal-700/40 text-white font-bold hover:bg-teal-600/60 transition-all border border-teal-500/30">
                  <span className="text-2xl">🌀</span>
                  <span>{v.room}</span>
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function SabotagePanel({ activeSabotage, onTrigger, onClose }: { activeSabotage: string | null; onTrigger: (t: SabotageType) => void; onClose: () => void }) {
  const options: { type: SabotageType; name: string; desc: string; icon: string; color: string }[] = [
    { type: 'reactor', name: 'Reactor Meltdown', desc: 'Crew must fix 2 panels in 45s or lose', icon: '☢️', color: 'bg-red-600' },
    { type: 'o2', name: 'Oxygen Depleted', desc: 'Crew must fix 2 panels in 45s or lose', icon: '🫁', color: 'bg-cyan-600' },
    { type: 'lights', name: 'Lights Off', desc: 'Reduces crew visibility until fixed', icon: '💡', color: 'bg-yellow-600' },
    { type: 'comms', name: 'Comms Sabotaged', desc: 'Hides crew task list until fixed', icon: '📡', color: 'bg-purple-600' },
    { type: 'doors', name: 'Lock Doors', desc: 'Doors locked for 10 seconds', icon: '🚪', color: 'bg-gray-700' },
  ]
  return (
    <div className="fixed inset-0 z-40 bg-black/80 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-zinc-900 border-2 border-purple-500/50 rounded-2xl p-6 w-full max-w-md shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-xl font-black text-purple-300">🔪 Sabotage</h3>
          <button onClick={onClose} className="text-white/50 hover:text-white text-2xl">✕</button>
        </div>
        {activeSabotage && <div className="mb-4 p-3 bg-red-500/20 border border-red-500/50 rounded-lg text-sm text-red-300">⚠ A sabotage is already active: <span className="font-bold uppercase">{activeSabotage}</span></div>}
        <div className="space-y-2">
          {options.map(o => (
            <button key={o.type} onClick={() => onTrigger(o.type)} disabled={!!activeSabotage} className={`w-full flex items-center gap-3 p-3 rounded-lg ${o.color} text-white font-bold hover:brightness-125 transition-all disabled:opacity-40 disabled:cursor-not-allowed`}>
              <span className="text-2xl">{o.icon}</span>
              <div className="text-left flex-1"><div>{o.name}</div><div className="text-xs font-normal text-white/80">{o.desc}</div></div>
            </button>
          ))}
        </div>
        <p className="text-xs text-white/40 mt-4 text-center">30s cooldown between sabotages</p>
      </div>
    </div>
  )
}

function SabotageAlert({ sabotage, now, myPlayer, cameraYaw }: { sabotage: SabotageState; now: number; myPlayer: any; cameraYaw: number }) {
  if (!sabotage.type) return null
  const labels: Record<string, { text: string; color: string; icon: string; room: string }> = {
    reactor: { text: 'REACTOR MELTDOWN', color: 'bg-red-600', icon: '☢️', room: 'Reactor' },
    o2:      { text: 'OXYGEN DEPLETED',  color: 'bg-cyan-600', icon: '🫁', room: 'O2 / Admin' },
    lights:  { text: 'LIGHTS OFF',        color: 'bg-yellow-600', icon: '💡', room: 'Electrical' },
    comms:   { text: 'COMMS DOWN',         color: 'bg-purple-600', icon: '📡', room: 'Communications' },
    doors:   { text: 'DOORS LOCKED',       color: 'bg-gray-700', icon: '🚪', room: '—' },
  }
  const info = labels[sabotage.type]
  const timeLeft = sabotage.endTime > 0 ? Math.max(0, Math.ceil((sabotage.endTime - now) / 1000)) : null

  // Find the relevant fix zone(s) for this sabotage type
  const fixZones = SABOTAGE_ZONES.filter(z => z.type === sabotage.type)
  const myX = myPlayer?.x ?? 0, myY = myPlayer?.y ?? 0
  const unfixedZones = fixZones.filter(z => !sabotage.fixedPanelIds.includes(z.id))
  const target = unfixedZones.length > 0 ? unfixedZones.map(z => {
    const cx = z.x + z.w / 2, cy = z.y + z.h / 2
    const dx = cx - myX, dy = cy - myY
    const dist = Math.sqrt(dx * dx + dy * dy)
    return { z, dist, dx, dy }
  }).sort((a, b) => a.dist - b.dist)[0] : null

  // CORRECT direction math:
  // Camera looks in direction (sin(yaw), cos(yaw)). yaw=0 → +Y (north).
  // Target world angle from player = atan2(dy, dx) — standard math angle (0=+X, π/2=+Y).
  // Camera forward angle from +X axis = atan2(cos(yaw), sin(yaw)) = π/2 - yaw.
  // Relative angle (target relative to camera forward) = worldAngle - cameraForwardAngle.
  // On screen, 0° = up (forward), positive = clockwise.
  // atan2 returns counterclockwise from +X, so we convert: screenAngleDeg = relativeRad * 180/π, then negate for clockwise.
  let arrowRotation = 0
  let distance = 0
  let compassDir = ''
  if (target) {
    distance = Math.round(target.dist)
    const worldAngle = Math.atan2(target.dy, target.dx) // radians, CCW from +X
    const camForwardAngle = Math.PI / 2 - cameraYaw // camera forward direction in world angle
    let relative = worldAngle - camForwardAngle // relative angle
    // Convert to degrees and normalize
    let deg = relative * 180 / Math.PI
    // Normalize to [-180, 180]
    deg = ((deg + 180) % 360 + 360) % 360 - 180
    // On screen, arrow points up at 0°. Positive deg = target is to the right (clockwise).
    // CSS rotate positive = clockwise. So arrowRotation = deg.
    arrowRotation = deg
    // Compass direction for text (N/E/S/W relative to camera)
    const absDeg = ((deg % 360) + 360) % 360
    if (absDeg < 22.5 || absDeg >= 337.5) compassDir = '↑ ahead'
    else if (absDeg < 67.5) compassDir = '↗ ahead-right'
    else if (absDeg < 112.5) compassDir = '→ right'
    else if (absDeg < 157.5) compassDir = '↘ behind-right'
    else if (absDeg < 202.5) compassDir = '↓ behind'
    else if (absDeg < 247.5) compassDir = '↙ behind-left'
    else if (absDeg < 292.5) compassDir = '← left'
    else compassDir = '↖ ahead-left'
  }

  return (
    <>
      {/* Top center banner */}
      <div className="fixed top-16 left-1/2 -translate-x-1/2 z-30 pointer-events-none">
        <div className={`${info.color} px-6 py-3 rounded-xl text-white font-black shadow-2xl flex items-center gap-3 animate-pulse`}>
          <span className="text-2xl">{info.icon}</span>
          <div className="text-center">
            <div className="text-sm">{info.text}</div>
            <div className="text-[10px] font-normal opacity-80">Fix at: {info.room}</div>
          </div>
          {timeLeft !== null && <span className="bg-black/40 px-3 py-1 rounded-full text-sm">{timeLeft}s</span>}
          {sabotage.fixRequired > 0 && (
            <span className="bg-black/40 px-3 py-1 rounded-full text-xs">Fixed: {sabotage.fixedPanelIds.length}/{sabotage.fixRequired}</span>
          )}
        </div>
      </div>

      {/* Direction arrow indicator (points toward nearest fix panel) */}
      {target && (
        <div className="fixed top-1/2 left-1/2 z-30 pointer-events-none" style={{ transform: 'translate(-50%, -50%)' }}>
          <div className="relative flex flex-col items-center">
            {/* Pulsing ring */}
            <div className="absolute inset-0 -m-10 rounded-full border-2 border-red-500/40 animate-ping" />
            {/* Arrow rotated to point toward target */}
            <div
              className="w-24 h-24 flex items-center justify-center transition-transform"
              style={{ transform: `rotate(${arrowRotation}deg)` }}
            >
              <svg width="70" height="70" viewBox="0 0 60 60">
                <path d="M30 5 L50 35 L37 35 L37 55 L23 55 L23 35 L10 35 Z" fill="#ef4444" stroke="#fff" strokeWidth="2" />
              </svg>
            </div>
            {/* Distance + direction label (NOT counter-rotated — stays upright) */}
            <div className="mt-2 bg-black/85 text-white text-sm font-bold px-3 py-1.5 rounded-lg border border-red-500/60 whitespace-nowrap text-center">
              <div className="text-red-400">{distance}m {compassDir}</div>
              <div className="text-[10px] text-white/60 font-normal">{target.z.name}</div>
            </div>
          </div>
        </div>
      )}

      {/* All sabotage zones — show mini-indicators around screen edges */}
      {fixZones.map((z) => {
        const cx = z.x + z.w / 2, cy = z.y + z.h / 2
        const dx = cx - myX, dy = cy - myY
        const dist = Math.sqrt(dx * dx + dy * dy)
        if (dist < 100) return null
        const worldAngle = Math.atan2(dy, dx)
        const camForwardAngle = Math.PI / 2 - cameraYaw
        let deg = (worldAngle - camForwardAngle) * 180 / Math.PI
        deg = ((deg + 180) % 360 + 360) % 360 - 180
        const isFixed = sabotage.fixedPanelIds.includes(z.id)
        return (
          <div
            key={z.id}
            className="fixed top-1/2 left-1/2 z-20 pointer-events-none"
            style={{
              transform: `translate(-50%, -50%) rotate(${deg}deg) translateY(-200px)`,
            }}
          >
            <div
              className="px-2 py-1 rounded-full text-[10px] font-bold border whitespace-nowrap"
              style={{ transform: `rotate(${-deg}deg)` }}
            >
              <span className={isFixed ? 'text-green-400' : 'text-red-400'}>
                {isFixed ? '✓' : '🔧'} {z.name} ({Math.round(dist)}m)
              </span>
            </div>
          </div>
        )
      })}
    </>
  )
}

function FullScreenMap({ room, myId, myRole, onClose }: { room: RoomState; myId: string; myRole: Role; onClose: () => void }) {
  const me = room.players.find(p => p.id === myId)
  const completedIds: string[] = (me as any)?.completedTaskIds || []
  return (
    <div className="fixed inset-0 z-40 bg-black/95 p-4 flex items-center justify-center" onClick={onClose}>
      <div className="bg-zinc-900 border border-white/10 rounded-2xl p-4 max-w-6xl w-full max-h-[95vh] overflow-auto" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-3">
          <div>
            <h3 className="font-bold text-lg">🗺️ Map · All Tasks</h3>
            <p className="text-xs text-white/50">Yellow = task available · Green ✓ = completed · Red = sabotage panel · 🔴 = emergency button</p>
          </div>
          <button onClick={onClose} className="text-white/50 hover:text-white text-2xl">✕</button>
        </div>
        <svg viewBox="0 0 2400 1600" className="w-full" style={{ maxHeight: '80vh' }}>
          {/* Rooms */}
          {ROOMS.map((r, i) => (
            <g key={i}>
              <rect x={r.x} y={r.y} width={r.w} height={r.h} fill="#1f2937" stroke="rgba(255,255,255,0.25)" strokeWidth="3" />
              <text x={r.x + r.w / 2} y={r.y + 20} fill="rgba(255,255,255,0.7)" fontSize="18" textAnchor="middle" fontWeight="bold">{r.name}</text>
            </g>
          ))}
          {/* Corridors */}
          {CORRIDORS.map((c, i) => (<rect key={i} x={c.x} y={c.y} width={c.w} height={c.h} fill="#161620" stroke="rgba(255,255,255,0.1)" strokeWidth="1" />))}
          {/* Task zones — show completion status (crewmates only) */}
          {myRole === 'crewmate' && TASK_ZONES.map((t) => {
            const done = completedIds.includes(t.id)
            return (
              <g key={t.id}>
                <rect
                  x={t.x} y={t.y} width={t.w} height={t.h}
                  fill={done ? '#22c55e' : '#facc15'}
                  opacity="0.8"
                  stroke={done ? '#16a34a' : '#ca8a04'}
                  strokeWidth="2"
                  rx="6"
                />
                <text x={t.x + t.w / 2} y={t.y + t.h / 2 + 5} fill="#000" fontSize="12" textAnchor="middle" fontWeight="bold">
                  {done ? '✓' : '⚡'}
                </text>
              </g>
            )
          })}
          {/* Impostors see task zones as gray (don't know completion) */}
          {myRole === 'impostor' && TASK_ZONES.map((t) => (
            <rect key={t.id} x={t.x} y={t.y} width={t.w} height={t.h} fill="#666" opacity="0.4" stroke="#444" strokeWidth="1" rx="4" />
          ))}
          {/* Sabotage fix zones — highlighted when sabotage active */}
          {SABOTAGE_ZONES.map((z) => {
            const isActive = room.sabotage?.type === z.type && !room.sabotage.fixedPanelIds.includes(z.id)
            const isFixed = room.sabotage?.type === z.type && room.sabotage.fixedPanelIds.includes(z.id)
            return (
              <g key={z.id}>
                {/* Pulsing outer ring when active */}
                {isActive && (
                  <circle
                    cx={z.x + z.w / 2} cy={z.y + z.h / 2}
                    r={Math.max(z.w, z.h) / 2 + 12 + Math.sin(Date.now() / 200) * 4}
                    fill="none" stroke="#ef4444" strokeWidth="3" opacity="0.6"
                  />
                )}
                <rect
                  x={z.x} y={z.y} width={z.w} height={z.h}
                  fill={isFixed ? '#22c55e' : isActive ? '#ef4444' : '#666'}
                  opacity={isActive ? 0.95 : 0.5}
                  stroke={isFixed ? '#16a34a' : isActive ? '#fff' : '#dc2626'}
                  strokeWidth={isActive ? 3 : 2}
                  rx="4"
                />
                <text x={z.x + z.w / 2} y={z.y + z.h / 2 + 4} fill="#fff" fontSize="10" textAnchor="middle" fontWeight="bold">
                  {isFixed ? '✓' : isActive ? '!' : '🔧'}
                </text>
                {isActive && (
                  <text x={z.x + z.w / 2} y={z.y - 4} fill="#ef4444" fontSize="11" textAnchor="middle" fontWeight="bold">
                    FIX HERE
                  </text>
                )}
              </g>
            )
          })}
          {/* Emergency button */}
          <circle cx={EMERGENCY_BUTTON.x + EMERGENCY_BUTTON.w / 2} cy={EMERGENCY_BUTTON.y + EMERGENCY_BUTTON.h / 2} r="18" fill="#dc2626" stroke="#fff" strokeWidth="2" />
          <text x={EMERGENCY_BUTTON.x + EMERGENCY_BUTTON.w / 2} y={EMERGENCY_BUTTON.y + EMERGENCY_BUTTON.h / 2 + 5} fill="#fff" fontSize="14" textAnchor="middle" fontWeight="bold">!</text>
          {/* Players */}
          {room.players.filter(p => { if (p.id === myId) return true; if (!p.alive) return true; if (myRole === 'impostor' && p.role === 'impostor') return true; return false }).map(p => (
            <g key={p.id}>
              <circle cx={p.x} cy={p.y} r="12" fill={p.color} stroke="#000" strokeWidth="2" />
              {p.id === myId && <circle cx={p.x} cy={p.y} r="18" fill="none" stroke="#fff" strokeWidth="3" />}
              {!p.alive && <text x={p.x} y={p.y + 5} fill="#fff" fontSize="16" textAnchor="middle">💀</text>}
            </g>
          ))}
        </svg>
        {/* Task legend / list */}
        {myRole === 'crewmate' && (
          <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
            {TASK_ZONES.map((t) => {
              const done = completedIds.includes(t.id)
              return (
                <div key={t.id} className={`flex items-center gap-2 p-1.5 rounded ${done ? 'bg-green-500/10 text-green-400 line-through' : 'bg-yellow-500/10 text-yellow-400'}`}>
                  <span>{done ? '✓' : '⚡'}</span>
                  <span className="truncate">{t.name} <span className="text-white/40">({t.room})</span></span>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
