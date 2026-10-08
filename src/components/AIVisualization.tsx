import { useEffect, useRef } from 'react'
import * as THREE from 'three'

const NETWORK_RADIUS = 1.28
const LONGITUDE_STEP = 6
const LATITUDE_STEP = 6
const CONTINENTS: number[][][] = [
  [[-168, 70], [-150, 72], [-135, 65], [-125, 55], [-124, 48], [-117, 32], [-108, 25], [-97, 18], [-90, 15], [-83, 9], [-77, 8], [-79, 25], [-67, 45], [-60, 53], [-78, 60], [-95, 72], [-120, 75], [-145, 72]],
  [[-52, 82], [-32, 78], [-20, 70], [-40, 59], [-55, 62], [-62, 72]],
  [[-81, 12], [-72, 10], [-63, 6], [-52, 2], [-44, -3], [-35, -8], [-39, -20], [-50, -30], [-60, -39], [-69, -55], [-75, -42], [-78, -20]],
  [[-11, 36], [-10, 44], [-5, 50], [2, 54], [8, 58], [18, 70], [32, 72], [45, 66], [60, 72], [78, 70], [95, 78], [120, 72], [140, 58], [160, 60], [178, 52], [165, 43], [145, 38], [135, 33], [122, 22], [110, 8], [100, 2], [105, -5], [120, -8], [130, -5], [140, -8], [153, -25], [145, -39], [130, -35], [115, -30], [112, -10], [102, 0], [90, 8], [80, 7], [75, 19], [65, 25], [55, 25], [48, 30], [40, 40], [30, 38], [22, 34], [15, 37], [8, 42], [0, 42], [-5, 36]],
  [[-17, 36], [-5, 37], [10, 34], [25, 31], [34, 20], [42, 12], [50, 10], [48, -5], [40, -15], [34, -28], [20, -35], [12, -18], [5, -5], [-5, 5], [-15, 15]],
  [[112, -11], [130, -10], [145, -15], [154, -27], [148, -39], [134, -44], [118, -35], [113, -24]],
  [[47, -13], [50, -16], [49, -25], [45, -24]],
]

function isLand(longitude: number, latitude: number) {
  return CONTINENTS.some((polygon) => {
    let inside = false
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
      const [xi, yi] = polygon[i]
      const [xj, yj] = polygon[j]
      const intersects = yi > latitude !== yj > latitude &&
        longitude < ((xj - xi) * (latitude - yi)) / (yj - yi) + xi
      if (intersects) inside = !inside
    }
    return inside
  })
}

export default function AIVisualization({ active = false }: { active?: boolean }) {
  const host = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const element = host.current
    if (!element) return

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5))
    renderer.setClearColor(0x000000, 0)
    element.appendChild(renderer.domElement)

    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100)
    camera.position.z = 6.6

    const core = new THREE.Group()
    core.rotation.z = -0.20
    scene.add(core)

    const dentSurface = new THREE.Mesh(
      new THREE.SphereGeometry(NETWORK_RADIUS, 32, 32),
      new THREE.MeshBasicMaterial({
        colorWrite: false,
        depthWrite: false,
        side: THREE.DoubleSide,
      }),
    )
    core.add(dentSurface)

    const longitudeCount = 360 / LONGITUDE_STEP
    const latitudes = Array.from(
      { length: 180 / LATITUDE_STEP - 1 },
      (_, index) => -90 + LATITUDE_STEP * (index + 1),
    )
    const nodePositions: THREE.Vector3[] = []
    const nodeLand: number[] = []
    latitudes.forEach((latitude) => {
      const latitudeRadians = THREE.MathUtils.degToRad(latitude)
      for (let column = 0; column < longitudeCount; column++) {
        const longitude = -180 + column * LONGITUDE_STEP
        const longitudeRadians = THREE.MathUtils.degToRad(longitude)
        const cosLatitude = Math.cos(latitudeRadians)
        nodePositions.push(
          new THREE.Vector3(
            Math.sin(longitudeRadians) * cosLatitude * NETWORK_RADIUS,
            Math.sin(latitudeRadians) * NETWORK_RADIUS,
            Math.cos(longitudeRadians) * cosLatitude * NETWORK_RADIUS,
          ),
        )
        nodeLand.push(isLand(longitude, latitude) ? 1 : 0)
      }
    })

    const landVertices: number[] = []
    latitudes.slice(0, -1).forEach((_, row) => {
      for (let column = 0; column < longitudeCount; column++) {
        const nextColumn = (column + 1) % longitudeCount
        const corners = [
          row * longitudeCount + column,
          row * longitudeCount + nextColumn,
          (row + 1) * longitudeCount + column,
          (row + 1) * longitudeCount + nextColumn,
        ]
        const landCorners = corners.filter((index) => nodeLand[index] === 1)
        if (landCorners.length < 3) continue
        const triangles = landCorners.length === 4
          ? [corners[0], corners[1], corners[2], corners[1], corners[3], corners[2]]
          : landCorners
        triangles.forEach((index) => {
          const point = nodePositions[index].clone().setLength(NETWORK_RADIUS * 1.004)
          landVertices.push(point.x, point.y, point.z)
        })
      }
    })
    const landGeometry = new THREE.BufferGeometry()
    landGeometry.setAttribute('position', new THREE.Float32BufferAttribute(landVertices, 3))
    const landMaterial = new THREE.MeshBasicMaterial({
      color: 0x37bd8c,
      transparent: true,
      opacity: 0.2,
      side: THREE.DoubleSide,
      depthWrite: false,
    })
    core.add(new THREE.Mesh(landGeometry, landMaterial))

    const edgeVertices: number[] = []
    const edgePhases: number[] = []
    const edgeLand: number[] = []
    latitudes.forEach((_, row) => {
      for (let column = 0; column < longitudeCount; column++) {
        const index = row * longitudeCount + column
        const neighbors = [
          row * longitudeCount + ((column + 1) % longitudeCount),
          (row + 1) * longitudeCount + column,
        ]
        neighbors.forEach((neighbor) => {
          if (neighbor >= nodePositions.length) return
          const from = nodePositions[index]
          const to = nodePositions[neighbor]
          const landWeight = (nodeLand[index] + nodeLand[neighbor]) * 0.5
        edgeVertices.push(from.x, from.y, from.z, to.x, to.y, to.z)
        const phase = Math.random()
        edgePhases.push(phase, phase)
          edgeLand.push(landWeight, landWeight)
        })
      }
    })

    const edgeGeometry = new THREE.BufferGeometry()
    edgeGeometry.setAttribute('position', new THREE.Float32BufferAttribute(edgeVertices, 3))
    edgeGeometry.setAttribute('phase', new THREE.Float32BufferAttribute(edgePhases, 1))
    edgeGeometry.setAttribute('land', new THREE.Float32BufferAttribute(edgeLand, 1))
    edgeGeometry.setAttribute(
      'progress',
      new THREE.Float32BufferAttribute(
        Array.from({ length: edgePhases.length }, (_, index) => index % 2),
        1,
      ),
    )
    const edgeMaterial = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: {
        time: { value: 0 },
        pulse: { value: active ? 1 : 0 },
        dentPoint: { value: new THREE.Vector3() },
        dent: { value: 0 },
      },
      vertexShader: `
        attribute float phase;
        attribute float progress;
        attribute float land;
        uniform vec3 dentPoint;
        uniform float dent;
        varying float vPhase;
        varying float vProgress;
        varying float vDepth;
        varying float vLand;
        void main() {
          vPhase = phase;
          vProgress = progress;
          vLand = land;
          float distanceToDent = distance(position, dentPoint);
          float influence = exp(-distanceToDent * distanceToDent * 6.0) * dent;
          vec3 p = position - normalize(position) * influence * 0.48;
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          vDepth = 1.0 - smoothstep(6.4, 8.5, -mv.z) * 0.58;
          gl_Position = projectionMatrix * mv;
        }
      `,
      fragmentShader: `
        uniform float time;
        uniform float pulse;
        varying float vPhase;
        varying float vProgress;
        varying float vDepth;
        varying float vLand;
        void main() {
          float wave = fract(vProgress - time * 0.16 + vPhase);
          float signal = exp(-abs(wave - 0.5) * 22.0);
          float alpha = (0.018 + vLand * 0.17 + signal * (0.035 + vLand * 0.34 + pulse * 0.12)) * vDepth;
          vec3 color = mix(vec3(0.08, 0.34, 0.28), vec3(0.32, 0.9, 0.72), vLand);
          gl_FragColor = vec4(color, alpha);
        }
      `,
    })
    core.add(new THREE.LineSegments(edgeGeometry, edgeMaterial))

    const pointGeometry = new THREE.BufferGeometry()
    pointGeometry.setAttribute(
      'position',
      new THREE.Float32BufferAttribute(nodePositions.flatMap((point) => point.toArray()), 3),
    )
    pointGeometry.setAttribute(
      'phase',
      new THREE.Float32BufferAttribute(
        Array.from({ length: nodePositions.length }, () => Math.random() * Math.PI * 2),
        1,
      ),
    )
    pointGeometry.setAttribute('land', new THREE.Float32BufferAttribute(nodeLand, 1))
    const pointMaterial = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: {
        time: { value: 0 },
        pulse: { value: active ? 1 : 0 },
        dentPoint: { value: new THREE.Vector3() },
        dent: { value: 0 },
      },
      vertexShader: `
        attribute float phase;
        attribute float land;
        uniform float time;
        uniform float pulse;
        uniform vec3 dentPoint;
        uniform float dent;
        varying float vBeat;
        varying float vLand;
        void main() {
          float beat = 0.5 + 0.5 * sin(time * 1.5 + phase);
          float distanceToDent = distance(position, dentPoint);
          float influence = exp(-distanceToDent * distanceToDent * 6.0) * dent;
          vec3 p = position - normalize(position) * influence * 0.48;
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          gl_Position = projectionMatrix * mv;
          gl_PointSize = (0.065 + beat * (0.025 + pulse * 0.015)) * (300.0 / -mv.z);
          vBeat = beat;
          vLand = land;
        }
      `,
      fragmentShader: `
        varying float vBeat;
        varying float vLand;
        void main() {
          float d = length(gl_PointCoord - 0.5);
          if (d > 0.5) discard;
          float halo = 1.0 - smoothstep(0.08, 0.5, d);
          float center = 1.0 - smoothstep(0.0, 0.2, d);
          vec3 seaColor = vec3(0.06, 0.29, 0.25);
          vec3 landColor = vec3(0.8, 1.0, 0.88);
          vec3 color = mix(seaColor, landColor, center * 0.75 + vLand * 0.45);
          float visibility = 0.15 + vLand * 0.85;
          gl_FragColor = vec4(color, (halo * 0.3 + center * 0.65) * visibility * (0.55 + vBeat * 0.45));
        }
      `,
    })
    core.add(new THREE.Points(pointGeometry, pointMaterial))

    const glowMaterial = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: { pulse: { value: active ? 1 : 0 } },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform float pulse;
        varying vec2 vUv;
        void main() {
          float d = length((vUv - 0.5) * 2.0);
          float glow = exp(-d * 4.2) * (0.065 + pulse * 0.035);
          gl_FragColor = vec4(0.18, 0.78, 0.57, glow);
        }
      `,
    })
    const glow = new THREE.Mesh(new THREE.PlaneGeometry(1.45, 1.45), glowMaterial)
    glow.position.z = -0.1
    core.add(glow)

    const orbitMaterial = new THREE.MeshBasicMaterial({
      color: 0x6be0b8,
      transparent: true,
      opacity: 0.17,
      depthWrite: false,
    })
    const orbit = new THREE.Mesh(new THREE.TorusGeometry(1.55, 0.004, 6, 180), orbitMaterial)
    orbit.rotation.set(1.12, 0.18, -0.22)
    core.add(orbit)

    const orbitTwoMaterial = new THREE.MeshBasicMaterial({
      color: 0x59bd9b,
      transparent: true,
      opacity: 0.1,
      depthWrite: false,
    })
    const orbitTwo = new THREE.Mesh(
      new THREE.TorusGeometry(1.68, 0.003, 6, 180),
      orbitTwoMaterial,
    )
    orbitTwo.rotation.set(0.8, -0.7, 0.55)
    core.add(orbitTwo)

    let frame = 0
    let animationFrame = 0
    const pointer = { x: 0, y: 0, hovering: false }
    const dentPoint = new THREE.Vector3()
    const raycaster = new THREE.Raycaster()
    const pointerNdc = new THREE.Vector2()
    let dentTarget = 0
    const move = (event: MouseEvent) => {
      const bounds = element.getBoundingClientRect()
      pointer.x = ((event.clientX - bounds.left) / bounds.width - 0.5) * 2
      pointer.y = ((event.clientY - bounds.top) / bounds.height - 0.5) * 2
      pointer.hovering = true
      pointerNdc.set(pointer.x, -pointer.y)
      raycaster.setFromCamera(pointerNdc, camera)
      const intersection = raycaster.intersectObject(dentSurface, false)[0]
      dentTarget = intersection ? 1 : 0
      if (intersection) {
        dentPoint.copy(core.worldToLocal(intersection.point.clone())).normalize().multiplyScalar(NETWORK_RADIUS)
      }
      if (reduced) draw()
    }
    const leave = () => {
      pointer.x = 0
      pointer.y = 0
      pointer.hovering = false
      dentTarget = 0
      if (reduced) draw()
    }
    element.addEventListener('mousemove', move)
    element.addEventListener('mouseleave', leave)

    const draw = () => {
      if (!reduced) animationFrame = requestAnimationFrame(draw)
      const time = reduced ? 0.6 : frame * 0.012
      edgeMaterial.uniforms.time.value = time
      pointMaterial.uniforms.time.value = time
      edgeMaterial.uniforms.dentPoint.value.copy(dentPoint)
      pointMaterial.uniforms.dentPoint.value.copy(dentPoint)
      edgeMaterial.uniforms.dent.value += (dentTarget - edgeMaterial.uniforms.dent.value) * 0.12
      pointMaterial.uniforms.dent.value += (dentTarget - pointMaterial.uniforms.dent.value) * 0.12
      for (const material of [edgeMaterial, pointMaterial, glowMaterial]) {
        material.uniforms.pulse.value +=
          ((active || pointer.hovering ? 1 : 0) - material.uniforms.pulse.value) * 0.035
      }
      core.rotation.y = (reduced ? 0 : Math.sin(time * 0.3) * 0.16) + pointer.x * 0.24
      core.rotation.x = (reduced ? 0 : Math.sin(time * 0.24) * 0.05) - pointer.y * 0.18
      orbit.rotation.z += reduced ? 0 : 0.001
      orbitTwo.rotation.y += reduced ? 0 : 0.0007
      renderer.render(scene, camera)
      frame++
    }

    const resize = () => {
      const size = Math.min(element.clientWidth || 360, 360)
      renderer.setSize(size, size)
      camera.aspect = 1
      camera.updateProjectionMatrix()
    }
    resize()
    const observer = new ResizeObserver(resize)
    observer.observe(element)
    draw()

    return () => {
      cancelAnimationFrame(animationFrame)
      observer.disconnect()
      element.removeEventListener('mousemove', move)
      element.removeEventListener('mouseleave', leave)
      dentSurface.geometry.dispose()
      dentSurface.material.dispose()
      landGeometry.dispose()
      landMaterial.dispose()
      edgeGeometry.dispose()
      edgeMaterial.dispose()
      pointGeometry.dispose()
      pointMaterial.dispose()
      glow.geometry.dispose()
      glowMaterial.dispose()
      orbit.geometry.dispose()
      orbitMaterial.dispose()
      orbitTwo.geometry.dispose()
      orbitTwoMaterial.dispose()
      renderer.dispose()
      renderer.domElement.remove()
    }
  }, [active])

  return <div ref={host} className={`ai-visual ${active ? 'is-active' : ''}`} aria-hidden="true" />
}
