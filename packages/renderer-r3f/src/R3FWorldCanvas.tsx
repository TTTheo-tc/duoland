'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Canvas, useFrame, useThree, type ThreeEvent } from '@react-three/fiber'
import type { Mesh } from 'three'
import type {
  CharacterPlacement,
  InteractableDefinition,
  SceneDefinition,
  WorldDefinition,
  WorldRendererToRuntimeEvent
} from '@sel-quest/world-core'
import { createInteractableClickedEvent } from './events'

const DEFAULT_CAMERA_POSITION: [number, number, number] = [0, 2.4, 6]
const DEFAULT_CAMERA_TARGET: [number, number, number] = [0, 0.9, 0]
const CHARACTER_BODY_Y = 0.72

export interface R3FWorldCanvasProps {
  world: WorldDefinition
  sceneId?: string
  preserveDrawingBuffer?: boolean
  onRendererEvent?: (event: WorldRendererToRuntimeEvent) => void
}

export function R3FWorldCanvas({
  world,
  sceneId,
  preserveDrawingBuffer = false,
  onRendererEvent
}: R3FWorldCanvasProps) {
  const scene = resolveScene(world, sceneId)
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const interactables = useMemo(
    () =>
      scene.interactableIds
        .map((id) => world.interactables.find((item) => item.id === id))
        .filter((item): item is InteractableDefinition => Boolean(item)),
    [scene.interactableIds, world.interactables]
  )
  const npcInteractables = useMemo(
    () => interactables.filter((item) => item.type === 'npc'),
    [interactables]
  )
  const objectInteractables = useMemo(
    () => interactables.filter((item) => item.type !== 'npc'),
    [interactables]
  )

  const selectInteractable = (interactable: InteractableDefinition) => {
    setSelectedId(interactable.id)
    onRendererEvent?.(createInteractableClickedEvent(interactable.id))
  }

  return (
    <div className="r3f-world-shell">
      <Canvas
        camera={{
          position: scene.cameraStart?.position ?? DEFAULT_CAMERA_POSITION,
          fov: scene.cameraStart?.fov ?? 45
        }}
        gl={{ preserveDrawingBuffer }}
      >
        <CameraTarget target={scene.cameraStart?.target ?? DEFAULT_CAMERA_TARGET} />
        <color attach="background" args={['#d7f5ff']} />
        <ambientLight intensity={0.55} />
        <directionalLight position={[4, 6, 3]} intensity={1.6} />
        <Room />
        {scene.characterPlacements.map((placement) => {
          const npcInteractable = findNpcInteractableForPlacement(
            npcInteractables,
            placement
          )

          return (
            <CharacterActor
              key={placement.characterId}
              placement={placement}
              selected={selectedId === npcInteractable?.id}
              onSelect={
                npcInteractable
                  ? () => selectInteractable(npcInteractable)
                  : undefined
              }
            />
          )
        })}
        {objectInteractables.map((interactable) => (
          <InteractableObject
            key={interactable.id}
            interactable={interactable}
            selected={selectedId === interactable.id}
            onSelect={() => selectInteractable(interactable)}
          />
        ))}
      </Canvas>
      <div className="r3f-status-strip">
        <span>{world.title}</span>
        <span>{scene.title}</span>
        <span>{selectedId ?? '未选择'}</span>
      </div>
    </div>
  )
}

function CameraTarget({ target }: { target: [number, number, number] }) {
  const { camera } = useThree()

  useEffect(() => {
    camera.lookAt(target[0], target[1], target[2])
    camera.updateProjectionMatrix()
  }, [camera, target])

  return null
}

function Room() {
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]}>
        <planeGeometry args={[7, 6]} />
        <meshStandardMaterial color="#f7f0de" />
      </mesh>
      <mesh position={[0, 1.6, -2.9]}>
        <boxGeometry args={[7, 3.2, 0.12]} />
        <meshStandardMaterial color="#f1f7ff" />
      </mesh>
      <mesh position={[-2.8, 0.8, -1.2]}>
        <boxGeometry args={[0.12, 1.6, 2.4]} />
        <meshStandardMaterial color="#f8d775" />
      </mesh>
      <mesh position={[2.3, 0.65, -1.3]} rotation={[0, -0.35, 0]}>
        <boxGeometry args={[1.4, 1.05, 0.08]} />
        <meshStandardMaterial color="#ffffff" />
      </mesh>
    </group>
  )
}

function CharacterActor({
  placement,
  selected,
  onSelect
}: {
  placement: CharacterPlacement
  selected: boolean
  onSelect?: () => void
}) {
  const meshRef = useRef<Mesh | null>(null)

  useFrame(({ clock }) => {
    if (!meshRef.current) return
    meshRef.current.position.y =
      CHARACTER_BODY_Y + Math.sin(clock.elapsedTime * 1.6) * 0.035
  })

  return (
    <group
      position={placement.position}
      rotation={[0, placement.rotationY ?? 0, 0]}
      onClick={
        onSelect
          ? (event: ThreeEvent<MouseEvent>) => {
              event.stopPropagation()
              onSelect()
            }
          : undefined
      }
    >
      {selected ? (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
          <ringGeometry args={[0.42, 0.52, 32]} />
          <meshStandardMaterial color="#f97316" />
        </mesh>
      ) : null}
      <mesh ref={meshRef} position={[0, CHARACTER_BODY_Y, 0]}>
        <capsuleGeometry args={[0.26, 0.72, 8, 16]} />
        <meshStandardMaterial color="#2563eb" />
      </mesh>
      <mesh position={[0, 1.34, 0]}>
        <sphereGeometry args={[0.28, 24, 24]} />
        <meshStandardMaterial color="#f8d775" />
      </mesh>
    </group>
  )
}

function findNpcInteractableForPlacement(
  interactables: InteractableDefinition[],
  placement: CharacterPlacement
): InteractableDefinition | undefined {
  return interactables.find(
    (interactable) => interactable.characterId === placement.characterId
  )
}

function InteractableObject({
  interactable,
  selected,
  onSelect
}: {
  interactable: InteractableDefinition
  selected: boolean
  onSelect: () => void
}) {
  const isClue = interactable.type === 'emotion_clue'
  const scale = selected ? 1.12 : 1

  return (
    <mesh
      position={interactable.position}
      scale={[scale, scale, scale]}
      onClick={(event) => {
        event.stopPropagation()
        onSelect()
      }}
    >
      {isClue ? (
        <boxGeometry args={[0.75, 0.06, 0.5]} />
      ) : (
        <sphereGeometry args={[0.32, 24, 24]} />
      )}
      <meshStandardMaterial
        color={selected ? '#f97316' : isClue ? '#ffffff' : '#16a34a'}
      />
    </mesh>
  )
}

function resolveScene(world: WorldDefinition, sceneId?: string): SceneDefinition {
  const scene = sceneId
    ? world.scenes.find((candidate) => candidate.id === sceneId)
    : world.scenes[0]

  if (!scene) {
    throw new Error(`World scene does not exist: ${sceneId ?? '<first>'}`)
  }

  return scene
}
