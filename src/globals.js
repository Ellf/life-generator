export default {
  startTime: performance.now(),
  simulationSpeed: 50, // delay between steps in ms (set from the speed slider)
  h: 4,
  w: 4,
  x: 128,
  y: 128,
  startingLife: 300,
  selectedLifeformId: null,
  generationLength: 300,     // biosim4: stepsPerGeneration
  generation: 0,
  lifeform: [],
  gen_len: 24,               // biosim4: genomeInitialLength
  mutation_rate: 0.001,      // biosim4: pointMutationRate (per gene)
  sexualReproduction: true,  // biosim4: children mix two parents' genes
  chooseParentsByFitness: true,
  killEnable: false,         // biosim4: lets KILL_FORWARD kill the lifeform ahead (off, as in biosim4)
  fastForward: false,        // run many steps per frame and redraw less
  sensory_inputs: 10,
  inner_neurons: 5,          // biosim4: maxNumberNeurons
  action_outputs: 10,
  yearCounter: 0,
  targetYear: 0,
  isPaused: false,
  initialEnergy: 150,
  moveCost: 1,
  foodCount: 40,
  foodEnergy: 100,
  foodGrid: [],
  foodEnergyEnabled: false, // off by default: the default challenge is about reaching the goal
  challenge: 'gap',          // key into CHALLENGES (challenges.js)
  barrierGrid: [],           // Uint8Array, 1 = wall, indexed y * x + x
  spawnZone: null,
  goalZone: null,
  goalDistance: null,        // walking distance to the goal for every cell (challenges.js)
  minParentShare: 0.1,       // if fewer than this share meet the challenge, the next-best also breed
  history: [],               // one { generation, percent } entry per finished generation
  pheromoneGrid: [],
  pheromoneStrength: 100,
  pheromoneEvapRate: 1,
}
