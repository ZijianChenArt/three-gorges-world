// Exactly two tiny, static color maps per renderer. Cloned physical materials
// share these textures; no per-instance or per-face texture is allocated.
export const GRADIENT_HEIGHT = 128;
export const GRADIENT_KINDS = Object.freeze(['acid-glass', 'acid-metal']);
const STOPS = Object.freeze({
  'acid-glass': Object.freeze([[201, 255, 50], [94, 255, 200], [167, 80, 255]].map(Object.freeze)),
  'acid-metal': Object.freeze([[237, 68, 250], [129, 77, 255], [38, 70, 255]].map(Object.freeze)),
});
const unit = value => Math.max(0, Math.min(1, Number.isFinite(value) ? value : .5));

/** Source-height color, also used for the explicitly approximate Canvas tint. */
export function gradientColor(kind, height = .5) {
  const stops = STOPS[kind];
  if (!stops) throw new Error(`Unknown physical gradient: ${kind}`);
  const coordinate = unit(height) * (stops.length - 1);
  const index = Math.min(stops.length - 2, Math.floor(coordinate));
  const blend = coordinate - index;
  return stops[index].map((value, channel) => value + (stops[index + 1][channel] - value) * blend);
}

export function gradientHeight(center, bounds) {
  const halfHeight = Number.isFinite(bounds?.[1]) && bounds[1] > 0 ? bounds[1] : 1;
  return unit((Number.isFinite(center?.[1]) ? center[1] : 0) / (2 * halfHeight) + .5);
}

// Three is supplied by the lazy PBR renderer, keeping Canvas fallback lightweight.
export function makeGradientTextures({DataTexture, RGBAFormat, UnsignedByteType, SRGBColorSpace, LinearFilter, ClampToEdgeWrapping}) {
  return GRADIENT_KINDS.map(kind => {
    const data = new Uint8Array(GRADIENT_HEIGHT * 4);
    for (let row = 0; row < GRADIENT_HEIGHT; row++) {
      const color = gradientColor(kind, row / (GRADIENT_HEIGHT - 1));
      for (let channel = 0; channel < 3; channel++) data[row * 4 + channel] = Math.round(color[channel]);
      data[row * 4 + 3] = 255;
    }
    const texture = new DataTexture(data, 1, GRADIENT_HEIGHT, RGBAFormat, UnsignedByteType);
    texture.name = kind;
    texture.colorSpace = SRGBColorSpace;
    texture.minFilter = texture.magFilter = LinearFilter;
    texture.wrapS = texture.wrapT = ClampToEdgeWrapping;
    texture.generateMipmaps = false;
    texture.needsUpdate = true;
    return texture;
  });
}
