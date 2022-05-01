import GLOBAL from './globals.js';

const runSimulation = (generation, ready) => {
    setTimeout(function() {
        if (ready) {

            while ( GLOBAL.yearCounter < generation ) {
                GLOBAL.popCounter = 0;
                // another for loop to allow each lifeform to do things
                while ( GLOBAL.popCounter < GLOBAL.startinglife) {

                    // pick a random guy to play with
                    let randomGuy = Math.floor(Math.random() * GLOBAL.startinglife);

                    //$('#year span').text(yearCounter);
                    //$('#pop_turn span').text(popCounter);
                    

                    let direction = Math.floor(Math.random() * 4);
                    switch(direction) {
                        case 0:
                            GLOBAL.lifeform[randomGuy].moveEast();
                            break;
                        case 1:
                            GLOBAL.lifeform[randomGuy].moveSouth();
                            break;
                        case 2:
                            GLOBAL.lifeform[randomGuy].moveWest();
                            break;
                        case 3:
                            GLOBAL.lifeform[randomGuy].moveNorth();
                            break;
                    }
                    GLOBAL.popCounter += 1;

                }
                GLOBAL.yearCounter += 1;
            }
        }
    }, 100);
}


export default runSimulation;