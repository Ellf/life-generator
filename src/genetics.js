import GLOBAL from './globals.js';
import { randomInt } from './utils.js';

// Reproduction, following biosim4's generateChildGenome() and randomBitFlip().
// Genes are 32-bit hex strings laid out as (high to low bits):
//   sourceType (1) | sourceNum (7) | sinkType (1) | sinkNum (7) | weight (16)

/** Inclusive random integer, like biosim4's randomUint(min, max). */
const randomUint = (min, max) => randomInt(min, max + 1);

/**
 * Make one child genome from a list of parent genomes sorted fittest first.
 * With chooseParentsByFitness, the second parent is always fitter than the first,
 * so fitter genomes are picked more often. With sexualReproduction, a random slice of
 * one parent is laid over a copy of the other.
 */
export function makeChildGenome(parentGenomes) {
  let i1, i2;
  if (GLOBAL.chooseParentsByFitness && parentGenomes.length > 1) {
    i1 = randomUint(1, parentGenomes.length - 1);
    i2 = randomUint(0, i1 - 1);
  } else {
    i1 = randomUint(0, parentGenomes.length - 1);
    i2 = randomUint(0, parentGenomes.length - 1);
  }
  const g1 = parentGenomes[i1];
  const g2 = parentGenomes[i2];

  let genome;
  if (GLOBAL.sexualReproduction) {
    // Copy the longer parent, then overlay a random slice of the shorter one.
    const [base, slice] = g1.length > g2.length ? [g1, g2] : [g2, g1];
    genome = base.slice();
    let index0 = randomUint(0, slice.length - 1);
    let index1 = randomUint(0, slice.length);
    if (index0 > index1) [index0, index1] = [index1, index0];
    for (let i = index0; i < index1; i++) genome[i] = slice[i];
    // Trim to the parents' average length (they're equal while genomes can't grow).
    let sum = g1.length + g2.length;
    if ((sum & 1) && Math.random() < 0.5) sum++;
    genome.length = Math.min(genome.length, sum >> 1);
  } else {
    genome = g2.slice();
  }

  applyPointMutations(genome);
  return genome;
}

/** Each gene has a pointMutationRate chance of causing one random bit flip somewhere in the genome. */
function applyPointMutations(genome) {
  for (let n = genome.length; n > 0; n--) {
    if (Math.random() < GLOBAL.mutation_rate) randomBitFlip(genome);
  }
}

/** Flip one bit in one field of a random gene, with biosim4's odds per field. */
function randomBitFlip(genome) {
  const index = randomUint(0, genome.length - 1);
  let gene = parseInt(genome[index], 16) >>> 0;
  const chance = Math.random();
  let bit;
  if (chance < 0.2) bit = 31;                          // sourceType
  else if (chance < 0.4) bit = 23;                     // sinkType
  else if (chance < 0.6) bit = 24 + randomUint(0, 6);  // sourceNum
  else if (chance < 0.8) bit = 16 + randomUint(0, 6);  // sinkNum
  else bit = randomUint(1, 15);                        // weight
  gene = (gene ^ (1 << bit)) >>> 0;
  genome[index] = gene.toString(16).padStart(8, '0').toUpperCase();
}

/** Fisher-Yates shuffle in place, so ties in fitness don't always favour the same lifeforms. */
export function shuffle(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = randomInt(0, i + 1);
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}
