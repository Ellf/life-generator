import { createEnum } from './utils';
// SENSORY DATA

let Sensor = createEnum([
    'LOC_X',                    // Lx = east/west world location
    'LOC_Y',                    // Ly = north/south world location
    'BOUNDARY_DIST_X',          // BDx = east/west border distance
    'BOUNDARY_DIST',            // BD = nearest border distance
    'BOUNDARY_DISY_Y',          // BDy = north/south border distance
    'GENETIC_SIM_FWD',          // Gen = genetic similarity of fwd neighbour
    'LAST_MOVE_DIR_X',          // LMx = last movement X
    'LAST_MOVE_DIR_Y',          // LMy = last movement Y
    'LONGPROBE_POP_FWD',        // LPf = population long-range forward
    'LONGPROBE_BAR_FWD',        // LBf = blockage long-range forward
    'POPULATION',               // Pop = population density
    'POPULATION_FWD',           // Pfd = population gradient forward
    'POPULATION_LR',            // Plr = population gradient left-right
    'OSC1',                     // Osc = oscillator (set to 30cycles/gen?)
    'AGE',                      // Age = age
    'BARRIER_FWD',              // Bfd = blockage forward
    'BARRIER_LR',               // Blr = blockage left-right
    'RANDOM',                   // Rnd = random input
    'SIGNAL0',                  // Sfd = pheromone gredient forward
    'SIGNAL0_FWD',              // Sg  = pheromone density
    'SIGNAL0_LR',               // Slr = pheromone gradient left-right
]);

export default {
    Sensor
} 