'use client'
import { useState, useEffect, useRef } from 'react'
import type { TaskZone } from '@/lib/amongus-map'
import { sounds } from '@/lib/sounds'

interface Props {
  task: TaskZone
  taskName: string
  onClose: () => void
  onComplete: () => void
}

export function TaskMiniGame({ task, taskName, onClose, onComplete }: Props) {
  const type = task.type || 'wires'
  return (
    <div className="fixed inset-0 z-40 bg-black/85 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-zinc-900 border-2 border-yellow-400/50 rounded-2xl p-6 w-full max-w-lg shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex justify-between items-center mb-4">
          <div>
            <h3 className="text-xl font-black">{taskName}</h3>
            <p className="text-xs text-white/50">{task.room} · <span className="text-yellow-400 uppercase">{type}</span></p>
          </div>
          <button onClick={onClose} className="text-white/50 hover:text-white text-2xl leading-none">✕</button>
        </div>
        {type === 'wires' && <WiresGame onComplete={onComplete} />}
        {type === 'swipe' && <SwipeGame onComplete={onComplete} />}
        {type === 'asteroids' && <AsteroidsGame onComplete={onComplete} />}
        {type === 'numbers' && <NumbersGame onComplete={onComplete} />}
        {type === 'progressbar' && <ProgressGame onComplete={onComplete} />}
        {type === 'memory' && <MemoryGame onComplete={onComplete} />}
        {type === 'dial' && <DialGame onComplete={onComplete} />}
        {type === 'timing' && <TimingGame onComplete={onComplete} />}
        {type === 'sliding' && <SlidingGame onComplete={onComplete} />}
        {type === 'simon' && <SimonGame onComplete={onComplete} />}
      </div>
    </div>
  )
}

function WiresGame({ onComplete }: { onComplete: () => void }) {
  const COLORS = ['#ef4444', '#22c55e', '#3b82f6', '#eab308']
  const [wires, setWires] = useState(() => COLORS.map(c => ({ color: c, to: null as number | null })))
  const [shuffledTo] = useState(() => [0, 1, 2, 3].sort(() => Math.random() - 0.5))
  const [connecting, setConnecting] = useState<number | null>(null)
  const onConnect = (fromIdx: number, toPos: number) => {
    if (wires[fromIdx].color === wires[shuffledTo[toPos]].color) {
      setWires(prev => prev.map((w, i) => i === fromIdx ? { ...w, to: toPos } : w))
      setConnecting(null)
      sounds.wireConnect()
    } else setConnecting(null)
  }
  const done = wires.every(w => w.to !== null)
  return (
    <>
      <p className="text-sm text-white/70 mb-4">Connect matching colored wires.</p>
      <div className="grid grid-cols-2 gap-8 py-4">
        <div className="space-y-4">
          {wires.map((w, i) => (
            <button key={i} onClick={() => setConnecting(i)} className={`w-full h-10 rounded-lg border-2 ${connecting === i ? 'border-white scale-105' : 'border-transparent'}`} style={{ background: w.color }}>{w.to !== null ? '✓' : ''}</button>
          ))}
        </div>
        <div className="space-y-4">
          {shuffledTo.map((origIdx, posIdx) => {
            const wire = wires[origIdx]; const taken = wires.some(w => w.to === posIdx)
            return <button key={posIdx} onClick={() => connecting !== null && onConnect(connecting, posIdx)} className={`w-full h-10 rounded-lg border-2 border-dashed ${taken ? 'opacity-30' : 'border-white/40 hover:border-white'}`} style={{ background: taken ? wire.color : 'transparent' }} />
          })}
        </div>
      </div>
      {done && <button onClick={onComplete} className="w-full mt-4 py-3 bg-green-500 text-white font-black rounded-lg hover:bg-green-400 transition-all">✓ TASK COMPLETE</button>}
    </>
  )
}

function SwipeGame({ onComplete }: { onComplete: () => void }) {
  const [position, setPosition] = useState(0)
  const [dragging, setDragging] = useState(false)
  const [status, setStatus] = useState<'idle' | 'too-slow' | 'too-fast' | 'success' | null>(null)
  const trackRef = useRef<HTMLDivElement>(null)
  const handleDown = (e: React.MouseEvent | React.TouchEvent) => { if (status === 'success') return; setDragging(true); setStatus('idle') }
  const handleMove = (e: React.MouseEvent | React.TouchEvent) => {
    if (!dragging || !trackRef.current) return
    const rect = trackRef.current.getBoundingClientRect()
    const clientX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX
    setPosition(Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100)))
  }
  const handleUp = () => {
    if (!dragging) return
    setDragging(false)
    if (position > 95) { setStatus('success'); sounds.swipeSuccess(); setTimeout(onComplete, 800) }
    else { setStatus('too-slow'); sounds.warning(); setTimeout(() => setPosition(0), 500) }
  }
  return (
    <>
      <p className="text-sm text-white/70 mb-2">Swipe the card from left to right in one smooth motion.</p>
      <div ref={trackRef} className="relative w-full h-16 bg-black/50 rounded-lg border-2 border-white/20 mb-4 select-none" onMouseMove={handleMove} onMouseUp={handleUp} onMouseLeave={handleUp} onTouchMove={handleMove} onTouchEnd={handleUp}>
        <div className="absolute inset-y-0 left-0 flex items-center pl-3 text-white/40 text-xs">SWIPE →</div>
        <div className={`absolute top-1 bottom-1 w-14 rounded-md cursor-grab ${dragging ? 'cursor-grabbing' : ''} flex items-center justify-center font-bold text-xs`}
          style={{ left: `calc(${position}% - 28px + 4px)`, background: status === 'success' ? '#22c55e' : status === 'too-slow' ? '#ef4444' : '#facc15', color: '#000', transition: dragging ? 'none' : 'left 0.3s ease' }}
          onMouseDown={handleDown} onTouchStart={handleDown}>CARD</div>
      </div>
      {status === 'too-slow' && <p className="text-red-400 text-sm">Try again, drag fully across.</p>}
      {status === 'success' && <p className="text-green-400 text-sm font-bold">✓ Card accepted!</p>}
    </>
  )
}

function AsteroidsGame({ onComplete }: { onComplete: () => void }) {
  const [asteroids, setAsteroids] = useState<{ id: number; x: number; y: number; speed: number }[]>([])
  const [destroyed, setDestroyed] = useState(0)
  const target = 8
  const nextIdRef = useRef(0)
  useEffect(() => {
    if (destroyed >= target) { const t = setTimeout(onComplete, 600); return () => clearTimeout(t) }
    const spawn = setInterval(() => {
      if (asteroids.length >= 6) return
      const id = nextIdRef.current++
      setAsteroids(prev => [...prev, { id, x: 5 + Math.random() * 90, y: 0, speed: 0.5 + Math.random() * 0.8 }])
    }, 800)
    return () => clearInterval(spawn)
  }, [asteroids.length, destroyed, onComplete])
  useEffect(() => {
    if (destroyed >= target) return
    const move = setInterval(() => {
      setAsteroids(prev => prev.map(a => ({ ...a, y: a.y + a.speed })).filter(a => a.y < 100))
    }, 50)
    return () => clearInterval(move)
  }, [destroyed])
  const destroy = (id: number) => { setAsteroids(prev => prev.filter(a => a.id !== id)); setDestroyed(d => d + 1); sounds.asteroidHit() }
  return (
    <>
      <p className="text-sm text-white/70 mb-2">Click asteroids to destroy them!</p>
      <p className="text-xs text-white/40 mb-4">Destroyed: <span className="text-yellow-400 font-bold">{destroyed}</span> / {target}</p>
      <div className="relative w-full h-72 bg-black/60 rounded-lg border-2 border-white/20 overflow-hidden">
        <div className="absolute inset-0">
          {Array.from({ length: 30 }).map((_, i) => (<div key={i} className="absolute w-0.5 h-0.5 bg-white" style={{ top: `${(i * 13) % 100}%`, left: `${(i * 37) % 100}%` }} />))}
        </div>
        {asteroids.map(a => (
          <button key={a.id} onClick={() => destroy(a.id)} className="absolute w-8 h-8 rounded-full bg-orange-700 border-2 border-orange-500 hover:bg-orange-500 transition-colors"
            style={{ left: `${a.x}%`, top: `${a.y}%`, transform: 'translate(-50%, -50%)', boxShadow: '0 0 8px rgba(249, 115, 22, 0.5)' }} />
        ))}
      </div>
      {destroyed >= target && <p className="text-green-400 text-sm font-bold mt-3 text-center">All asteroids destroyed!</p>}
    </>
  )
}

function NumbersGame({ onComplete }: { onComplete: () => void }) {
  const [sequence] = useState(() => Array.from({ length: 5 }, () => Math.floor(Math.random() * 10)))
  const [showing, setShowing] = useState(true)
  const [input, setInput] = useState('')
  const [status, setStatus] = useState<'idle' | 'wrong' | 'correct'>('idle')
  useEffect(() => { const t = setTimeout(() => setShowing(false), 3000); return () => clearTimeout(t) }, [])
  const submit = () => {
    if (input === sequence.join('')) { setStatus('correct'); sounds.swipeSuccess(); setTimeout(onComplete, 800) }
    else { setStatus('wrong'); sounds.warning(); setInput('') }
  }
  return (
    <>
      <p className="text-sm text-white/70 mb-2">Memorize the security code, then enter it.</p>
      <p className="text-xs text-white/40 mb-4">{showing ? 'Memorize...' : 'Enter the code you saw'}</p>
      <div className="bg-black/50 rounded-lg p-8 mb-4 text-center">
        {showing ? <div className="text-4xl font-mono font-black tracking-widest text-yellow-400">{sequence.join(' ')}</div>
          : <div className="text-4xl font-mono font-black tracking-widest text-white/30">• • • • •</div>}
      </div>
      {!showing && (
        <>
          <input value={input} onChange={e => setInput(e.target.value.replace(/[^0-9]/g, '').slice(0, 5))} onKeyDown={e => e.key === 'Enter' && submit()}
            placeholder="Enter 5-digit code" className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-3 text-white text-center font-mono text-2xl tracking-widest focus:outline-none focus:border-yellow-400 mb-3" autoFocus />
          <button onClick={submit} disabled={input.length !== 5} className="w-full py-3 bg-yellow-400 text-black font-black rounded-lg hover:bg-yellow-300 transition-all disabled:opacity-40">SUBMIT</button>
        </>
      )}
      {status === 'wrong' && <p className="text-red-400 text-sm mt-3">Incorrect! Try again.</p>}
      {status === 'correct' && <p className="text-green-400 text-sm mt-3 font-bold">✓ Code accepted!</p>}
    </>
  )
}

function ProgressGame({ onComplete }: { onComplete: () => void }) {
  const [progress, setProgress] = useState(0)
  const [holding, setHolding] = useState(false)
  const [errors, setErrors] = useState(0)
  useEffect(() => {
    const i = setInterval(() => {
      if (holding && errors < 3) {
        setProgress(p => {
          const next = p + 1.5
          if (next >= 100) { clearInterval(i); setTimeout(onComplete, 500); return 100 }
          return next
        })
      }
    }, 30)
    const e = setInterval(() => { if (holding && Math.random() < 0.15) { setErrors(e => e + 1); setHolding(false); setProgress(p => Math.max(0, p - 10)); sounds.warning() } }, 500)
    return () => { clearInterval(i); clearInterval(e) }
  }, [holding, errors, onComplete])
  return (
    <>
      <p className="text-sm text-white/70 mb-2">Hold the button to download data.</p>
      <p className="text-xs text-white/40 mb-4">Don't let errors hit 3.</p>
      <div className="w-full h-6 bg-black/50 rounded-full overflow-hidden border border-white/10 mb-3">
        <div className="h-full transition-all" style={{ width: `${progress}%`, background: errors >= 2 ? '#ef4444' : 'linear-gradient(to right, #22c55e, #06b6d4)' }} />
      </div>
      <div className="flex justify-between text-xs mb-4">
        <span className="text-white/60">{Math.floor(progress)}%</span>
        <span className={errors >= 2 ? 'text-red-400 font-bold' : 'text-white/60'}>Errors: {errors}/3</span>
      </div>
      <button onMouseDown={() => errors < 3 && setHolding(true)} onMouseUp={() => setHolding(false)} onMouseLeave={() => setHolding(false)}
        onTouchStart={() => errors < 3 && setHolding(true)} onTouchEnd={() => setHolding(false)}
        className={`w-full py-6 rounded-lg font-black text-lg transition-all select-none ${holding ? 'bg-cyan-400 text-black scale-95' : errors >= 3 ? 'bg-red-500/30 text-red-300 cursor-not-allowed' : 'bg-cyan-500/30 text-cyan-300 hover:bg-cyan-500/50'}`}
        disabled={errors >= 3 || progress >= 100}>
        {progress >= 100 ? '✓ DOWNLOAD COMPLETE' : holding ? 'DOWNLOADING...' : 'HOLD TO DOWNLOAD'}
      </button>
      {errors >= 3 && <button onClick={() => { setErrors(0); setProgress(0) }} className="w-full mt-3 py-2 bg-white/10 rounded-lg text-sm">Retry</button>}
    </>
  )
}

function MemoryGame({ onComplete }: { onComplete: () => void }) {
  const COLORS = [{ id: 0, color: '#ef4444' }, { id: 1, color: '#22c55e' }, { id: 2, color: '#3b82f6' }, { id: 3, color: '#eab308' }]
  const [sequence] = useState(() => Array.from({ length: 4 }, () => Math.floor(Math.random() * 4)))
  const [showing, setShowing] = useState(true)
  const [activeIdx, setActiveIdx] = useState<number | null>(null)
  const [step, setStep] = useState(0)
  const [status, setStatus] = useState<'idle' | 'wrong' | 'correct'>('idle')
  useEffect(() => {
    if (!showing) return
    let i = 0
    const interval = setInterval(() => {
      setActiveIdx(sequence[i]); sounds.memoryBeep(sequence[i]); setTimeout(() => setActiveIdx(null), 400); i++
      if (i >= sequence.length) { clearInterval(interval); setTimeout(() => setShowing(false), 600) }
    }, 700)
    return () => clearInterval(interval)
  }, [showing, sequence])
  const handleClick = (id: number) => {
    if (showing) return
    sounds.memoryBeep(id)
    if (id === sequence[step]) {
      setActiveIdx(id); setTimeout(() => setActiveIdx(null), 200)
      const next = step + 1
      if (next >= sequence.length) { setStatus('correct'); sounds.swipeSuccess(); setTimeout(onComplete, 800) }
      else setStep(next)
    } else { setStatus('wrong'); sounds.warning(); setStep(0); setTimeout(() => setStatus('idle'), 1000) }
  }
  return (
    <>
      <p className="text-sm text-white/70 mb-2">Watch the sequence, then repeat it.</p>
      <p className="text-xs text-white/40 mb-4">{showing ? 'Watch carefully...' : status === 'correct' ? 'Perfect!' : status === 'wrong' ? 'Wrong! Watch again.' : `Step ${step + 1} of ${sequence.length}`}</p>
      <div className="grid grid-cols-2 gap-3 py-4">
        {COLORS.map(c => (
          <button key={c.id} onClick={() => handleClick(c.id)} disabled={showing} className="aspect-square rounded-xl transition-all"
            style={{ background: c.color, opacity: activeIdx === c.id ? 1 : 0.4, transform: activeIdx === c.id ? 'scale(1.05)' : 'scale(1)', boxShadow: activeIdx === c.id ? `0 0 30px ${c.color}` : 'none' }} />
        ))}
      </div>
      {status === 'wrong' && <button onClick={() => { setShowing(true); setStep(0); setStatus('idle') }} className="w-full mt-2 py-2 bg-white/10 rounded-lg text-sm hover:bg-white/20">Watch again</button>}
    </>
  )
}

// ============ 7. DIAL — rotate dial to match target angle ============
function DialGame({ onComplete }: { onComplete: () => void }) {
  const [target] = useState(() => Math.floor(Math.random() * 360))
  const [angle, setAngle] = useState(0)
  const [dragging, setDragging] = useState(false)
  const dialRef = useRef<HTMLDivElement>(null)
  const startAngleRef = useRef(0)
  const startMouseRef = useRef(0)

  const getAngle = (e: React.MouseEvent | React.TouchEvent) => {
    if (!dialRef.current) return 0
    const rect = dialRef.current.getBoundingClientRect()
    const cx = rect.left + rect.width / 2
    const cy = rect.top + rect.height / 2
    const clientX = 'touches' in e ? e.touches[0].clientX : (e as React.MouseEvent).clientX
    const clientY = 'touches' in e ? e.touches[0].clientY : (e as React.MouseEvent).clientY
    return Math.atan2(clientY - cy, clientX - cx) * 180 / Math.PI
  }

  const handleDown = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault()
    setDragging(true)
    startAngleRef.current = getAngle(e)
    startMouseRef.current = angle
  }
  const handleMove = (e: React.MouseEvent | React.TouchEvent) => {
    if (!dragging) return
    e.preventDefault()
    const currentAngle = getAngle(e)
    const delta = currentAngle - startAngleRef.current
    setAngle((startMouseRef.current + delta + 360) % 360)
  }
  const handleUp = () => setDragging(false)

  const diff = Math.min(Math.abs(angle - target), 360 - Math.abs(angle - target))
  const done = diff < 8

  useEffect(() => { if (done) { sounds.swipeSuccess(); setTimeout(onComplete, 600) } }, [done, onComplete])

  return (
    <>
      <p className="text-sm text-white/70 mb-2">Rotate the dial to match the target angle.</p>
      <div className="flex items-center justify-around mb-4">
        <div className="text-center">
          <div className="text-xs text-white/50 mb-1">Target</div>
          <div className="text-3xl font-mono font-bold text-yellow-400">{target}°</div>
        </div>
        <div className="text-center">
          <div className="text-xs text-white/50 mb-1">Current</div>
          <div className={`text-3xl font-mono font-bold ${done ? 'text-green-400' : 'text-white'}`}>{Math.round(angle)}°</div>
        </div>
      </div>
      <div
        ref={dialRef}
        className="relative w-48 h-48 mx-auto rounded-full border-4 border-white/30 bg-black/40 cursor-grab active:cursor-grabbing mb-4"
        onMouseDown={handleDown}
        onMouseMove={handleMove}
        onMouseUp={handleUp}
        onMouseLeave={handleUp}
        onTouchStart={handleDown}
        onTouchMove={handleMove}
        onTouchEnd={handleUp}
      >
        {/* Target marker */}
        <div
          className="absolute w-1 h-6 bg-yellow-400"
          style={{
            left: '50%',
            top: '8px',
            transformOrigin: '50% 88px',
            transform: `rotate(${target}deg)`,
          }}
        />
        {/* Dial pointer */}
        <div
          className="absolute w-1.5 h-20 bg-red-500"
          style={{
            left: 'calc(50% - 3px)',
            top: '24px',
            transformOrigin: '50% 72px',
            transform: `rotate(${angle}deg)`,
          }}
        />
        <div className="absolute inset-0 flex items-center justify-center text-xs text-white/40">DRAG</div>
      </div>
      {done && <p className="text-green-400 text-center font-bold">✓ Dial aligned!</p>}
    </>
  )
}

// ============ 8. TIMING — press button when marker is in green zone ============
function TimingGame({ onComplete }: { onComplete: () => void }) {
  const [position, setPosition] = useState(0)
  const [status, setStatus] = useState<'playing' | 'hit' | 'miss'>('playing')
  const [zone] = useState(() => ({ start: 35 + Math.random() * 20, size: 18 }))
  const rafRef = useRef<number>(0)

  useEffect(() => {
    if (status !== 'playing') return
    const animate = () => {
      rafRef.current = requestAnimationFrame(animate)
      setPosition(p => (p + 1.5) % 100)
    }
    rafRef.current = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(rafRef.current)
  }, [status])

  const tryHit = () => {
    if (status !== 'playing') return
    if (position >= zone.start && position <= zone.start + zone.size) {
      setStatus('hit'); sounds.swipeSuccess(); setTimeout(onComplete, 700)
    } else {
      setStatus('miss'); sounds.warning(); setTimeout(() => setStatus('playing'), 600)
    }
  }

  return (
    <>
      <p className="text-sm text-white/70 mb-2">Press the button when the marker is in the green zone.</p>
      <div className="relative w-full h-10 bg-black/50 rounded-lg border-2 border-white/20 mb-4 overflow-hidden">
        {/* Green zone */}
        <div
          className="absolute inset-y-0 bg-green-500/40 border-x-2 border-green-400"
          style={{ left: `${zone.start}%`, width: `${zone.size}%` }}
        />
        {/* Marker */}
        <div
          className="absolute inset-y-0 w-1 bg-red-500"
          style={{ left: `${position}%` }}
        />
      </div>
      <button
        onClick={tryHit}
        disabled={status !== 'playing'}
        className={`w-full py-6 rounded-lg font-black text-lg transition-all ${status === 'hit' ? 'bg-green-500 text-white' : status === 'miss' ? 'bg-red-500 text-white' : 'bg-yellow-400 text-black hover:bg-yellow-300'}`}
      >
        {status === 'hit' ? '✓ PERFECT!' : status === 'miss' ? '✗ MISS!' : 'PRESS NOW!'}
      </button>
    </>
  )
}

// ============ 9. SLIDING — slide tiles to arrange numbers 1-8 ============
function getNeighbors(idx: number): number[] {
  const row = Math.floor(idx / 3), col = idx % 3
  const n = []
  if (row > 0) n.push(idx - 3)
  if (row < 2) n.push(idx + 3)
  if (col > 0) n.push(idx - 1)
  if (col < 2) n.push(idx + 1)
  return n
}

function SlidingGame({ onComplete }: { onComplete: () => void }) {
  // 3x3 puzzle, one tile empty
  const [tiles, setTiles] = useState<number[]>(() => {
    let arr = [1, 2, 3, 4, 5, 6, 7, 8, 0]
    // Shuffle with valid moves
    for (let i = 0; i < 50; i++) {
      const emptyIdx = arr.indexOf(0)
      const neighbors = getNeighbors(emptyIdx)
      const swapIdx = neighbors[Math.floor(Math.random() * neighbors.length)]
      ;[arr[emptyIdx], arr[swapIdx]] = [arr[swapIdx], arr[emptyIdx]]
    }
    return arr
  })

  const move = (idx: number) => {
    const emptyIdx = tiles.indexOf(0)
    if (getNeighbors(idx).includes(emptyIdx)) {
      const newTiles = [...tiles]
      ;[newTiles[idx], newTiles[emptyIdx]] = [newTiles[emptyIdx], newTiles[idx]]
      setTiles(newTiles)
      sounds.click()
    }
  }

  const done = tiles.every((t, i) => t === (i + 1) % 9)
  useEffect(() => { if (done) { sounds.swipeSuccess(); setTimeout(onComplete, 700) } }, [done, onComplete])

  return (
    <>
      <p className="text-sm text-white/70 mb-4">Slide tiles to arrange 1-8 in order.</p>
      <div className="grid grid-cols-3 gap-1 w-48 mx-auto bg-black/40 p-1 rounded-lg border border-white/20 mb-4">
        {tiles.map((t, i) => (
          <button
            key={i}
            onClick={() => t !== 0 && move(i)}
            className={`aspect-square rounded font-black text-2xl transition-all ${t === 0 ? 'bg-transparent' : 'bg-yellow-400 text-black hover:bg-yellow-300'}`}
            disabled={t === 0}
          >
            {t !== 0 ? t : ''}
          </button>
        ))}
      </div>
      {done && <p className="text-green-400 text-center font-bold">✓ Puzzle solved!</p>}
    </>
  )
}

// ============ 10. SIMON — longer sequences, 4 colors, harder than memory ============
function SimonGame({ onComplete }: { onComplete: () => void }) {
  const COLORS = [
    { id: 0, color: '#ef4444', name: 'Red' },
    { id: 1, color: '#22c55e', name: 'Green' },
    { id: 2, color: '#3b82f6', name: 'Blue' },
    { id: 3, color: '#eab308', name: 'Yellow' },
  ]
  const [sequence, setSequence] = useState<number[]>(() => Array.from({ length: 5 }, () => Math.floor(Math.random() * 4)))
  const [showing, setShowing] = useState(true)
  const [activeIdx, setActiveIdx] = useState<number | null>(null)
  const [step, setStep] = useState(0)
  const [status, setStatus] = useState<'idle' | 'wrong' | 'correct'>('idle')

  useEffect(() => {
    if (!showing) return
    let i = 0
    const interval = setInterval(() => {
      setActiveIdx(sequence[i]); sounds.memoryBeep(sequence[i]); setTimeout(() => setActiveIdx(null), 350); i++
      if (i >= sequence.length) { clearInterval(interval); setTimeout(() => setShowing(false), 500) }
    }, 600)
    return () => clearInterval(interval)
  }, [showing, sequence])

  const handleClick = (id: number) => {
    if (showing) return
    sounds.memoryBeep(id)
    if (id === sequence[step]) {
      setActiveIdx(id); setTimeout(() => setActiveIdx(null), 150)
      const next = step + 1
      if (next >= sequence.length) { setStatus('correct'); sounds.swipeSuccess(); setTimeout(onComplete, 800) }
      else setStep(next)
    } else { setStatus('wrong'); sounds.warning(); setStep(0); setTimeout(() => { setStatus('idle'); setShowing(true) }, 1000) }
  }

  return (
    <>
      <p className="text-sm text-white/70 mb-2">Simon Says — repeat the 5-step sequence.</p>
      <p className="text-xs text-white/40 mb-4">{showing ? 'Watch carefully...' : status === 'correct' ? 'Perfect!' : status === 'wrong' ? 'Wrong! Watch again.' : `Step ${step + 1} of ${sequence.length}`}</p>
      <div className="grid grid-cols-2 gap-3 py-2 max-w-xs mx-auto">
        {COLORS.map(c => (
          <button
            key={c.id}
            onClick={() => handleClick(c.id)}
            disabled={showing}
            className="aspect-square rounded-xl transition-all"
            style={{
              background: c.color,
              opacity: activeIdx === c.id ? 1 : 0.35,
              transform: activeIdx === c.id ? 'scale(1.08)' : 'scale(1)',
              boxShadow: activeIdx === c.id ? `0 0 40px ${c.color}` : 'none',
            }}
          />
        ))}
      </div>
      {status === 'wrong' && <p className="text-red-400 text-center text-sm mt-2">Wrong! Restarting...</p>}
    </>
  )
}
