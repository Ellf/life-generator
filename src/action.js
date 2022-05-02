import { createEnum } from './utils';
// actions

let Action = createEnum([
    'MOVE_X',                   // MX   - move east/west (+/-)
    'MOVE_Y',                   // MY   - move north/south (+/-)
    'MOVE_FORWARD',             // Mfd  - move forward (same as previous)
    'MOVE_RL',                  // component of movement (??)
    'MOVE_RANDOM',              // Mrn  - move random
    'SET_OSCILLATOR_PERIOD',    // OSC  - set oscillator period
    'SET_LONGPROBE_DIST',       // LPD  - set long-probe distance
    'SET_RESPONSIVENESS',       // Res  - set responsiveness
    'EMIT_SIGNAL0',             // SG   - emit pheromone
    'MOVE_EAST',
    'MOVE_WEST',
    'MOVE_NORTH',
    'MOVE_SOUTH',
    'MOVE_LEFT',
    'MOVE_RIGHT',               // MRL  - move left/right (+/-)
    'MOVE_REVERSE',             // Mrv  - move reverse
    'NUM_ACTIONS',   // <!-- end of active actions 
    'KILL_FORWARD'              // Kill - kill forward neighbour (default off)
]);

export default {
    Action
}