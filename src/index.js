import './style.css';
import GLOBAL from './globals.js';
import { startSimulation, stopSimulation } from './simulator.js';
import SENS from './sensor.js';
import ACTS from './action.js';
import { logToPage, randomInt, mutateGeneBit } from './utils.js';
import Life, { parseGene, isBlocked } from './life.js';
import { CHALLENGES, applyChallenge, inZone, qualifies } from './challenges.js';

const DIRECTIONS = ['N', 'E', 'S', 'W'];
const SELECTED_COLOR = 'orange';

let worldCanvas, worldCtx;

document.addEventListener('DOMContentLoaded', async () => {
  worldCanvas = document.querySelector('.world');
  worldCtx = worldCanvas.getContext('2d');
  worldCanvas.addEventListener('click', onWorldCanvasClick);

  // The slider runs 1 (slow) to 200 (fast); invert it into a delay in ms.
  const speedSlider = document.getElementById('speed-slider');
  const applySpeed = () => { GLOBAL.simulationSpeed = 201 - Number(speedSlider.value); };
  applySpeed();
  speedSlider.addEventListener('input', applySpeed);

  const toggleBtn = document.getElementById('toggleSimulation');
  toggleBtn.addEventListener('click', () => {
    setPaused(!GLOBAL.isPaused);
    logToPage(GLOBAL.isPaused ? 'Simulation paused.' : 'Simulation resumed.');
  });

  document.getElementById('regenerateWorld').addEventListener('click', () => {
    restartWorld('Restarting world with a new random population...');
  });

  const foodEnergyCheckbox = document.getElementById('toggle-food-energy');
  foodEnergyCheckbox.checked = GLOBAL.foodEnergyEnabled;

  const challengeSelect = document.getElementById('challenge-select');
  for (const [key, challenge] of Object.entries(CHALLENGES)) {
    challengeSelect.add(new Option(challenge.label, key, false, key === GLOBAL.challenge));
  }
  challengeSelect.addEventListener('change', () => {
    GLOBAL.challenge = challengeSelect.value;
    const challenge = CHALLENGES[GLOBAL.challenge];
    // Goal challenges run without food by default, so starving doesn't mask who reached the goal.
    GLOBAL.foodEnergyEnabled = !challenge.goal;
    foodEnergyCheckbox.checked = GLOBAL.foodEnergyEnabled;
    restartWorld(`Challenge: ${challenge.label}. Restarting world...`);
  });

  window.addEventListener('resize', drawHistoryChart);
  foodEnergyCheckbox.addEventListener('change', (event) => {
    // Applied live, so the current run and its evolution carry on.
    // Food already on the map is kept while disabled (drawing and sensors check the flag),
    // so switching off and on again doesn't top it up.
    GLOBAL.foodEnergyEnabled = event.target.checked;
    if (GLOBAL.foodEnergyEnabled && GLOBAL.foodGrid.length === 0) spawnFood();
    logToPage(`Food/energy ${GLOBAL.foodEnergyEnabled ? 'enabled' : 'disabled'}.`);
    updateSelectedLifeformUI();
    updateLifeformTable();
    drawWorld();
  });

  const tabLinks = document.querySelectorAll('.tab-link');
  const tabContents = document.querySelectorAll('.tab-content');
  tabLinks.forEach(link => {
    link.addEventListener('click', () => {
      tabLinks.forEach(item => item.classList.remove('active'));
      tabContents.forEach(item => item.classList.remove('active'));
      link.classList.add('active');
      document.getElementById(link.dataset.tab).classList.add('active');
      if (link.dataset.tab === 'tab-log') {
        // The log can't auto-scroll while hidden, so jump to the newest entries on open.
        const log = document.getElementById('log-output');
        log.scrollTop = log.scrollHeight;
      }
      // Bring the newly visible panel up to date straight away, even when paused.
      updateSelectedLifeformUI();
      updateLifeformTable();
    });
  });

  // Click anywhere on a population row to select that lifeform.
  document.getElementById('lifeform-table-body').addEventListener('click', (event) => {
    const row = event.target.closest('tr[data-id]');
    if (row) selectLifeform(parseInt(row.dataset.id, 10));
  });

  // Opening the debug table should show data immediately, even when paused.
  document.getElementById('brain-debug').addEventListener('toggle', updateSelectedLifeformUI);

  await setupWorld();
  logToPage(`World ready after ${((performance.now() - GLOBAL.startTime) / 1000).toFixed(2)} seconds`);
  startSimulation(GLOBAL.generationLength);
});

function setPaused(paused) {
  GLOBAL.isPaused = paused;
  document.getElementById('toggleSimulation').textContent = paused ? 'Resume' : 'Pause';
  if (paused) {
    stopSimulation();
  } else {
    startSimulation(0); // carry on towards the current target year
  }
}

async function restartWorld(message) {
  logToPage(message);
  stopSimulation();
  setStatusMessage('');
  GLOBAL.selectedLifeformId = 0;
  GLOBAL.isPaused = false;
  document.getElementById('toggleSimulation').textContent = 'Pause';
  await setupWorld();
  startSimulation(GLOBAL.generationLength);
}

function setStatusMessage(text) {
  const el = document.getElementById('status-message');
  el.textContent = text;
  el.hidden = !text;
}

export function updateStatus() {
  const alive = GLOBAL.lifeform.filter(lf => lf.alive).length;
  document.getElementById('generation-value').textContent = GLOBAL.generation;
  document.getElementById('year-value').textContent = `${GLOBAL.yearCounter} / ${GLOBAL.generationLength}`;
  document.getElementById('population-value').textContent = `${alive} / ${GLOBAL.lifeform.length}`;

  const goalStat = document.getElementById('goal-stat');
  goalStat.hidden = !GLOBAL.goalZone;
  if (GLOBAL.goalZone) {
    const inGoal = GLOBAL.lifeform.filter(lf => lf.alive && inZone(GLOBAL.goalZone, lf.pos_x, lf.pos_y)).length;
    document.getElementById('goal-value').textContent = `${inGoal} / ${GLOBAL.lifeform.length}`;
  }
}

function selectLifeform(id) {
  if (!GLOBAL.lifeform[id]) return;
  GLOBAL.selectedLifeformId = id;
  updateSelectedLifeformUI();
  updateLifeformTable();
  drawWorld();
}

function isVisible(tabId) {
  return document.getElementById(tabId).classList.contains('active');
}

export function updateSelectedLifeformUI() {
  if (!isVisible('tab-selection')) return;

  const id = GLOBAL.selectedLifeformId;
  const lifeform = id === null ? null : GLOBAL.lifeform[id];
  const set = (selector, value) => { document.querySelector(selector).textContent = value; };
  const logDiv = document.getElementById('life-action-log');
  const debugDetails = document.getElementById('brain-debug');
  const debugTableDiv = document.getElementById('brain-debug-table');

  if (!lifeform) {
    ['#cell-selected span', '#position span', '#energy span', '#age span', '#last-action span']
      .forEach(sel => set(sel, '-'));
    set('#genome-raw-output', '-');
    logDiv.innerHTML = '<em>Click a lifeform to see its events.</em>';
    debugTableDiv.innerHTML = '';
    clearBrainCanvas();
    return;
  }

  set('#cell-selected span', `#${id} (gen ${lifeform.generation})`);
  set('#position span', `${lifeform.pos_x}, ${lifeform.pos_y} facing ${DIRECTIONS[lifeform.direction]}`);
  set('#energy span', lifeform.alive ? (GLOBAL.foodEnergyEnabled ? lifeform.energy : 'n/a') : 'Dead');
  set('#age span', lifeform.age);
  set('#last-action span', lifeform.lastAction || '-');
  set('#genome-raw-output', lifeform.genome ? lifeform.genome.join(' ') : '-');

  logDiv.innerHTML = lifeform.actionLog.length
    ? lifeform.actionLog.slice(-30).reverse().map(e => `<div>${e}</div>`).join('')
    : '<em>No events yet.</em>';

  // The debug table is only built while it is open: it's large and changes every tick.
  if (debugDetails.open) {
    debugTableDiv.innerHTML = renderBrainDebugTable(lifeform);
  }

  drawBrainCanvas(lifeform);
}

function renderBrainDebugTable(lifeform) {
  const steps = lifeform._lastBrainStepDebug;
  if (!steps || !steps.length) return '<em>No brain step data yet.</em>';
  const rows = steps.map(step => `
      <tr>
        <td>${step.geneIndex}</td>
        <td>${step.from}</td>
        <td>${step.to}</td>
        <td>${step.sourceValue.toFixed(2)}</td>
        <td>${step.weight.toFixed(2)}</td>
        <td>${step.contribution.toFixed(2)}</td>
        <td>${step.before.toFixed(2)}</td>
        <td>${step.after.toFixed(2)}</td>
      </tr>`).join('');
  return `<table>
      <thead><tr><th>#</th><th>From</th><th>To</th><th>Input</th><th>Weight</th><th>Delta</th><th>Before</th><th>After</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>`;
}

function clearBrainCanvas() {
  const canvas = document.getElementById('brain-canvas');
  if (canvas) canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);
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
  // Sorted for layout stability, and capped for clarity.
  const MAX_SHOWN = 8;
  const sortedSlice = set => Array.from(set).sort((a, b) => a - b).slice(0, MAX_SHOWN);
  const sensorsToDraw = sortedSlice(usedSensors);
  const neuronsToDraw = sortedSlice(usedNeurons);
  const actionsToDraw = sortedSlice(usedActions);

  // 2. Node positions per column. Side columns leave room for 16px labels.
  const nodeR = 16;
  const nodeX = [canvas.width * 0.35, canvas.width * 0.5, canvas.width * 0.65];
  const nodeY = (len, idx) => canvas.height * (0.1 + 0.8 * (idx + 1) / (len + 1));

  const mapIdx = arr => {
    const result = {};
    arr.forEach((val, i) => { result[val] = i; });
    return result;
  };
  const sensorMap = mapIdx(sensorsToDraw);
  const neuronMap = mapIdx(neuronsToDraw);
  const actionMap = mapIdx(actionsToDraw);
  const has = (obj, key) => Object.prototype.hasOwnProperty.call(obj, key);

  // Draw connections first
  ctx.globalAlpha = 0.8;
  for (const gene of lifeform.brain) {
    let from = null, to = null;
    if (gene.sourceType === 0 && has(sensorMap, gene.sourceId)) {
      from = [nodeX[0], nodeY(sensorsToDraw.length, sensorMap[gene.sourceId])];
    } else if (gene.sourceType === 1 && has(neuronMap, gene.sourceId)) {
      from = [nodeX[1], nodeY(neuronsToDraw.length, neuronMap[gene.sourceId])];
    }
    if (gene.sinkType === 0 && has(neuronMap, gene.sinkId)) {
      to = [nodeX[1], nodeY(neuronsToDraw.length, neuronMap[gene.sinkId])];
    } else if (gene.sinkType === 1 && has(actionMap, gene.sinkId)) {
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

  const drawNode = (x, y, fill) => {
    ctx.beginPath();
    ctx.arc(x, y, nodeR, 0, 2 * Math.PI);
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  };
  ctx.font = 'bold 16px Segoe UI, Arial, sans-serif';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#fff';

  const sensorKeys = Object.keys(SENS.Sensor);
  sensorsToDraw.forEach((id, i) => {
    const y = nodeY(sensorsToDraw.length, i);
    drawNode(nodeX[0], y, '#24cb72');
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'right';
    ctx.fillText(sensorKeys[id], nodeX[0] - nodeR - 8, y);
  });

  neuronsToDraw.forEach((id, i) => {
    const nv = (lifeform._lastNeuronValues && typeof lifeform._lastNeuronValues[id] === 'number')
      ? lifeform._lastNeuronValues[id] : 0;
    const y = nodeY(neuronsToDraw.length, i);
    drawNode(nodeX[1], y, nv > 0 ? 'rgb(255,235,70)' : 'rgb(100,120,190)');
    ctx.fillStyle = nv > 0 ? '#222' : '#fff';
    ctx.textAlign = 'center';
    ctx.fillText('N' + id, nodeX[1], y);
  });

  const actionKeys = Object.keys(ACTS.Action);
  actionsToDraw.forEach((id, i) => {
    const y = nodeY(actionsToDraw.length, i);
    drawNode(nodeX[2], y, '#299de0');
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'left';
    ctx.fillText(actionKeys[id], nodeX[2] + nodeR + 8, y);
  });
}

async function setupWorld(isNewGeneration = false) {
  if (!isNewGeneration) {
    GLOBAL.generation = 0;
    GLOBAL.history = [];
    GLOBAL.lifeform = randomPopulation(0);
  }

  applyChallenge();
  GLOBAL.pheromoneGrid = new Array(GLOBAL.y).fill(0).map(() => new Array(GLOBAL.x).fill(0));
  GLOBAL.yearCounter = 0;

  sizeWorldCanvas();
  try {
    placeLifeformsOnGrid();
    spawnFood();
  } catch (error) {
    logToPage(`An error occurred: ${error.message}`);
    console.error(error);
  }

  // Keep the current selection across generations; fall back to #0.
  if (GLOBAL.selectedLifeformId === null || !GLOBAL.lifeform[GLOBAL.selectedLifeformId]) {
    GLOBAL.selectedLifeformId = 0;
  }

  updateStatus();
  updateSelectedLifeformUI();
  updateLifeformTable();
  drawWorld();
  drawHistoryChart();
  return true;
}

function randomPopulation(generation) {
  // This gene means: SENSOR[AGE] -> ACTION[EMIT_SIGNAL1_PHER]
  // (The older it gets, the more it emits)
  const pheromoneGene = '0E887FFF';
  const population = [];
  for (let g = 0; g < GLOBAL.startingLife; g++) {
    const newLifeform = new Life(g, generation);
    // For the first 10 lifeforms, "seed" the pheromone gene
    if (g < 10) {
      newLifeform.genome[0] = pheromoneGene;
      newLifeform.brain = newLifeform.genome.map(gene => parseGene(gene));
    }
    population.push(newLifeform);
  }
  return population;
}

function sizeWorldCanvas() {
  const width = GLOBAL.x * GLOBAL.w;
  const height = GLOBAL.y * GLOBAL.h;
  if (worldCanvas.width !== width) worldCanvas.width = width;
  if (worldCanvas.height !== height) worldCanvas.height = height;
}

function onWorldCanvasClick(e) {
  const rect = worldCanvas.getBoundingClientRect();
  const scaleX = worldCanvas.width / rect.width;
  const scaleY = worldCanvas.height / rect.height;
  const mouseX = (e.clientX - rect.left) * scaleX;
  const mouseY = (e.clientY - rect.top) * scaleY;

  // Generous hit area: small dots are hard to click exactly.
  const tolerance = Math.max(GLOBAL.w, GLOBAL.h) * 2;

  // Find the nearest lifeform within tolerance, preferring living ones.
  let best = null, bestScore = Infinity;
  for (const lf of GLOBAL.lifeform) {
    const dx = mouseX - (lf.pos_x * GLOBAL.w + GLOBAL.w / 2);
    const dy = mouseY - (lf.pos_y * GLOBAL.h + GLOBAL.h / 2);
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist >= tolerance) continue;
    const score = dist + (lf.alive ? 0 : tolerance);
    if (score < bestScore) {
      bestScore = score;
      best = lf;
    }
  }

  if (best) selectLifeform(best.id);
}

function drawWorld() {
  if (!worldCtx) return;
  const w = GLOBAL.w;
  const h = GLOBAL.h;
  const cx = x => x * w + w / 2;
  const cy = y => y * h + h / 2;
  worldCtx.clearRect(0, 0, worldCanvas.width, worldCanvas.height);

  // Start and goal zones, then walls
  const shadeZone = (zone, fill, stroke) => {
    if (!zone) return;
    const zx = zone.x0 * w, zy = zone.y0 * h;
    const zw = (zone.x1 - zone.x0 + 1) * w, zh = (zone.y1 - zone.y0 + 1) * h;
    worldCtx.fillStyle = fill;
    worldCtx.fillRect(zx, zy, zw, zh);
    if (stroke) {
      worldCtx.strokeStyle = stroke;
      worldCtx.lineWidth = 2;
      worldCtx.setLineDash([6, 4]);
      worldCtx.strokeRect(zx + 1, zy + 1, zw - 2, zh - 2);
      worldCtx.setLineDash([]);
    }
  };
  if (GLOBAL.goalZone) shadeZone(GLOBAL.spawnZone, 'rgba(255, 255, 255, 0.05)');
  shadeZone(GLOBAL.goalZone, 'rgba(41, 157, 224, 0.2)', 'rgba(41, 157, 224, 0.8)');

  if (GLOBAL.barrierGrid.length) {
    worldCtx.fillStyle = '#8a8f98';
    for (let y = 0; y < GLOBAL.y; y++) {
      for (let x = 0; x < GLOBAL.x; x++) {
        if (GLOBAL.barrierGrid[y * GLOBAL.x + x]) worldCtx.fillRect(x * w, y * h, w, h);
      }
    }
  }

  // Pheromones
  const grid = GLOBAL.pheromoneGrid;
  const norm = GLOBAL.pheromoneStrength;
  if (grid.length) {
    for (let y = 0; y < GLOBAL.y; y++) {
      for (let x = 0; x < GLOBAL.x; x++) {
        if (grid[y][x] > 0) {
          worldCtx.fillStyle = `rgba(255, 0, 255, ${(grid[y][x] / norm).toFixed(2)})`;
          worldCtx.fillRect(x * w, y * h, w, h);
        }
      }
    }
  }

  // Food
  if (GLOBAL.foodEnergyEnabled) {
    worldCtx.fillStyle = '#2ecc71';
    for (const pos of GLOBAL.foodGrid) {
      const [fy, fx] = pos.split('-').map(Number);
      worldCtx.beginPath();
      worldCtx.arc(cx(fx), cy(fy), Math.max(2, w / 2), 0, 2 * Math.PI);
      worldCtx.fill();
    }
  }

  // Lifeforms: living as coloured dots, dead as a red cross.
  for (const lifeform of GLOBAL.lifeform) {
    const x = cx(lifeform.pos_x);
    const y = cy(lifeform.pos_y);
    if (lifeform.alive) {
      worldCtx.fillStyle = `rgb(${lifeform.color[0]},${lifeform.color[1]},${lifeform.color[2]})`;
      worldCtx.beginPath();
      worldCtx.arc(x, y, 3, 0, 2 * Math.PI);
      worldCtx.fill();
    } else {
      const r = Math.max(2, w / 2);
      worldCtx.strokeStyle = '#c62828';
      worldCtx.lineWidth = 1.5;
      worldCtx.beginPath();
      worldCtx.moveTo(x - r, y - r);
      worldCtx.lineTo(x + r, y + r);
      worldCtx.moveTo(x + r, y - r);
      worldCtx.lineTo(x - r, y + r);
      worldCtx.stroke();
    }
  }

  // Selection ring, drawn last so it sits on top.
  const selected = GLOBAL.lifeform[GLOBAL.selectedLifeformId];
  if (selected) {
    worldCtx.strokeStyle = SELECTED_COLOR;
    worldCtx.lineWidth = 2.5;
    worldCtx.beginPath();
    worldCtx.arc(cx(selected.pos_x), cy(selected.pos_y), 7, 0, 2 * Math.PI);
    worldCtx.stroke();
  }
}

function placeLifeformsOnGrid() {
  // Put every lifeform on a free, wall-free cell inside the challenge's start zone.
  const zone = GLOBAL.spawnZone;
  const occupied = new Set();
  for (const lifeform of GLOBAL.lifeform) {
    let x, y, tries = 0;
    do {
      x = randomInt(zone.x0, zone.x1 + 1);
      y = randomInt(zone.y0, zone.y1 + 1);
      tries++;
    } while ((isBlocked(x, y) || occupied.has(`${y}-${x}`)) && tries < 1000);
    lifeform.pos_x = lifeform.old_x = x;
    lifeform.pos_y = lifeform.old_y = y;
    occupied.add(`${y}-${x}`);
  }
}

function spawnFood() {
  GLOBAL.foodGrid = [];
  if (!GLOBAL.foodEnergyEnabled) return;
  while (GLOBAL.foodGrid.length < GLOBAL.foodCount) {
    const x = randomInt(0, GLOBAL.x), y = randomInt(0, GLOBAL.y);
    const pos = `${y}-${x}`; // 'y-x'
    if (!isBlocked(x, y) && !GLOBAL.foodGrid.includes(pos)) GLOBAL.foodGrid.push(pos);
  }
}

export function updateLifeformTable() {
  if (!isVisible('tab-population')) return;
  const tableBody = document.getElementById('lifeform-table-body');

  // Drop rows for lifeforms that no longer exist.
  for (const row of Array.from(tableBody.rows)) {
    if (!GLOBAL.lifeform[Number(row.dataset.id)]) row.remove();
  }

  for (const lifeform of GLOBAL.lifeform) {
    let row = tableBody.querySelector(`tr[data-id='${lifeform.id}']`);
    if (!row) {
      row = document.createElement('tr');
      row.dataset.id = lifeform.id;
      row.innerHTML = `
        <td>${lifeform.id}</td>
        <td class="gen"></td>
        <td class="status"></td>
        <td class="position"></td>
        <td class="energy"></td>
        <td class="age"></td>
        <td class="direction"></td>
        <td class="action"></td>`;
      tableBody.appendChild(row);
    }

    row.querySelector('.gen').textContent = lifeform.generation;
    row.querySelector('.status').textContent = lifeform.alive ? 'Alive' : 'Dead';
    row.querySelector('.position').textContent = `${lifeform.pos_x}, ${lifeform.pos_y}`;
    row.querySelector('.energy').textContent = GLOBAL.foodEnergyEnabled ? lifeform.energy : 'n/a';
    row.querySelector('.age').textContent = lifeform.age;
    row.querySelector('.direction').textContent = DIRECTIONS[lifeform.direction];
    row.querySelector('.action').textContent = lifeform.lastAction || '-';
    row.classList.toggle('selected-row', lifeform.id === GLOBAL.selectedLifeformId);
    row.classList.toggle('dead-row', !lifeform.alive);
  }
}

export async function createNewGeneration() {
  stopSimulation();

  // 1. SELECTION: lifeforms that met the challenge (alive, and in the goal zone if there is one),
  // fittest (highest energy) first.
  const parents = GLOBAL.lifeform.filter(qualifies).sort((a, b) => b.energy - a.energy);
  const total = GLOBAL.lifeform.length;
  const percent = total ? Math.round((parents.length / total) * 100) : 0;
  GLOBAL.history.push({ generation: GLOBAL.generation, percent });

  const what = GLOBAL.goalZone ? 'reached the goal' : 'survived';
  logToPage(`${parents.length} of ${total} lifeforms ${what} (${percent}%).`);

  const endedGeneration = GLOBAL.generation;
  GLOBAL.generation++;

  let newLifeforms;
  if (parents.length === 0) {
    // Nobody to breed from: carry on with fresh random brains, keeping the generation count and chart.
    const reason = GLOBAL.goalZone ? 'Nobody reached the goal' : 'Everyone died';
    logToPage(`${reason} in generation ${endedGeneration}. Next generation starts from random brains.`);
    setStatusMessage(`${reason} in generation ${endedGeneration}, so generation ${GLOBAL.generation} starts from random brains.`);
    newLifeforms = randomPopulation(GLOBAL.generation);
  } else {
    setStatusMessage(''); // a generation succeeded, so any old notice is stale
    // 2. REPRODUCTION: fitter parents are earlier in the list, so they may parent more than once.
    newLifeforms = [];
    for (let i = 0; i < GLOBAL.startingLife; i++) {
      const parent = parents[i % parents.length];
      // 3. MUTATION: flip a bit in each gene with probability mutation_rate
      const newGenome = parent.genome.map(gene =>
        Math.random() < GLOBAL.mutation_rate ? mutateGeneBit(gene) : gene
      );
      newLifeforms.push(new Life(i, GLOBAL.generation, newGenome));
    }
  }

  GLOBAL.lifeform = newLifeforms;
  await setupWorld(true);
  logToPage(`--- Beginning Generation ${GLOBAL.generation} ---`);
  startSimulation(GLOBAL.generationLength);
}

// --- Progress chart: % of each generation that met the challenge ---
function drawHistoryChart() {
  const canvas = document.getElementById('history-chart');
  const history = GLOBAL.history;
  const what = GLOBAL.goalZone ? 'Reached the goal' : 'Survived';
  document.getElementById('progress-title').textContent = `Progress: ${what.toLowerCase()} per generation`;

  const summary = document.getElementById('progress-summary');
  if (!history.length) {
    summary.textContent = 'The chart fills in as each generation finishes.';
  } else {
    const last = history[history.length - 1];
    const best = Math.max(...history.map(h => h.percent));
    summary.textContent = `Last: ${last.percent}% (gen ${last.generation}) · Best: ${best}% · Blue = each generation, orange = 10-generation average`;
  }

  // Size the canvas to its displayed width, so the 16px labels are never scaled down.
  const width = canvas.clientWidth;
  if (!width) return;
  if (canvas.width !== width) canvas.width = width;
  const height = canvas.height;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, width, height);

  const left = 56, right = 16, top = 14, bottom = 34;
  const plotW = width - left - right, plotH = height - top - bottom;
  const yFor = pct => top + plotH * (1 - pct / 100);

  ctx.font = '16px Segoe UI, Arial, sans-serif';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#c0c0c0';
  ctx.strokeStyle = '#3a3a3a';
  ctx.lineWidth = 1;
  for (const pct of [0, 50, 100]) {
    const y = yFor(pct);
    ctx.beginPath();
    ctx.moveTo(left, y);
    ctx.lineTo(width - right, y);
    ctx.stroke();
    ctx.textAlign = 'right';
    ctx.fillText(`${pct}%`, left - 8, y);
  }
  if (!history.length) return;

  const n = history.length;
  const xFor = i => left + (n === 1 ? plotW / 2 : (plotW * i) / (n - 1));

  // Generation numbers along the bottom: first and last.
  ctx.textBaseline = 'top';
  ctx.textAlign = n === 1 ? 'center' : 'left';
  ctx.fillText(`gen ${history[0].generation}`, xFor(0), top + plotH + 8);
  if (n > 1) {
    ctx.textAlign = 'right';
    ctx.fillText(`gen ${history[n - 1].generation}`, xFor(n - 1), top + plotH + 8);
  }

  const drawSeries = (values, color, lineWidth) => {
    ctx.strokeStyle = color;
    ctx.lineWidth = lineWidth;
    ctx.beginPath();
    values.forEach((v, i) => (i ? ctx.lineTo(xFor(i), yFor(v)) : ctx.moveTo(xFor(i), yFor(v))));
    ctx.stroke();
  };

  const values = history.map(h => h.percent);
  drawSeries(values, '#299de0', 2);
  if (n <= 60) {
    ctx.fillStyle = '#299de0';
    values.forEach((v, i) => {
      ctx.beginPath();
      ctx.arc(xFor(i), yFor(v), 3, 0, 2 * Math.PI);
      ctx.fill();
    });
  }

  // 10-generation rolling average, to show the trend through the noise.
  const avg = values.map((_, i) => {
    const slice = values.slice(Math.max(0, i - 9), i + 1);
    return slice.reduce((a, b) => a + b, 0) / slice.length;
  });
  if (n > 1) drawSeries(avg, 'orange', 3);
}

export { drawWorld };
