'use client'

// Sound effects using Web Audio API (no external files needed)
let audioCtx: AudioContext | null = null

function getCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null
  if (!audioCtx) {
    try {
      audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)()
    } catch { return null }
  }
  if (audioCtx.state === 'suspended') audioCtx.resume()
  return audioCtx
}

// Play a simple beep with given frequency, duration, type, and volume
function beep(freq: number, duration: number, type: OscillatorType = 'sine', volume: number = 0.3, when: number = 0) {
  const ctx = getCtx(); if (!ctx) return
  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.type = type
  osc.frequency.value = freq
  gain.gain.setValueAtTime(0, ctx.currentTime + when)
  gain.gain.linearRampToValueAtTime(volume, ctx.currentTime + when + 0.01)
  gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + when + duration)
  osc.connect(gain)
  gain.connect(ctx.destination)
  osc.start(ctx.currentTime + when)
  osc.stop(ctx.currentTime + when + duration)
}

// Play a noise burst (for explosions, kills, etc.)
function noise(duration: number, volume: number = 0.3, when: number = 0) {
  const ctx = getCtx(); if (!ctx) return
  const bufferSize = ctx.sampleRate * duration
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate)
  const data = buffer.getChannelData(0)
  for (let i = 0; i < bufferSize; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize)
  const src = ctx.createBufferSource()
  src.buffer = buffer
  const gain = ctx.createGain()
  gain.gain.value = volume
  src.connect(gain)
  gain.connect(ctx.destination)
  src.start(ctx.currentTime + when)
}

export const sounds = {
  click() { beep(800, 0.05, 'square', 0.15) },
  taskComplete() {
    beep(523, 0.1, 'sine', 0.25, 0)    // C
    beep(659, 0.1, 'sine', 0.25, 0.1)  // E
    beep(784, 0.2, 'sine', 0.25, 0.2)  // G
  },
  taskProgress() { beep(440, 0.08, 'sine', 0.15) },
  kill() {
    noise(0.3, 0.4)
    beep(150, 0.4, 'sawtooth', 0.3, 0)
    beep(80, 0.5, 'sawtooth', 0.3, 0.1)
  },
  bodyReport() {
    beep(880, 0.15, 'square', 0.3, 0)
    beep(660, 0.15, 'square', 0.3, 0.15)
    beep(440, 0.3, 'square', 0.3, 0.3)
  },
  meeting() {
    beep(523, 0.1, 'sine', 0.3, 0)
    beep(523, 0.1, 'sine', 0.3, 0.15)
    beep(523, 0.1, 'sine', 0.3, 0.3)
    beep(659, 0.4, 'sine', 0.3, 0.45)
  },
  vote() { beep(600, 0.06, 'square', 0.2) },
  eject() {
    beep(400, 0.2, 'sawtooth', 0.3, 0)
    beep(300, 0.2, 'sawtooth', 0.3, 0.2)
    beep(200, 0.4, 'sawtooth', 0.3, 0.4)
    noise(0.5, 0.2, 0.4)
  },
  win() {
    beep(523, 0.15, 'sine', 0.3, 0)
    beep(659, 0.15, 'sine', 0.3, 0.15)
    beep(784, 0.15, 'sine', 0.3, 0.3)
    beep(1047, 0.4, 'sine', 0.3, 0.45)
  },
  lose() {
    beep(440, 0.2, 'sawtooth', 0.3, 0)
    beep(370, 0.2, 'sawtooth', 0.3, 0.2)
    beep(294, 0.5, 'sawtooth', 0.3, 0.4)
  },
  sabotage() {
    beep(200, 0.5, 'sawtooth', 0.3, 0)
    beep(180, 0.5, 'sawtooth', 0.3, 0.1)
    noise(0.6, 0.25, 0)
  },
  sabotageFix() {
    beep(600, 0.1, 'sine', 0.25, 0)
    beep(800, 0.15, 'sine', 0.25, 0.1)
  },
  warning() {
    beep(880, 0.1, 'square', 0.25, 0)
    beep(880, 0.1, 'square', 0.25, 0.2)
  },
  join() { beep(659, 0.1, 'sine', 0.2) },
  leave() { beep(440, 0.1, 'sine', 0.2) },
  ready() {
    beep(659, 0.08, 'sine', 0.2, 0)
    beep(880, 0.1, 'sine', 0.2, 0.08)
  },
  start() {
    beep(523, 0.1, 'sine', 0.25, 0)
    beep(659, 0.1, 'sine', 0.25, 0.1)
    beep(784, 0.1, 'sine', 0.25, 0.2)
    beep(1047, 0.3, 'sine', 0.25, 0.3)
  },
  footstep() { beep(100 + Math.random() * 50, 0.04, 'square', 0.05) },
  asteroidHit() {
    noise(0.15, 0.3)
    beep(400, 0.1, 'square', 0.2, 0)
  },
  wireConnect() { beep(880, 0.08, 'sine', 0.2) },
  swipeSuccess() {
    beep(600, 0.08, 'sine', 0.2, 0)
    beep(900, 0.12, 'sine', 0.2, 0.08)
  },
  memoryBeep(idx: number) {
    const freqs = [400, 500, 600, 700]
    beep(freqs[idx] || 400, 0.2, 'sine', 0.25)
  },
}

// Initialize audio on first user interaction (browsers require this)
export function initAudio() {
  getCtx()
}

// Play a looping ambient hum (returns a stop function)
export function playAmbientHum(): () => void {
  const ctx = getCtx()
  if (!ctx) return () => {}
  const osc1 = ctx.createOscillator()
  const osc2 = ctx.createOscillator()
  const gain = ctx.createGain()
  osc1.type = 'sine'; osc1.frequency.value = 55
  osc2.type = 'sine'; osc2.frequency.value = 82.5
  gain.gain.value = 0.04
  osc1.connect(gain); osc2.connect(gain)
  gain.connect(ctx.destination)
  osc1.start(); osc2.start()
  return () => {
    try { osc1.stop(); osc2.stop() } catch {}
  }
}
