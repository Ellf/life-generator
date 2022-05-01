import './style.css';
import _ from 'lodash';
import GLOBAL from './globals.js';
import './simulator.js';
import runSimulation from './simulator.js';

// Create the grid
$(document).ready(async () => {
    GLOBAL.worldReady = await setupWorld(GLOBAL.x, GLOBAL.y, GLOBAL.startinglife);
    var endTime = performance.now();
    console.log(`World Ready after ${(endTime - GLOBAL.startTime) / 1000} seconds`);
    // run the simulation after the setup has completed.
    runSimulation(GLOBAL.steps, GLOBAL.worldReady);

    // event listener on button to restart simulation
    $('#regenerateWorld').on('click', () => {
        console.log('creating new world');
        GLOBAL.worldReady = setupWorld(GLOBAL.x, GLOBAL.y, GLOBAL.startinglife);
        console.log(GLOBAL.worldReady);
        runSimulation(GLOBAL.steps, GLOBAL.worldReady);
        $('.live-cell').on('click', getClicked);
    });

    $('.live-cell').on('click', getClicked);

});

let selectionCriteria = ""; // no criteria set yet

function getClicked() {
    let clickedLife = $(this).data("id");
    $('#cell-selected span').text(clickedLife);
    $('#posx span').text(lifeform[clickedLife].pos_x);
    $('#posy span').text(lifeform[clickedLife].pos_y);
    $('#genome-length span').text(lifeform[clickedLife].genome_length);
    $('#sensory-inputs span').text(lifeform[clickedLife].sensory_inputs);
    $('#inner-neurons span').text(lifeform[clickedLife].inner_neurons);
    $('#action-outputs span').text(lifeform[clickedLife].action_outputs);
}

async function setupWorld(x, y, startinglife) {
    let worldExists = createWorld(x,y);
    try {
        if (worldExists) {
            console.log('World Exists...');
            var lifeCreated = createLife(startinglife);
            console.log('Life Created: ', lifeCreated);
        }
    }
    catch(error) {
        console.log('some error from someplace?', error);
    }

    // define genomes
    // world is ready
    return true;

}

function createWorld(x, y) {
    console.log('Creating World...');
    $('.world').html('');
    $('.world').css({
        'width': x * GLOBAL.w,
        'height': y * GLOBAL.h
    });
    for (let horizontal = 0; horizontal < x; horizontal += 1 ) {
        for (let vertical = 0; vertical < y; vertical += 1 ) {
            $('.world').append(`<div data-xy="${vertical}-${horizontal}" class="cell" style="width:${GLOBAL.w}px; height:${GLOBAL.h}px;background:white;"></div>`);
        };
    };

    return true;
}

function createLife(population) {

    // create starting lifeform genome for each population

    for (let g = 0; g < population; g += 1) {

        // new instance of a lifeform for each pop
        
        GLOBAL.lifeform[g] = new Life(g, GLOBAL.gen_len, GLOBAL.sensory_inputs, GLOBAL.inner_neurons, GLOBAL.action_outputs);

        $(`.world [data-xy='${GLOBAL.lifeform[g].pos_x}-${GLOBAL.lifeform[g].pos_y}']`).addClass('live-cell').attr('data-id', g).css({
            background: `rgb(${GLOBAL.lifeform[g].color[0]}, ${GLOBAL.lifeform[g].color[1]}, ${GLOBAL.lifeform[g].color[2]})`
        });

    }

    return true;

}

// definition of genes
// SENSOR INPUTS
// float (fp) between 0 and 1
// weights (w) -4.0 to 4.0
// sN = fp * w
/*
    Slr = pheromone gradient left-right
    Sfd = pheromone gredient forward
    Sg  = pheromone density
    Age = age
    Rnd = random input
    Blr = blockage left-right
    Osc = oscillator (set to 30cycles/gen?)
    Bfd = blockage forward
    Plr = population gradient left-right
    
    Pfd = population gradient forward
    
*/

createEnum([
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
]);

// internal neuron =
// iN = tanh(sum(inputs))
// with will be a number between -1.0 and 1.0

// similarly, action neurons
// aN = tanh(sum(inputs)) between -1.0 and 1.0
/*
    LPD  - set long-probe distance
    Kill - kill forward neighbour (default off)
    OSC  - set oscillator period
    SG   - emit pheromone
    Res  - set responsiveness
    Mfd  - move forward (same as previous)
    Mrn  - move random
    Mrv  - move reverse
    MRL  - move left/right (+/-)
    MX   - move east/west (+/-)
    MY   - move north/south (+/-)
*/




function createGenome(glength) {

    let gnome = [];
    for (let g = 0; g < glength; g+=1) {
        var sourceType = 0;
        var sinkType = 0;

        // BIT: 1
        var sT = randomInt(0, 2);
        if (sT == 1) {
            sourceType = (setBit(sourceType, 7));
        } else {
            sourceType = 0;
        }
        // BIT 2 - 8
        var sourceID = randomInt(0, 127);
        //console.log(sourceID % glength);
        // BIT 1 - 8
        var sTandsID = sourceType | sourceID;
        //console.log(sourceID.toString(2).padStart(8, '0'));
        var siT = randomInt(0, 2);
        if (siT === 1) {
            sinkType = (setBit(sinkType, 7))
        } else {
            sinkType = 0;
        }
        var sinkID = randomInt(0, 127);
        var siTandsiID = sinkType | sinkID;

        //console.log("       ", sinkID.toString(2).padStart(8, '0'));

        var weight = randomInt(0, 32767).toString(2); //16 bit
        var gString = `${sTandsID.toString(2).padStart(8, '0')}${siTandsiID.toString(2).padStart(8, '0')}${weight}`;
        //console.log(gString);
        var geneHex = parseInt(gString, 2).toString(16).toUpperCase();
        gnome[g] = geneHex;
        
    }

    return gnome;
    
}

const randomInt = (minimum, maximum) => {
    return Math.floor((Math.random() * (maximum - minimum)) + minimum);
}

// this sets a specific bit to 1 or 0 
const setBit = (n, bitIndex) => {
    const bitMask = 1 << bitIndex;
    return n | bitMask;
}

function updatePosition(id, new_x, new_y, old_x, old_y) {

    setTimeout(() => {
        //console.log(`updating position...[${id}]`)
        // clear old cell
        $(`.world [data-xy=${old_x}-${old_y}]`).css({'background': 'white'}).removeClass('live-cell').attr('data-id', null);
        // set the new cell location to the lifeform colour.
        $(`.world [data-xy=${new_x}-${new_y}]`).css({
            background: `rgb(${GLOBAL.lifeform[id].color[0]}, ${GLOBAL.lifeform[id].color[1]}, ${GLOBAL.lifeform[id].color[2]})`
        }).addClass('live-cell').attr('data-id', id);
    }, 1250);
}

class Life {

    constructor(id, genome_length, sensory_inputs, inner_neurons, action_outputs) {
        this.alive = true; // always alive at the start
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
    }

    // move east
    moveEast() {
        if (this.pos_x < (GLOBAL.x - 1) ) {
            this.old_x = this.pos_x;
            this.old_y = this.pos_y;
            this.pos_x += 1;
            //console.log(`moving lifeform[${this.id}] east`);
            //console.log(`${this.old_x}:${this.old_y} => ${this.pos_x}:${this.pos_y}`);
            updatePosition(this.id, this.pos_x, this.pos_y, this.old_x, this.old_y);
            return true;
        } else {
            return false;
        }
    }
    // move west
    moveWest() {
        if (this.pos_x > 0) {
            this.old_x = this.pos_x;
            this.old_y = this.pos_y;
            this.pos_x -= 1;
            //console.log('moving west');
            //console.log(`${this.old_x}:${this.old_y} => ${this.pos_x}:${this.pos_y}`);
            updatePosition(this.id, this.pos_x, this.pos_y, this.old_x, this.old_y);
            return true;
        } else {
            return false;
        }
    }
    // move north
    moveNorth() {
        if (this.pos_y > 0) {
            this.old_y = this.pos_y;
            this.old_x = this.pos_x;
            this.pos_y -= 1;
            //console.log('moving north');
            //console.log(`${this.old_x}:${this.old_y} => ${this.pos_x}:${this.pos_y}`);
            updatePosition(this.id, this.pos_x, this.pos_y, this.old_x, this.old_y);
            return true;
        } else {
            return false;
        }
    }
    // move south
    moveSouth() {
        if (this.pos_y < (GLOBAL.y - 1) ) {
            this.old_y = this.pos_y;
            this.old_x = this.pos_x;
            this.pos_y += 1;
            //console.log('moving south');
            //console.log(`${this.old_x}:${this.old_y} => ${this.pos_x}:${this.pos_y}`);
            updatePosition(this.id, this.pos_x, this.pos_y, this.old_x, this.old_y);
            return true;
        } else {
            return false
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

// Utility Functions
function createEnum(values) {
    const enumObject = {};
    for (const val of values) {
      enumObject[val] = val;
    }
    return Object.freeze(enumObject);
  }

// SENSOR
const SEN = new Uint8Array(1);
const SENSOR = SEN[0] = 1; // always a source

// ACTION
const ACT = new Uint8Array(1);
const ACTION = ACT[0] = 1; // always a sink

// NEURON
const NEU = new Uint8Array(1);
const NEURON = NEU[0] = 0; // sink or source