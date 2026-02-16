import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

function SingleBlackHole({ x, y, scale = 1 }) {
  const diskRef = useRef(null)

  useFrame((_, delta) => {
    if (diskRef.current) diskRef.current.rotation.z += delta * 0.4
  })

  const sphereRadius = 10 * scale
  const diskMajor = 18 * scale
  const diskTube = 3 * scale

  return (
    <group position={[x, y, 0]}>
      <mesh>
        <sphereGeometry args={[sphereRadius, 32, 24]} />
        <meshBasicMaterial color="#000000" depthWrite={true} />
      </mesh>
      <mesh ref={diskRef} rotation={[Math.PI / 2 - 0.2, 0, 0]}>
        <torusGeometry args={[diskMajor, diskTube, 16, 48]} />
        <meshBasicMaterial
          color="#ff8844"
          transparent
          opacity={0.92}
        />
      </mesh>
      <mesh rotation={[Math.PI / 2 - 0.2, 0, 0]}>
        <ringGeometry args={[diskMajor + 2, diskMajor + 10, 32]} />
        <meshBasicMaterial
          color="#ff6622"
          transparent
          opacity={0.3}
          side={THREE.DoubleSide}
        />
      </mesh>
    </group>
  )
}

function BlackHoleMeshes({ blackHoles, scrollX, logicalWidth, logicalHeight }) {
  if (!blackHoles?.length) return null

  const halfW = logicalWidth / 2
  const halfH = logicalHeight / 2
  const margin = 80

  return blackHoles
    .filter((bh) => {
      const screenX = bh.x - scrollX
      return screenX >= -margin && screenX <= logicalWidth + margin
    })
    .map((bh, idx) => {
      const screenX = bh.x - scrollX
      const threeX = screenX - halfW
      const threeY = halfH - bh.y
      const scale = ((bh.absorbRadius ?? 20) / 20) * 0.85
      return (
        <SingleBlackHole
          key={`bh-${bh.x}-${bh.y}-${idx}`}
          x={threeX}
          y={threeY}
          scale={scale}
        />
      )
    })
}

export default function GameBlackHoleScene({ blackHoles, scrollX, logicalWidth, logicalHeight }) {
  return (
    <>
      <orthographicCamera
        makeDefault
        position={[0, 0, 100]}
        left={-logicalWidth / 2}
        right={logicalWidth / 2}
        top={logicalHeight / 2}
        bottom={-logicalHeight / 2}
        near={0.1}
        far={200}
      />
      <color attach="background" args={['rgba(0,0,0,0)']} />
      <BlackHoleMeshes
        blackHoles={blackHoles}
        scrollX={scrollX}
        logicalWidth={logicalWidth}
        logicalHeight={logicalHeight}
      />
    </>
  )
}
