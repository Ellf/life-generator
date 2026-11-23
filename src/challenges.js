import GLOBAL from './globals.js';

// Each challenge sets up the walls, where lifeforms start, and (optionally) a goal zone.
// With a goal zone, only lifeforms inside it at the end of a generation get to breed,
// so you can watch whether later generations learn to get there.
// Zones are inclusive cell ranges: { x0, x1, y0, y1 }.

const LEFT_SPAWN = () => ({ x0: 0, x1: 15, y0: 0, y1: GLOBAL.y - 1 });
const RIGHT_GOAL = () => ({ x0: GLOBAL.x - 16, x1: GLOBAL.x - 1, y0: 0, y1: GLOBAL.y - 1 });

function fillRect(grid, x0, y0, x1, y1) {
  for (let y = Math.max(0, y0); y <= Math.min(GLOBAL.y - 1, y1); y++) {
    for (let x = Math.max(0, x0); x <= Math.min(GLOBAL.x - 1, x1); x++) {
      grid[y * GLOBAL.x + x] = 1;
    }
  }
}

export const CHALLENGES = {
  gap: {
    label: 'Wall with a gap',
    goal: true,
    spawn: LEFT_SPAWN,
    walls(grid) {
      const midX = Math.floor(GLOBAL.x / 2);
      const midY = Math.floor(GLOBAL.y / 2);
      // A full-height wall, two cells thick, with a 16-cell gap in the middle.
      fillRect(grid, midX - 1, 0, midX, midY - 9);
      fillRect(grid, midX - 1, midY + 8, midX, GLOBAL.y - 1);
    },
  },
  cup: {
    label: 'U-shaped cup',
    goal: true,
    // Start in front of the cup's mouth, so heading straight for the goal leads into it.
    spawn: () => ({ x0: 0, x1: 15, y0: 40, y1: GLOBAL.y - 41 }),
    walls(grid) {
      const top = 30, bottom = GLOBAL.y - 31, back = 72, mouth = 36;
      fillRect(grid, back - 1, top, back, bottom);      // back wall, facing the start
      fillRect(grid, mouth, top, back, top + 1);        // top arm
      fillRect(grid, mouth, bottom - 1, back, bottom);  // bottom arm
    },
  },
  blocks: {
    label: 'Scattered blocks',
    goal: true,
    spawn: LEFT_SPAWN,
    walls(grid) {
      // A fixed, staggered field of 8×8 blocks between the start and the goal.
      for (let col = 0; col < 5; col++) {
        const x = 28 + col * 16;
        const offset = col % 2 === 0 ? 4 : 14;
        for (let y = offset; y < GLOBAL.y - 8; y += 22) {
          fillRect(grid, x, y, x + 7, y + 7);
        }
      }
    },
  },
  free: {
    label: 'Open field (survive to breed)',
    goal: false,
    spawn: () => ({ x0: 0, x1: GLOBAL.x - 1, y0: 0, y1: GLOBAL.y - 1 }),
    walls() {},
  },
};

/** Build the walls, start zone and goal zone for the current challenge. */
export function applyChallenge() {
  const challenge = CHALLENGES[GLOBAL.challenge] || CHALLENGES.gap;
  GLOBAL.barrierGrid = new Uint8Array(GLOBAL.x * GLOBAL.y);
  challenge.walls(GLOBAL.barrierGrid);
  GLOBAL.spawnZone = challenge.spawn();
  GLOBAL.goalZone = challenge.goal ? RIGHT_GOAL() : null;
  GLOBAL.goalDistance = GLOBAL.goalZone ? walkingDistanceTo(GLOBAL.goalZone) : null;
}

/**
 * Walking distance (in moves) from every cell to the nearest goal cell, going round walls.
 * Lifeforms can move diagonally, so this is a breadth-first search over all 8 neighbours.
 * Walls and unreachable cells get Infinity. Using walking distance rather than a straight
 * line matters: in the cup, the straight-line-closest spot is the dead end at its back.
 */
function walkingDistanceTo(zone) {
  const W = GLOBAL.x, H = GLOBAL.y, grid = GLOBAL.barrierGrid;
  const dist = new Float64Array(W * H).fill(Infinity);
  const queue = new Int32Array(W * H);
  let head = 0, tail = 0;
  for (let y = zone.y0; y <= zone.y1; y++) {
    for (let x = zone.x0; x <= zone.x1; x++) {
      const i = y * W + x;
      if (!grid[i]) { dist[i] = 0; queue[tail++] = i; }
    }
  }
  while (head < tail) {
    const i = queue[head++];
    const x = i % W, y = (i - x) / W;
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const nx = x + dx, ny = y + dy;
        if ((dx || dy) && nx >= 0 && nx < W && ny >= 0 && ny < H) {
          const n = ny * W + nx;
          if (!grid[n] && dist[n] === Infinity) { dist[n] = dist[i] + 1; queue[tail++] = n; }
        }
      }
    }
  }
  return dist;
}

/** How far this lifeform is from the goal on foot (0 = inside it). */
export function distanceToGoal(lifeform) {
  return GLOBAL.goalDistance ? GLOBAL.goalDistance[lifeform.pos_y * GLOBAL.x + lifeform.pos_x] : 0;
}

export function inZone(zone, x, y) {
  return !!zone && x >= zone.x0 && x <= zone.x1 && y >= zone.y0 && y <= zone.y1;
}

/** Does this lifeform count towards breeding at the end of a generation? */
export function qualifies(lifeform) {
  if (!lifeform.alive) return false;
  return GLOBAL.goalZone ? inZone(GLOBAL.goalZone, lifeform.pos_x, lifeform.pos_y) : true;
}
