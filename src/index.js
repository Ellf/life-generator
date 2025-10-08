import './style.css';
import _ from 'lodash';
import GLOBAL from './globals.js';
import './simulator.js';
import { startSimulation, stopSimulation } from './simulator.js';
import SENS from './sensor.js';
import ACTS from './action.js';
import {logToPage, randomInt} from './utils.js';
import Life, { createGenome, parseGene } from './life.js';

// Create the grid
document.addEventListener('DOMContentLoaded', async () => {
  GLOBAL.worldReady = await setupWorld(GLOBAL.x, GLOBAL.y, GLOBAL.startingLife);
  let endTime = performance.now();
  logToPage(`World Ready after ${((endTime - GLOBAL.startTime) / 1000).toFixed(2)} seconds`);

  // run the simulation after the setup has completed.
  startSimulation(GLOBAL.steps);

  const world = document.querySelector('.world');

  const speedSlider = document.getElementById('speed-slider');
  speedSlider.addEventListener('input', (event) => {
    // The slider gives a value from 1 to 200. We want the delay to be
    // smaller for faster speeds, so we invert it.
    GLOBAL.simulationSpeed = 201 - event.target.value;
  });

  // Restart button event listener
  document.getElementById('regenerateWorld').addEventListener('click', async () => {
    logToPage('Restarting world...');
    stopSimulation();
    await setupWorld(GLOBAL.x, GLOBAL.y, GLOBAL.startingLife);
    startSimulation(GLOBAL.steps);
  });

  // Toggle the simulation to pause/start
  const toggleBtn = document.getElementById('toggleSimulation');
  toggleBtn.addEventListener('click', () => {
    GLOBAL.isPaused = !GLOBAL.isPaused; // Toggle the paused state

    if (GLOBAL.isPaused) {
      stopSimulation();
      toggleBtn.textContent = 'Resume';
      logToPage('Simulation paused.');
    } else {
      // We pass 0 steps to continue to the previously set targetYear
      startSimulation(0);
      toggleBtn.textContent = 'Pause';
      logToPage('Simulation resumed.');
    }
  });

  // Continue button event listener
  document.getElementById('continueSimulation').addEventListener('click', () => {
    logToPage(`Continuing for ${GLOBAL.steps} more steps...`);
    startSimulation(GLOBAL.steps);
    // Ensure the toggle button is in the correct state
    toggleBtn.textContent = 'Pause';
    GLOBAL.isPaused = false;
  });

  // Event listener on button to restart simulation
  document.getElementById('regenerateWorld').addEventListener('click', () => {
    logToPage('creating new world');
    GLOBAL.worldReady = setupWorld(GLOBAL.x, GLOBAL.y, GLOBAL.startingLife);
    logToPage(GLOBAL.worldReady);
    startSimulation(GLOBAL.steps);
  });

  // Use event delegation for clicks on dynamically created life cells
  world.addEventListener('click', (event) => {
    if (event.target.classList.contains('live-cell')) {
      getClicked(event.target);
    }
  });
});

let selectionCriteria = ""; // no criteria set yet

function getClicked(element) {
  const previouslySelected = document.querySelector('.selected-cell');
  if (previouslySelected) {
    previouslySelected.classList.remove('selected-cell');
  }
  element.classList.add('selected-cell');

  GLOBAL.selectedLifeformId = element.dataset.id; // Set the global ID
  updateSelectedLifeformUI(); // Update the info panel
}

export function updateSelectedLifeformUI() {
  const id = GLOBAL.selectedLifeformId;

  // --- Select all the UI elements ---
  const idSpan = document.querySelector('#cell-selected span');
  const posXSpan = document.querySelector('#posx span');
  const posYSpan = document.querySelector('#posy span');
  const energySpan = document.querySelector('#energy span');
  const brainOutput = document.getElementById('brain-output');

  // Clear brain display initially
  if (brainOutput) brainOutput.innerHTML = '';

  if (id === null || !GLOBAL.lifeform[id]) {
    // Clear all fields if no lifeform is selected
    idSpan.textContent = '-';
    posXSpan.textContent = '-';
    posYSpan.textContent = '-';
    energySpan.textContent = '-';
    return;
  }

  // --- THE FIX: Define the 'lifeform' variable ---
  const lifeform = GLOBAL.lifeform[id];

  // Update the text content of the elements
  idSpan.textContent = id;
  posXSpan.textContent = lifeform.pos_x;
  posYSpan.textContent = lifeform.pos_y;
  energySpan.textContent = lifeform.alive ? lifeform.energy : 'Dead';

  // Update the rest of the UI (like the brain display)
  if (brainOutput && lifeform.brain) {
    const sensorNames = Object.keys(SENS.Sensor);
    const actionNames = Object.keys(ACTS.Action);
    let brainHtml = '';
    lifeform.brain.forEach((gene, index) => {
      let sourceName, sinkName;
      if (gene.sourceType === 0) { sourceName = `Sensor[${sensorNames[gene.sourceId]}]`; }
      else { sourceName = `Neuron[${gene.sourceId}]`; }
      if (gene.sinkType === 1) { sinkName = `Action[${actionNames[gene.sinkId]}]`; }
      else { sinkName = `Neuron[${gene.sinkId}]`; }
      const weight = gene.weight.toFixed(2);
      brainHtml += `<div class="gene-connection">${index}: ${sourceName} &rarr; ${sinkName} | w: ${weight}</div>`;
    });
    brainOutput.innerHTML = brainHtml;
  }
}

async function setupWorld(x, y, startingLife, isNewGeneration = false) {
  if (!isNewGeneration) {
    GLOBAL.generation = 0;
    GLOBAL.lifeform = []; // Clear the population
    document.getElementById('generation-value').textContent = GLOBAL.generation;
    // Create the new random population directly in setupWorld
    for (let g = 0; g < startingLife; g++) {
      GLOBAL.lifeform[g] = new Life(g, GLOBAL.gen_len, GLOBAL.sensory_inputs, GLOBAL.inner_neurons, GLOBAL.action_outputs, GLOBAL.generation);
    }
  }

  GLOBAL.yearCounter = 0;
  GLOBAL.popCounter = 0;
  document.querySelector('#year-value').textContent = '0';
  document.getElementById('population-value').textContent = GLOBAL.startingLife;

  let worldExists = createWorld(x, y);
  try {
    if (worldExists) {
      logToPage('World Exists...');
      // Call the new, simplified function to place the lifeforms
      let lifePlaced = placeLifeformsOnGrid();
      logToPage(`Life Placed: ${GLOBAL.startingLife} organisms`);
      spawnFood();
    }
  }
  catch(error) {
    logToPage(`An error occurred: ${error.message}`);
    console.error(error);
  }

  const firstLifeformElement = document.querySelector('.world [data-id="0"]');
  if (firstLifeformElement) {
    getClicked(firstLifeformElement);
    logToPage('Tracking Lifeform #0 by default.');
  }

  return true;
}

function createWorld(x, y) {
  logToPage('Creating World...');
  const world = document.querySelector('.world');
  world.innerHTML = '';
  for (let horizontal = 0; horizontal < x; horizontal += 1 ) {
    for (let vertical = 0; vertical < y; vertical += 1 ) {
      world.insertAdjacentHTML('beforeend', `<div data-xy="${vertical}-${horizontal}" class="cell"></div>`);
    }
  }

  return true;
}

function placeLifeformsOnGrid() {
  // This function no longer creates lifeforms, it just places them.
  for (const lifeform of GLOBAL.lifeform) {
    const cell = document.querySelector(`.world [data-xy='${lifeform.pos_x}-${lifeform.pos_y}']`);
    if (cell) {
      cell.classList.add('live-cell');
      cell.dataset.id = lifeform.id;
      cell.style.background = `rgb(${lifeform.color[0]}, ${lifeform.color[1]}, ${lifeform.color[2]})`;
    }
  }
  // We can return true to keep the logic in setupWorld the same.
  return true;
}

function spawnFood() {
  // Clear existing food
  document.querySelectorAll('.food-cell').forEach(el => el.classList.remove('food-cell'));
  GLOBAL.foodGrid = [];

  for (let i = 0; i < GLOBAL.foodCount; i++) {
    const x = randomInt(0, GLOBAL.x);
    const y = randomInt(0, GLOBAL.y);
    const pos = `${y}-${x}`;
    if (!GLOBAL.foodGrid.includes(pos)) {
      GLOBAL.foodGrid.push(pos);
      const foodCell = document.querySelector(`.world [data-xy='${pos}']`);
      if (foodCell) {
        logToPage(`Adding food cell to ${pos}`);
        foodCell.classList.add('food-cell');
      }
    }
  }
}

export function updateLifeformTable() {
  const tableBody = document.getElementById('lifeform-table-body');
  if (!tableBody) return;

  let tableHtml = '';
  const directions = ['N', 'E', 'S', 'W']; // For converting direction number to letter

  for (const lifeform of GLOBAL.lifeform) {
    const status = lifeform.alive ? 'Alive' : 'Dead';
    const position = `${lifeform.pos_x}, ${lifeform.pos_y}`;
    const direction = directions[lifeform.direction];

    tableHtml += `
            <tr>
                <td>${lifeform.id}</td>
                <td>${lifeform.generation}</td>
                <td>${status}</td>
                <td>${position}</td>
                <td>${lifeform.energy}</td>
                <td>${lifeform.age}</td>
                <td>${direction}</td>
            </tr>
        `;
  }
  tableBody.innerHTML = tableHtml;
}

export async function createNewGeneration() {
  GLOBAL.generation++;
  document.getElementById('generation-value').textContent = GLOBAL.generation;
  logToPage('Evaluating survivors and creating new generation...');

  // 1. SELECTION: Find all living lifeforms and sort them by energy (highest first)
  const survivors = GLOBAL.lifeform
    .filter(lf => lf.alive)
    .sort((a, b) => b.energy - a.energy);

  // Handle extinction
  if (survivors.length === 0) {
    logToPage('EXTINCTION! No lifeforms survived. Restarting with a new random population.');
    await setupWorld(GLOBAL.x, GLOBAL.y, GLOBAL.startingLife);
    startSimulation(GLOBAL.steps);
    return;
  }

  logToPage(`${survivors.length} of ${GLOBAL.startingLife} lifeforms survived.`);

  const newLifeforms = [];
  // 2. REPRODUCTION: Create a new population from the fittest survivors
  for (let i = 0; i < GLOBAL.startingLife; i++) {
    // The parent is chosen from the top survivors. This gives fitter individuals
    // a higher chance of reproducing more than once.
    const parent = survivors[i % survivors.length];

    // Create a new genome by copying the parent's
    const newGenome = parent.genome.map(gene => {
      // 3. MUTATION: Apply the mutation rate
      if (Math.random() < GLOBAL.mutation_rate) {
        // If mutation occurs, create one new random gene
        return createGenome(1)[0];
      }
      // Otherwise, pass the parent's gene on unchanged
      return gene;
    });

    const child = new Life(i, newGenome.length, GLOBAL.sensory_inputs, GLOBAL.inner_neurons, GLOBAL.action_outputs, GLOBAL.generation);
    child.genome = newGenome;
    child.brain = child.genome.map(gene => parseGene(gene));
    newLifeforms.push(child);
  }

  // Replace the old population with the new generation
  GLOBAL.lifeform = newLifeforms;

  // Reset the world for the new generation to begin
  await setupWorld(GLOBAL.x, GLOBAL.y, GLOBAL.startingLife, true); // The 'true' flag tells setupWorld not to wipe everything
  logToPage(`--- Beginning Generation ${GLOBAL.generation} ---`);
  startSimulation(GLOBAL.steps);
}
