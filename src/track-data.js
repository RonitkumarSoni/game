export const TRACKS = Object.freeze([
  { id: 'nova-harbor', name: 'Nova Harbor', theme: 'harbor' },
  { id: 'ember-rift', name: 'Ember Rift', theme: 'ember' },
  { id: 'skyforge-circuit', name: 'Skyforge Circuit', theme: 'skyforge' },
  { id: 'chromewave-city', name: 'Chromewave City', theme: 'chromewave' },
]);

export function selectTrack(id) {
  return TRACKS.find((track) => track.id === id) || TRACKS[0];
}

// Both circuits begin on the same grid orientation. Subsequent control points
// deliberately diverge so lap projection, AI lines and the minimap remain real.
export const EMBER_CONTROL_POINTS = [
  [0, 0, -60], [0, 0, 60], [12, 0, 168], [64, 1, 230],
  [143, 3, 235], [207, 5, 196], [228, 6, 121], [195, 6, 52],
  [124, 4, 12], [100, 3, -49], [153, 4, -110], [227, 7, -125],
  [289, 10, -178], [266, 10, -246], [201, 6, -283], [113, 3, -274],
  [42, 1, -320], [-47, 0, -344], [-123, 0, -318], [-159, 0, -260],
  [-134, 0, -210], [-75, 0, -222], [-17, 0, -186], [0, 0, -135],
];

// Two further closed routes share the start-grid heading but deliberately use
// different corner sequences, elevation profiles and bounds from either launch circuit.
export const SKYFORGE_CONTROL_POINTS = [
  [0, 0, -60], [0, 0, 60], [18, 2, 150], [82, 7, 210],
  [160, 14, 210], [205, 18, 158], [193, 21, 86], [235, 25, 30],
  [300, 29, 4], [356, 34, -58], [340, 35, -145], [282, 30, -196],
  [205, 23, -190], [161, 18, -132], [107, 13, -121], [67, 9, -183],
  [87, 6, -259], [33, 3, -311], [-53, 1, -293], [-111, 0, -238],
  [-107, 0, -169], [-57, 0, -143], [-14, 0, -178], [0, 0, -132],
];

export const CHROMEWAVE_CONTROL_POINTS = [
  [0, 0, -60], [0, 0, 60], [-30, 0, 142], [-102, 0, 178],
  [-172, 1, 152], [-205, 1, 82], [-166, 2, 12], [-219, 3, -45],
  [-285, 3, -78], [-307, 4, -160], [-257, 4, -230], [-177, 3, -242],
  [-121, 2, -198], [-67, 1, -227], [-62, 1, -305], [-8, 0, -354],
  [78, 0, -341], [137, 1, -293], [129, 2, -223], [80, 2, -194],
  [41, 1, -238], [4, 0, -220], [-23, 0, -174], [0, 0, -131],
];
