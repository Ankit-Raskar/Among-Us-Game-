'use client'
import { useEffect, useState, useRef } from 'react'
import { getSocket, useSocket, type RoomState, type ChatMessage, type VoteResult, type Role } from '@/lib/amongus-client'
import { sounds, initAudio, playAmbientHum } from '@/lib/sounds'
import { HomeScreen } from '@/components/amongus/HomeScreen'
import { LobbyScreen } from '@/components/amongus/LobbyScreen'
import { GameScreen } from '@/components/amongus/GameScreen'
import { MeetingScreen } from '@/components/amongus/MeetingScreen'
import { GameOverScreen } from '@/components/amongus/GameOverScreen'
import { toast } from 'sonner'

export default function Home() {
  const { connected } = useSocket()
  const [view, setView] = useState<'home' | 'lobby' | 'game' | 'meeting' | 'gameover'>('home')
  const [room, setRoom] = useState<RoomState | null>(null)
  const [myRole, setMyRole] = useState<Role | null>(null)
  const [myId, setMyId] = useState<string>('')
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([])
  const [voteResult, setVoteResult] = useState<VoteResult | null>(null)
  const prevPhaseRef = useRef<string>('home')
  const prevPlayerCountRef = useRef<number>(0)
  const prevSabotageRef = useRef<string | null>(null)
  const stopHumRef = useRef<(() => void) | null>(null)

  useEffect(() => {
    const s = getSocket()
    const onState = (state: RoomState) => {
      setRoom(state)
      const oldPhase = prevPhaseRef.current
      const newPhase = state.phase
      // Phase change sounds
      if (oldPhase !== newPhase) {
        if (newPhase === 'lobby' && oldPhase !== 'home') sounds.join()
        if (newPhase === 'playing') {
          sounds.start()
          // Start ambient hum during gameplay
          if (!stopHumRef.current) stopHumRef.current = playAmbientHum()
        }
        if (newPhase === 'meeting') sounds.meeting()
        if (newPhase === 'gameover') {
          if (stopHumRef.current) { stopHumRef.current(); stopHumRef.current = null }
          if (state.winner === 'crew' && myRole === 'crewmate') sounds.win()
          else if (state.winner === 'impostor' && myRole === 'impostor') sounds.win()
          else sounds.lose()
        }
        if (newPhase !== 'playing' && stopHumRef.current) {
          stopHumRef.current(); stopHumRef.current = null
        }
        prevPhaseRef.current = newPhase
      }
      // Player join/leave sound
      const oldCount = prevPlayerCountRef.current
      if (state.phase === 'lobby' && oldCount > 0 && state.players.length > oldCount) sounds.join()
      if (state.phase === 'lobby' && oldCount > 0 && state.players.length < oldCount) sounds.leave()
      prevPlayerCountRef.current = state.players.length
      // Sabotage start sound
      const oldSab = prevSabotageRef.current
      const newSab = state.sabotage?.type || null
      if (newSab && oldSab !== newSab) sounds.sabotage()
      if (!newSab && oldSab) sounds.sabotageFix()
      prevSabotageRef.current = newSab

      if (state.phase === 'lobby') setView('lobby')
      else if (state.phase === 'playing') setView('game')
      else if (state.phase === 'meeting') setView('meeting')
      else if (state.phase === 'gameover') setView('gameover')
    }
    const onRole = ({ role }: { role: Role }) => {
      setMyRole(role)
      if (role === 'impostor') toast.error('You are an IMPOSTOR! Kill the crew.')
      else toast.success('You are a CREWMATE! Complete your tasks.')
    }
    const onChat = (msg: ChatMessage) => setChatMessages(prev => [...prev.slice(-100), msg])
    const onVoteResult = (r: VoteResult) => {
      setVoteResult(r)
      if (r.ejectedName) sounds.eject()
    }
    const onErr = ({ message }: { message: string }) => toast.error(message)
    const onConnect = () => setMyId(s.id || '')
    s.on('state', onState)
    s.on('role-assigned', onRole)
    s.on('chat', onChat)
    s.on('vote-result', onVoteResult)
    s.on('error-msg', onErr)
    s.on('connect', onConnect)
    if (s.connected && s.id) queueMicrotask(() => setMyId(s.id))
    return () => {
      s.off('state', onState); s.off('role-assigned', onRole); s.off('chat', onChat)
      s.off('vote-result', onVoteResult); s.off('error-msg', onErr); s.off('connect', onConnect)
      if (stopHumRef.current) { stopHumRef.current(); stopHumRef.current = null }
    }
  }, [myRole])

  const handleCreate = (name: string, color: string) => { initAudio(); sounds.click(); getSocket().emit('create-room', { name, color }) }
  const handleJoin = (code: string, name: string, color: string) => { initAudio(); sounds.click(); getSocket().emit('join-room', { code, name, color }) }
  const handleLeave = () => {
    setRoom(null); setMyRole(null); setView('home'); setChatMessages([]); setVoteResult(null)
    if (stopHumRef.current) { stopHumRef.current(); stopHumRef.current = null }
    const s = getSocket(); s.disconnect(); setTimeout(() => s.connect(), 200)
  }

  return (
    <div className="min-h-screen bg-[#0a0a1a] text-white">
      {!connected && (
        <div className="fixed inset-0 flex items-center justify-center bg-[#0a0a1a] z-50">
          <div className="text-center">
            <div className="text-2xl mb-4 animate-pulse">Connecting to server...</div>
            <div className="w-12 h-12 mx-auto border-4 border-yellow-400 border-t-transparent rounded-full animate-spin"></div>
          </div>
        </div>
      )}
      {connected && view === 'home' && <HomeScreen onCreate={handleCreate} onJoin={handleJoin} />}
      {connected && view === 'lobby' && room && <LobbyScreen room={room} myId={myId} chatMessages={chatMessages} />}
      {connected && view === 'game' && room && myRole && <GameScreen room={room} myId={myId} myRole={myRole} chatMessages={chatMessages} />}
      {connected && view === 'meeting' && room && <MeetingScreen room={room} myId={myId} myRole={myRole} chatMessages={chatMessages} voteResult={voteResult} />}
      {connected && view === 'gameover' && room && <GameOverScreen room={room} myRole={myRole} myId={myId} onLeave={handleLeave} />}
    </div>
  )
}
