/**
 * Who is standing where, as a flat array indexed y * width + x. Much faster than a Map
 * keyed by "y-x" strings, which matters because the crowding senses look at about
 * 20 neighbouring cells per lifeform per step.
 */
export default class Occupancy {
  constructor(width, height) {
    this.width = width;
    this.height = height;
    this.cells = new Array(width * height).fill(null);
  }

  /** Empty every cell, ready for a new step. */
  reset() {
    this.cells.fill(null);
  }

  /** The lifeform at (x, y), or null if it's empty or off the map. */
  get(x, y) {
    if (x < 0 || x >= this.width || y < 0 || y >= this.height) return null;
    return this.cells[y * this.width + x];
  }

  set(x, y, lifeform) {
    this.cells[y * this.width + x] = lifeform;
  }

  clear(x, y) {
    this.cells[y * this.width + x] = null;
  }
}
