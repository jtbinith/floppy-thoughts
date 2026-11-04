import * as THREE from 'three'

// The drawing style shared by every 3D prototype: toon shading in three flat bands of light, with
// ink outlines, so things look drawn. Keeps track of what it makes so it can all be freed at once.

export const INK = '#1a110c'

export type Kit = {
  toon: (color: string, extra?: THREE.MeshToonMaterialParameters) => THREE.MeshToonMaterial
  inked: (geometry: THREE.BufferGeometry, material: THREE.Material | THREE.Material[], outline?: number) => THREE.Mesh
  box: (w: number, h: number, d: number, color: string, outline?: number) => THREE.Mesh
  keep: <T extends { dispose: () => void }>(thing: T) => T
  dispose: () => void
}

function toonRamp() {
  const data = new Uint8Array([90, 90, 90, 255, 175, 175, 175, 255, 255, 255, 255, 255])
  const tex = new THREE.DataTexture(data, 3, 1, THREE.RGBAFormat)
  tex.minFilter = THREE.NearestFilter
  tex.magFilter = THREE.NearestFilter
  tex.needsUpdate = true
  return tex
}

// `ink` and `outlineScale` let a scene draw softer, thinner outlines than the default.
export function createKit({ ink = INK, outlineScale = 1 }: { ink?: string; outlineScale?: number } = {}): Kit {
  const disposables: { dispose: () => void }[] = []
  const keep = <T extends { dispose: () => void }>(thing: T) => {
    disposables.push(thing)
    return thing
  }
  const ramp = keep(toonRamp())
  const inkMat = keep(new THREE.MeshBasicMaterial({ color: ink, side: THREE.BackSide }))
  const toon = (color: string, extra: THREE.MeshToonMaterialParameters = {}) => keep(new THREE.MeshToonMaterial({ color, gradientMap: ramp, ...extra }))

  // A mesh with an ink outline: a slightly bigger copy, inside out, drawn in ink behind it.
  // It grows from the shape's own centre, and not at all along a very thin side.
  function inked(geometry: THREE.BufferGeometry, material: THREE.Material | THREE.Material[], outline = 0.03) {
    outline *= outlineScale
    keep(geometry)
    const mesh = new THREE.Mesh(geometry, material)
    mesh.castShadow = true
    mesh.receiveShadow = true
    geometry.computeBoundingBox()
    const size = new THREE.Vector3()
    const centre = new THREE.Vector3()
    geometry.boundingBox!.getSize(size)
    geometry.boundingBox!.getCenter(centre)
    const grow = (s: number) => (s < 0.05 ? 1 : 1 + (2 * outline) / s)
    const hull = new THREE.Mesh(geometry, inkMat)
    hull.scale.set(grow(size.x), grow(size.y), grow(size.z))
    hull.position.set(centre.x * (1 - hull.scale.x), centre.y * (1 - hull.scale.y), centre.z * (1 - hull.scale.z))
    mesh.add(hull)
    return mesh
  }
  const box = (w: number, h: number, d: number, color: string, outline = 0.03) => inked(new THREE.BoxGeometry(w, h, d), toon(color), outline)

  return {
    toon,
    inked,
    box,
    keep,
    dispose: () => disposables.forEach((d) => d.dispose()),
  }
}
