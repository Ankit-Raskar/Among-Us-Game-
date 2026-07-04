'use client'
import { useState, useEffect, useRef } from 'react'
import { getSocket, type RoomState, type ChatMessage } from '@/lib/amongus-client'
import { sounds } from '@/lib/sounds'

interface Props {
  room: RoomState
  myId: string
  chatMessages: ChatMessage[]
}

export function LobbyScreen({ room, myId, chatMessages }: Props) {
  const me = room.players.find(p => p.id === myId)
  const isHost = me?.isHost
  const [chatInput, setChatInput] = useState('')
  const chatEndRef = useRef<HTMLDivElement>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [chatMessages])

  const allReady = room.players.length >= 3 && room.players.every(p => p.ready || p.isHost)
  const hostReady = me?.ready ?? false

  const sendChat = () => {
    if (!chatInput.trim()) return
    getSocket().emit('chat', { message: chatInput.trim() })
    setChatInput('')
  }

  const copyCode = async () => {
    try { await navigator.clipboard.writeText(room.code); setCopied(true); setTimeout(() => setCopied(false), 1500); sounds.click() } catch {}
  }

  const toggleReady = () => { sounds.ready(); getSocket().emit('set-ready', { ready: !hostReady }) }
  const startGame = () => { sounds.start(); getSocket().emit('start-game') }
  const setImpostorCount = (n: number) => { sounds.click(); getSocket().emit('set-impostor-count', { count: n }) }
  const leaveRoom = () => { sounds.leave(); const s = getSocket(); s.disconnect(); setTimeout(() => s.connect(), 200) }

  return (
    <div className="min-h-screen p-4 md:p-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-col md:flex-row gap-4 justify-between items-start md:items-center mb-6">
          <div>
            <h1 className="text-3xl md:text-4xl font-black tracking-tight">LOBBY</h1>
            <p className="text-white/50 text-sm mt-1">Waiting for players to ready up...</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="bg-white/5 border border-white/10 rounded-lg px-4 py-2">
              <div className="text-xs text-white/50 uppercase">Room Code</div>
              <button onClick={copyCode} className="font-mono text-2xl font-black tracking-widest text-yellow-400 hover:text-yellow-300 flex items-center gap-2" title="Click to copy">
                {room.code}<span className="text-xs text-white/40">{copied ? 'COPIED!' : '📋'}</span>
              </button>
            </div>
            <button onClick={leaveRoom} className="px-4 py-3 bg-red-500/20 hover:bg-red-500/30 text-red-300 rounded-lg font-bold transition-all">Leave</button>
          </div>
        </div>

        <div className="grid md:grid-cols-3 gap-4">
          <div className="md:col-span-2 bg-white/5 border border-white/10 rounded-2xl p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold flex items-center gap-2"><span className="text-2xl">👥</span> Players ({room.players.length}/12)</h2>
              {isHost && (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-white/60">Impostors:</span>
                  {[1, 2, 3].map(n => (
                    <button key={n} onClick={() => setImpostorCount(n)}
                      className={`w-7 h-7 rounded-full text-xs font-bold transition-all ${room.impostorCount === n ? 'bg-red-500 text-white' : 'bg-white/10 text-white/60 hover:bg-white/20'}`}>{n}</button>
                  ))}
                </div>
              )}
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {room.players.map(p => (
                <div key={p.id} className={`relative bg-black/30 rounded-xl p-3 flex items-center gap-3 border ${p.isHost ? 'border-yellow-400/50' : 'border-white/5'}`}>
                  <div className="w-12 h-12 rounded-full flex-shrink-0 flex items-center justify-center" style={{ background: p.color }}>
                    <span className="text-lg">{p.isHost ? '👑' : '🚀'}</span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="font-bold text-sm truncate">{p.name} {p.id === myId && <span className="text-white/40">(You)</span>}</div>
                    <div className="text-xs text-white/50">{p.isHost ? 'Host' : 'Player'}</div>
                    {!p.isHost && <div className={`text-xs font-bold mt-0.5 ${p.ready ? 'text-green-400' : 'text-white/40'}`}>{p.ready ? '✓ READY' : 'NOT READY'}</div>}
                  </div>
                </div>
              ))}
              {Array.from({ length: Math.max(0, 4 - room.players.length) }).map((_, i) => (
                <div key={`empty-${i}`} className="bg-black/20 border border-dashed border-white/10 rounded-xl p-3 flex items-center gap-3 opacity-50">
                  <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center"><span className="text-lg text-white/30">+</span></div>
                  <div className="text-xs text-white/30">Waiting...</div>
                </div>
              ))}
            </div>

            <div className="mt-6 flex gap-3">
              {!isHost && (
                <button onClick={toggleReady}
                  className={`flex-1 py-4 rounded-lg font-black text-lg transition-all active:scale-95 ${hostReady ? 'bg-green-500 text-white' : 'bg-yellow-400 text-black hover:bg-yellow-300'}`}>
                  {hostReady ? '✓ READY' : 'GET READY'}
                </button>
              )}
              {isHost && (
                <button onClick={startGame} disabled={room.players.length < 3 || !allReady}
                  className="flex-1 py-4 rounded-lg font-black text-lg bg-yellow-400 text-black disabled:opacity-40 disabled:cursor-not-allowed hover:bg-yellow-300 transition-all active:scale-95">
                  {room.players.length < 3 ? 'NEED 3+ PLAYERS' : !allReady ? 'WAITING FOR READY' : 'START GAME'}
                </button>
              )}
            </div>
            {!isHost && <p className="text-center text-xs text-white/40 mt-3">Click GET READY, then wait for the host to start the game.</p>}
            {isHost && room.players.length >= 3 && !allReady && <p className="text-center text-xs text-yellow-400/60 mt-3">All players must be ready before you can start.</p>}
          </div>

          <div className="bg-white/5 border border-white/10 rounded-2xl p-5 flex flex-col h-[400px] md:h-auto">
            <h2 className="text-lg font-bold mb-3 flex items-center gap-2"><span className="text-2xl">💬</span> Chat</h2>
            <div className="flex-1 overflow-y-auto space-y-2 mb-3 min-h-[200px]">
              {chatMessages.length === 0 ? <p className="text-xs text-white/30 text-center mt-4">No messages yet. Say hi!</p> :
                chatMessages.map((m, i) => (<div key={i} className="text-sm"><span className="font-bold" style={{ color: m.color }}>{m.name}:</span> <span className="text-white/80">{m.message}</span></div>))}
              <div ref={chatEndRef} />
            </div>
            <div className="flex gap-2">
              <input value={chatInput} onChange={(e) => setChatInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && sendChat()}
                placeholder="Type a message..." maxLength={200}
                className="flex-1 bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/30 focus:outline-none focus:border-yellow-400" />
              <button onClick={sendChat} className="px-4 bg-yellow-400 text-black font-bold rounded-lg hover:bg-yellow-300 transition-all">Send</button>
            </div>
          </div>
        </div>

        <div className="mt-6 bg-white/5 border border-white/10 rounded-2xl p-5">
          <h3 className="font-bold mb-3 flex items-center gap-2"><span className="text-xl">📋</span> How to Play</h3>
          <div className="grid md:grid-cols-2 gap-4 text-sm text-white/70">
            <div>
              <div className="font-bold text-green-400 mb-1">Crewmates</div>
              <p>Complete all tasks around the map. Win by finishing all tasks OR ejecting all impostors. Use WASD/Arrows to move. Press E near task zones to do tasks. Report dead bodies (R). Fix sabotages (T).</p>
            </div>
            <div>
              <div className="font-bold text-red-400 mb-1">Impostors</div>
              <p>Sabotage and kill crewmates without getting caught. Win when impostors match crewmates in number. Press Q near a crewmate to kill (20s cooldown). Press V to open sabotage menu (reactor, O2, lights, comms, doors).</p>
            </div>
          </div>
          <div className="mt-4 text-xs text-white/50">
            <div className="font-bold text-white/70 mb-1">Controls:</div>
            WASD = Move | Left/Right Arrow = Rotate camera | E = Use task | Q = Kill | R = Report body | F = Emergency meeting | T = Fix sabotage | V = Sabotage menu (impostor) | Tab = Map | M = Chat
          </div>
        </div>
      </div>
    </div>
  )
}
