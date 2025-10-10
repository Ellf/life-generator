// globals
// var startTime = performance.now();
// let h = 8;                 //width of the lifeform in pixels
// let w = 8;                 // height of the lifeform in pixels
// let x = 64;                 // world x size
// let y = 64;                 // world y size
// let startingLife = 50;      // total number of live cells at the start
// let steps = 10;             // how many steps to run the simulation
// let generation = 0;         // the generation of the simulation. We start at gen 0 and each new generation will be a more complicated gene pool.
// let lifeform = [];
// let gen_len = 4;            // genome length
// let mutation_rate = 0.01;   // mutation rate
// let sensory_inputs = 10;    // sensory inputs
// let inner_neurons = 2;      // inner neurons
// let action_outputs = 10;    // action outputs
// let worldReady = false;
// let yearCounter = 0;
// let popCounter = 0;

//export default { startTime, h, w, x, y, startingLife, steps, generation, lifeform, gen_len, mutation_rate, sensory_inputs, inner_neurons, action_outputs, worldReady, yearCounter, popCounter }

export default {
  startTime: performance.now(),
  simulationSpeed: 50,
  h: 4,
  w: 4,
  x: 128,
  y: 128,
  startingLife: 100,
  selectedLifeformId: null,
  steps: 100,
  generationLength: 100,
  generation: 0,
  lifeform: [],
  gen_len: 4,
  mutation_rate: 0.01,
  sensory_inputs: 10,
  inner_neurons: 2,
  action_outputs: 10,
  worldReady: false,
  yearCounter: 0,
  popCounter: 0,
  targetYear: 0,
  isPaused: false,
  initialEnergy: 90,
  moveCost: 1,
  foodCount: 40,
  foodEnergy: 100,
  foodGrid: [],
}
