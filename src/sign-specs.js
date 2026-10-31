// Every sign in the alley: text, style, placement, flicker and light strength.

// side: -1 = left wall, +1 = right wall (looking down the alley from the start).
export const SIGN_SPECS = [
  { text: 'バー', sub: 'BAR', style: 'border', color: '#c070ff', color2: '#ff4fd8', side: 1, z: -3.4, y: 2.95, w: 1.0, h: 1.1, flicker: 'steady', light: 9 },
  { text: '24H', font: 'lat', style: 'border', color: '#ff4fd8', color2: '#4fe3ff', side: 1, z: -9.5, y: 4.9, w: 1.7, h: 0.8, flicker: 'flicker', light: 10 },
  { text: '居酒屋', style: 'box', color: '#ff2d55', side: -1, z: -6.8, y: 4.6, w: 2.0, h: 0.75, light: 9 },
  { text: 'ラーメン', vertical: true, style: 'tube', color: '#ff3fb4', side: -1, z: -12.5, y: 9.0, w: 0.8, h: 3.0, light: 12 },
  { columns: ['TECH', 'SOLUTIONS'], font: 'lat', vertical: true, style: 'tube', color: '#38e8ff', side: -1, z: -16.5, y: 6.4, w: 0.8, h: 3.6, flicker: 'broken', light: 8 },
  { kind: 'holo', side: -1, z: -21, y: 9.6, w: 3.0, h: 3.8, color: '#5ef2ff', color2: '#ff4fd8', light: 14 },
  { style: 'circle', color: '#39f0ff', side: 1, z: -15.5, y: 10.5, w: 1.1, h: 1.1, flicker: 'pulse', light: 0 },
  { text: 'CYBERNETICS', font: 'lat', vertical: true, style: 'tube', color: '#b66bff', side: 1, z: -23.5, y: 8.4, w: 0.62, h: 4.4, light: 9 },
  { text: 'OPEN', font: 'neon', style: 'tube', color: '#ff3355', side: 1, z: -12.2, y: 2.35, w: 0.9, h: 0.42, mount: 'flat', flicker: 'flicker', light: 0 },
  { text: 'ラーメン', sub: 'RAMEN', style: 'box', color: '#ff7a2f', side: -1, z: -28, y: 4.8, w: 1.6, h: 0.7, light: 7 },
  { text: 'カラオケ', style: 'border', color: '#38e8ff', color2: '#ff3fa4', side: -1, z: -34, y: 5.2, w: 2.0, h: 0.7, light: 8 },
  { text: 'ホテル', vertical: true, style: 'tube', color: '#ff4fd8', side: 1, z: -36, y: 9, w: 0.8, h: 2.6, flicker: 'pulse', light: 9 },
  { text: '薬局', style: 'box', color: '#2bff88', textColor: '#ffffff', side: 1, z: -42, y: 4.4, w: 1.3, h: 0.7, light: 7 },
  { text: '電脳', vertical: true, style: 'tube', color: '#a970ff', side: -1, z: -46, y: 10, w: 0.9, h: 2.2, flicker: 'flicker', light: 8 },
  { text: '質屋', vertical: true, style: 'box', color: '#ffb340', side: -1, z: -50, y: 5.5, w: 0.8, h: 1.8, light: 7 },
  { text: 'NOODLES', font: 'neon', style: 'tube', color: '#38e8ff', side: 1, z: -55, y: 4.6, w: 2.2, h: 0.6, light: 8 },
  { text: '喫茶', sub: 'CAFE', style: 'box', color: '#fff0d0', textColor: '#3a1a10', side: -1, z: -60, y: 4.2, w: 1.2, h: 0.9, light: 6 },
  { text: 'マッサージ', vertical: true, style: 'tube', color: '#ff3fa4', side: 1, z: -64, y: 8, w: 0.7, h: 3.4, flicker: 'broken', light: 8 },
  { text: 'ゲーム', sub: 'GAME CENTER', style: 'border', color: '#5dffb4', color2: '#b66bff', side: -1, z: -70, y: 5.5, w: 1.9, h: 0.9, light: 8 },
  { text: '酒', style: 'box', color: '#ff2d55', side: 1, z: -74, y: 4.5, w: 0.8, h: 0.8, light: 6 },
  { text: 'BAR', font: 'neon', style: 'tube', color: '#ffd166', side: -1, z: -80, y: 3.7, w: 1.3, h: 0.6, flicker: 'flicker', light: 7 },
  { text: '24/7', font: 'lat', style: 'border', color: '#38e8ff', color2: '#ff3fa4', side: 1, z: -83, y: 5.0, w: 1.4, h: 0.7, light: 8 },
  { text: '夜市', sub: 'NIGHT MARKET', style: 'border', color: '#ff4fd8', color2: '#ffd166', mount: 'facing', x: 0, z: -105.7, y: 8.5, w: 7, h: 3.2, light: 0 },
  { text: '路地', sub: 'ALLEY 07', style: 'border', color: '#38e8ff', color2: '#ff3fa4', mount: 'facingBack', x: 0, z: 15.9, y: 6.2, w: 3.2, h: 1.6, light: 10 },
];

export const SIGN_TEXT = SIGN_SPECS.map((s) => (s.text || '') + (s.columns || []).join('') + (s.sub || '')).join('') +
  'らーめんつめた〜い夢を見る機械未来はここに眠らない街宇宙ラーメン';
