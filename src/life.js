import GLOBAL from './globals.js';
import SENS from './sensor.js';
import ACTS from './action.js';
import { randomInt, setBit } from './utils.js';

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
      
      let forwardLifeform = null;
      for (const lf of GLOBAL.lifeform) {
        if (lf.alive && lf.pos_x === fwdX && lf.pos_y === fwdY) {
          forwardLifeform = lf;
          break;
        }
      }
      
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

    return sensorValues;
  }
  
  processBrain(occupiedCells) {
    const sensorValues = this.getSensorValues(occupiedCells);
    const neuronValues = new Array(this.inner_neurons).fill(0);
    const actionValues = new Array(Object.keys(ACTS.Action).length).fill(0);
    
    // DEBUG log structure
    const debugSteps = []; // <--- NEW (will populate per connection)
    
    // 1. Process all connections in the brain
    for (let geneIndex = 0; geneIndex < this.brain.length; geneIndex++) {
      const gene = this.brain[geneIndex];
      
      // Get value from source
      let sourceValue = 0;
      let sourceLabel = '';
      if (gene.sourceType === 0) { // Sensor
        sourceValue = sensorValues[gene.sourceId];
        sourceLabel = `Sensor[${Object.keys(SENS.Sensor)[gene.sourceId]}]`;
      } else {
        sourceValue = neuronValues[gene.sourceId];
        sourceLabel = `Neuron[${gene.sourceId}]`;
      }
      
      // Store current value of destination before addition
      let sinkLabel = '';
      let destinationBefore = 0;
      if (gene.sinkType === 0) { // neuron
        destinationBefore = neuronValues[gene.sinkId];
        sinkLabel = `Neuron[${gene.sinkId}]`;
      } else { // action
        destinationBefore = actionValues[gene.sinkId];
        sinkLabel = `Action[${Object.keys(ACTS.Action)[gene.sinkId]}]`;
      }
      
      // Compute delta
      const weightedValue = sourceValue * gene.weight;
      
      // Actually apply delta
      if (gene.sinkType === 0) {
        neuronValues[gene.sinkId] += weightedValue;
      } else {
        actionValues[gene.sinkId] += weightedValue;
      }
      
      // Store destination after addition
      const destinationAfter = (gene.sinkType === 0) ? neuronValues[gene.sinkId] : actionValues[gene.sinkId];
      
      // Add step to debug log
      debugSteps.push({
        geneIndex,
        from: sourceLabel,
        to: sinkLabel,
        sourceValue,
        weight: gene.weight,
        contribution: weightedValue,
        before: destinationBefore,
        after: destinationAfter,
      });
    }
    
    // 2. Apply activation function (tanh) to all neurons and actions
    for (let i = 0; i < neuronValues.length; i++) {
      neuronValues[i] = Math.tanh(neuronValues[i]);
    }
    for (let i = 0; i < actionValues.length; i++) {
      actionValues[i] = Math.tanh(actionValues[i]);
    }
    
    this._lastNeuronValues = neuronValues.slice(0, 4);
    
    // 3. Find the action with the highest output value
    let maxOutput = -Infinity;
    let chosenActionId = -1;
    for (let i = 0; i < actionValues.length; i++) {
      if (actionValues[i] > maxOutput) {
        maxOutput = actionValues[i];
        chosenActionId = i;
      }
    }
    
    // --- NEW: Store this for inspection/debugging in UI or log ---
    this._lastBrainStepDebug = debugSteps;
    
    if (chosenActionId !== -1 && maxOutput > 0.0) {
      return chosenActionId;
    }
    
    return -1; // No action chosen
  }

  performAction(actionId, occupiedCells) {
    // Check if no action was chosen
    if (actionId === -1) {
      this.lastAction = 'None';
      return;
    }
    const actionNames = Object.keys(ACTS.Action);
    const actionName = actionNames[actionId];
    const actionValues = new Array(Object.keys(ACTS.Action).length).fill(0);
    this.lastAction = actionName;
    
    this.actionLog.push(`Action: ${actionName} @ (${this.pos_x},${this.pos_y}) [${this.energy}]`);
    if (this.actionLog.length > 100) this.actionLog.shift();

    switch (actionName) {
      case 'MOVE_EAST': this.moveEast(occupiedCells); break;
      case 'MOVE_WEST': this.moveWest(occupiedCells); break;
      case 'MOVE_NORTH': this.moveNorth(occupiedCells); break;
      case 'MOVE_SOUTH': this.moveSouth(occupiedCells); break;
      
      case 'MOVE_LEFT':
        // if facing North, move west
        if (this.direction === 0) this.moveWest(occupiedCells);
        else if (this.direction === 1) this.moveNorth(occupiedCells);
        else if (this.direction === 2) this.moveEast(occupiedCells);
        else if (this.direction === 3) this.moveSouth(occupiedCells);
        break;
        
      case 'MOVE_RIGHT':
        // if facing North, move east
        if (this.direction === 0) this.moveEast(occupiedCells);
        else if (this.direction === 1) this.moveSouth(occupiedCells);
        else if (this.direction === 3) this.moveWest(occupiedCells);
        else if (this.direction === 4) this.moveNorth(occupiedCells);
        break;
      
      case 'MOVE_RL': {
        // direction: 0=North, 1=East, 2=South, 3=West
        // Perpendicular to current direction, right = +1.0, left = -1.0
        // Assume actionValues is in scope
        const level = actionValues[actionNames.indexOf('MOVE_RL')]; // tanh output [-1,1]
        let dx = 0, dy = 0;
        switch (this.direction) {
          case 0:  // North, right is East
            dx = Math.round(level);
            break;
          case 1:  // East, right is South
            dy = Math.round(level);
            break;
          case 2:  // South, right is West
            dx = -Math.round(level);
            break;
          case 3:  // West, right is North
            dy = -Math.round(level);
            break;
        }
        // Only move if not zero (could include magnitude if desired)
        if (dx !== 0 || dy !== 0) this._move(dx, dy, this.direction, occupiedCells);
        break;
      }
      
      case 'MOVE_X': {
        const level = actionValues[actionNames.indexOf('MOVE_X')]; // tanh output [-1,1]
        const dx = Math.round(level); // +1, 0, -1
        let moved = false;
        if (dx !== 0) {
          moved = this._move(dx, 0, this.direction, occupiedCells);
          if (moved) {
            this.lastAction = `MOVE_X to ${this.pos_x},${this.pos_y}`;
            this.actionLog.push(`MOVE_X by ${dx} to (${this.pos_x},${this.pos_y})`);
          }
        } else {
          this.lastAction = 'MOVE_X (no move)';
          this.actionLog.push('MOVE_X neuron fired, but output ~0 (no move)');
        }
        break;
      }
      
      case 'MOVE_Y': {
        const level = actionValues[actionNames.indexOf('MOVE_Y')]; // tanh output [-1,1]
        const dy = Math.round(level); // +1, 0, -1
        let moved = false;
        if (dy !== 0) {
          moved = this._move(0, dy, this.direction, occupiedCells);
          if (moved) {
            this.lastAction = `MOVE_Y to ${this.pos_y},${this.pos_y}`;
            this.actionLog.push(`MOVE_Y to ${this.pos_y},${this.pos_y}`);
          }
        } else {
          this.lastAction = 'MOVE_Y (no move)';
          this.actionLog.push('MOVE_Y neuron fired, but output ~0 (no move)');
        }
        break;
      }
        
      case 'MOVE_REVERSE':
        // if facing north, move south
        if (this.direction === 0) this.moveSouth(occupiedCells);
        else if (this.direction === 1) this.moveWest(occupiedCells);
        else if (this.direction === 3) this.moveNorth(occupiedCells);
        else if (this.direction === 4) this.moveEast(occupiedCells);
        break;

      case 'MOVE_FORWARD':
        // Move in the direction the lifeform is currently facing
        if (this.direction === 0) this.moveNorth(occupiedCells);
        else if (this.direction === 1) this.moveEast(occupiedCells);
        else if (this.direction === 2) this.moveSouth(occupiedCells);
        else if (this.direction === 3) this.moveWest(occupiedCells);
        break;

      case 'MOVE_RANDOM':
        // Pick a random direction to move
        const randDir = randomInt(0, 4);
        if (randDir === 0) this.moveNorth(occupiedCells);
        else if (randDir === 1) this.moveEast(occupiedCells);
        else if (randDir === 2) this.moveSouth(occupiedCells);
        else if (randDir === 3) this.moveWest(occupiedCells);
        break;

      default:
        // Do nothing if the action is not recognized
        break;
    }
  }

  _move(dx, dy, direction, occupiedCells) {
    const newX = this.pos_x + dx;
    const newY = this.pos_y + dy;

    // 1. Check if the move is within world boundaries.
    if (newX < 0 || newX >= GLOBAL.x || newY < 0 || newY >= GLOBAL.y) {
      return false; // Can't move, hit a wall.
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

    // 5. Update the visual position on the grid.
    updatePosition(this.id, this.pos_x, this.pos_y, this.old_x, this.old_y);

    // 6. Check for death after the move.
    if (GLOBAL.foodEnergyEnabled && this.energy <= 0) {
      this.alive = false;
      this.actionLog.push("Died at (" + this.pos_x + "," + this.pos_y + ") [age=" + this.age + "]");
      if (this.actionLog.length > 100) this.actionLog.shift()
      this.color = [200, 50, 50]; // Red color for dead

      const deadCell = document.querySelector(`.world [data-xy='${this.pos_x}-${this.pos_y}']`);
      if (deadCell) {
        deadCell.style.background = `rgb(${this.color[0]}, ${this.color[1]}, ${this.color[2]})`;
        deadCell.classList.remove('live-cell');
        deadCell.classList.add('dead-cell');
      }
      return false; // Move was fatal.
    }

    // 7. If it survived, check for food.
    this.checkForFood();
    return true; // The move was successful.
  }

  moveEast(occupiedCells) {
    return this._move(1, 0, 1, occupiedCells); // dx=1, dy=0, direction=East(1)
  }

  moveWest(occupiedCells) {
    return this._move(-1, 0, 3, occupiedCells); // dx=-1, dy=0, direction=West(3)
  }

  moveNorth(occupiedCells) {
    return this._move(0, -1, 0, occupiedCells); // dx=0, dy=-1, direction=North(0)
  }

  moveSouth(occupiedCells) {
    return this._move(0, 1, 2, occupiedCells); // dx=0, dy=1, direction=South(2)
  }
  
  checkForFood() {
    if (!GLOBAL.foodEnergyEnabled) return;
    const currentPos = `${this.pos_x}-${this.pos_y}`;
    const foodIndex = GLOBAL.foodGrid.indexOf(currentPos);
    
    if (foodIndex > -1) {
      this.energy += GLOBAL.foodEnergy;
      this.actionLog.push("Ate food (+energy) @ (" + this.pos_x + "," + this.pos_y + ")");
      if (this.actionLog.length > 100) this.actionLog.shift()
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
    const sourceID = randomInt(0, 127);
    // BIT 1-8
    const sTandsID = sourceType | sourceID;
    const siT = randomInt(0, 2);
    if (siT === 1) {
      sinkType = (setBit(sinkType, 7))
    } else {
      sinkType = 0;
    }
    const sinkID = randomInt(0, 127);
    const siTandsiID = sinkType | sinkID;
    
    const weight = randomInt(0, 32767).toString(2); //16 bit
    const gString = `${sTandsID.toString(2).padStart(8, '0')}${siTandsiID.toString(2).padStart(8, '0')}${weight}`;
    const geneHex = parseInt(gString, 2).toString(16).toUpperCase();
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

      if (id === GLOBAL.selectedLifeformId) {
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
