/** Session-only score for Holding Ground. Coordinates are an invented landscape. */
export const DURATION = 140;
export const SPACING = 2.35;
export const clamp = (n, min, max) => Math.max(min, Math.min(max, n));
export function terrainHeight(x, z) {
  return .28 * Math.sin(x * .28) * Math.cos(z * .26);
}
export const DEFAULT_MODELS = [
  {name:'Memory Aperture',center:[0,0,-3],label:'记忆孔径'},
  {name:'Resonance Garden',center:[-8,0,-4],label:'共振花园'},
  {name:'Data Cloud',center:[8,0,-4],label:'数据云'},
  {name:'Echo Chamber',center:[-5,0,4],label:'回声室'},
  {name:'Phase Bloom',center:[6,0,4],label:'相位花'},
];
export function createState({ reducedMotion = false, models = DEFAULT_MODELS } = {}) {
  const pieces = models.map((model,id) => {
    const [x,,z] = model.center;
    return { id, name:model.name, label:DEFAULT_MODELS[id]?.label || model.name, col:x, row:z,
      x, z, dx:0, dz:0, delay:0, heldAt:null, moved:false,
      flowX:[.42,-.7,.6,-.45,.5][id] ?? .3,
      flowZ:[-.38,-.42,-.55,.6,.58][id] ?? .4 };
  });
  return { pieces, elapsed:0, paused:reducedMotion, held:null, selected:0, contacts:0, hasMoved:false };
}
export function advance(state, seconds) {
  if (!state.paused && Number.isFinite(seconds) && seconds > 0) state.elapsed = Math.min(DURATION, state.elapsed + seconds);
}
export function positionOf(piece, state) {
  const t = clamp(((piece.heldAt ?? state.elapsed) - piece.delay) / DURATION, 0, 1);
  // Fast enough to be perceived at entry; ends gently without a reset or cut.
  const p = 1 - (1 - t) ** 1.8;
  return { x: piece.x + piece.dx + piece.flowX * p * 2.5, z: piece.z + piece.dz + piece.flowZ * p * 2.5, progress: p };
}
export function holdPiece(state, id) {
  if (!state.pieces[id] || state.held !== null) return false;
  state.held = id; state.selected = id; state.pieces[id].heldAt = state.elapsed; state.contacts++;
  return true;
}
export function moveHeld(state, dx, dz) {
  if (state.held === null || !Number.isFinite(dx) || !Number.isFinite(dz)) return false;
  const piece = state.pieces[state.held];
  piece.dx = clamp(piece.dx + dx, -11, 11); piece.dz = clamp(piece.dz + dz, -9, 9);
  if (Math.abs(dx) + Math.abs(dz) > .015) { piece.moved = true; state.hasMoved = true; }
  return true;
}
export function releasePiece(state) {
  if (state.held === null) return false;
  const piece = state.pieces[state.held];
  piece.delay += state.elapsed - piece.heldAt;
  piece.heldAt = null; state.held = null;
  return true;
}
export function neighboringPiece(state, dx, dz) {
  const current = state.pieces[state.selected];
  let best = current.id, score = Infinity;
  for (const piece of state.pieces) {
    const x = piece.col - current.col, z = piece.row - current.row;
    if (x * dx + z * dz <= 0) continue;
    const s = Math.hypot(x - dx, z - dz);
    if (s < score) { score = s; best = piece.id; }
  }
  return best;
}
export const formatTime = seconds => `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;
