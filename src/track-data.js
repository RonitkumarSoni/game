export const TRACKS = Object.freeze([
  { id: 'nova-harbor', name: 'Nova Harbor', theme: 'harbor' },
  { id: 'ember-rift', name: 'Ember Rift', theme: 'ember' },
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
