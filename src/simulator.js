import GLOBAL from './globals.js';
import { updateSelectedLifeformUI, createNewGeneration, updateLifeformTable, updateStatus, drawWorld } from './index.js';
import { logToPage } from './utils.js';

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

function runStep() {
  simulationTimeout = null;
  if (GLOBAL.yearCounter >= GLOBAL.targetYear || GLOBAL.isPaused) {
    return;
  }

  // Evaporate all pheromones before lifeforms act
  updatePheromones();

  // 1. Create the "snapshot" of the world before anyone moves.
  const occupiedCells = new Map();
  GLOBAL.lifeform.forEach(lf => {
    if (lf.alive) {
      occupiedCells.set(`${lf.pos_y}-${lf.pos_x}`, true);
    }
  });

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

    // Let the brain decide and perform the action
    const chosenAction = currentLifeform.processBrain(occupiedCells);
    currentLifeform.performAction(chosenAction, occupiedCells);
  }

  // 3. Update UI
  GLOBAL.yearCounter += 1;
  updateStatus();
  updateSelectedLifeformUI();
  updateLifeformTable();
  drawWorld();

  // 4. End the generation when its time is up, or straight away if everyone has died.
  const anyAlive = GLOBAL.lifeform.some(lf => lf.alive);
  if (!anyAlive || GLOBAL.yearCounter % GLOBAL.generationLength === 0) {
    logToPage(`--- End of Generation ${GLOBAL.generation} (year ${GLOBAL.yearCounter}) ---`);
    createNewGeneration(); // This function will restart the simulation
    return;
  }

  // 5. Schedule the NEXT step
  simulationTimeout = setTimeout(runStep, GLOBAL.simulationSpeed);
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
