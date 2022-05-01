import './style.css';
import _ from 'lodash';
/* 
Thanks to Dave Miller's YouTube video and github repository for providing the inspiration and variable names along with many other ideas for this learning project.

https://github.com/davidrmiller/biosim4
*/

// self-replication
// blueprint -- genome
// inherit blueprint
// mutations
// selection, natural or otherwise

var startTime = performance.now();
// globals
let h = 8;                 //width of the lifeform in pixels
let w = 8;                 // height of the lifeform in pixels
let x = 64;                 // world x size
let y = 64;                 // world y size
let startinglife = 50;      // total number of live cells at the start
let steps = 10;             // how many steps to run the simulation
let generation = 0;         // the generation of the simulation. We start at gen 0 and each new generation will be a more complicated gene pool.
let lifeform = [];
let gen_len = 4;            // genome length
let mutation_rate = 0.01;   // mutation rate
let sensory_inputs = 10;    // sensory inputs
let inner_neurons = 2;      // inner neurons
let action_outputs = 10;    // action outputs
let worldReady = false;
let yearCounter = 0;
let popCounter = 0;



// Create the grid
$(document).ready(async () => {
    worldReady = await setupWorld(x, y, startinglife);
    var endTime = performance.now();
    console.log(`World Ready after ${(endTime - startTime) / 1000} seconds`);
    // run the simulation after the setup has completed.
    runSimulation(steps, worldReady);

    // event listener on button to restart simulation
    $('#regenerateWorld').on('click', () => {
        console.log('creating new world');
        worldReady = setupWorld(x, y, startinglife);
        console.log(worldReady);
        runSimulation(steps, worldReady);
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
        'width': x * w,
        'height': y * h
    });
    for (let horizontal = 0; horizontal < x; horizontal += 1 ) {
        for (let vertical = 0; vertical < y; vertical += 1 ) {
            $('.world').append(`<div data-xy="${vertical}-${horizontal}" class="cell" style="width:${w}px; height:${h}px;background:white;"></div>`);
        };
    };

    return true;
}

function createLife(population) {

    // create starting lifeform genome for each population

    for (let g = 0; g < population; g += 1) {

        // new instance of a lifeform for each pop
        console.log('creating lifeform:', g)
        lifeform[g] = new Life(g, gen_len, sensory_inputs, inner_neurons, action_outputs);

        $(`.world [data-xy='${lifeform[g].pos_x}-${lifeform[g].pos_y}']`).addClass('live-cell').attr('data-id', g).css({
            background: `rgb(${lifeform[g].color[0]}, ${lifeform[g].color[1]}, ${lifeform[g].color[2]})`
        });

    }

    return true;

}
/* =================================================================

                       R U N   S I M U L A T O R

   ================================================================= */
const runSimulation = (generation, ready) => {
    setTimeout(function() {
        if (ready) {

            while ( yearCounter < generation ) {
                popCounter = 0;
                // another for loop to allow each lifeform to do things
                while ( popCounter < startinglife) {

                    // pick a random guy to play with
                    let randomGuy = Math.floor(Math.random() * startinglife);

                    //$('#year span').text(yearCounter);
                    //$('#pop_turn span').text(popCounter);
                    

                    let direction = Math.floor(Math.random() * 4);
                    switch(direction) {
                        case 0:
                           lifeform[randomGuy].moveEast();
                            break;
                        case 1:
                            lifeform[randomGuy].moveSouth();
                            break;
                        case 2:
                            lifeform[randomGuy].moveWest();
                            break;
                        case 3:
                            lifeform[randomGuy].moveNorth();
                            break;
                    }
                    popCounter += 1;

                }
                yearCounter += 1;
            }
        }
    }, 100);
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
    // genomes are collection of genes 
    // one gene = 8-hexadecimal digits ########
    // 32 binary bits of data
    // f 1 3 5 1 f e 3
    /*
    [1|1|1|1] [0|0|0|1] [0|0|1|1] [0|1|0|1] 
    [0|0|0|1] [1|1|1|1] [1|1|1|0] [0|0|1|1]

    bit 1       = source type [input sensory or internal neuron]
    bit 2 - 8   = source ID (take modulo of number of neurons to find out which one it refers to????)
    bit 9       = sink (action) type
    bit 10 - 16 = sink ID

    bit 17 - 32 = 16-bit signed integer weight of the connection (divide this by 8000 or so) to get to a floating point value -4.0 -> 4.0
    */

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
            background: `rgb(${lifeform[id].color[0]}, ${lifeform[id].color[1]}, ${lifeform[id].color[2]})`
        }).addClass('live-cell').attr('data-id', id);
    }, 1250);
}

class Life {

    constructor(id, genome_length, sensory_inputs, inner_neurons, action_outputs) {
        this.alive = true; // always alive at the start
        this.id = id;
        this.pos_x =  Math.floor(Math.random() * x );
        this.pos_y = Math.floor(Math.random() * y );
        this.old_x = this.pos_x;
        this.old_y = this.pos_y;
        this.genome_length = genome_length;
        this.sensory_inputs = sensory_inputs;
        this.inner_neurons = inner_neurons;
        this.action_outputs = action_outputs;
        this.color =  [150, 150, 200]; //[Math.floor(Math.random() * 255), Math.floor(Math.random() * 255), Math.floor(Math.random() * 255)]
        this.age = 0; // always start at age 0
        this.genome = createGenome(genome_length);
    }

    // move east
    moveEast() {
        if (this.pos_x < (x - 1) ) {
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
        if (this.pos_y < (y - 1) ) {
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
