import { useRef, useMemo } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'

function Sky() {
  return (
    <mesh position={[0, 0, -50]}>
      <planeGeometry args={[200, 100]} />
      <meshBasicMaterial color="#87ceeb" depthWrite={false} />
    </mesh>
  )
}

function CloudLayer({ scrollOffset, factor }) {
  const ref = useRef()
  const x = useMemo(() => (scrollOffset ?? 0) * factor * -0.02, [scrollOffset, factor])
  useFrame(() => {
    if (ref.current) ref.current.position.x = x
  })
  return (
    <group ref={ref}>
      <mesh position={[-15, 8, -20]}>
        <sphereGeometry args={[4, 8, 6]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0.9} depthWrite={false} />
      </mesh>
      <mesh position={[-5, 10, -22]}>
        <sphereGeometry args={[3, 8, 6]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0.85} depthWrite={false} />
      </mesh>
      <mesh position={[10, 6, -18]}>
        <sphereGeometry args={[5, 8, 6]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0.9} depthWrite={false} />
      </mesh>
      <mesh position={[25, 9, -21]}>
        <sphereGeometry args={[3.5, 8, 6]} />
        <meshBasicMaterial color="#ffffff" transparent opacity={0.85} depthWrite={false} />
      </mesh>
    </group>
  )
}

function GroundLayer({ scrollOffset }) {
  const ref = useRef()
  const x = useMemo(() => (scrollOffset ?? 0) * -0.015, [scrollOffset])
  useFrame(() => {
    if (ref.current) ref.current.position.x = x
  })
  return (
    <group ref={ref} position={[0, -12, -10]}>
      <mesh>
        <planeGeometry args={[200, 30]} />
        <meshBasicMaterial color="#7cb342" depthWrite={false} />
      </mesh>
    </group>
  )
}

function Scene({ scrollOffset }) {
  return (
    <>
      <Sky />
      <CloudLayer scrollOffset={scrollOffset} factor={1} />
      <CloudLayer scrollOffset={scrollOffset} factor={0.5} />
      <GroundLayer scrollOffset={scrollOffset} />
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
