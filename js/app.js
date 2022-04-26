// globals
let h = 10;                 //width of the lifeform in pixels
let w = 10;                 // height of the lifeform in pixels
let x = 50;                 // world x size
let y = 50;                 // world y size
let startinglife = 10;     // total number of live cells at the start
let generations = 20;      // how many generations to run the simulation
let lifeform = [];
let gen_len = 5;            // genome length
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
    console.log("World Ready: ", worldReady);
    // run the simulation after the setup has completed.
    runSimulation(generations, worldReady);

    // event listener on button to restart simulation
    $('#regenerateWorld').on('click', () => {
        console.log('creating new world');
        worldReady = setupWorld(x, y, startinglife);
        console.log(worldReady);
        runSimulation(generations, worldReady);
        $('.live-cell').on('click', getClicked);
    });

    $('.live-cell').on('click', getClicked);

});

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
            lifeCreated = createLife(startinglife, x, y);
            console.log('Life Created: ', lifeCreated);
        }
    }
    catch(error) {
        console.log('some error from someplace?');
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
            let r = Math.floor(Math.random() * 255);
            let g = Math.floor(Math.random() * 255);
            let b = Math.floor(Math.random() * 255);
            $('.world').append(`<div data-xy="${vertical}-${horizontal}" class="cell" style="width:${w}px; height:${h}px;background:white;"></div>`);
        };
    };

    return true;
}

function createLife(population, x, y) {

    // create starting lifeform genome for each population

    for (let g = 0; g < population; g += 1) {

        // new instance of a lifeform for each pop

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

function createGenome(glength) {
    let gnome = [];
    for (let g = 0; g < glength; g+=1) {
        gnome[g] = Math.random(Math.random());
    }

    return gnome;
    
}

function updatePosition(id, new_x, new_y, old_x, old_y) {

    setTimeout(() => {
        console.log(`updating position...[${id}]`)
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
        this.pickGenome = createGenome(genome_length);
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

// SENSOR
const SEN = new Uint8Array(1);
const SENSOR = SEN[0] = 1; // always a source

// ACTION
const ACT = new Uint8Array(1);
const ACTION = ACT[0] = 1; // always a sink

// NEURON
const NEU = new Uint8Array(1);
const NEURON = NEU[0] = 0; // sink or source
