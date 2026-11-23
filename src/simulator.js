import GLOBAL from './globals.js';
import { updateSelectedLifeformUI, createNewGeneration, updateLifeformTable, updateStatus, drawWorld } from './index.js';
import { logToPage } from './utils.js';
import Occupancy from './occupancy.js';

let occupancy = null; // reused every step

let simulationTimeout = null;

function updatePheromones() {
  const grid = GLOBAL.pheromoneGrid;
  const evapRate = GLOBAL.pheromoneEvapRate;

  for (let y = 0; y < GLOBAL.y; y++) {
    for (let x = 0; x < GLOBAL.x; x++) {
      if (grid[y][x] > 0) {
        grid[y][x] = Math.max(0, grid[y][x] - evapRate);
      }
    }
  }
}

/** Advance the world by one step. Returns true when the generation is over. */
function simulateOneStep() {
  // Evaporate all pheromones before lifeforms act
  updatePheromones();

  // 1. Snapshot of who is where before anyone moves.
  if (!occupancy || occupancy.width !== GLOBAL.x || occupancy.height !== GLOBAL.y) {
    occupancy = new Occupancy(GLOBAL.x, GLOBAL.y);
  }
  occupancy.reset();
  for (const lf of GLOBAL.lifeform) {
    if (lf.alive) occupancy.set(lf.pos_x, lf.pos_y, lf);
  }
  const occupiedCells = occupancy;

  // 2. Main loop: Age, apply energy cost, and act.
  for (const currentLifeform of GLOBAL.lifeform) {
    if (!currentLifeform.alive) continue;

    // Apply cost of living and age up
    currentLifeform.age++;
    if (GLOBAL.foodEnergyEnabled) currentLifeform.energy -= 1;
    // Only kill by energy if enabled
    if (GLOBAL.foodEnergyEnabled && currentLifeform.energy <= 0) {
      currentLifeform.alive = false;
      currentLifeform.color = [200, 50, 50];
      currentLifeform.actionLog.push(`Starved at (${currentLifeform.pos_x},${currentLifeform.pos_y}) [age=${currentLifeform.age}]`);
      continue;
    }

    // Let the brain decide and act
    const actionLevels = currentLifeform.processBrain(occupiedCells);
    currentLifeform.executeActions(actionLevels, occupiedCells);
  }

  GLOBAL.yearCounter += 1;

  // The generation ends when its time is up, or straight away if everyone has died.
  return !GLOBAL.lifeform.some(lf => lf.alive) || GLOBAL.yearCounter % GLOBAL.generationLength === 0;
}

// In fast-forward, keep stepping for this long before redrawing once.
const FAST_FORWARD_BUDGET_MS = 50;

function runStep() {
  simulationTimeout = null;
  if (GLOBAL.yearCounter >= GLOBAL.targetYear || GLOBAL.isPaused) {
    return;
  }

  const deadline = performance.now() + FAST_FORWARD_BUDGET_MS;
  let generationOver;
  do {
    generationOver = simulateOneStep();
  } while (GLOBAL.fastForward && !generationOver && performance.now() < deadline);

  // Update the UI once per batch of steps
  updateStatus();
  updateSelectedLifeformUI();
  updateLifeformTable();
  drawWorld();

  if (generationOver) {
    logToPage(`--- End of Generation ${GLOBAL.generation} (year ${GLOBAL.yearCounter}) ---`);
    createNewGeneration(); // This function will restart the simulation
    return;
  }

  // Schedule the next step (or batch)
  simulationTimeout = setTimeout(runStep, GLOBAL.fastForward ? 0 : GLOBAL.simulationSpeed);
}

function startSimulation(steps) {
  if (steps > 0) {
    GLOBAL.targetYear = GLOBAL.yearCounter + steps;
  }

  // Start the loop if it's not already running
  if (!simulationTimeout) {
    runStep();
  }
}

function stopSimulation() {
  if (simulationTimeout) {
    clearTimeout(simulationTimeout);
    simulationTimeout = null;
  }
}

export { startSimulation, stopSimulation };
