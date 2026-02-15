// Obstacles: gates (top+bottom gap) or single big obstacles (top / bottom / center). Kid flies through gaps or over/under.
// Gate: gapY = top of gap, gapHeight = height. Top obstacle above gap, bottom below.
// Top: big obstacle at top — fly under. Bottom: big at bottom — fly over. Center: big in middle — fly over or under.
const GROUND_Y = 156

export const LEVEL = {
  length: 3200,
  scrollSpeed: 2.9,
  groundY: GROUND_Y,
  obstacles: [
    { x: 350, gapY: 72, gapHeight: 48, width: 44 },
    { type: 'top', x: 520, width: 72 },
    { x: 680, gapY: 28, gapHeight: 52, width: 46 },
    { type: 'bottom', x: 840, width: 68 },
    { x: 1000, gapY: 68, gapHeight: 50, width: 44 },
    { type: 'center', x: 1160, width: 64 },
    { x: 1320, gapY: 32, gapHeight: 54, width: 48 },
    { type: 'top', x: 1480, width: 70 },
    { x: 1640, gapY: 76, gapHeight: 48, width: 44 },
    { type: 'bottom', x: 1800, width: 66 },
    { x: 1960, gapY: 30, gapHeight: 52, width: 46 },
    { type: 'center', x: 2120, width: 62 },
    { x: 2280, gapY: 70, gapHeight: 50, width: 44 },
    { type: 'top', x: 2440, width: 68 },
    { x: 2600, gapY: 36, gapHeight: 52, width: 46 },
  ],
  // Gate-type obstacles only (for difficulty tuning that expects .gates with gapY/gapHeight)
  get gates() {
    return this.obstacles.filter((o) => o.gapY != null && o.gapHeight != null)
  },
}
