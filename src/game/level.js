// Flappy-style gates: top and bottom obstacles with a gap. Kid flies through the gap.
// gapY = y of top of gap, gapHeight = height of gap. Top obstacle 0..gapY, bottom (gapY+gapHeight)..ground.
const GROUND_Y = 156 // top of ground strip (canvas 180, ground 24px)

export const LEVEL = {
  length: 3200,
  scrollSpeed: 1.8,
  groundY: GROUND_Y,
  // Uneven gaps: sometimes high (low gapY), sometimes low (high gapY)
  gates: [
    { x: 350, gapY: 50, gapHeight: 48, width: 44 },
    { x: 520, gapY: 75, gapHeight: 44, width: 40 },
    { x: 680, gapY: 30, gapHeight: 52, width: 46 },
    { x: 840, gapY: 90, gapHeight: 40, width: 42 },
    { x: 1000, gapY: 45, gapHeight: 50, width: 44 },
    { x: 1160, gapY: 70, gapHeight: 46, width: 40 },
    { x: 1320, gapY: 25, gapHeight: 54, width: 48 },
    { x: 1480, gapY: 85, gapHeight: 44, width: 42 },
    { x: 1640, gapY: 55, gapHeight: 48, width: 44 },
    { x: 1800, gapY: 65, gapHeight: 46, width: 40 },
    { x: 1960, gapY: 35, gapHeight: 52, width: 46 },
    { x: 2120, gapY: 80, gapHeight: 42, width: 42 },
    { x: 2280, gapY: 48, gapHeight: 50, width: 44 },
    { x: 2440, gapY: 72, gapHeight: 44, width: 40 },
    { x: 2600, gapY: 40, gapHeight: 52, width: 46 },
  ],
}
