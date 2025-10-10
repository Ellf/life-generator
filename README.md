# Lifeform Generator

A JavaScript-based playground for artificial life and emergent behaviors, inspired by digital evolution concepts.

This experiment simulates tiny lifeforms in a grid world, where each organism has a genome (digital DNA), a set of simulated "neurons", and must use various sensors to move, eat, and survive. Over multiple generations, genomes can mutate, leading to the emergence of new behaviors.

---

## Features

- **Lifeforms with Digital Genomes**  
  Each organism has a genome made of binary "genes", encoding how its neural network wiring connects sensors to actions.
- **Ecosystem Simulation**  
  Organisms roam a 2D world, searching for food and avoiding boundaries or obstacles.
- **Neural Network-based Decisions**  
  Every turn, a lifeform gathers sensory data (location, age, food presence, neighbors, barriers, random number, etc.), processes it through a neural net, and chooses its next action.
- **No Overlapping Life**  
  Lifeforms can't occupy the same cell. Movement checks and respects occupied locations.
- **Action, Event, and Lifeform Logs**  
  Inspect per-lifeform action history/events directly in the UI for tracking/debugging.
- **Automatic Generation Cycling**  
  Simulated years pass, creatures age, die, reproduce, and mutations occur. Generations restart with the fittest survivors' children.

---

## Sensors

Sensors feed inputs to each lifeform's neural net, including:
- Position in the world (X, Y)
- Proximity to boundaries
- Population and food nearby (forward/left/right)
- Blockages/barriers detected
- Age, random noise, custom signals

---

## Actions

Lifeforms can:
- Move in cardinal directions (N, S, E, W)
- Move forward (current direction), randomly, or with custom behaviors
- Seek and eat food for energy
- (Extensible for more actions)

---

## How It Works

1. At startup, a grid world is created. Lifeforms are spawned at random unoccupied positions, each with a random genome.
2. Lifeforms sense their environment, process neural network output, act, and consume energy each "year."
3. Food is randomly generated and is required for lifeforms to replenish energy and survive.
4. If energy reaches zero or max age is hit, the lifeform dies.
5. When the "year" counter reaches a generation threshold, the simulation evaluates survivors. New genomes are created via mutation for the next generation.
6. All key events, including every action and death/food event, are logged per-creature for inspection in the UI.

---

## Controls and UI

- Grid world is visualized with colored cells representing lifeforms, their positions and deaths.
- A **Selected Lifeform** sidebar shows detailed genome, sensors/actions, and a real-time action log.
- Adjustable simulation speed and world regeneration.
- Easily track specific lifeforms' stories and actions.

---

## Running and Building

- **Development server:**  
  `npm start`  
  Then open [http://localhost:3000](http://localhost:3000)
- **Production build:**  
  `npm run build` (output in `dist/`)

---

## Thanks & Inspiration

- Thanks to [Dave Miller's biosim4](https://github.com/davidrmiller/biosim4) for inspiring many of the structures and ideas.
- Heavily influenced by genetic algorithms, artificial life, and neural evolutions concepts.

---

## Project Goals

- Explore emergent complexity and digital evolution using simple rules.
- Learn JavaScript, neuroevolution/genetics, and visualization techniques.
- Encourage tinkering, hacks, and new experimentations!

---

**Contributions, questions, bug reports, ideas, and forks most welcome!**
