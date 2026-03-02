import './style.css';
import GLOBAL from './globals.js';
import './simulator.js';
import { startSimulation, stopSimulation } from './simulator.js';
import SENS from './sensor.js';
import ACTS from './action.js';
import {logToPage, randomInt, mutateGeneBit} from './utils.js';
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

  const tabLinks = document.querySelectorAll('.tab-link');
  const tabContents = document.querySelectorAll('.tab-content');

  tabLinks.forEach(link => {
    link.addEventListener('click', () => {
      // Remove active class from all links and content
      tabLinks.forEach(item => item.classList.remove('active'));
      tabContents.forEach(item => item.classList.remove('active'));

      // Add active class to the clicked link and corresponding content
      const tabId = link.dataset.tab;
      const correspondingTab = document.getElementById(tabId);

      link.classList.add('active');
      correspondingTab.classList.add('active');
    });
  });

  // Continue button event listener
  document.getElementById('continueSimulation').addEventListener('click', () => {
    logToPage(`Continuing for ${GLOBAL.steps} more steps...`);
    startSimulation(GLOBAL.steps);
    // Ensure the toggle button is in the correct state
    toggleBtn.textContent = 'Pause';
    GLOBAL.isPaused = false;
  });

  const tableBody = document.getElementById('lifeform-table-body');
  tableBody.addEventListener('click', (event) => {
    if (event.target.classList.contains('select-lifeform-btn')) {
      GLOBAL.selectedLifeformId = parseInt(event.target.dataset.id, 10);
      updateSelectedLifeformUI();
      drawWorld();
    }
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
  const genomeRawOutput = document.getElementById('genome-raw-output');

  const genomeLengthSpan = document.querySelector('#genome-length span');
  const sensoryInputsSpan = document.querySelector('#sensory-inputs span');
  const innerNeuronsSpan = document.querySelector('#inner-neurons span');
  const actionOutputsSpan = document.querySelector('#action-outputs span');
  const logDiv = document.getElementById('life-action-log');

  // Clear brain display initially
  if (brainOutput) brainOutput.innerHTML = '';
  if (genomeRawOutput) genomeRawOutput.innerHTML = '-';

  if (id === null || !GLOBAL.lifeform[id]) {
    // Clear all fields if no lifeform is selected
    idSpan.textContent = '-';
    posXSpan.textContent = '-';
    posYSpan.textContent = '-';
    energySpan.textContent = '-';
    genomeLengthSpan.textContent = '-';
    sensoryInputsSpan.textContent = '-';
    innerNeuronsSpan.textContent = '-';
    actionOutputsSpan.textContent = '-';
    return;
  }

  const lifeform = GLOBAL.lifeform[id];
  
  if (logDiv) {
    if (lifeform && lifeform.actionLog.length) {
      logDiv.innerHTML = lifeform.actionLog.slice(-30).reverse().map(e => `<div>${e}</div>`).join('');
    } else {
      logDiv.innerHTML = '<em>No events yet.</em>';
    }
  }

  // Update the text content of the elements
  idSpan.textContent = id;
  posXSpan.textContent = lifeform.pos_x;
  posYSpan.textContent = lifeform.pos_y;
  energySpan.textContent = lifeform.alive ? lifeform.energy : 'Dead';
  genomeLengthSpan.textContent = lifeform.genome_length;
  sensoryInputsSpan.textContent = lifeform.sensory_inputs;
  innerNeuronsSpan.textContent = lifeform.inner_neurons;
  actionOutputsSpan.textContent = lifeform.action_outputs;

  if (genomeRawOutput && lifeform.genome) {
    // Join the array of hex strings with a space for readability
    const genomeString = lifeform.genome.join(' ');
    genomeRawOutput.innerHTML = `${genomeString}`;
  }

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
  
  const debugTableDiv = document.getElementById('brain-debug-table');
  debugTableDiv.innerHTML = ''; // clear previous
  
  if (lifeform._lastBrainStepDebug && lifeform._lastBrainStepDebug.length) {
    // Table header
    let html = `<table class="debug-table">
      <thead>
        <tr>
          <th>#</th>
          <th>From</th>
          <th>To</th>
          <th>Input</th>
          <th>Weight</th>
          <th>Delta</th>
          <th>Before</th>
          <th>After</th>
        </tr>
      </thead>
      <tbody>`;
    
    lifeform._lastBrainStepDebug.forEach(step => {
      html += `
        <tr>
          <td>${step.geneIndex}</td>
          <td>${step.from}</td>
          <td>${step.to}</td>
          <td>${step.sourceValue.toFixed(3)}</td>
          <td>${step.weight.toFixed(3)}</td>
          <td>${step.contribution.toFixed(3)}</td>
          <td>${step.before.toFixed(3)}</td>
          <td>${step.after.toFixed(3)}</td>
        </tr>`;
    });
    
    html += '</tbody></table>';
    debugTableDiv.innerHTML = html;
  } else {
    debugTableDiv.innerHTML = '<em>No brain step data for this tick.</em>';
  }
  
  drawBrainCanvas(lifeform);
}

// --- Draw neural network for selected lifeform ---
function drawBrainCanvas(lifeform) {
  const canvas = document.getElementById('brain-canvas');
  if (!canvas || !lifeform || !lifeform.brain) return;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  
  // 1. Find used sensors/neurons/actions from genes
  const usedSensors = new Set();
  const usedNeurons = new Set();
  const usedActions = new Set();
  
  for (const gene of lifeform.brain) {
    if (gene.sourceType === 0) usedSensors.add(gene.sourceId);
    if (gene.sourceType === 1) usedNeurons.add(gene.sourceId);
    if (gene.sinkType === 0) usedNeurons.add(gene.sinkId);
    if (gene.sinkType === 1) usedActions.add(gene.sinkId);
  }
  // sorted for layout stability
  const sensorsArr = Array.from(usedSensors).sort((a, b) => a - b);
  const neuronsArr = Array.from(usedNeurons).sort((a, b) => a - b);
  const actionsArr = Array.from(usedActions).sort((a, b) => a - b);
  
  // Limit how many are drawn for clarity (optional)
  const MAX_SHOWN = 8;
  const sensorsToDraw = sensorsArr.slice(0, MAX_SHOWN);
  const neuronsToDraw = neuronsArr.slice(0, MAX_SHOWN);
  const actionsToDraw = actionsArr.slice(0, MAX_SHOWN);
  
  // 2. Setup node positions per type
  const nodeR = 15;
  const nodeX = [200, 300, 400];
  const nodeY = (len, idx) => canvas.height * (0.1 + 0.8 * (idx + 1) / (len + 1));
  
  // positional index mapping (id -> position in array)
  const mapIdx = arr => {
    const result = {};
    arr.forEach((val, i) => result[val] = i);
    return result;
  };
  const sensorMap = mapIdx(sensorsToDraw);
  const neuronMap = mapIdx(neuronsToDraw);
  const actionMap = mapIdx(actionsToDraw);
  
  // Draw connections first
  ctx.globalAlpha = 0.8;
  for (const gene of lifeform.brain) {
    let from = null, to = null;
    if (gene.sourceType === 0 && sensorMap.hasOwnProperty(gene.sourceId)) {
      from = [nodeX[0], nodeY(sensorsToDraw.length, sensorMap[gene.sourceId])];
    } else if (gene.sourceType === 1 && neuronMap.hasOwnProperty(gene.sourceId)) {
      from = [nodeX[1], nodeY(neuronsToDraw.length, neuronMap[gene.sourceId])];
    }
    if (gene.sinkType === 0 && neuronMap.hasOwnProperty(gene.sinkId)) {
      to = [nodeX[1], nodeY(neuronsToDraw.length, neuronMap[gene.sinkId])];
    } else if (gene.sinkType === 1 && actionMap.hasOwnProperty(gene.sinkId)) {
      to = [nodeX[2], nodeY(actionsToDraw.length, actionMap[gene.sinkId])];
    }
    if (!from || !to) continue;
    ctx.strokeStyle = gene.weight >= 0 ? '#F9ED31' : '#F24367';
    ctx.lineWidth = Math.max(1, Math.abs(gene.weight) * 2);
    ctx.beginPath();
    ctx.moveTo(from[0], from[1]);
    ctx.lineTo(to[0], to[1]);
    ctx.stroke();
  }
  ctx.globalAlpha = 1.0;
  
  // Draw sensors (labels)
  const sensorKeys = Object.keys(SENS.Sensor);
  sensorsToDraw.forEach((id, i) => {
    ctx.beginPath();
    ctx.arc(nodeX[0], nodeY(sensorsToDraw.length, i), nodeR, 0, 2 * Math.PI);
    ctx.fillStyle = '#24cb72';
    ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.font = 'bold 11px Segoe UI,Arial';
    ctx.fillStyle = '#fff';
    ctx.textAlign = "right";
    ctx.fillText(sensorKeys[id], nodeX[0] - nodeR - 8, nodeY(sensorsToDraw.length, i) + 4);
  });
  
  // Draw neurons
  neuronsToDraw.forEach((id, i) => {
    let nv = (lifeform._lastNeuronValues && typeof lifeform._lastNeuronValues[id] === 'number')
      ? lifeform._lastNeuronValues[id] : 0;
    ctx.beginPath();
    ctx.arc(nodeX[1], nodeY(neuronsToDraw.length, i), nodeR, 0, 2 * Math.PI);
    ctx.fillStyle = `rgb(${nv > 0 ? 255 : 100}, ${nv > 0 ? 235 : 120}, ${nv > 0 ? 70 : 190})`;
    ctx.globalAlpha = 0.95;
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.font = 'bold 11px Segoe UI,Arial';
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'center';
    ctx.fillText('N' + id, nodeX[1], nodeY(neuronsToDraw.length, i));
  });
  
  // Draw actions
  const actionKeys = Object.keys(ACTS.Action);
  actionsToDraw.forEach((id, i) => {
    ctx.beginPath();
    ctx.arc(nodeX[2], nodeY(actionsToDraw.length, i), nodeR, 0, 2 * Math.PI);
    ctx.fillStyle = '#299de0';
    ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.font = 'bold 11px Segoe UI,Arial';
    ctx.fillStyle = '#fff';
    ctx.textAlign = "left";
    ctx.fillText(actionKeys[id], nodeX[2] + nodeR + 8, nodeY(actionsToDraw.length, i) + 4);
  });
}

async function setupWorld(x, y, startingLife, isNewGeneration = false) {
  if (!isNewGeneration) {
    GLOBAL.generation = 0;
    GLOBAL.lifeform = []; // Clear the population
    document.getElementById('generation-value').textContent = GLOBAL.generation;

    // Create the new random population directly in setupWorld
    // for (let g = 0; g < startingLife; g++) {
    //   GLOBAL.lifeform[g] = new Life(g, GLOBAL.generation);
    // }

    // This gene means: SENSOR[AGE] -> ACTION[EMIT_SIGNAL1_PHER]
    // (The older it gets, the more it emits)
    const pheromoneGene = '0E887FFF';

    // Create the new random population directly in setupWorld
    for (let g = 0; g < startingLife; g++) {
      // Create a new lifeform with a random genome (default constructor)
      let newLifeform = new Life(g, GLOBAL.generation);

      // For the first 10 lifeforms, "seed" the pheromone gene
      if (g < 10) {
        newLifeform.genome[0] = pheromoneGene; // Overwrite the first gene
        // Re-parse the brain to include the new gene
        newLifeform.brain = newLifeform.genome.map(gene => parseGene(gene));
      }

      GLOBAL.lifeform[g] = newLifeform;
    }

  }

  // Initialize/reset the pheromone grid to all zeros
  GLOBAL.pheromoneGrid = new Array(GLOBAL.y).fill(0).map(() => new Array(GLOBAL.x).fill(0));

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
  
  GLOBAL.selectedLifeformId = 0;
  updateSelectedLifeformUI();
  drawWorld();
  drawBrainCanvas(GLOBAL.selectedLifeformId);
  logToPage('Tracking Lifeform #0 by default.');

  return true;
}

let worldCanvas, worldCtx;
function createWorld(x, y) {
  const w = GLOBAL.w;
  const h = GLOBAL.h;
  logToPage('Creating World...');
  // set up the canvas once
  worldCanvas = document.querySelector('.world');
  worldCanvas.addEventListener('click', onWorldCanvasClick);
  worldCtx = worldCanvas.getContext('2d');
  worldCanvas.width = x * w;
  worldCanvas.height = y * h;
  
  // Clear the canvas initially
  worldCtx.clearRect(0, 0, worldCanvas.width, worldCanvas.height);
  
  // No inner HTML/divs created for the grid anymore!
  return true;
}

function onWorldCanvasClick(e) {
  const rect = worldCanvas.getBoundingClientRect();
  const scaleX = worldCanvas.width / rect.width;
  const scaleY = worldCanvas.height / rect.height;
  const mouseX = (e.clientX - rect.left) * scaleX;
  const mouseY = (e.clientY - rect.top) * scaleY;
  
  // Allow for hit area around center of cell
  const tolerance = Math.max(GLOBAL.w, GLOBAL.h) * 1.2; // 1.2 "cell radii" or try 6-10px constant
  
  // Find nearest lifeform within tolerance, prefer alive, then dead
  let minDist = Infinity, best = null;
  for (const lf of GLOBAL.lifeform) {
    const lfCenterX = lf.pos_x * GLOBAL.w + GLOBAL.w / 2;
    const lfCenterY = lf.pos_y * GLOBAL.h + GLOBAL.h / 2;
    const dx = mouseX - lfCenterX;
    const dy = mouseY - lfCenterY;
    const dist = Math.sqrt(dx*dx + dy*dy);
    if (dist < tolerance && dist < minDist) {
      minDist = dist;
      best = lf;
    }
  }
  
  if (best) {
    GLOBAL.selectedLifeformId = best.id;
    updateSelectedLifeformUI();
    drawWorld();
  }
}

const foodEnergyCheckbox = document.getElementById('toggle-food-energy');
foodEnergyCheckbox.checked = GLOBAL.foodEnergyEnabled;
foodEnergyCheckbox.addEventListener('change', async (event) => {
  GLOBAL.foodEnergyEnabled = event.target.checked;
  logToPage('Food/Energy ' + (GLOBAL.foodEnergyEnabled ? 'enabled' : 'disabled') + '. Restarting world...');
  stopSimulation();
  await setupWorld(GLOBAL.x, GLOBAL.y, GLOBAL.startingLife); // food spawning logic responds to the flag
  startSimulation(GLOBAL.steps);
});

function drawWorld() {
  if (!worldCtx) return;
  const x = GLOBAL.x;
  const y = GLOBAL.y;
  const w = GLOBAL.w;
  const h = GLOBAL.h;
  worldCtx.clearRect(0, 0, worldCanvas.width, worldCanvas.height);

  const grid = GLOBAL.pheromoneGrid;
  const norm = GLOBAL.pheromoneStrength;
  if (grid.length) { // Only run if grid is initialized
    for (let y = 0; y < GLOBAL.y; y++) {
      for (let x = 0; x < GLOBAL.x; x++) {
        if (grid[y][x] > 0) {
          const alpha = (grid[y][x] / norm).toFixed(2); // 0.0 to 1.0
          // Using a magenta color for pheromones
          worldCtx.fillStyle = `rgba(255, 0, 255, ${alpha})`;
          worldCtx.fillRect(x * w, y * h, w, h);
        }
      }
    }
  }

  // Draw food
  if (GLOBAL.foodEnergyEnabled) {
    for (const pos of GLOBAL.foodGrid) {
      const [fy, fx] = pos.split('-').map(Number);
      worldCtx.fillStyle = '#2ecc71';
      worldCtx.beginPath();
      worldCtx.arc(fx * w + 4, fy * h + 4, 2, 0, 2 * Math.PI);
      worldCtx.fill();
    }
  }
  
  // Draw ALL lifeforms
  for (const lifeform of GLOBAL.lifeform) {
    if (lifeform.alive) {
      worldCtx.fillStyle = `rgb(${lifeform.color[0]},${lifeform.color[1]},${lifeform.color[2]})`;
      worldCtx.beginPath();
      worldCtx.arc(
        lifeform.pos_x * w + 4,
        lifeform.pos_y * h + 4,
        3, 0, 2 * Math.PI
      );
      worldCtx.fill();
    } else {
      // Draw dead as a red X or square
      worldCtx.strokeStyle = "#c62828"; // red or gray e.g. "#888"
      worldCtx.lineWidth = 1.5;
      // Draw X at (pos_x, pos_y)
      let px = lifeform.pos_x * w + 1;
      let py = lifeform.pos_y * h + 1;
      worldCtx.beginPath();
      worldCtx.moveTo(px, py);
      worldCtx.lineTo(px+w, py+h);
      worldCtx.moveTo(px+w, py);
      worldCtx.lineTo(px, py+h);
      worldCtx.stroke();
      
      // Optionally, faded fill
      worldCtx.fillStyle = "rgba(150,50,50,0.18)";
      worldCtx.fillRect(lifeform.pos_x * w + 1, lifeform.pos_y * h + 1, w, h);
    }
  }
  const selected = GLOBAL.lifeform[GLOBAL.selectedLifeformId];
  if (selected) {
    worldCtx.strokeStyle = "orange";
    worldCtx.lineWidth = 2;
    worldCtx.beginPath();
    worldCtx.arc(selected.pos_x * GLOBAL.h + GLOBAL.h / 2, selected.pos_y * GLOBAL.w + GLOBAL.w / 2, 4, 0, 2 * Math.PI);
    worldCtx.stroke();
  }
}

function placeLifeformsOnGrid() {
  // Step 1: Track occupied positions this generation
  const occupied = new Set();
  
  for (const lifeform of GLOBAL.lifeform) {
    const key = `${lifeform.pos_x}-${lifeform.pos_y}`;
    let tries = 0;
    // If this spawn location is already occupied, pick a new one
    while (occupied.has(key) && tries < 500) {
      // Find a new random legal position
      lifeform.pos_x = randomInt(0, GLOBAL.x);
      lifeform.pos_y = randomInt(0, GLOBAL.y);
      lifeform.old_x = lifeform.pos_x;
      lifeform.old_y = lifeform.pos_y;
      tries++;
    }
    occupied.add(`${lifeform.pos_x}-${lifeform.pos_y}`);
  }
  drawWorld();
  return true;
}

function spawnFood() {
  GLOBAL.foodGrid = [];
  if (!GLOBAL.foodEnergyEnabled) {
    drawWorld();
    return;
  }
  let foodCount = 0;
  while (foodCount < GLOBAL.foodCount) {
    const x = randomInt(0, GLOBAL.x);
    const y = randomInt(0, GLOBAL.y);
    const pos = `${y}-${x}`;
    if (!GLOBAL.foodGrid.includes(pos)) {
      GLOBAL.foodGrid.push(pos);
      foodCount++;
    }
  }
  drawWorld();
}

export function updateLifeformTable() {
  const tableBody = document.getElementById('lifeform-table-body');
  if (!tableBody) return;

  const directions = ['N', 'E', 'S', 'W'];

  for (const lifeform of GLOBAL.lifeform) {
    // Try to find an existing row for this lifeform
    let row = tableBody.querySelector(`tr[data-id='${lifeform.id}']`);

    // If no row exists, create it and its cells
    if (!row) {
      row = document.createElement('tr');
      row.setAttribute('data-id', lifeform.id);
      row.innerHTML = `
                <td>${lifeform.id}</td>
                <td>${lifeform.generation}</td>
                <td class="status"></td>
                <td class="position"></td>
                <td class="energy"></td>
                <td class="age"></td>
                <td class="direction"></td>
                <td class="action"></td>
                <td><button class="select-lifeform-btn" data-id="${lifeform.id}">Select</button></td>
            `;
      tableBody.appendChild(row);
    }

    // Now, update the content of the cells that change each year
    const status = lifeform.alive ? 'Alive' : 'Dead';
    const position = `${lifeform.pos_x}, ${lifeform.pos_y}`;
    const direction = directions[lifeform.direction];

    row.querySelector('.status').textContent = status;
    row.querySelector('.position').textContent = position;
    row.querySelector('.energy').textContent = lifeform.energy;
    row.querySelector('.age').textContent = lifeform.age;
    row.querySelector('.direction').textContent = direction;
    row.querySelector('.action').textContent = lifeform.lastAction || '-';
  }
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
        return mutateGeneBit(gene);
      }
      // Otherwise, pass the parent's gene on unchanged
      return gene;
    });

    const child = new Life(i, GLOBAL.generation, newGenome);
    newLifeforms.push(child);
  }

  // Replace the old population with the new generation
  GLOBAL.lifeform = newLifeforms;

  // Reset the world for the new generation to begin
  await setupWorld(GLOBAL.x, GLOBAL.y, GLOBAL.startingLife, true); // The 'true' flag tells setupWorld not to wipe everything
  logToPage(`--- Beginning Generation ${GLOBAL.generation} ---`);
  startSimulation(GLOBAL.steps);
}

export { drawWorld, drawBrainCanvas };