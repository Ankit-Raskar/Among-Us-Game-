'use client'
import * as THREE from 'three'
import { useEffect, useRef, useState } from 'react'
import { MAP_WIDTH, MAP_HEIGHT, ROOMS, CORRIDORS, TASK_ZONES, SABOTAGE_ZONES, VENT_ZONES, EMERGENCY_BUTTON } from '@/lib/amongus-map'
import type { Player, SabotageState } from '@/lib/amongus-client'

interface Props {
  myId: string
  myColor: string
  playersRef: React.MutableRefObject<Player[]>
  sabotageRef?: React.MutableRefObject<SabotageState | null>
  cameraYawRef?: React.MutableRefObject<number>
}

const WALL_HEIGHT = 90

// Procedural textures (no external files needed)
function makeCarpetTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas'); c.width = 256; c.height = 256
  const ctx = c.getContext('2d')!
  ctx.fillStyle = '#3a3020'; ctx.fillRect(0, 0, 256, 256)
  // Add noise specks
  for (let i = 0; i < 3000; i++) {
    const x = Math.random() * 256, y = Math.random() * 256
    const shade = Math.random() * 40 - 20
    ctx.fillStyle = `rgb(${58 + shade}, ${48 + shade}, ${32 + shade})`
    ctx.fillRect(x, y, 1, 1)
  }
  const tex = new THREE.CanvasTexture(c)
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping
  return tex
}

function makeWallTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas'); c.width = 256; c.height = 256
  const ctx = c.getContext('2d')!
  // Base yellow-ish wallpaper (backrooms vibe)
  ctx.fillStyle = '#8a7a3a'; ctx.fillRect(0, 0, 256, 256)
  // Vertical stripes (subtle)
  for (let x = 0; x < 256; x += 32) {
    ctx.fillStyle = `rgba(0,0,0,0.05)`; ctx.fillRect(x, 0, 16, 256)
  }
  // Stains
  for (let i = 0; i < 20; i++) {
    const x = Math.random() * 256, y = Math.random() * 256, r = 10 + Math.random() * 30
    ctx.fillStyle = `rgba(60,50,20,${Math.random() * 0.3})`
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill()
  }
  // Noise
  for (let i = 0; i < 2000; i++) {
    const x = Math.random() * 256, y = Math.random() * 256
    const shade = Math.random() * 30 - 15
    ctx.fillStyle = `rgba(${138 + shade}, ${122 + shade}, ${58 + shade}, 0.3)`
    ctx.fillRect(x, y, 1, 1)
  }
  const tex = new THREE.CanvasTexture(c)
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping
  return tex
}

function makeCeilingTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas'); c.width = 256; c.height = 256
  const ctx = c.getContext('2d')!
  ctx.fillStyle = '#6a6a5a'; ctx.fillRect(0, 0, 256, 256)
  // Ceiling tiles pattern
  ctx.strokeStyle = 'rgba(0,0,0,0.3)'; ctx.lineWidth = 2
  for (let i = 0; i <= 256; i += 64) {
    ctx.beginPath(); ctx.moveTo(i, 0); ctx.lineTo(i, 256); ctx.stroke()
    ctx.beginPath(); ctx.moveTo(0, i); ctx.lineTo(256, i); ctx.stroke()
  }
  // Stains
  for (let i = 0; i < 15; i++) {
    const x = Math.random() * 256, y = Math.random() * 256, r = 5 + Math.random() * 20
    ctx.fillStyle = `rgba(40,40,30,${Math.random() * 0.4})`
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill()
  }
  const tex = new THREE.CanvasTexture(c)
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping
  return tex
}

export function GameScene3D({ myId, myColor, playersRef, sabotageRef, cameraYawRef }: Props) {
  const mountRef = useRef<HTMLDivElement>(null)
  const sceneRef = useRef<THREE.Scene | null>(null)
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null)
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null)
  const playerMeshesRef = useRef<Map<string, THREE.Group>>(new Map())
  const playerLabelsRef = useRef<Map<string, THREE.Sprite>>(new Map())
  const myPlayerMeshRef = useRef<THREE.Group | null>(null)
  const cameraYawRefInner = useRef<number>(0)
  const cameraPitchRef = useRef<number>(0)
  const targetYawRef = useRef<number>(0)
  const targetPitchRef = useRef<number>(0)
  const pointerLockedRef = useRef<boolean>(false)
  const animationFrameRef = useRef<number>(0)
  const lightsRef = useRef<{ ambient: THREE.AmbientLight; playerLight: THREE.PointLight } | null>(null)
  const flickerLightsRef = useRef<THREE.PointLight[]>([])
  const lastFlickerRef = useRef<number>(0)
  const playerVelocityRef = useRef<{ x: number; z: number }>({ x: 0, z: 0 })

  useEffect(() => {
    if (!mountRef.current) return
    const mount = mountRef.current

    const scene = new THREE.Scene()
    scene.background = new THREE.Color(0x000510)
    scene.fog = new THREE.FogExp2(0x1a1810, 0.004)
    sceneRef.current = scene

    // First-person camera
    const camera = new THREE.PerspectiveCamera(75, mount.clientWidth / mount.clientHeight, 0.5, 2000)
    camera.position.set(0, 35, 0)
    cameraRef.current = camera

    const renderer = new THREE.WebGLRenderer({ antialias: false, alpha: false, powerPreference: 'high-performance' })
    renderer.setPixelRatio(1)  // cap at 1 for performance
    renderer.setSize(mount.clientWidth, mount.clientHeight)
    renderer.shadowMap.enabled = false  // disable shadows for performance
    mount.appendChild(renderer.domElement)
    rendererRef.current = renderer

    const canvas = renderer.domElement
    canvas.style.cursor = 'crosshair'

    // Detect touch device
    const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0

    // Pointer lock for FPS-style mouse control (desktop only)
    const requestLock = () => {
      if (isTouchDevice) return  // Don't use pointer lock on touch devices
      if (document.pointerLockElement !== canvas) canvas.requestPointerLock()
    }
    const onLockChange = () => {
      pointerLockedRef.current = document.pointerLockElement === canvas
      canvas.style.cursor = pointerLockedRef.current ? 'none' : 'crosshair'
    }
    const onMouseMove = (e: MouseEvent) => {
      if (!pointerLockedRef.current) return
      // FPS-style: mouse right = look right, mouse up = look up
      const sensitivity = 0.0025
      targetYawRef.current -= e.movementX * sensitivity
      targetPitchRef.current += e.movementY * sensitivity
      targetPitchRef.current = Math.max(-1.2, Math.min(1.2, targetPitchRef.current))
    }

    // Touch camera control (mobile) — drag on right 60% of screen to rotate camera
    // Left 40% is reserved for joystick
    let lastTouchX = 0, lastTouchY = 0
    const onTouchStart = (e: TouchEvent) => {
      if (e.touches.length === 0) return
      const t = e.touches[0]
      const rect = canvas.getBoundingClientRect()
      // Only use touches on the right 60% of screen (left is joystick + buttons)
      // Actually, let's use touches that start in the upper/middle area (avoiding bottom controls)
      const relativeY = (t.clientY - rect.top) / rect.height
      if (relativeY > 0.65) return  // Bottom 35% is for controls
      lastTouchX = t.clientX
      lastTouchY = t.clientY
    }
    const onTouchMoveCamera = (e: TouchEvent) => {
      if (e.touches.length === 0) return
      const t = e.touches[0]
      const rect = canvas.getBoundingClientRect()
      const relativeY = (t.clientY - rect.top) / rect.height
      if (relativeY > 0.65) return  // Bottom 35% is for controls
      const dx = t.clientX - lastTouchX
      const dy = t.clientY - lastTouchY
      lastTouchX = t.clientX
      lastTouchY = t.clientY
      // Touch drag sensitivity
      const sensitivity = 0.005
      targetYawRef.current -= dx * sensitivity
      targetPitchRef.current += dy * sensitivity
      targetPitchRef.current = Math.max(-1.2, Math.min(1.2, targetPitchRef.current))
    }

    if (!isTouchDevice) {
      canvas.addEventListener('click', requestLock)
      document.addEventListener('pointerlockchange', onLockChange)
      document.addEventListener('mousemove', onMouseMove)
    } else {
      // Touch device — use drag to rotate camera
      canvas.addEventListener('touchstart', onTouchStart, { passive: true })
      canvas.addEventListener('touchmove', onTouchMoveCamera, { passive: true })
    }

    // Lighting — backrooms yellow fluorescent vibe
    // Higher ambient since we removed per-room lights (perf optimization)
    const ambientLight = new THREE.AmbientLight(0xfff5d0, 0.7)
    scene.add(ambientLight)
    const directionalLight = new THREE.DirectionalLight(0xfff5e0, 0.4)
    directionalLight.position.set(200, 400, 200)
    scene.add(directionalLight)

    // Player head-mounted light (flashlight in first person) — brighter to compensate
    const playerLight = new THREE.PointLight(0xfff0c0, 1.5, 250, 1.5)
    playerLight.position.set(0, 35, 0)
    scene.add(playerLight)
    lightsRef.current = { ambient: ambientLight, playerLight }

    const offsetX = -MAP_WIDTH / 2
    const offsetZ = -MAP_HEIGHT / 2

    // Procedural textures
    const carpetTex = makeCarpetTexture()
    const wallTex = makeWallTexture()
    const ceilTex = makeCeilingTexture()

    // Floor — large with carpet texture
    const floorGeo = new THREE.PlaneGeometry(MAP_WIDTH + 400, MAP_HEIGHT + 400)
    const floorMat = new THREE.MeshStandardMaterial({ map: carpetTex, roughness: 0.95, metalness: 0.05 })
    carpetTex.repeat.set(MAP_WIDTH / 100, MAP_HEIGHT / 100)
    const floor = new THREE.Mesh(floorGeo, floorMat)
    floor.rotation.x = -Math.PI / 2
    floor.receiveShadow = true
    scene.add(floor)

    // Outer boundary walls (very tall)
    const boundaryMat = new THREE.MeshStandardMaterial({ color: 0x1a1a15, roughness: 0.9, side: THREE.DoubleSide })
    const boundaryHeight = WALL_HEIGHT + 120
    const bThickness = 20
    const bN = new THREE.Mesh(new THREE.BoxGeometry(MAP_WIDTH + 200, boundaryHeight, bThickness), boundaryMat)
    bN.position.set(0, boundaryHeight / 2, -MAP_HEIGHT / 2 - 40); scene.add(bN)
    const bS = new THREE.Mesh(new THREE.BoxGeometry(MAP_WIDTH + 200, boundaryHeight, bThickness), boundaryMat)
    bS.position.set(0, boundaryHeight / 2, MAP_HEIGHT / 2 + 40); scene.add(bS)
    const bE = new THREE.Mesh(new THREE.BoxGeometry(bThickness, boundaryHeight, MAP_HEIGHT + 200), boundaryMat)
    bE.position.set(MAP_WIDTH / 2 + 40, boundaryHeight / 2, 0); scene.add(bE)
    const bW = new THREE.Mesh(new THREE.BoxGeometry(bThickness, boundaryHeight, MAP_HEIGHT + 200), boundaryMat)
    bW.position.set(-MAP_WIDTH / 2 - 40, boundaryHeight / 2, 0); scene.add(bW)

    const roomColors: Record<string, number> = {
      Cafeteria: 0x4a4030, Engine: 0x3a3040, Reactor: 0x503030, Security: 0x403830,
      MedBay: 0x304838, Navigation: 0x303848, Electrical: 0x503828, Storage: 0x3a3025,
      Weapons: 0x502830, O2: 0x283848, Admin: 0x4a3048, Communications: 0x303848,
    }
    const roomMatCache: Record<number, THREE.MeshStandardMaterial> = {}
    flickerLightsRef.current = []

    for (const r of ROOMS) {
      const color = roomColors[r.name] || 0x3a3025
      if (!roomMatCache[color]) {
        const tex = makeCarpetTexture()
        tex.repeat.set(r.w / 80, r.h / 80)
        roomMatCache[color] = new THREE.MeshStandardMaterial({ map: tex, color, roughness: 0.85, metalness: 0.05 })
      }
      const geo = new THREE.BoxGeometry(r.w, 2, r.h)
      const mesh = new THREE.Mesh(geo, roomMatCache[color])
      mesh.position.set(r.x + r.w / 2 + offsetX, 1, r.y + r.h / 2 + offsetZ)
      mesh.receiveShadow = true
      scene.add(mesh)

      // Ceiling with texture
      const ceilTexClone = ceilTex.clone()
      ceilTexClone.needsUpdate = true
      ceilTexClone.repeat.set(r.w / 80, r.h / 80)
      const ceilMat = new THREE.MeshStandardMaterial({ map: ceilTexClone, color: 0x6a6a5a, roughness: 0.9 })
      const ceil = new THREE.Mesh(new THREE.BoxGeometry(r.w, 2, r.h), ceilMat)
      ceil.position.set(r.x + r.w / 2 + offsetX, WALL_HEIGHT, r.y + r.h / 2 + offsetZ)
      scene.add(ceil)

      // Walls with texture
      buildRoomWalls(scene, r, offsetX, offsetZ, wallTex)

      // Room name label
      const lblCanvas = document.createElement('canvas')
      lblCanvas.width = 256; lblCanvas.height = 64
      const ctx = lblCanvas.getContext('2d')!
      ctx.fillStyle = 'rgba(255,245,200,0.5)'; ctx.fillRect(0, 0, 256, 64)
      ctx.fillStyle = 'rgba(0,0,0,0.8)'; ctx.font = 'bold 28px monospace'; ctx.textAlign = 'center'
      ctx.fillText(r.name.toUpperCase(), 128, 42)
      const texture = new THREE.CanvasTexture(lblCanvas)
      const labelMat = new THREE.SpriteMaterial({ map: texture, transparent: true, opacity: 0.8 })
      const label = new THREE.Sprite(labelMat)
      label.position.set(r.x + r.w / 2 + offsetX, WALL_HEIGHT - 15, r.y + r.h / 2 + offsetZ)
      label.scale.set(70, 18, 1)
      scene.add(label)

      // Fluorescent light fixture (backrooms style) with flickering light
      const fixtureMat = new THREE.MeshStandardMaterial({ color: 0xffffe0, emissive: 0xfff5b0, emissiveIntensity: 1.0 })
      const fixtureGeo = new THREE.BoxGeometry(30, 4, 10)
      const fixture = new THREE.Mesh(fixtureGeo, fixtureMat)
      fixture.position.set(r.x + r.w / 2 + offsetX, WALL_HEIGHT - 6, r.y + r.h / 2 + offsetZ)
      scene.add(fixture)
      // NOTE: Removed per-room PointLight for performance — emissive fixture + ambient is enough

      // Add environment decorations
      addRoomDecorations(scene, r, offsetX, offsetZ)
    }

    // Corridors — with side walls so player can't see outside
    const corridorMat = new THREE.MeshStandardMaterial({ color: 0x2a2520, roughness: 0.85 })
    const corridorWallMat = new THREE.MeshStandardMaterial({ color: 0x6a5a2a, roughness: 0.8, metalness: 0.05 })
    for (const c of CORRIDORS) {
      const cx = c.x + c.w / 2 + offsetX
      const cz = c.y + c.h / 2 + offsetZ
      const geo = new THREE.BoxGeometry(c.w, 1.5, c.h)
      const mesh = new THREE.Mesh(geo, corridorMat)
      mesh.position.set(cx, 0.75, cz)
      scene.add(mesh)
      const ceil = new THREE.Mesh(new THREE.BoxGeometry(c.w, 1.5, c.h), new THREE.MeshStandardMaterial({ color: 0x151510, roughness: 0.9 }))
      ceil.position.set(cx, WALL_HEIGHT - 1, cz)
      scene.add(ceil)

      // Add side walls along the corridor's long sides
      // If horizontal corridor (w > h): walls on north (y) and south (y+h) sides
      // If vertical corridor (h > w): walls on east (x+w) and west (x) sides
      const wallT = 3  // wall thickness
      if (c.w >= c.h) {
        // Horizontal corridor — walls along top and bottom
        const wallLen = c.w
        const nWall = new THREE.Mesh(new THREE.BoxGeometry(wallLen, WALL_HEIGHT, wallT), corridorWallMat)
        nWall.position.set(cx, WALL_HEIGHT / 2, c.y + offsetZ)
        scene.add(nWall)
        const sWall = new THREE.Mesh(new THREE.BoxGeometry(wallLen, WALL_HEIGHT, wallT), corridorWallMat)
        sWall.position.set(cx, WALL_HEIGHT / 2, c.y + c.h + offsetZ)
        scene.add(sWall)
      } else {
        // Vertical corridor — walls along left and right
        const wallLen = c.h
        const wWall = new THREE.Mesh(new THREE.BoxGeometry(wallT, WALL_HEIGHT, wallLen), corridorWallMat)
        wWall.position.set(c.x + offsetX, WALL_HEIGHT / 2, cz)
        scene.add(wWall)
        const eWall = new THREE.Mesh(new THREE.BoxGeometry(wallT, WALL_HEIGHT, wallLen), corridorWallMat)
        eWall.position.set(c.x + c.w + offsetX, WALL_HEIGHT / 2, cz)
        scene.add(eWall)
      }

      // NOTE: Removed corridor PointLight for performance
    }

    // Task zones (glowing yellow pads)
    const taskPadMat = new THREE.MeshStandardMaterial({ color: 0xfacc15, emissive: 0xfacc15, emissiveIntensity: 0.7, roughness: 0.3 })
    for (const t of TASK_ZONES) {
      const radius = Math.min(t.w, t.h) / 2
      const geo = new THREE.CylinderGeometry(radius, radius, 1.5, 24)
      const mesh = new THREE.Mesh(geo, taskPadMat)
      mesh.position.set(t.x + t.w / 2 + offsetX, 2, t.y + t.h / 2 + offsetZ)
      scene.add(mesh)
      const icon = new THREE.Mesh(new THREE.SphereGeometry(5, 12, 8), new THREE.MeshStandardMaterial({ color: 0xfacc15, emissive: 0xfacc15, emissiveIntensity: 0.6 }))
      icon.position.set(t.x + t.w / 2 + offsetX, 22, t.y + t.h / 2 + offsetZ)
      scene.add(icon)
      const beamMat = new THREE.MeshBasicMaterial({ color: 0xfacc15, transparent: true, opacity: 0.15, side: THREE.DoubleSide })
      const beam = new THREE.Mesh(new THREE.CylinderGeometry(2, 6, 22, 8, 1, true), beamMat)
      beam.position.set(t.x + t.w / 2 + offsetX, 12, t.y + t.h / 2 + offsetZ)
      scene.add(beam)
    }

    // Sabotage fix zones (red glowing pads — bigger and more visible)
    const sabPadMat = new THREE.MeshStandardMaterial({ color: 0xef4444, emissive: 0xef4444, emissiveIntensity: 0.7, roughness: 0.3 })
    for (const z of SABOTAGE_ZONES) {
      const radius = 18  // bigger radius for visibility
      const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, 2, 20), sabPadMat)
      mesh.position.set(z.x + z.w / 2 + offsetX, 2, z.y + z.h / 2 + offsetZ)
      scene.add(mesh)
      // Glowing icon above
      const icon = new THREE.Mesh(new THREE.OctahedronGeometry(6), new THREE.MeshStandardMaterial({ color: 0xef4444, emissive: 0xef4444, emissiveIntensity: 0.8 }))
      icon.position.set(z.x + z.w / 2 + offsetX, 18, z.y + z.h / 2 + offsetZ)
      scene.add(icon)
    }

    // Vents (dark teal circles on floor — impostors only, but visible to all)
    const ventMat = new THREE.MeshStandardMaterial({ color: 0x0d9488, emissive: 0x0d9488, emissiveIntensity: 0.4, roughness: 0.5 })
    const ventRingMat = new THREE.MeshStandardMaterial({ color: 0x134e4a, roughness: 0.6 })
    for (const v of VENT_ZONES) {
      // Outer ring
      const ring = new THREE.Mesh(new THREE.TorusGeometry(12, 2, 8, 16), ventRingMat)
      ring.position.set(v.x + offsetX, 1.5, v.y + offsetZ)
      ring.rotation.x = -Math.PI / 2
      scene.add(ring)
      // Inner circle
      const inner = new THREE.Mesh(new THREE.CircleGeometry(10, 16), ventMat)
      inner.position.set(v.x + offsetX, 1.2, v.y + offsetZ)
      inner.rotation.x = -Math.PI / 2
      scene.add(inner)
    }

    // Emergency button
    const btnMat = new THREE.MeshStandardMaterial({ color: 0xdc2626, emissive: 0xdc2626, emissiveIntensity: 0.8, roughness: 0.3 })
    const btn = new THREE.Mesh(new THREE.CylinderGeometry(8, 10, 6, 24), btnMat)
    btn.position.set(EMERGENCY_BUTTON.x + EMERGENCY_BUTTON.w / 2 + offsetX, 4, EMERGENCY_BUTTON.y + EMERGENCY_BUTTON.h / 2 + offsetZ)
    scene.add(btn)
    const btnBase = new THREE.Mesh(new THREE.CylinderGeometry(14, 14, 3, 24), new THREE.MeshStandardMaterial({ color: 0x444444, roughness: 0.6 }))
    btnBase.position.set(EMERGENCY_BUTTON.x + EMERGENCY_BUTTON.w / 2 + offsetX, 1.5, EMERGENCY_BUTTON.y + EMERGENCY_BUTTON.h / 2 + offsetZ)
    scene.add(btnBase)

    const handleResize = () => {
      if (!mountRef.current || !cameraRef.current || !rendererRef.current) return
      const w = mountRef.current.clientWidth, h = mountRef.current.clientHeight
      cameraRef.current.aspect = w / h
      cameraRef.current.updateProjectionMatrix()
      rendererRef.current.setSize(w, h)
    }
    window.addEventListener('resize', handleResize)

    let lastTime = performance.now()
    const animate = (now: number) => {
      animationFrameRef.current = requestAnimationFrame(animate)
      const dt = Math.min(0.1, (now - lastTime) / 1000)
      lastTime = now

      // Smooth camera interpolation
      cameraYawRefInner.current += (targetYawRef.current - cameraYawRefInner.current) * Math.min(1, dt * 12)
      cameraPitchRef.current += (targetPitchRef.current - cameraPitchRef.current) * Math.min(1, dt * 12)
      if (cameraYawRef) cameraYawRef.current = cameraYawRefInner.current

      // Lighting state (sabotage check) — only update every 100ms
      if (now - lastFlickerRef.current > 100) {
        lastFlickerRef.current = now
        if (lightsRef.current) {
          const sab = sabotageRef?.current
          if (sab?.type === 'lights') {
            lightsRef.current.playerLight.intensity = 0.4
            lightsRef.current.ambient.intensity = 0.08
          } else {
            lightsRef.current.playerLight.intensity = 1.5
            lightsRef.current.ambient.intensity = 0.7
          }
        }
      }

      // Update OTHER player meshes (not my own — first person doesn't show own body)
      const players = playersRef.current
      const seenIds = new Set<string>()
      for (const p of players) {
        if (p.id === myId) continue // skip self in first person
        seenIds.add(p.id)
        let mesh = playerMeshesRef.current.get(p.id)
        if (!mesh) {
          mesh = createCharacter(p.color)
          scene.add(mesh)
          playerMeshesRef.current.set(p.id, mesh)
        }
        const targetX = p.x + offsetX, targetZ = p.y + offsetZ
        mesh.position.x += (targetX - mesh.position.x) * Math.min(1, dt * 12)
        mesh.position.z += (targetZ - mesh.position.z) * Math.min(1, dt * 12)

        if (!p.alive) {
          mesh.rotation.z = Math.PI / 2; mesh.position.y = 4
          mesh.traverse((child: any) => { if (child.isMesh) { child.material.transparent = true; child.material.opacity = 0.55 } })
        } else {
          mesh.rotation.z = 0; mesh.position.y = Math.abs(Math.sin(now * 0.005 + mesh.position.x * 0.01)) * 1.2
          mesh.traverse((child: any) => { if (child.isMesh) { child.material.transparent = false; child.material.opacity = 1 } })
        }

        // Name label above head
        let label = playerLabelsRef.current.get(p.id)
        if (!label) {
          label = createNameLabel(p.name, p.color, p.alive)
          scene.add(label)
          playerLabelsRef.current.set(p.id, label)
        }
        // Position label above player's head
        label.position.set(mesh.position.x, 48, mesh.position.z)
        // Update label if alive status changed
        label.visible = p.alive
      }
      // Remove labels for players that left
      for (const [id, label] of playerLabelsRef.current.entries()) {
        if (!seenIds.has(id)) { scene.remove(label); playerLabelsRef.current.delete(id) }
      }
      for (const [id, mesh] of playerMeshesRef.current.entries()) {
        if (!seenIds.has(id)) { scene.remove(mesh); playerMeshesRef.current.delete(id) }
      }

      // First-person camera: position at my player's eye level
      const myPlayer = players.find(p => p.id === myId)
      if (myPlayer) {
        const px = myPlayer.x + offsetX
        const pz = myPlayer.y + offsetZ
        const yaw = cameraYawRefInner.current
        const pitch = cameraPitchRef.current
        // Eye height ~32 (character is ~40 tall)
        camera.position.x = px
        camera.position.y = 32
        camera.position.z = pz
        // Look direction: forward = (sin(yaw)*cos(pitch), sin(pitch), cos(yaw)*cos(pitch))
        // But pitch positive should look down in our convention... let's use:
        // lookX = sin(yaw) * cos(pitch), lookY = -sin(pitch), lookZ = cos(yaw) * cos(pitch)
        const lookX = px + Math.sin(yaw) * Math.cos(pitch) * 100
        const lookY = 32 - Math.sin(pitch) * 100
        const lookZ = pz + Math.cos(yaw) * Math.cos(pitch) * 100
        camera.lookAt(lookX, lookY, lookZ)

        if (lightsRef.current) {
          lightsRef.current.playerLight.position.set(px, 38, pz)
        }
      }

      renderer.render(scene, camera)
    }
    animationFrameRef.current = requestAnimationFrame(animate)

    return () => {
      cancelAnimationFrame(animationFrameRef.current)
      window.removeEventListener('resize', handleResize)
      if (!isTouchDevice) {
        canvas.removeEventListener('click', requestLock)
        document.removeEventListener('pointerlockchange', onLockChange)
        document.removeEventListener('mousemove', onMouseMove)
        if (document.pointerLockElement === canvas) document.exitPointerLock()
      } else {
        canvas.removeEventListener('touchstart', onTouchStart)
        canvas.removeEventListener('touchmove', onTouchMoveCamera)
      }
      renderer.dispose()
      if (mount.contains(renderer.domElement)) mount.removeChild(renderer.domElement)
      playerMeshesRef.current.clear()
    }
  }, [myId])

  // Click-to-play overlay when not pointer-locked
  return (
    <div className="w-full h-full relative">
      <div ref={mountRef} className="w-full h-full" />
      <CameraHint />
    </div>
  )
}

function CameraHint() {
  const [isTouch, setIsTouch] = useState(false)
  const [locked, setLocked] = useState(false)
  const [hintSeen, setHintSeen] = useState(false)

  useEffect(() => {
    const touch = 'ontouchstart' in window || navigator.maxTouchPoints > 0
    queueMicrotask(() => setIsTouch(touch))
    const onChange = () => setLocked(!!document.pointerLockElement)
    document.addEventListener('pointerlockchange', onChange)
    return () => document.removeEventListener('pointerlockchange', onChange)
  }, [])

  // Hide hint after 3 seconds on touch, or when locked on desktop
  useEffect(() => {
    if (locked) return
    const t = setTimeout(() => setHintSeen(true), 4000)
    return () => clearTimeout(t)
  }, [locked])

  if (locked || hintSeen) return null

  if (isTouch) {
    return (
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 pointer-events-none z-20">
        <div className="bg-black/70 border border-yellow-400/50 rounded-xl px-4 py-2 text-center">
          <div className="text-yellow-400 font-bold text-xs">👆 Drag screen to look around</div>
        </div>
      </div>
    )
  }

  return (
    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
      <div className="bg-black/70 border border-yellow-400/50 rounded-xl px-6 py-3 text-center">
        <div className="text-yellow-400 font-bold text-sm">Click to enable mouse look</div>
        <div className="text-white/50 text-xs mt-1">ESC to release</div>
      </div>
    </div>
  )
}

function buildRoomWalls(scene: THREE.Scene, r: { x: number; y: number; w: number; h: number; name: string }, offsetX: number, offsetZ: number, wallTex: THREE.CanvasTexture) {
  // Use a single shared material for all walls in this room (perf optimization)
  const wallMat = new THREE.MeshStandardMaterial({ map: wallTex, color: 0x8a7a3a, roughness: 0.8, metalness: 0.05 })
  const wallThickness = 4
  const hasGap = (side: 'n' | 's' | 'e' | 'w'): { start: number; end: number } | null => {
    for (const c of CORRIDORS) {
      if (side === 'n' && Math.abs(c.y + c.h - r.y) < 10 && c.x + c.w > r.x && c.x < r.x + r.w) return { start: Math.max(c.x, r.x) + offsetX, end: Math.min(c.x + c.w, r.x + r.w) + offsetX }
      if (side === 's' && Math.abs(c.y - r.y - r.h) < 10 && c.x + c.w > r.x && c.x < r.x + r.w) return { start: Math.max(c.x, r.x) + offsetX, end: Math.min(c.x + c.w, r.x + r.w) + offsetX }
      if (side === 'w' && Math.abs(c.x + c.w - r.x) < 10 && c.y + c.h > r.y && c.y < r.y + r.h) return { start: Math.max(c.y, r.y) + offsetZ, end: Math.min(c.y + c.h, r.y + r.h) + offsetZ }
      if (side === 'e' && Math.abs(c.x - r.x - r.w) < 10 && c.y + c.h > r.y && c.y < r.y + r.h) return { start: Math.max(c.y, r.y) + offsetZ, end: Math.min(c.y + c.h, r.y + r.h) + offsetZ }
    }
    return null
  }
  const addWall = (wx: number, wz: number, ww: number, wh: number) => {
    if (ww <= 0 || wh <= 0) return
    const geo = new THREE.BoxGeometry(ww, WALL_HEIGHT, wh)
    const mesh = new THREE.Mesh(geo, wallMat)  // shared material
    mesh.position.set(wx, WALL_HEIGHT / 2, wz)
    scene.add(mesh)
  }
  const buildSide = (side: 'n' | 's' | 'e' | 'w', mainAxisPos: number, start: number, end: number) => {
    const gap = hasGap(side)
    const isHorizontal = side === 'n' || side === 's'
    if (gap) {
      if (isHorizontal) {
        addWall((start + gap.start) / 2, mainAxisPos, gap.start - start, wallThickness)
        addWall((gap.end + end) / 2, mainAxisPos, end - gap.end, wallThickness)
      } else {
        addWall(mainAxisPos, (start + gap.start) / 2, wallThickness, gap.start - start)
        addWall(mainAxisPos, (gap.end + end) / 2, wallThickness, end - gap.end)
      }
    } else {
      if (isHorizontal) addWall((start + end) / 2, mainAxisPos, end - start, wallThickness)
      else addWall(mainAxisPos, (start + end) / 2, wallThickness, end - start)
    }
  }
  buildSide('n', r.y + offsetZ, r.x + offsetX, r.x + r.w + offsetX)
  buildSide('s', r.y + r.h + offsetZ, r.x + offsetX, r.x + r.w + offsetX)
  buildSide('w', r.x + offsetX, r.y + offsetZ, r.y + r.h + offsetZ)
  buildSide('e', r.x + r.w + offsetX, r.y + offsetZ, r.y + r.h + offsetZ)
}

function addRoomDecorations(scene: THREE.Scene, r: { x: number; y: number; w: number; h: number; name: string }, offsetX: number, offsetZ: number) {
  const cx = r.x + r.w / 2 + offsetX
  const cz = r.y + r.h / 2 + offsetZ
  const crateMat = new THREE.MeshStandardMaterial({ color: 0x6b5a3e, roughness: 0.8 })
  const barrelMat = new THREE.MeshStandardMaterial({ color: 0x3a4a5a, roughness: 0.6, metalness: 0.4 })
  const tableMat = new THREE.MeshStandardMaterial({ color: 0x4a3a2a, roughness: 0.7 })
  const screenMat = new THREE.MeshStandardMaterial({ color: 0x1a2a3a, emissive: 0x00ff88, emissiveIntensity: 0.5, roughness: 0.3 })
  const plantMat = new THREE.MeshStandardMaterial({ color: 0x2a5a2a, roughness: 0.9 })
  const potMat = new THREE.MeshStandardMaterial({ color: 0x5a3a2a, roughness: 0.8 })

  if (r.name === 'Cafeteria') {
    const table = new THREE.Mesh(new THREE.BoxGeometry(80, 8, 30), tableMat)
    table.position.set(cx, 4, cz - 40); table.castShadow = true; scene.add(table)
    for (const [dx, dz] of [[-r.w/2+20, -r.h/2+20], [r.w/2-20, -r.h/2+20], [-r.w/2+20, r.h/2-20], [r.w/2-20, r.h/2-20]]) {
      const pot = new THREE.Mesh(new THREE.CylinderGeometry(6, 7, 8, 8), potMat)
      pot.position.set(cx + dx, 4, cz + dz); scene.add(pot)
      const plant = new THREE.Mesh(new THREE.SphereGeometry(8, 8, 6), plantMat)
      plant.position.set(cx + dx, 14, cz + dz); scene.add(plant)
    }
  } else if (r.name === 'Engine' || r.name === 'Reactor') {
    for (let i = 0; i < 2; i++) {
      const cyl = new THREE.Mesh(new THREE.CylinderGeometry(18, 18, 50, 16), barrelMat)
      cyl.position.set(cx - 50 + i * 100, 25, cz + 30); cyl.castShadow = true; scene.add(cyl)
      const top = new THREE.Mesh(new THREE.CylinderGeometry(12, 12, 4, 16), screenMat)
      top.position.set(cx - 50 + i * 100, 52, cz + 30); scene.add(top)
    }
  } else if (r.name === 'MedBay') {
    for (let i = 0; i < 2; i++) {
      const bed = new THREE.Mesh(new THREE.BoxGeometry(20, 6, 40), new THREE.MeshStandardMaterial({ color: 0xdddddd, roughness: 0.5 }))
      bed.position.set(cx - 30 + i * 60, 3, cz); bed.castShadow = true; scene.add(bed)
    }
    const screen = new THREE.Mesh(new THREE.BoxGeometry(30, 20, 4), screenMat)
    screen.position.set(cx, 30, cz - r.h/2 + 10); scene.add(screen)
  } else if (r.name === 'Security') {
    const desk = new THREE.Mesh(new THREE.BoxGeometry(60, 8, 25), tableMat)
    desk.position.set(cx, 4, cz); desk.castShadow = true; scene.add(desk)
    for (let i = 0; i < 3; i++) {
      const mon = new THREE.Mesh(new THREE.BoxGeometry(14, 10, 3), screenMat)
      mon.position.set(cx - 20 + i * 20, 16, cz - 8); scene.add(mon)
    }
  } else if (r.name === 'Navigation' || r.name === 'Communications') {
    const console_ = new THREE.Mesh(new THREE.BoxGeometry(50, 12, 30), tableMat)
    console_.position.set(cx, 6, cz); console_.castShadow = true; scene.add(console_)
    const holo = new THREE.Mesh(new THREE.CylinderGeometry(15, 15, 2, 16), new THREE.MeshBasicMaterial({ color: 0x00ffff, transparent: true, opacity: 0.4 }))
    holo.position.set(cx, 14, cz); scene.add(holo)
  } else if (r.name === 'Electrical') {
    const panelMat = new THREE.MeshStandardMaterial({ color: 0x2a2a3a, roughness: 0.6 })
    for (let i = 0; i < 3; i++) {
      const panel = new THREE.Mesh(new THREE.BoxGeometry(8, 30, 6), panelMat)
      panel.position.set(cx - 40 + i * 40, 18, cz - r.h/2 + 10); panel.castShadow = true; scene.add(panel)
      for (let j = 0; j < 4; j++) {
        const brk = new THREE.Mesh(new THREE.BoxGeometry(4, 4, 2), screenMat)
        brk.position.set(cx - 40 + i * 40, 12 + j * 6, cz - r.h/2 + 14); scene.add(brk)
      }
    }
  } else if (r.name === 'Storage') {
    for (let i = 0; i < 4; i++) {
      const crate = new THREE.Mesh(new THREE.BoxGeometry(18, 18, 18), crateMat)
      crate.position.set(cx - 40 + (i % 2) * 40, 9, cz - 30 + Math.floor(i / 2) * 40); crate.castShadow = true; scene.add(crate)
    }
    for (let i = 0; i < 3; i++) {
      const barrel = new THREE.Mesh(new THREE.CylinderGeometry(8, 8, 20, 12), barrelMat)
      barrel.position.set(cx + 50, 10, cz - 20 + i * 25); barrel.castShadow = true; scene.add(barrel)
    }
  } else if (r.name === 'Weapons' || r.name === 'O2') {
    const station = new THREE.Mesh(new THREE.CylinderGeometry(15, 18, 35, 12), barrelMat)
    station.position.set(cx, 18, cz); station.castShadow = true; scene.add(station)
    const top = new THREE.Mesh(new THREE.CylinderGeometry(10, 10, 4, 12), screenMat)
    top.position.set(cx, 38, cz); scene.add(top)
  } else if (r.name === 'Admin') {
    const table = new THREE.Mesh(new THREE.CylinderGeometry(25, 25, 8, 16), tableMat)
    table.position.set(cx, 4, cz); table.castShadow = true; scene.add(table)
    const holo = new THREE.Mesh(new THREE.CylinderGeometry(18, 18, 2, 16), new THREE.MeshBasicMaterial({ color: 0xff00ff, transparent: true, opacity: 0.4 }))
    holo.position.set(cx, 10, cz); scene.add(holo)
  }
}

// Create a floating name label above a player's head
function createNameLabel(name: string, color: string, alive: boolean): THREE.Sprite {
  const canvas = document.createElement('canvas')
  canvas.width = 256; canvas.height = 64
  const ctx = canvas.getContext('2d')!
  // Background pill
  ctx.fillStyle = 'rgba(0, 0, 0, 0.75)'
  roundRect(ctx, 8, 12, 240, 40, 20)
  ctx.fill()
  // Border in player color
  ctx.strokeStyle = color
  ctx.lineWidth = 3
  roundRect(ctx, 8, 12, 240, 40, 20)
  ctx.stroke()
  // Name text
  ctx.fillStyle = '#ffffff'
  ctx.font = 'bold 22px sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(name, 128, 33)
  const texture = new THREE.CanvasTexture(canvas)
  const mat = new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: true, depthWrite: false })
  const sprite = new THREE.Sprite(mat)
  sprite.scale.set(50, 13, 1)
  // No renderOrder override — walls will naturally block the label
  return sprite
}

function roundRect(ctx: any, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

function createCharacter(color: string): THREE.Group {
  const group = new THREE.Group()
  const colorObj = new THREE.Color(color)
  const body = new THREE.Mesh(new THREE.CapsuleGeometry(14, 18, 8, 16), new THREE.MeshStandardMaterial({ color: colorObj, roughness: 0.5, metalness: 0.1 }))
  body.position.y = 16; body.castShadow = true; body.receiveShadow = true; group.add(body)
  const visor = new THREE.Mesh(new THREE.SphereGeometry(9, 16, 12), new THREE.MeshStandardMaterial({ color: 0x93c5fd, roughness: 0.1, metalness: 0.3, emissive: 0x60a5fa, emissiveIntensity: 0.3 }))
  visor.position.set(0, 22, 8); visor.scale.set(1, 0.7, 0.8); visor.castShadow = true; group.add(visor)
  const highlight = new THREE.Mesh(new THREE.SphereGeometry(2.5, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffffff }))
  highlight.position.set(-3, 25, 12); group.add(highlight)
  const pack = new THREE.Mesh(new THREE.BoxGeometry(12, 18, 8), new THREE.MeshStandardMaterial({ color: colorObj, roughness: 0.6 }))
  pack.position.set(0, 16, -12); pack.castShadow = true; group.add(pack)
  const legGeo = new THREE.CylinderGeometry(4, 5, 8, 8)
  const legMat = new THREE.MeshStandardMaterial({ color: colorObj, roughness: 0.6 })
  const legL = new THREE.Mesh(legGeo, legMat); legL.position.set(-6, 4, 0); legL.castShadow = true; group.add(legL)
  const legR = new THREE.Mesh(legGeo, legMat); legR.position.set(6, 4, 0); legR.castShadow = true; group.add(legR)
  return group
}
