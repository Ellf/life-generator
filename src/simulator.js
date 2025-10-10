import GLOBAL from './globals.js';
import {updateSelectedLifeformUI, createNewGeneration, updateLifeformTable} from './index.js';
import {logToPage} from "./utils";
import { drawWorld } from './index.js';

let simulationTimeout = null;

function runStep() {
  if (GLOBAL.yearCounter >= GLOBAL.targetYear || GLOBAL.isPaused) {
    stopSimulation();
    return;
  }

  // 1. Create the "snapshot" of the world before anyone moves.
  const occupiedCells = new Map();
  GLOBAL.lifeform.forEach(lf => {
    if (lf.alive) {
      occupiedCells.set(`${lf.pos_y}-${lf.pos_x}`, true);
    }
  });

  // 2. Main loop: Age, apply energy cost, and act.
  for (let i = 0; i < GLOBAL.lifeform.length; i++) {
    const currentLifeform = GLOBAL.lifeform[i];
    if (!currentLifeform.alive) continue;

    // Apply cost of living and age up
    currentLifeform.age++;
    currentLifeform.energy -= 1;
    if (currentLifeform.energy <= 0) {
      currentLifeform.alive = false;
      currentLifeform.color = [200, 50, 50]; // Change color to a dim red
      const deadCell = document.querySelector(`.world [data-id='${currentLifeform.id}']`);
      if (deadCell) {
        deadCell.style.background = `rgb(${currentLifeform.color[0]}, ${currentLifeform.color[1]}, ${currentLifeform.color[2]})`;
        deadCell.classList.add('dead-cell'); // Add a class for styling
      }
      drawWorld();
      continue; // Lifeform dies, skip to the next one
    }

    // Let the brain decide and perform the action
    const chosenAction = currentLifeform.processBrain(occupiedCells);
    currentLifeform.performAction(chosenAction, occupiedCells);
  }

  // 3. Update UI
  GLOBAL.yearCounter += 1;
  document.querySelector('#year-value').textContent = GLOBAL.yearCounter;
  document.getElementById('population-value').textContent =
    GLOBAL.lifeform.filter(lf => lf.alive).length;
  updateSelectedLifeformUI();
  updateLifeformTable();

  // 4. Check for End of Generation (Moved to before the next step)
  if (GLOBAL.yearCounter > 0 && GLOBAL.yearCounter % GLOBAL.generationLength === 0) {
    stopSimulation();
    logToPage(`--- End of Generation ${GLOBAL.generation} ---`);
    createNewGeneration(); // This function will restart the simulation
    return; // IMPORTANT: Stop this loop from continuing
  }

  // 5. Schedule the NEXT step
  drawWorld();
  simulationTimeout = setTimeout(runStep, GLOBAL.simulationSpeed);
}

function startSimulation(steps) {
  // If we're adding steps to a running sim, just update the target
  if (!simulationTimeout && steps > 0) {
    GLOBAL.targetYear += steps;
  } else if (steps > 0) {
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
