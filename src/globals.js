export default {
  startTime: performance.now(),
  simulationSpeed: 50, // delay between steps in ms (set from the speed slider)
  h: 4,
  w: 4,
  x: 128,
  y: 128,
  startingLife: 100,
  selectedLifeformId: null,
  generationLength: 160,
  generation: 0,
  lifeform: [],
  gen_len: 4,
  mutation_rate: 0.01,
  sensory_inputs: 10,
  inner_neurons: 2,
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
  history: [],               // one { generation, percent } entry per finished generation
  pheromoneGrid: [],
  pheromoneStrength: 100,
  pheromoneEvapRate: 1,
}
