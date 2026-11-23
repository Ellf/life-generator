import GLOBAL from './globals.js';
import SENS from './sensor.js';
import ACTS from './action.js';

// Turns a lifeform's brain into plain-English sentences, strongest connections first.

// How each sense reads after "The ...", as it increases.
const SENSE = {
  LOC_X: 'further east it is',
  LOC_Y: 'further south it is',
  BOUNDARY_DIST_X: 'further it is from the east and west edges',
  BOUNDARY_DIST: 'further it is from any edge',
  BOUNDARY_DIST_Y: 'further it is from the north and south edges',
  GENETIC_SIM_FWD: 'more alike the lifeform ahead is',
  LAST_MOVE_DIR_X: 'more its last move was eastward',
  LAST_MOVE_DIR_Y: 'more its last move was northward',
  LONGPROBE_POP_FWD: 'further away the next lifeform ahead is',
  LONGPROBE_BAR_FWD: 'closer a wall ahead is (long range)',
  POPULATION: 'more crowded its surroundings are',
  POPULATION_FWD: 'more crowded it is ahead',
  POPULATION_LR: 'more crowded it is to its right',
  OSC1: 'higher its internal clock wave is',
  AGE: 'older it is',
  BARRIER_FWD: 'more a wall blocks the way ahead',
  BARRIER_LR: 'more a wall is on its right rather than its left',
  RANDOM: 'higher a random signal is',
  SIGNAL0_FOOD: 'closer food is ahead',
  SIGNAL1: 'stronger the pheromone where it stands',
  SIGNAL1_LR: 'more pheromone there is to its right',
};

// For each action: [clause for a positive weight, clause for a negative weight,
// the same two as plain verbs for "A steady push makes it ..."].
const move = (verb, pos, neg) => [`the more it ${verb}s ${pos}`, `the more it ${verb}s ${neg}`, `${verb} ${pos}`, `${verb} ${neg}`];
const ACTION = {
  MOVE_X: move('move', 'east', 'west'),
  MOVE_Y: move('move', 'north', 'south'),
  MOVE_EAST: move('move', 'east', 'west'),
  MOVE_WEST: move('move', 'west', 'east'),
  MOVE_NORTH: move('move', 'north', 'south'),
  MOVE_SOUTH: move('move', 'south', 'north'),
  MOVE_RIGHT: move('step', 'right', 'left'),
  MOVE_RL: move('step', 'right', 'left'),
  MOVE_LEFT: move('step', 'left', 'right'),
  MOVE_FORWARD: ['the more it keeps going forward', 'the more it turns back', 'keep going forward', 'turn back'],
  MOVE_REVERSE: ['the more it turns back', 'the more it keeps going forward', 'turn back', 'keep going forward'],
  MOVE_RANDOM: ['the more it moves randomly', 'the less it moves randomly', 'move randomly', 'move randomly less'],
  SET_OSCILLATOR_PERIOD: ['the slower its internal clock runs', 'the faster its internal clock runs',
    'run its internal clock slower', 'run its internal clock faster'],
  SET_LONGPROBE_DIST: ['the further ahead it looks', 'the less far ahead it looks', 'look further ahead', 'look less far ahead'],
  SET_RESPONSIVENESS: ['the more active it is', 'the less active it is', 'be more active', 'be less active'],
  EMIT_SIGNAL1_PHER: ['the more pheromone it leaves', 'the less pheromone it leaves', 'leave more pheromone', 'leave less pheromone'],
  KILL_FORWARD: ['the more likely it attacks the lifeform ahead', 'the less likely it attacks the lifeform ahead',
    'attack the lifeform ahead', 'hold back from attacking'],
};

function strength(weight) {
  const w = Math.abs(weight);
  return w >= 2.5 ? 'strong' : w >= 1 ? 'medium' : 'weak';
}

/** [clause, verb] for what this connection does to its target, given the weight's sign. */
function effect(gene) {
  const positive = gene.weight >= 0;
  if (gene.sinkType === 0) {
    const n = `neuron N${gene.sinkId}`;
    return positive ? [`the more it excites ${n}`, `excite ${n}`] : [`the more it inhibits ${n}`, `inhibit ${n}`];
  }
  const name = Object.keys(ACTS.Action)[gene.sinkId];
  const [pos, neg, posVerb, negVerb] = ACTION[name] || [`the more it does ${name}`, `the less it does ${name}`, name, name];
  return positive ? [pos, posVerb] : [neg, negVerb];
}

function sentence(gene, driven, sensorNames) {
  const [clause, verb] = effect(gene);
  if (gene.sourceType === 0) {
    const name = sensorNames[gene.sourceId];
    return `The ${SENSE[name] || name}, ${clause}.`;
  }
  const n = gene.sourceId;
  if (gene.sinkType === 0 && gene.sinkId === n) {
    return gene.weight >= 0
      ? `Neuron N${n} feeds back into itself, so it holds on to what it was doing (a simple memory).`
      : `Neuron N${n} damps itself, so it flips back and forth.`;
  }
  if (!driven.has(n)) {
    // A neuron with no inputs holds a steady 0.5, so it acts as a constant push.
    return `A steady push makes it ${verb} (from neuron N${n}, which has no inputs).`;
  }
  return `The higher neuron N${n} is, ${clause}.`;
}

/**
 * Sentences for a lifeform's brain, strongest first: [{ text, strength }].
 * Left out: connections into a neuron that feeds nothing, and attack connections
 * while attacking is switched off, since neither can affect what it does.
 */
export function describeBrain(lifeform) {
  const brain = lifeform.brain || [];
  const sensorNames = Object.keys(SENS.Sensor);
  const killIndex = Object.keys(ACTS.Action).indexOf('KILL_FORWARD');
  const feedsSomething = new Set(brain.filter(g => g.sourceType === 1).map(g => g.sourceId));
  const driven = new Set(brain.filter(g => g.sinkType === 0).map(g => g.sinkId));

  return brain
    .filter(g => (g.sinkType === 1 ? GLOBAL.killEnable || g.sinkId !== killIndex : feedsSomething.has(g.sinkId)))
    .slice()
    .sort((a, b) => Math.abs(b.weight) - Math.abs(a.weight))
    .map(gene => ({ text: sentence(gene, driven, sensorNames), strength: strength(gene.weight) }));
}
