/** The only file to edit when adding a scene or changing the exhibition. */
export const WORLD = {
  title: '异构场 · SCULPTURE FIELD',
  model: {
    url: 'models/three-gorges.glb',
    credit: '为此空间创作的原创媒体艺术雕塑',
    provenance: '这是新创作的艺术场景，不是三峡大坝原模型的还原。后续可以接入新的 GLB 模型，继续扩展这个空间。',
    normalizedSize: 22,
    rotationY: 0,
  },
  // Positions use the normalized world coordinates, with Y pointing upward.
  // Model is centered in X/Z, floor is Y = 0, largest dimension is 22.
  views: [
    { id: 'overview', title: '全景', subtitle: 'THE FIELD', number: '01', icon: 'field', position: [24, 17, 27], target: [0, 2, 0], description: '结构、信号与重力之间。<br>一个没有固定观看方式的雕塑空间。' },
    { id: 'aperture', group: '01_MEMORY_APERTURE', title: '记忆孔径', subtitle: 'MEMORY APERTURE', number: '02', icon: 'core', position: [8, 7, 9], target: [0, 3.3, -2.7], description: '层叠的记忆，未闭合的圆。<br>在结构的缝隙里，寻找新的尺度。' },
    { id: 'resonance', group: '02_RESONANCE_GARDEN', title: '共振花园', subtitle: 'RESONANCE GARDEN', number: '03', icon: 'horizon', position: [-17, 6, 6], target: [-8.1, 1.7, -4.0], description: '重复是一种频率。<br>让静止的形态，产生声音般的起伏。' },
    { id: 'cloud', group: '03_DATA_CLOUD', title: '数据云', subtitle: 'DATA CLOUD', number: '04', icon: 'aerial', position: [17, 7, 7], target: [8, 1.8, -4.2], description: '把信息悬置在空气中。<br>细线之间，漂浮着不确定的秩序。' },
    { id: 'echo', group: '04_ECHO_CHAMBER', title: '回声室', subtitle: 'ECHO CHAMBER', number: '05', icon: 'echo', position: [-11, 4.7, 15], target: [-5.4, 1.7, 4.4], description: '穿过一个又一个框架。<br>视线的深处，总有下一道回声。' },
    { id: 'bloom', group: '05_PHASE_BLOOM', title: '相位花', subtitle: 'PHASE BLOOM', number: '06', icon: 'bloom', position: [14, 6, 15], target: [6, 1.8, 4.4], description: '在旋转与错位中生长。<br>一朵正在计算自己的花。' },
  ],
  appearance: {
    monolith: { background: '#121715', fog: '#121715', floor: '#18201c', key: '#f3ffe5', rim: '#bdfbbc', accent: '#c9fc9b' },
    signal: { background: '#060b13', fog: '#060b13', floor: '#08121c', key: '#89d8ff', rim: '#5575ff', accent: '#70f2d0' },
    source: { background: '#151217', fog: '#151217', floor: '#211b23', key: '#fff0df', rim: '#a78cff', accent: '#ebacf9' },
  },
};

export function assetUrl(path, base = import.meta.env?.BASE_URL || './') {
  return `${base}${path.replace(/^\/+/, '')}`;
}

export function getInitialSelection(search, views = WORLD.views) {
  const params = new URLSearchParams(search);
  const mode = ['monolith', 'signal', 'source'].includes(params.get('mode')) ? params.get('mode') : 'source';
  const view = views.find((item) => item.id === params.get('view'))?.id || views[0].id;
  return { mode, view };
}
