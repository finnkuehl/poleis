// The roads on the map (docs/ART.md "Roads"): gravel tracks and stone paving as textured meshes.
// The small textures are generated once (roadTextures.ts) and shared; the network becomes one
// mesh per texture (roadPaint.ts), so the whole road network costs seven draw calls. The meshes are
// rebuilt only when the road network changes (geometry.ts `roadSignature`).
//
// The meshes use PixiJS's own mesh shader plus its per-vertex color (the same building blocks
// as the sprite batcher), so every vertex carries its own color and alpha: soft edges, fading
// ends and the light on the relief come from the vertices, the material from the textures.
import {
  BufferImageSource,
  Container,
  Graphics,
  Matrix,
  Mesh,
  MeshGeometry,
  Shader,
  Texture,
  colorBit,
  colorBitGl,
  compileHighShaderGlProgram,
  compileHighShaderGpuProgram,
  localUniformBit,
  localUniformBitGl,
  roundPixelsBit,
  roundPixelsBitGl,
  textureBit,
  textureBitGl,
  type GlProgram,
  type GpuProgram,
} from 'pixi.js';
import { hexToPixel, type Hex } from '../core/hex';
import type { GameState, PlayerId } from '../core/state';
import { buildingsShownTo } from './fog';
import { previewPiece, roadSignature, roadTracks, type TrackParams } from './geometry';
import type { MeshData } from './roadMesh';
import { ROAD_MESHES, roadMeshData, type RoadMeshId } from './roadPaint';
import {
  bankImage,
  flagstoneTileImage,
  gravelTileImage,
  pavingImage,
  pavingReliefImage,
  rutReliefImage,
  type PixelImage,
} from './roadTextures';
import { theme } from './theme';

const R = theme.road;

/** Track sizes from the theme (see geometry.ts `roadTracks`). */
export function roadTrackParams(): TrackParams {
  return {
    width: R.width,
    pavingWidth: R.paving.width,
    edgeJitter: R.edgeJitter,
    centerJitter: R.centerJitter,
    buildingEnd: R.buildingEnd,
    plazaRx: R.plazaRx,
    plazaRy: R.plazaRy,
    samples: R.samples,
    bankRamp: R.banks.ramp,
    junctionRadius: R.junctionRadius,
    deadEndRadius: R.deadEndRadius,
    loneRadius: R.loneRadius,
    squareRadius: R.paving.squareRadius,
  };
}

type TextureId = 'gravel' | 'ruts' | 'paving' | 'pavingRelief' | 'flagstone' | 'bank';

/** Which texture each mesh uses. */
const MESH_TEXTURE: Record<RoadMeshId, TextureId> = {
  shoulders: 'gravel',
  banks: 'bank',
  surface: 'gravel',
  ruts: 'ruts',
  paving: 'paving',
  pavingRelief: 'pavingRelief',
  squares: 'flagstone',
};

const textures: Partial<Record<TextureId, Texture>> = {};

/** A texture from pixels: repeats along x (and along y for planar tiles), with mipmaps. */
function makeTexture(image: PixelImage, repeatY: boolean): Texture {
  return new Texture({
    source: new BufferImageSource({
      resource: image.pixels,
      width: image.width,
      height: image.height,
      format: 'rgba8unorm',
      alphaMode: 'premultiplied-alpha',
      addressModeU: 'repeat',
      addressModeV: repeatY ? 'repeat' : 'clamp-to-edge',
      scaleMode: 'linear',
      mipmapFilter: 'linear',
      autoGenerateMipmaps: true,
    }),
  });
}

/** The shared road textures (made once, on first use). */
export function roadTexture(id: TextureId): Texture {
  let tex = textures[id];
  if (!tex) {
    const S = R.textures;
    switch (id) {
      case 'gravel':
        tex = makeTexture(gravelTileImage(S.gravelSize), true);
        break;
      case 'ruts':
        tex = makeTexture(rutReliefImage(S.rutSize.along, S.rutSize.across), false);
        break;
      case 'paving':
        tex = makeTexture(pavingImage(S.pavingSize.along, S.pavingSize.across), false);
        break;
      case 'pavingRelief':
        tex = makeTexture(pavingReliefImage(S.pavingSize.along, S.pavingSize.across), false);
        break;
      case 'flagstone':
        tex = makeTexture(flagstoneTileImage(S.flagstoneSize), true);
        break;
      case 'bank':
        tex = makeTexture(bankImage(S.bankSize.along, S.bankSize.across), false);
        break;
    }
    textures[id] = tex;
  }
  return tex;
}

let programs: { gl: GlProgram; gpu: GpuProgram } | null = null;
const shaders: Partial<Record<TextureId, Shader>> = {};

/** PixiJS's mesh shader with a per-vertex color (compiled once). */
function roadShader(id: TextureId): Shader {
  programs ??= {
    gl: compileHighShaderGlProgram({
      name: 'road-mesh',
      bits: [localUniformBitGl, textureBitGl, roundPixelsBitGl, colorBitGl],
    }),
    gpu: compileHighShaderGpuProgram({
      name: 'road-mesh',
      bits: [localUniformBit, textureBit, roundPixelsBit, colorBit],
    }),
  };
  let shader = shaders[id];
  if (!shader) {
    const source = roadTexture(id).source;
    shader = new Shader({
      glProgram: programs.gl,
      gpuProgram: programs.gpu,
      resources: {
        uTexture: source,
        uSampler: source.style,
        textureUniforms: { uTextureMatrix: { type: 'mat3x3<f32>', value: new Matrix() } },
      },
    });
    shaders[id] = shader;
  }
  return shader;
}

/** A mesh from vertex arrays (null when empty). */
function makeMesh(data: MeshData, texture: TextureId): Mesh<MeshGeometry, Shader> | null {
  if (data.indices.length === 0) return null;
  const geometry = new MeshGeometry({
    positions: new Float32Array(data.positions),
    uvs: new Float32Array(data.uvs),
    indices: new Uint32Array(data.indices),
  });
  // Vertex colors as 4 bytes (0..255 -> 0..1 in the shader)
  const colors = new Uint8Array(data.colors.length);
  for (let i = 0; i < colors.length; i++) {
    colors[i] = Math.round(Math.max(0, Math.min(1, data.colors[i])) * 255);
  }
  geometry.addAttribute('aColor', { buffer: colors, format: 'unorm8x4', stride: 4, offset: 0 });
  return new Mesh({ geometry, shader: roadShader(texture) });
}

/** Replaces the meshes in `layer` by new ones from `data`. */
function fillMeshes(layer: Container, data: Record<RoadMeshId, MeshData>): void {
  for (const child of layer.removeChildren()) {
    // A mesh does not free its geometry (the GPU buffers); the shaders and textures are shared
    const geometry = child instanceof Mesh ? child.geometry : null;
    child.destroy();
    // true: also its GPU buffers (not shared with anything)
    geometry?.destroy(true);
  }
  for (const id of ROAD_MESHES) {
    const mesh = makeMesh(data[id], MESH_TEXTURE[id]);
    if (mesh) layer.addChild(mesh);
  }
}

export interface RoadLayer {
  /** The roads (on the ground, below the buildings). */
  roads: Container;
  /** The planned road while building one (above the units). */
  preview: Container;
  /**
   * Repaints the roads when the network as `viewer` sees it changed (same network: nothing to
   * do). Paving, plaza ends and yards only come from buildings the viewer may see (`revealAll`:
   * test option, every tile counts as explored).
   */
  update(state: GameState, viewer: PlayerId, revealAll: boolean): void;
  /** Ghost of the planned road along `path`, dots on `newTiles` (tiles that need a new road); null clears. */
  setPreview(path: readonly Hex[] | null, newTiles: readonly Hex[]): void;
}

export function createRoadLayer(size: number): RoadLayer {
  const roads = new Container();
  const preview = new Container();
  const ghostMeshes = new Container();
  const dots = new Graphics();
  preview.addChild(ghostMeshes, dots);
  /** Key of the road network last painted. */
  let key: string | null = null;
  return {
    roads,
    preview,
    update(state, viewer, revealAll) {
      const shown = buildingsShownTo(state, viewer, revealAll);
      const next = roadSignature(state, shown);
      if (next === key) return;
      key = next;
      fillMeshes(roads, roadMeshData(roadTracks(state, size, roadTrackParams(), shown), size));
    },
    setPreview(path, newTiles) {
      dots.clear();
      if (!path || path.length === 0) {
        fillMeshes(ghostMeshes, roadMeshData({ pieces: [], crossings: [] }, size));
        return;
      }
      const ghost = { tint: R.preview.tint, mix: R.preview.tintMix, alpha: R.preview.alpha };
      const c0 = hexToPixel(path[0], size);
      const tracks =
        path.length === 1
          ? {
              pieces: [],
              crossings: [
                {
                  tile: -1,
                  style: 'dirt' as const,
                  kind: 'lone' as const,
                  center: c0,
                  r: R.width * size * R.loneRadius,
                },
              ],
            }
          : { pieces: [previewPiece(path, size, R.width)], crossings: [] };
      fillMeshes(ghostMeshes, roadMeshData(tracks, size, ghost));
      for (const h of newTiles) {
        const p = hexToPixel(h, size);
        dots.circle(p.x, p.y, size * R.preview.dotRadius);
      }
      dots.fill(R.preview.dotColor);
    },
  };
}
