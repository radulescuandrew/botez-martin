import { useRef, useMemo } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'

function DeepSpace() {
  return (
    <mesh position={[0, 0, -50]}>
      <planeGeometry args={[200, 100]} />
      <meshBasicMaterial color="#060816" depthWrite={false} />
    </mesh>
  )
}

function NebulaLayer({ scrollOffset, factor, color, opacity, yShift }) {
  const ref = useRef()
  const x = useMemo(() => (scrollOffset ?? 0) * factor * -0.02, [scrollOffset, factor])
  useFrame(() => {
    if (ref.current) ref.current.position.x = x
  })
  return (
    <group ref={ref}>
      <mesh position={[-16, 8 + yShift, -20]}>
        <sphereGeometry args={[5.5, 16, 12]} />
        <meshBasicMaterial color={color} transparent opacity={opacity} depthWrite={false} />
      </mesh>
      <mesh position={[-5, 10 + yShift, -22]}>
        <sphereGeometry args={[4.2, 16, 12]} />
        <meshBasicMaterial color={color} transparent opacity={opacity * 0.9} depthWrite={false} />
      </mesh>
      <mesh position={[11, 6 + yShift, -18]}>
        <sphereGeometry args={[6, 16, 12]} />
        <meshBasicMaterial color={color} transparent opacity={opacity * 0.95} depthWrite={false} />
      </mesh>
      <mesh position={[26, 9 + yShift, -21]}>
        <sphereGeometry args={[4.5, 16, 12]} />
        <meshBasicMaterial color={color} transparent opacity={opacity * 0.88} depthWrite={false} />
      </mesh>
    </group>
  )
}

function StarField({ scrollOffset, factor = 1, z = -12, color = '#ffffff', size = 0.09 }) {
  const ref = useRef()
  const points = useMemo(() => {
    const count = 160
    const arr = new Float32Array(count * 3)
    for (let i = 0; i < count; i += 1) {
      arr[i * 3] = (Math.random() - 0.5) * 95
      arr[i * 3 + 1] = (Math.random() - 0.5) * 55
      arr[i * 3 + 2] = z + (Math.random() - 0.5) * 3
    }
    return arr
  }, [z])

  const x = useMemo(() => (scrollOffset ?? 0) * factor * -0.03, [scrollOffset, factor])
  useFrame(() => {
    if (ref.current) ref.current.position.x = x
  })
  return (
    <points ref={ref}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[points, 3]} />
      </bufferGeometry>
      <pointsMaterial color={color} size={size} sizeAttenuation transparent opacity={0.9} />
    </points>
  )
}

function Scene({ scrollOffset }) {
  return (
    <>
      <DeepSpace />
      <StarField scrollOffset={scrollOffset} factor={0.25} z={-24} color="#9bb2ff" size={0.06} />
      <StarField scrollOffset={scrollOffset} factor={0.55} z={-15} color="#d6e0ff" size={0.08} />
      <StarField scrollOffset={scrollOffset} factor={1} z={-9} color="#ffffff" size={0.1} />
      <NebulaLayer scrollOffset={scrollOffset} factor={0.35} color="#5c4ee2" opacity={0.15} yShift={1} />
      <NebulaLayer scrollOffset={scrollOffset} factor={0.7} color="#26a5b8" opacity={0.1} yShift={-3} />
    </>
  )
}

export default function ParallaxBackground({ scrollOffset = 0 }) {
  return (
    <div className="parallax-background">
      <Canvas
        camera={{ position: [0, 0, 5], fov: 60 }}
        gl={{ alpha: true, antialias: false }}
        dpr={[1, 2]}
      >
        <Scene scrollOffset={scrollOffset} />
      </Canvas>
    </div>
  )
}
