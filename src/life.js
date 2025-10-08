import GLOBAL from './globals.js';
import SENS from './sensor.js';
import ACTS from './action.js';
import { randomInt, setBit } from './utils.js';

export default class Life {
  constructor(id, genome_length, sensory_inputs, inner_neurons, action_outputs, generation = 0) {
    this.alive = true; // always alive at the start
    this.energy = GLOBAL.initialEnergy;
    this.generation = generation;
    this.id = id;
    this.pos_x =  Math.floor(Math.random() * GLOBAL.x );
    this.pos_y = Math.floor(Math.random() * GLOBAL.y );
    this.old_x = this.pos_x;
    this.old_y = this.pos_y;
    this.genome_length = GLOBAL.genome_length;
    this.sensory_inputs = GLOBAL.sensory_inputs;
    this.inner_neurons = GLOBAL.inner_neurons;
    this.action_outputs = GLOBAL.action_outputs;
    this.color =  [150, 150, 200]; //[Math.floor(Math.random() * 255), Math.floor(Math.random() * 255), Math.floor(Math.random() * 255)]
    this.age = 0; // always start at age 0
    this.genome = createGenome(genome_length);
    this.brain = this.genome.map(gene => parseGene(gene));
    this.direction = randomInt(0, 4);
  }

  getSensorValues(occupiedCells) {
    const sensorNames = Object.keys(SENS.Sensor);
    const sensorValues = new Array(sensorNames.length).fill(0);

    // --- Example Implementations for a few sensors ---

    // LOC_X: East/West location, normalized between 0.0 and 1.0
    const locXIndex = sensorNames.indexOf('LOC_X');
    if (locXIndex !== -1) {
      sensorValues[locXIndex] = this.pos_x / GLOBAL.x;
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

    const barrierFwdIndex = sensorNames.indexOf('BARRIER_FWD');
    if (barrierFwdIndex !== -1) {
      let isBlocked = false;
      if (this.direction === 0 && this.pos_y === 0) isBlocked = true; // Facing North at top edge
      if (this.direction === 1 && this.pos_x === GLOBAL.x - 1) isBlocked = true; // Facing East at right edge
      if (this.direction === 2 && this.pos_y === GLOBAL.y - 1) isBlocked = true; // Facing South at bottom edge
      if (this.direction === 3 && this.pos_x === 0) isBlocked = true; // Facing West at left edge

      sensorValues[barrierFwdIndex] = isBlocked ? 1.0 : 0.0;
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

    // --- Add a Food Sensor (repurposing SIGNAL0_FWD) ---
    const foodFwdIndex = sensorNames.indexOf('SIGNAL0_FWD');
    if (foodFwdIndex !== -1) {
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

          if(inDirection) {
            // The signal is stronger the closer the food is (1.0 = right next to us)
            foodInSight = 1.0 - (distance / (GLOBAL.x)); // Normalize by world size
            closestFoodDist = distance;
          }
        }
      }
      sensorValues[foodFwdIndex] = foodInSight;
    }

    return sensorValues;
  }

  processBrain(occupiedCells) {
    const sensorValues = this.getSensorValues(occupiedCells);
    const neuronValues = new Array(this.inner_neurons).fill(0);
    const actionValues = new Array(Object.keys(ACTS.Action).length).fill(0);

    // 1. Process all connections in the brain
    for (const gene of this.brain) {
      let sourceValue = 0;

      if (gene.sourceType === 0) { // Source is a Sensor
        sourceValue = sensorValues[gene.sourceId];
      } else { // Source is an inner Neuron
        sourceValue = neuronValues[gene.sourceId];
      }

      // Calculate the weighted input
      const weightedValue = sourceValue * gene.weight;

      if (gene.sinkType === 0) { // Sink is a Neuron
        neuronValues[gene.sinkId] += weightedValue;
      } else { // Sink is an Action
        actionValues[gene.sinkId] += weightedValue;
      }
    }

    // 2. Apply activation function (tanh) to all neurons and actions
    // This squashes the values to be between -1.0 and 1.0
    for (let i = 0; i < neuronValues.length; i++) {
      neuronValues[i] = Math.tanh(neuronValues[i]);
    }
    for (let i = 0; i < actionValues.length; i++) {
      actionValues[i] = Math.tanh(actionValues[i]);
    }

    // 3. Find the action with the highest output value
    let maxOutput = -Infinity;
    let chosenActionId = -1;
    for (let i = 0; i < actionValues.length; i++) {
      if (actionValues[i] > maxOutput) {
        maxOutput = actionValues[i];
        chosenActionId = i;
      }
    }

    return chosenActionId; // This is the ID of the action to perform
  }

  performAction(actionId) {
    const actionNames = Object.keys(ACTS.Action);
    const actionName = actionNames[actionId];

    switch (actionName) {
      case 'MOVE_EAST': this.moveEast(); break;
      case 'MOVE_WEST': this.moveWest(); break;
      case 'MOVE_NORTH': this.moveNorth(); break;
      case 'MOVE_SOUTH': this.moveSouth(); break;

      case 'MOVE_FORWARD':
        // Move in the direction the lifeform is currently facing
        if (this.direction === 0) this.moveNorth();
        else if (this.direction === 1) this.moveEast();
        else if (this.direction === 2) this.moveSouth();
        else if (this.direction === 3) this.moveWest();
        break;

      case 'MOVE_RANDOM':
        // Pick a random direction to move
        const randDir = randomInt(0, 4);
        if (randDir === 0) this.moveNorth();
        else if (randDir === 1) this.moveEast();
        else if (randDir === 2) this.moveSouth();
        else if (randDir === 3) this.moveWest();
        break;

      default:
        // Do nothing if the action is not recognized
        break;
    }
  }

  // move east
  moveEast() {
    if (this.pos_x < (GLOBAL.x - 1) ) {
      this.energy -= GLOBAL.moveCost; // It costs energy to move
      if (this.energy <= 0) {
        this.alive = false;
        return false; // Stop the move if it dies
      }
      this.direction = 1;
      this.old_x = this.pos_x;
      this.old_y = this.pos_y;
      this.pos_x += 1;
      updatePosition(this.id, this.pos_x, this.pos_y, this.old_x, this.old_y);
      this.checkForFood();
      return true;
    } else {
      return false;
    }
  }
  // move west
  moveWest() {
    if (this.pos_x > 0) {
      this.energy -= GLOBAL.moveCost; // It costs energy to move
      if (this.energy <= 0) {
        this.alive = false;
        return false; // Stop the move if it dies
      }
      this.direction = 3;
      this.old_x = this.pos_x;
      this.old_y = this.pos_y;
      this.pos_x -= 1;
      updatePosition(this.id, this.pos_x, this.pos_y, this.old_x, this.old_y);
      this.checkForFood();
      return true;
    } else {
      return false;
    }
  }
  // move north
  moveNorth() {
    if (this.pos_y > 0) {
      this.energy -= GLOBAL.moveCost; // It costs energy to move
      if (this.energy <= 0) {
        this.alive = false;
        return false; // Stop the move if it dies
      }
      this.direction = 0;
      this.old_y = this.pos_y;
      this.old_x = this.pos_x;
      this.pos_y -= 1;
      updatePosition(this.id, this.pos_x, this.pos_y, this.old_x, this.old_y);
      this.checkForFood();
      return true;
    } else {
      return false;
    }
  }
  // move south
  moveSouth() {
    if (this.pos_y < (GLOBAL.y - 1) ) {
      this.energy -= GLOBAL.moveCost; // It costs energy to move
      if (this.energy <= 0) {
        this.alive = false;
        return false; // Stop the move if it dies
      }
      this.direction = 2;
      this.old_y = this.pos_y;
      this.old_x = this.pos_x;
      this.pos_y += 1;
      updatePosition(this.id, this.pos_x, this.pos_y, this.old_x, this.old_y);
      this.checkForFood();
      return true;
    } else {
      return false
    }
  }

  checkForFood() {
    const currentPos = `${this.pos_y}-${this.pos_x}`;
    const foodIndex = GLOBAL.foodGrid.indexOf(currentPos);

    if (foodIndex > -1) {
      this.energy += GLOBAL.foodEnergy;
      GLOBAL.foodGrid.splice(foodIndex, 1); // Remove food from the data array

      // Remove the food visual from the grid
      const foodCell = document.querySelector(`.world [data-xy='${currentPos}']`);
      if (foodCell) {
        foodCell.classList.remove('food-cell');
      }
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
    var sourceType = 0;
    var sinkType = 0;

    // BIT: 1
    var sT = randomInt(0, 2);
    if (sT === 1) {
      sourceType = (setBit(sourceType, 7));
    } else {
      sourceType = 0;
    }
    // BIT 2 - 8
    var sourceID = randomInt(0, 127);
    // BIT 1 - 8
    var sTandsID = sourceType | sourceID;
    var siT = randomInt(0, 2);
    if (siT === 1) {
      sinkType = (setBit(sinkType, 7))
    } else {
      sinkType = 0;
    }
    var sinkID = randomInt(0, 127);
    var siTandsiID = sinkType | sinkID;

    var weight = randomInt(0, 32767).toString(2); //16 bit
    var gString = `${sTandsID.toString(2).padStart(8, '0')}${siTandsiID.toString(2).padStart(8, '0')}${weight}`;
    var geneHex = parseInt(gString, 2).toString(16).toUpperCase();
    gnome[g] = geneHex;
  }
  return gnome;
}

function updatePosition(id, new_x, new_y, old_x, old_y) {
  // We only need a single, simple timeout now
  setTimeout(() => {
    // --- Handle Old Cell ---
    const oldCell = document.querySelector(`.world [data-xy='${old_x}-${old_y}']`);
    if (oldCell) {
      // Simply reset its background and remove the classes
      oldCell.style.background = '';
      oldCell.classList.remove('live-cell', 'selected-cell');
      delete oldCell.dataset.id;
    }

    // --- Handle New Cell ---
    const newCell = document.querySelector(`.world [data-xy='${new_x}-${new_y}']`);
    if (newCell) {
      newCell.style.background = `rgb(${GLOBAL.lifeform[id].color[0]}, ${GLOBAL.lifeform[id].color[1]}, ${GLOBAL.lifeform[id].color[2]})`;
      newCell.classList.add('live-cell');
      newCell.dataset.id = id;

      if (id == GLOBAL.selectedLifeformId) {
        newCell.classList.add('selected-cell');
      }
    }
  }, 100); // A simple delay for all animations
}

/**
 * Parses a single gene (a 32-bit hex string) into a connection object.
 * This function uses bitwise operations to extract the data.
 */
export function parseGene(geneHex) {
  const gene = parseInt(geneHex, 16);

  // Use bitwise AND and right shifts to extract the parts of the gene
  const sourceType = (gene >> 31) & 1;          // Bit 32 (or 31 in 0-indexing)
  let sourceId   = (gene >> 24) & 0x7F;       // Bits 25-31
  const sinkType   = (gene >> 23) & 1;          // Bit 24
  let sinkId     = (gene >> 16) & 0x7F;       // Bits 17-23
  let weight       = gene & 0xFFFF;             // Last 16 bits for the weight

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
