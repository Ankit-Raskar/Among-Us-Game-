'use client'
import { useState } from 'react'
import { COLORS } from '@/lib/amongus-map'

interface Props {
  onCreate: (name: string, color: string) => void
  onJoin: (code: string, name: string, color: string) => void
}

export function HomeScreen({ onCreate, onJoin }: Props) {
  const [tab, setTab] = useState<'create' | 'join'>('create')
  const [name, setName] = useState('')
  const [color, setColor] = useState(COLORS[0])
  const [joinCode, setJoinCode] = useState('')
  const valid = name.trim().length >= 2 && name.trim().length <= 14

  return (
    <div className="min-h-screen w-full flex items-start sm:items-center justify-center p-4 relative overflow-y-auto"
      style={{ minHeight: '100dvh', WebkitOverflowScrolling: 'touch' }}>
      {/* Starfield background */}
      <div className="absolute inset-0 pointer-events-none">
        {Array.from({ length: 80 }).map((_, i) => (
          <div key={i} className="absolute rounded-full bg-white opacity-70"
            style={{ width: Math.random() * 3 + 'px', height: Math.random() * 3 + 'px',
              top: Math.random() * 100 + '%', left: Math.random() * 100 + '%',
              animation: `twinkle ${2 + Math.random() * 3}s ease-in-out infinite` }} />
        ))}
      </div>
      <style>{`@keyframes twinkle { 0%,100%{opacity:0.2} 50%{opacity:1} } @keyframes float { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-8px)} }`}</style>

      <div className="relative z-10 w-full max-w-md my-auto py-4">
        {/* Logo */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-28 h-28 rounded-3xl mb-3"
            style={{ background: color, animation: 'float 3s ease-in-out infinite', boxShadow: `0 8px 40px ${color}80` }}>
            <svg viewBox="0 0 64 64" className="w-20 h-20">
              <ellipse cx="32" cy="34" rx="22" ry="24" fill="#fef3c7" />
              <rect x="18" y="14" width="28" height="14" rx="4" fill="#3b82f6" />
              <rect x="22" y="17" width="10" height="6" rx="2" fill="#93c5fd" />
              <ellipse cx="20" cy="56" rx="6" ry="4" fill="#fbbf24" />
              <ellipse cx="44" cy="56" rx="6" ry="4" fill="#fbbf24" />
              <rect x="46" y="36" width="8" height="14" rx="3" fill="#fbbf24" />
            </svg>
          </div>
          <h1 className="text-4xl sm:text-5xl font-black tracking-tight">AMONG <span className="text-yellow-400">US</span></h1>
          <p className="text-sm text-white/60 mt-1">3D Multiplayer · Play with friends by room code</p>
        </div>

        {/* Main card */}
        <div className="bg-white/5 backdrop-blur-md rounded-2xl border border-white/10 p-5 sm:p-6 shadow-2xl">
          {/* Tabs */}
          <div className="flex gap-2 mb-5 bg-black/30 p-1 rounded-lg">
            <button onClick={() => setTab('create')}
              className={`flex-1 py-3 rounded-md text-sm font-bold transition-all ${tab === 'create' ? 'bg-yellow-400 text-black' : 'text-white/70 hover:text-white'}`}>CREATE</button>
            <button onClick={() => setTab('join')}
              className={`flex-1 py-3 rounded-md text-sm font-bold transition-all ${tab === 'join' ? 'bg-yellow-400 text-black' : 'text-white/70 hover:text-white'}`}>JOIN</button>
          </div>

          {/* Name input */}
          <label className="block text-xs font-bold text-white/60 mb-2 uppercase">Your Nickname</label>
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Enter name (2-14 chars)" maxLength={14}
            autoComplete="off" autoCorrect="off" autoCapitalize="off" spellCheck={false}
            className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-4 text-white text-base placeholder-white/30 focus:outline-none focus:border-yellow-400 mb-4" />

          {/* Color picker */}
          <label className="block text-xs font-bold text-white/60 mb-2 uppercase">Choose Color</label>
          <div className="grid grid-cols-6 gap-2 mb-5">
            {COLORS.map((c) => (
              <button key={c} onClick={() => setColor(c)}
                className={`aspect-square rounded-full transition-all ${color === c ? 'ring-4 ring-white scale-110' : 'opacity-70 hover:opacity-100'}`}
                style={{ background: c }} />
            ))}
          </div>

          {/* Join code (only on join tab) */}
          {tab === 'join' && (
            <>
              <label className="block text-xs font-bold text-white/60 mb-2 uppercase">Room Code</label>
              <input value={joinCode} onChange={(e) => setJoinCode(e.target.value.toUpperCase())} placeholder="ABCDE" maxLength={5}
                autoComplete="off" autoCorrect="off" autoCapitalize="characters" spellCheck={false}
                inputMode="text"
                className="w-full bg-black/40 border border-white/10 rounded-lg px-4 py-4 text-white text-2xl font-mono tracking-widest text-center placeholder-white/30 focus:outline-none focus:border-yellow-400 mb-5" />
            </>
          )}

          {/* Action button */}
          {tab === 'create' ? (
            <button disabled={!valid} onClick={() => onCreate(name.trim(), color)}
              className="w-full py-4 rounded-lg bg-yellow-400 text-black font-black text-lg disabled:opacity-40 disabled:cursor-not-allowed hover:bg-yellow-300 transition-all active:scale-95">CREATE GAME</button>
          ) : (
            <button disabled={!valid || joinCode.length !== 5} onClick={() => onJoin(joinCode, name.trim(), color)}
              className="w-full py-4 rounded-lg bg-yellow-400 text-black font-black text-lg disabled:opacity-40 disabled:cursor-not-allowed hover:bg-yellow-300 transition-all active:scale-95">JOIN GAME</button>
          )}

          {!valid && <p className="text-xs text-white/40 mt-3 text-center">Enter a nickname (2-14 chars) to continue</p>}
        </div>
        <p className="text-center text-xs text-white/40 mt-4">Share your room code with friends so they can join your game.</p>
      </div>
    </div>
  )
}
