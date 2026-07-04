'use client'
import { useEffect, useState } from 'react'
import { io, Socket } from 'socket.io-client'

export type Role = 'crewmate' | 'impostor'
export type GamePhase = 'lobby' | 'playing' | 'meeting' | 'gameover'

export interface Player {
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
  ready: boolean
  votedFor: string | null
  completedTaskIds: string[]  // which task zones this player has completed
}

export interface TaskItem {
  id: string
  room: string
  name: string
  type: string
}

export interface SabotageState {
  type: 'reactor' | 'o2' | 'lights' | 'comms' | 'doors' | null
  startTime: number
  endTime: number
  fixedBy: string[]
  fixRequired: number
  fixedPanelIds: string[]
}

export interface RoomState {
  code: string
  phase: GamePhase
  hostId: string
  impostorCount: number
  players: Player[]
  taskList: TaskItem[]
  meetingCaller: string | null
  meetingReason: 'emergency' | 'body' | null
  meetingEndTime: number
  votingEndTime: number
  winner: 'crew' | 'impostor' | null
  bodyReported: string | null
  totalTasksComplete: number
  totalTasksNeeded: number
  sabotage: SabotageState
}

export interface ChatMessage {
  playerId: string
  name: string
  color: string
  message: string
  timestamp: number
}

export interface VoteResult {
  ejectedName: string | null
  wasImpostor: boolean
  tie: boolean
  skipped: boolean
}

let socket: Socket | null = null

export function getSocket(): Socket {
  if (!socket) {
    const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:3003'
    socket = io(BACKEND_URL, {
      path: '/',
      transports: ['websocket', 'polling'],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
    })
  }
  return socket
}

export function useSocket() {
  const [connected, setConnected] = useState(false)
  useEffect(() => {
    const s = getSocket()
    const onConn = () => setConnected(true)
    const onDisc = () => setConnected(false)
    s.on('connect', onConn)
    s.on('disconnect', onDisc)
    if (s.connected) queueMicrotask(() => setConnected(true))
    return () => { s.off('connect', onConn); s.off('disconnect', onDisc) }
  }, [])
  return { connected, socket: getSocket() }
}
