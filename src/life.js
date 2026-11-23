import GLOBAL from './globals.js';
import SENS from './sensor.js';
import ACTS from './action.js';
import { randomInt, setBit } from './utils.js';

// Step offsets for each facing: 0 = North, 1 = East, 2 = South, 3 = West.
const DIR_DX = [0, 1, 0, -1];
const DIR_DY = [-1, 0, 1, 0];
const LONG_PROBE_DIST = 16; // how far LONGPROBE_BAR_FWD looks ahead, in cells

// biosim4: neurons start (and, if undriven, stay) at 0.5, which gives brains a constant bias.
const INITIAL_NEURON_OUTPUT = 0.5;
const EMIT_THRESHOLD = 0.5;
const RESPONSIVENESS_K = 2; // biosim4's responsivenessCurveKFactor
const ACTION_INDEX = Object.fromEntries(Object.keys(ACTS.Action).map((name, i) => [name, i]));

/** biosim4's responseCurve: maps responsiveness 0..1 to an activity factor 0..1. */
function responseCurve(r) {
  const k = RESPONSIVENESS_K;
  return Math.pow(r - 2, -2 * k) - Math.pow(2, -2 * k) * (1 - r);
}

/** True if (x, y) is outside the world or a wall cell. */
export function isBlocked(x, y) {
  if (x < 0 || x >= GLOBAL.x || y < 0 || y >= GLOBAL.y) return true;
  return GLOBAL.barrierGrid.length > 0 && GLOBAL.barrierGrid[y * GLOBAL.x + x] === 1;
}

export default class Life {
  constructor(id, generation = 0, genome = null) {
    this.alive = true;
    this.energy = GLOBAL.initialEnergy;
    this.age = 0;
    this.id = id;
    this.generation = generation;
    this.pos_x = randomInt(0, GLOBAL.x);
    this.pos_y = randomInt(0, GLOBAL.y);
    this.old_x = this.pos_x;
    this.old_y = this.pos_y;
    this.direction = randomInt(0, 4);
    this.lastAction = 'None';
    this.actionLog = [];

    // Core Genetic Properties
    this.genome_length = GLOBAL.gen_len;
    this.sensory_inputs = GLOBAL.sensory_inputs;
    this.inner_neurons = GLOBAL.inner_neurons;
    this.action_outputs = GLOBAL.action_outputs;

    // If a genome is passed in, use it. Otherwise, create a new random one.
    this.genome = genome ? genome : createGenome(this.genome_length);
    this.brain = this.genome.map(gene => parseGene(gene));
    this.color = genomeToColor(this.genome);
  }

  _getPheromone(y, x) {
    if (y < 0 || y >= GLOBAL.y || x < 0 || x >= GLOBAL.x) {
      return 0; // Out of bounds is 0
    }
    return GLOBAL.pheromoneGrid[y][x];
  }

  getSensorValues(occupiedCells) {
    const sensorNames = Object.keys(SENS.Sensor);
    const sensorValues = new Array(sensorNames.length).fill(0);

    // LOC_X: East/West location, normalized between 0.0 and 1.0
    const locXIndex = sensorNames.indexOf('LOC_X');
    if (locXIndex !== -1) {
      sensorValues[locXIndex] = this.pos_x / GLOBAL.x;
    }
    
    // LOC_Y: NORTH/SOUTH location, normalized between 0.0 and 1.0
    const locYIndex = sensorNames.indexOf('LOC_Y');
    if (locYIndex !== -1) {
      sensorValues[locYIndex] = this.pos_y / GLOBAL.y;
    }
    
    // GENETIC_SIM_FWD: The genetic similarity of creature in front
    const geneticSimFwd = sensorNames.indexOf('GENETIC_SIM_FWD');
    let geneticSim = 0;
    
    if (geneticSimFwd !== -1) {
      let fwdX = this.pos_x, fwdY = this.pos_y;
      if (this.direction === 0) fwdY--; // North
      if (this.direction === 1) fwdX++; // East
      if (this.direction === 2) fwdY++; // South
      if (this.direction === 3) fwdX--; // West
      
      const ahead = occupiedCells && occupiedCells.get(`${fwdY}-${fwdX}`);
      const forwardLifeform = ahead && ahead !== true && ahead.alive ? ahead : null;

      if (forwardLifeform) {
        const genomeA = this.genome;
        const genomeB = forwardLifeform.genome;
        let matching = 0;
        let compareLen = Math.min(genomeA.length, genomeB.length);
        for (let i = 0; i < compareLen; i++) {
          if (genomeA[i] === genomeB[i]) matching++;
        }
        geneticSim = matching / compareLen; // 1.0 = identical, 0 = nothing matches
      }
      
      // return the value
      sensorValues[geneticSimFwd] = geneticSim;
    }

    // AGE: Normalized age. Let's cap max age at 1000 for normalization.
    const ageIndex = sensorNames.indexOf('AGE');
    if (ageIndex !== -1) {
      sensorValues[ageIndex] = Math.min(this.age / 1000, 1.0);
    }

    // RANDOM: A random value, for spontaneous behavior.
    const randomIndex = sensorNames.indexOf('RANDOM');
    if (randomIndex !== -1) {
      sensorValues[randomIndex] = Math.random();
    }

    // BOUNDARY_DIST_X: How close to an East/West wall (0.0 = on edge, 1.0 = center)
    const boundaryXIndex = sensorNames.indexOf('BOUNDARY_DIST_X');
    if (boundaryXIndex !== -1) {
      // This calculation finds the closest distance to an E/W wall and normalizes it
      const distX = Math.min(this.pos_x, (GLOBAL.x - 1) - this.pos_x);
      sensorValues[boundaryXIndex] = distX / (GLOBAL.x / 2);
    }

    // BOUNDARY_DIST_Y: How close to a North/South wall
    const boundaryYIndex = sensorNames.indexOf('BOUNDARY_DIST_Y');
    if (boundaryYIndex !== -1) {
      const distY = Math.min(this.pos_y, (GLOBAL.y - 1) - this.pos_y);
      sensorValues[boundaryYIndex] = distY / (GLOBAL.y / 2);
    }

    // BOUNDARY_DIST: How close to the NEAREST wall
    const boundaryDistIndex = sensorNames.indexOf('BOUNDARY_DIST');
    if (boundaryDistIndex !== -1) {
      // We can just use the minimum of the two previous calculations
      sensorValues[boundaryDistIndex] = Math.min(sensorValues[boundaryXIndex], sensorValues[boundaryYIndex]);
    }

    // BARRIER_FWD: 1.0 if the cell straight ahead is a wall or the world edge.
    const dx = DIR_DX[this.direction], dy = DIR_DY[this.direction];
    const barrierFwdIndex = sensorNames.indexOf('BARRIER_FWD');
    if (barrierFwdIndex !== -1) {
      sensorValues[barrierFwdIndex] = isBlocked(this.pos_x + dx, this.pos_y + dy) ? 1.0 : 0.0;
    }

    // BARRIER_LR: wall to the side (Value = Right - Left: +1 wall on the right, -1 on the left).
    const barrierLRIndex = sensorNames.indexOf('BARRIER_LR');
    if (barrierLRIndex !== -1) {
      // Right of facing (dx, dy) is (-dy, dx); left is (dy, -dx).
      const right = isBlocked(this.pos_x - dy, this.pos_y + dx) ? 1 : 0;
      const left = isBlocked(this.pos_x + dy, this.pos_y - dx) ? 1 : 0;
      sensorValues[barrierLRIndex] = right - left;
    }

    // LONGPROBE_BAR_FWD: how close the nearest wall ahead is (1.0 = adjacent, 0 = none in range).
    const longProbeBarIndex = sensorNames.indexOf('LONGPROBE_BAR_FWD');
    if (longProbeBarIndex !== -1) {
      let value = 0;
      for (let d = 1; d <= LONG_PROBE_DIST; d++) {
        if (isBlocked(this.pos_x + dx * d, this.pos_y + dy * d)) {
          value = 1 - (d - 1) / LONG_PROBE_DIST;
          break;
        }
      }
      sensorValues[longProbeBarIndex] = value;
    }

    // --- Add POPULATION_FWD Sensor ---
    const popFwdIndex = sensorNames.indexOf('POPULATION_FWD');
    if (popFwdIndex !== -1) {
      let fwdX = this.pos_x, fwdY = this.pos_y;
      if (this.direction === 0) fwdY--; // North
      if (this.direction === 1) fwdX++; // East
      if (this.direction === 2) fwdY++; // South
      if (this.direction === 3) fwdX--; // West

      sensorValues[popFwdIndex] = occupiedCells.has(`${fwdY}-${fwdX}`) ? 1.0 : 0.0;
    }

    // --- Add a Food Sensor ---
    const foodFwdIndex = sensorNames.indexOf('SIGNAL0_FOOD');
    if (foodFwdIndex !== -1) {
      
      if (!GLOBAL.foodEnergyEnabled) {
        sensorValues[foodFwdIndex] = 0.0;
      } else {
        let closestFoodDist = Infinity;
        let foodInSight = 0.0;
        
        // Find the closest food source
        for (const foodPos of GLOBAL.foodGrid) {
          const [foodY, foodX] = foodPos.split('-').map(Number);
          const distX = foodX - this.pos_x;
          const distY = foodY - this.pos_y;
          const distance = Math.sqrt(distX * distX + distY * distY);
          
          if (distance < closestFoodDist) {
            // Check if the closest food is in the direction we are facing
            let inDirection = false;
            if (this.direction === 0 && distY < 0 && Math.abs(distX) < Math.abs(distY)) inDirection = true; // North
            if (this.direction === 1 && distX > 0 && Math.abs(distY) < Math.abs(distX)) inDirection = true; // East
            if (this.direction === 2 && distY > 0 && Math.abs(distX) < Math.abs(distY)) inDirection = true; // South
            if (this.direction === 3 && distX < 0 && Math.abs(distY) < Math.abs(distX)) inDirection = true; // West
            
            if (inDirection) {
              // The signal is stronger the closer the food is (1.0 = right next to us)
              foodInSight = 1.0 - (distance / (GLOBAL.x)); // Normalize by world size
              closestFoodDist = distance;
            }
          }
        }
        sensorValues[foodFwdIndex] = foodInSight;
      }
    }

    // --- Add Pheromone Sensors ---
    const norm = GLOBAL.pheromoneStrength; // For normalization

    // SIGNAL1: Pheromone gradient forward (Value = Fwd - Current)
    const signal1Index = sensorNames.indexOf('SIGNAL1');
    if (signal1Index !== -1) {
      let fwdX = this.pos_x, fwdY = this.pos_y;
      if (this.direction === 0) fwdY--; // North
      if (this.direction === 1) fwdX++; // East
      if (this.direction === 2) fwdY++; // South
      if (this.direction === 3) fwdX--; // West

      const fwdStrength = this._getPheromone(fwdY, fwdX);
      const currentStrength = this._getPheromone(this.pos_y, this.pos_x);

      // Normalized difference: +1.0 = max scent fwd, -1.0 = max scent here
      sensorValues[signal1Index] = (fwdStrength - currentStrength) / norm;
    }

    // SIGNAL1_LR: Pheromone gradient left/right (Value = Right - Left)
    const signal1LRIndex = sensorNames.indexOf('SIGNAL1_LR');
    if (signal1LRIndex !== -1) {
      let leftX = this.pos_x, leftY = this.pos_y;
      let rightX = this.pos_x, rightY = this.pos_y;

      if (this.direction === 0) { // Facing North
        leftX--; rightX++; // Left is West, Right is East
      } else if (this.direction === 1) { // Facing East
        leftY--; rightY++; // Left is North, Right is South
      } else if (this.direction === 2) { // Facing South
        leftX++; rightX--; // Left is East, Right is West
      } else if (this.direction === 3) { // Facing West
        leftY++; rightY--; // Left is South, Right is North
      }

      const leftStrength = this._getPheromone(leftY, leftX);
      const rightStrength = this._getPheromone(rightY, rightX);

      // Normalized difference: +1.0 = max scent right, -1.0 = max scent left
      sensorValues[signal1LRIndex] = (rightStrength - leftStrength) / norm;
    }

    return sensorValues;
  }
  
  /**
   * Order this brain's connections the way biosim4 does: everything feeding a neuron
   * first, then everything feeding an action, so neurons are fully computed before
   * any action reads them. Also note which neurons have inputs ("driven"); undriven
   * neurons keep their starting output of 0.5 and act as a constant bias.
   */
  _wire() {
    this._wiredBrain = this.brain;
    this._wiring = [
      ...this.brain.filter(g => g.sinkType === 0),
      ...this.brain.filter(g => g.sinkType === 1),
    ];
    this._driven = new Array(GLOBAL.inner_neurons).fill(false);
    for (const g of this.brain) if (g.sinkType === 0) this._driven[g.sinkId] = true;
    this.neurons = new Array(GLOBAL.inner_neurons).fill(INITIAL_NEURON_OUTPUT);
  }

  /**
   * One feed-forward pass (biosim4's feedForward). Returns the raw action levels:
   * the weighted sums into each action, of arbitrary range.
   * Neuron outputs are latched in this.neurons and carry over to the next step,
   * so a neuron that feeds itself or another neuron sees last step's value.
   */
  processBrain(occupiedCells) {
    if (this._wiredBrain !== this.brain) this._wire(); // brain was (re)built since last wiring

    const sensorValues = this.getSensorValues(occupiedCells);
    const sensorNames = Object.keys(SENS.Sensor);
    const actionNames = Object.keys(ACTS.Action);
    const accumulators = new Array(GLOBAL.inner_neurons).fill(0);
    const actionLevels = new Array(actionNames.length).fill(0);
    // Only the selected lifeform's step-by-step detail is shown, so only record that one.
    const debugSteps = this.id === GLOBAL.selectedLifeformId ? [] : null;
    let neuronsLatched = false;

    const latchNeurons = () => {
      for (let i = 0; i < accumulators.length; i++) {
        if (this._driven[i]) this.neurons[i] = Math.tanh(accumulators[i]);
      }
      neuronsLatched = true;
    };

    for (const gene of this._wiring) {
      // Before the first connection into an action, squash and latch the neuron outputs.
      if (gene.sinkType === 1 && !neuronsLatched) latchNeurons();

      const sourceValue = gene.sourceType === 0 ? sensorValues[gene.sourceId] : this.neurons[gene.sourceId];
      const contribution = sourceValue * gene.weight;
      const target = gene.sinkType === 0 ? accumulators : actionLevels;
      const before = target[gene.sinkId];
      target[gene.sinkId] += contribution;

      if (debugSteps) debugSteps.push({
        geneIndex: this.brain.indexOf(gene),
        from: gene.sourceType === 0 ? `Sensor[${sensorNames[gene.sourceId]}]` : `Neuron[${gene.sourceId}]`,
        to: gene.sinkType === 0 ? `Neuron[${gene.sinkId}]` : `Action[${actionNames[gene.sinkId]}]`,
        sourceValue,
        weight: gene.weight,
        contribution,
        before,
        after: target[gene.sinkId],
      });
    }
    // A brain with no action connections still updates its neurons.
    if (!neuronsLatched) latchNeurons();

    this._lastNeuronValues = this.neurons.slice(0, 4);
    this._lastActionValues = actionLevels;
    if (debugSteps) this._lastBrainStepDebug = debugSteps;
    return actionLevels;
  }

  /**
   * Act on every action level at once (biosim4's executeActions). Movement outputs
   * are summed into one X/Y urge; the chance of moving along each axis is the strength
   * of that urge, so several outputs can blend (e.g. mostly east, a little north).
   */
  executeActions(levels, occupiedCells) {
    const A = ACTION_INDEX;
    const squash01 = v => (Math.tanh(v) + 1) / 2; // arbitrary level -> 0..1

    // SET_RESPONSIVENESS: how readily this lifeform acts at all. Undriven, it sits at 0.5.
    this.responsiveness = squash01(levels[A.SET_RESPONSIVENESS] || 0);
    const responsiveness = responseCurve(this.responsiveness);

    // EMIT_SIGNAL1_PHER: above the threshold, emit with probability equal to the level.
    const emitLevel = squash01(levels[A.EMIT_SIGNAL1_PHER] || 0) * responsiveness;
    if (emitLevel > EMIT_THRESHOLD && Math.random() < emitLevel) {
      GLOBAL.pheromoneGrid[this.pos_y][this.pos_x] = GLOBAL.pheromoneStrength;
    }

    // --- Movement: sum every urge into X (east +) and Y (north +), as biosim4 does ---
    const fwdX = DIR_DX[this.direction], fwdNorth = -DIR_DY[this.direction];
    // Right of facing (east, north) is (north, -east); left is the opposite.
    const rightX = fwdNorth, rightNorth = -fwdX;

    let moveX = (levels[A.MOVE_X] || 0) + (levels[A.MOVE_EAST] || 0) - (levels[A.MOVE_WEST] || 0);
    let moveY = (levels[A.MOVE_Y] || 0) + (levels[A.MOVE_NORTH] || 0) - (levels[A.MOVE_SOUTH] || 0);
    const forward = (levels[A.MOVE_FORWARD] || 0) - (levels[A.MOVE_REVERSE] || 0);
    moveX += fwdX * forward;
    moveY += fwdNorth * forward;
    const right = (levels[A.MOVE_RIGHT] || 0) - (levels[A.MOVE_LEFT] || 0) + (levels[A.MOVE_RL] || 0);
    moveX += rightX * right;
    moveY += rightNorth * right;
    const randomLevel = levels[A.MOVE_RANDOM] || 0;
    if (randomLevel) {
      moveX += randomInt(-1, 2) * randomLevel;
      moveY += randomInt(-1, 2) * randomLevel;
    }

    moveX = Math.tanh(moveX) * responsiveness;
    moveY = Math.tanh(moveY) * responsiveness;
    const stepX = Math.random() < Math.abs(moveX) ? Math.sign(moveX) : 0;
    const stepNorth = Math.random() < Math.abs(moveY) ? Math.sign(moveY) : 0;

    if (stepX === 0 && stepNorth === 0) {
      this.lastAction = 'Idle';
      return;
    }

    // Face along the stronger urge (our facing is 4-way; biosim4's is 8-way).
    const facing = Math.abs(moveX) >= Math.abs(moveY)
      ? (stepX > 0 ? 1 : stepX < 0 ? 3 : (stepNorth > 0 ? 0 : 2))
      : (stepNorth > 0 ? 0 : stepNorth < 0 ? 2 : (stepX > 0 ? 1 : 3));
    const dy = -stepNorth; // our y grows southwards
    const label = `${stepNorth > 0 ? 'N' : stepNorth < 0 ? 'S' : ''}${stepX > 0 ? 'E' : stepX < 0 ? 'W' : ''}`;

    if (this._move(stepX, dy, facing, occupiedCells)) {
      this.lastAction = `Move ${label}`;
      this.actionLog.push(`Move ${label} to (${this.pos_x},${this.pos_y})`);
    } else {
      this.lastAction = `Blocked ${label}`;
      this.actionLog.push(`Blocked moving ${label} at (${this.pos_x},${this.pos_y})`);
    }
    if (this.actionLog.length > 100) this.actionLog.shift();
  }

  _move(dx, dy, direction, occupiedCells) {
    const newX = this.pos_x + dx;
    const newY = this.pos_y + dy;

    // 1. Check the move stays inside the world and doesn't walk into a wall.
    if (isBlocked(newX, newY)) {
      return false;
    }
    
    // 2. Check for other lifeform
    if (occupiedCells && occupiedCells.has(`${newY}-${newX}`)) {
      // cell blocked by another lifeform
      this.actionLog.push("Blocked by lifeform at (" + newX + "," + newY + ")");
      if (this.actionLog.length > 100) this.actionLog.shift();
      return false;
    }
    
    // 3. Pay the energy cost — only if enabled.
    if (GLOBAL.foodEnergyEnabled)
      this.energy -= GLOBAL.moveCost;

    // 4. Update the position in memory.
    this.direction = direction;
    this.old_x = this.pos_x;
    this.old_y = this.pos_y;
    this.pos_x = newX;
    this.pos_y = newY;

    // 5. Keep this tick's occupancy map current, so two lifeforms can't step onto the same cell.
    if (occupiedCells) {
      occupiedCells.delete(`${this.old_y}-${this.old_x}`);
      occupiedCells.set(`${newY}-${newX}`, this);
    }

    // 6. Check for death after the move.
    if (GLOBAL.foodEnergyEnabled && this.energy <= 0) {
      this.alive = false;
      this.actionLog.push("Died at (" + this.pos_x + "," + this.pos_y + ") [age=" + this.age + "]");
      if (this.actionLog.length > 100) this.actionLog.shift()
      this.color = [200, 50, 50]; // Red color for dead
      return false; // Move was fatal.
    }

    // 7. If it survived, check for food.
    this.checkForFood();
    return true; // The move was successful.
  }

  checkForFood() {
    if (!GLOBAL.foodEnergyEnabled) return;
    // foodGrid stores positions as "y-x" (see spawnFood and drawWorld), so the
    // lookup has to use the same order.
    const currentPos = `${this.pos_y}-${this.pos_x}`;
    const foodIndex = GLOBAL.foodGrid.indexOf(currentPos);

    if (foodIndex > -1) {
      this.energy += GLOBAL.foodEnergy;
      this.actionLog.push("Ate food (+energy) @ (" + this.pos_x + "," + this.pos_y + ")");
      if (this.actionLog.length > 100) this.actionLog.shift()
      // Removing it from foodGrid is enough: drawWorld redraws food from this array.
      GLOBAL.foodGrid.splice(foodIndex, 1);
    }
  }

  // methods, not used at the moment
  getLength() {
    console.log('getting length');
    return Math.floor(Math.random() * 255 );
  }

  getSensory() {
    console.log('getting sensory');
    return true;
  }

  getInner() {
    console.log('getting inner');
    return true;
  }

  getActions() {
    console.log('getting actions');
    return true;
  }
}

export function createGenome(glength) {
  let gnome = [];
  for (let g = 0; g < glength; g+=1) {
    let sourceType = 0;
    let sinkType = 0;
    
    // BIT: 1
    const sT = randomInt(0, 2);
    if (sT === 1) {
      sourceType = (setBit(sourceType, 7));
    } else {
      sourceType = 0;
    }
    // BIT 2-8
    const sourceID = randomInt(0, 128); // 0-127 (randomInt's max is exclusive)
    // BIT 1-8
    const sTandsID = sourceType | sourceID;
    const siT = randomInt(0, 2);
    if (siT === 1) {
      sinkType = (setBit(sinkType, 7))
    } else {
      sinkType = 0;
    }
    const sinkID = randomInt(0, 128);
    const siTandsiID = sinkType | sinkID;
    
    // The weight must be exactly 16 bits. Without padding, a small number like 5
    // becomes '101' (3 bits), the whole gene comes out shorter than 32 bits, and
    // parseGene reads the source/sink fields from the wrong positions.
    // Using the full 0-65535 range also gives negative weights once parseGene
    // treats it as a signed number.
    const weight = randomInt(0, 65536).toString(2).padStart(16, '0');
    const gString = `${sTandsID.toString(2).padStart(8, '0')}${siTandsiID.toString(2).padStart(8, '0')}${weight}`;
    const geneHex = parseInt(gString, 2).toString(16).padStart(8, '0').toUpperCase();
    gnome[g] = geneHex;
  }
  return gnome;
}

/**
 * Parses a single gene (a 32-bit hex string) into a connection object.
 * This function uses bitwise operations to extract the data.
 */
export function parseGene(geneHex) {
  const gene = parseInt(geneHex, 16);

  // Use bitwise AND and right shifts to extract the parts of the gene
  const sourceType = (gene >> 31) & 1;     // Bit 32 (or 31 in 0-indexing)
  let sourceId     = (gene >> 24) & 0x7F;  // Bits 25-31
  const sinkType   = (gene >> 23) & 1;     // Bit 24
  let sinkId       = (gene >> 16) & 0x7F;  // Bits 17-23
  let weight       = gene & 0xFFFF;        // Last 16 bits for the weight

  const numSensors = Object.keys(SENS.Sensor).length;
  const numActions = Object.keys(ACTS.Action).length;

  if (sourceType === 0) { // It's a Sensor
    sourceId = sourceId % numSensors;
  } else { // It's an internal Neuron
    sourceId = sourceId % GLOBAL.inner_neurons;
  }

  if (sinkType === 1) { // It's an Action
    sinkId = sinkId % numActions;
  } else { // It's an internal Neuron
    sinkId = sinkId % GLOBAL.inner_neurons;
  }

  // Handle the signed 16-bit integer for the weight
  if (weight > 32767) {
    weight -= 65536;
  }

  // Normalize the weight to a floating point between -4.0 and 4.0
  const normalizedWeight = (weight / 8192.0); // 32767 / 8192 ≈ 4.0

  return {
    sourceType, // 0 for Sensor, 1 for Neuron
    sourceId,
    sinkType,   // 0 for Neuron, 1 for Action
    sinkId,
    weight: normalizedWeight,
  };
}

function genomeToColor(genome) {
  // Concatenate all gene hex strings into one long string
  const genomeStr = genome.join('');
  
  // Use the first 6 hex chars for RGB, padding if needed
  const padded = genomeStr.padEnd(6, '0');
  const r = parseInt(padded.slice(0, 2), 16);
  const g = parseInt(padded.slice(2, 4), 16);
  const b = parseInt(padded.slice(4, 6), 16);
  
  // Optionally, boost brightness for visual separation
  const boost = 80;
  return [
    Math.min(255, r + boost),
    Math.min(255, g + boost),
    Math.min(255, b + boost)
  ];
}
