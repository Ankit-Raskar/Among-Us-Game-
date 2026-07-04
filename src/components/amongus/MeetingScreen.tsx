'use client'
import { useEffect, useState, useRef } from 'react'
import { getSocket, type RoomState, type ChatMessage, type Role, type VoteResult } from '@/lib/amongus-client'
import { sounds } from '@/lib/sounds'

interface Props {
  room: RoomState
  myId: string
  myRole: Role | null
  chatMessages: ChatMessage[]
  voteResult: VoteResult | null
}

export function MeetingScreen({ room, myId, myRole, chatMessages, voteResult }: Props) {
  const me = room.players.find(p => p.id === myId)
  const [now, setNow] = useState(Date.now())
  const [chatInput, setChatInput] = useState('')
  const chatEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => { const i = setInterval(() => setNow(Date.now()), 200); return () => clearInterval(i) }, [])
  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [chatMessages])

  const caller = room.players.find(p => p.id === room.meetingCaller)
  const reportedBody = room.bodyReported ? room.players.find(p => p.id === room.bodyReported) : null
  const phase: 'discussion' | 'voting' | 'result' = voteResult ? 'result' : (now < room.meetingEndTime ? 'discussion' : 'voting')

  const timeLeft = phase === 'discussion' ? Math.max(0, Math.ceil((room.meetingEndTime - now) / 1000))
    : phase === 'voting' ? Math.max(0, Math.ceil((room.votingEndTime - now) / 1000)) : 0

  const castVote = (targetId: string | 'skip') => {
    if (phase !== 'voting' || !me?.alive) return
    sounds.vote()
    getSocket().emit('vote', { targetId })
  }

  const sendChat = () => {
    if (!chatInput.trim()) return
    getSocket().emit('chat', { message: chatInput.trim() })
    setChatInput('')
  }

  const alivePlayers = room.players.filter(p => p.alive)
  const votedCount = alivePlayers.filter(p => p.votedFor !== null).length

  return (
    <div className="min-h-screen flex flex-col p-4">
      <div className="max-w-5xl mx-auto w-full flex-1 flex flex-col">
        <div className="text-center mb-4">
          <h1 className="text-4xl md:text-5xl font-black tracking-tight">
            {phase === 'discussion' ? '📢 DISCUSSION' : phase === 'voting' ? '🗳️ VOTING' : '⚖️ RESULT'}
          </h1>
          <p className="text-white/60 mt-1">
            {phase === 'discussion' && `Discuss who you think the impostor is. Voting starts in ${timeLeft}s`}
            {phase === 'voting' && `Vote to eject someone. ${timeLeft}s remaining`}
            {phase === 'result' && 'The vote has been resolved.'}
          </p>
          <p className="text-xs text-white/40 mt-1">
            {caller && `Called by ${caller.name} · `}{room.meetingReason === 'body' && reportedBody ? `Body of ${reportedBody.name} reported` : 'Emergency meeting'}
          </p>
        </div>

        {phase === 'result' && voteResult && (
          <div className="bg-white/5 border-2 border-yellow-400/50 rounded-2xl p-6 mb-4 text-center">
            {voteResult.ejectedName ? (
              <>
                <div className="text-2xl mb-2">{voteResult.wasImpostor ? '🔪' : '😢'}</div>
                <div className="text-xl font-bold"><span className="text-yellow-400">{voteResult.ejectedName}</span> was ejected.</div>
                <div className="text-sm text-white/60 mt-2">{voteResult.wasImpostor ? 'They were an Impostor.' : 'They were NOT an Impostor.'}</div>
              </>
            ) : (
              <div className="text-xl font-bold">{voteResult.tie ? 'Tie! No one was ejected.' : 'Skipped! No one was ejected.'}</div>
            )}
          </div>
        )}

        <div className="grid md:grid-cols-2 gap-4 flex-1 min-h-0">
          <div className="bg-white/5 border border-white/10 rounded-2xl p-4 overflow-y-auto">
            <h3 className="font-bold mb-3 flex items-center justify-between">
              <span>Players ({alivePlayers.length} alive)</span>
              {phase === 'voting' && <span className="text-xs text-white/60">{votedCount}/{alivePlayers.length} voted</span>}
            </h3>
            <div className="grid grid-cols-2 gap-2">
              {room.players.map(p => {
                const isMe = p.id === myId
                const myVote = me?.votedFor
                const votedForThis = myVote === p.id
                const othersVoted = room.players.filter(x => x.votedFor === p.id).length
                return (
                  <button key={p.id} onClick={() => phase === 'voting' && p.alive && me?.alive && castVote(p.id)}
                    disabled={phase !== 'voting' || !p.alive || !me?.alive || isMe}
                    className={`relative bg-black/40 rounded-xl p-3 flex items-center gap-2 border-2 transition-all text-left ${votedForThis ? 'border-yellow-400 bg-yellow-400/10' : phase === 'voting' && p.alive && me?.alive && !isMe ? 'border-white/10 hover:border-white/40 cursor-pointer' : 'border-white/5 opacity-60'}`}>
                    <div className="w-10 h-10 rounded-full flex items-center justify-center relative" style={{ background: p.color }}>
                      {!p.alive && <div className="absolute inset-0 flex items-center justify-center text-xl">💀</div>}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="font-bold text-sm truncate">{p.name}{isMe && ' (You)'}</div>
                      <div className="text-xs text-white/40">{!p.alive ? 'Dead' : phase === 'voting' ? 'Tap to vote' : 'Alive'}</div>
                      {othersVoted > 0 && phase !== 'discussion' && <div className="text-xs text-yellow-400 font-bold">{othersVoted} vote{othersVoted > 1 ? 's' : ''}</div>}
                    </div>
                    {p.votedFor !== null && p.alive && <div className="text-xs text-green-400">✓</div>}
                  </button>
                )
              })}
            </div>
            {phase === 'voting' && me?.alive && (
              <button onClick={() => castVote('skip')} disabled={me?.votedFor === 'skip'}
                className={`w-full mt-3 py-3 rounded-xl border-2 font-bold transition-all ${me?.votedFor === 'skip' ? 'border-yellow-400 bg-yellow-400/10' : 'border-white/10 hover:border-white/40 bg-black/40'}`}>
                {me?.votedFor === 'skip' ? '✓ SKIPPED' : '⏭️ SKIP VOTE'}
              </button>
            )}
            {me?.votedFor && phase === 'voting' && <p className="text-center text-xs text-white/40 mt-2">Waiting for others ({votedCount}/{alivePlayers.length})...</p>}
            {!me?.alive && <p className="text-center text-xs text-white/40 mt-2">You are dead. You cannot vote.</p>}
          </div>

          <div className="bg-white/5 border border-white/10 rounded-2xl p-4 flex flex-col min-h-0">
            <h3 className="font-bold mb-3 flex items-center gap-2"><span>💬</span> Discussion</h3>
            <div className="flex-1 overflow-y-auto space-y-2 mb-3 min-h-[200px] text-sm">
              {chatMessages.length === 0 ? <p className="text-xs text-white/30 text-center mt-4">No messages yet. Start the discussion!</p> :
                chatMessages.map((m, i) => {
                  const sender = room.players.find(p => p.id === m.playerId)
                  return (<div key={i} className={!sender?.alive ? 'opacity-50' : ''}>
                    <span className="font-bold" style={{ color: m.color }}>{m.name}{!sender?.alive && ' 👻'}:</span> <span className="text-white/80">{m.message}</span>
                  </div>)
                })}
              <div ref={chatEndRef} />
            </div>
            {me?.alive ? (
              <div className="flex gap-2">
                <input value={chatInput} onChange={(e) => setChatInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && sendChat()}
                  placeholder="Type your message..." maxLength={200}
                  className="flex-1 bg-black/40 border border-white/10 rounded-lg px-3 py-2 text-sm text-white placeholder-white/30 focus:outline-none focus:border-yellow-400" />
                <button onClick={sendChat} className="px-4 bg-yellow-400 text-black font-bold rounded-lg hover:bg-yellow-300 transition-all">Send</button>
              </div>
            ) : <p className="text-center text-xs text-white/40 py-2">Ghosts can't chat with the living...</p>}
          </div>
        </div>
      </div>
    </div>
  )
}
