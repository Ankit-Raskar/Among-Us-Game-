'use client'
import { type RoomState, type Role, getSocket } from '@/lib/amongus-client'

interface Props {
  room: RoomState
  myRole: Role | null
  myId: string
  onLeave: () => void
}

export function GameOverScreen({ room, myRole, myId, onLeave }: Props) {
  const winner = room.winner
  const iWon = winner === 'impostor' ? myRole === 'impostor' : myRole === 'crewmate'
  const me = room.players.find(p => p.id === myId)
  const isHost = me?.isHost

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="max-w-2xl w-full">
        <div className={`text-center mb-6 p-8 rounded-3xl border-2 ${winner === 'impostor' ? 'bg-red-500/10 border-red-500/50' : 'bg-green-500/10 border-green-500/50'}`}>
          <div className="text-6xl mb-4">{winner === 'impostor' ? '🔪' : '🚀'}</div>
          <h1 className={`text-5xl font-black mb-2 ${iWon ? 'text-yellow-400' : 'text-white/60'}`}>{iWon ? 'VICTORY!' : 'DEFEAT'}</h1>
          <p className="text-2xl font-bold mb-1">{winner === 'impostor' ? 'IMPOSTORS WIN' : 'CREWMATES WIN'}</p>
          <p className="text-sm text-white/60">{winner === 'impostor' ? 'The impostors eliminated enough crewmates.' : 'Crewmates completed all tasks or ejected all impostors.'}</p>
        </div>

        <div className="bg-white/5 border border-white/10 rounded-2xl p-5 mb-4">
          <h3 className="font-bold mb-3">Game Results</h3>
          <div className="space-y-2">
            {room.players.map(p => (
              <div key={p.id} className={`flex items-center gap-3 p-2 rounded-lg ${p.id === myId ? 'bg-yellow-400/10' : 'bg-black/20'}`}>
                <div className="w-10 h-10 rounded-full flex items-center justify-center relative" style={{ background: p.color }}>
                  {!p.alive && <span className="absolute inset-0 flex items-center justify-center text-lg">💀</span>}
                </div>
                <div className="flex-1">
                  <div className="font-bold text-sm">{p.name}{p.id === myId && ' (You)'}</div>
                  <div className="text-xs text-white/50">{p.role === 'impostor' ? '🔪 Impostor' : '🚀 Crewmate'}{!p.alive && ' · Dead'}</div>
                </div>
                <div className="text-right">
                  {p.role === 'crewmate' && <div className="text-xs text-white/60">Tasks: {p.tasksCompleted}/{p.tasksTotal}</div>}
                  {p.role === 'impostor' && <div className="text-xs text-red-400">Impostor</div>}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="flex gap-3">
          {isHost ? (
            <button onClick={() => getSocket().emit('back-to-lobby')} className="flex-1 py-4 rounded-lg bg-yellow-400 text-black font-black text-lg hover:bg-yellow-300 transition-all active:scale-95">Back to Lobby</button>
          ) : <p className="flex-1 text-center text-sm text-white/50 py-4">Waiting for host to return to lobby...</p>}
          <button onClick={onLeave} className="px-6 py-4 bg-red-500/20 hover:bg-red-500/30 text-red-300 rounded-lg font-bold transition-all">Leave</button>
        </div>
      </div>
    </div>
  )
}
