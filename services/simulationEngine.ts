import { Critter, Food, Species, Genome, Vector2 } from '../types';
import * as Constants from '../constants';
import { SpatialHash } from '../core/SpatialHash';
import { GeneticSystem } from '../systems/Genetics';
import { EnvironmentSystem } from '../systems/Environment';
import { CreatureSystem } from '../systems/Creature';
import { EventBus } from '../core/EventBus';

export class SimulationEngine {
  public events = new EventBus();
  
  critters: Critter[] = [];
  food: Food[] = [];
  species: Map<string, Species> = new Map();
  time: number = 0;
  
  // Modular Spatial Partitioning
  foodGrid: SpatialHash<Food> = new SpatialHash();
  critterGrid: SpatialHash<Critter> = new SpatialHash();

  private nextId = 0;
  // Bound function for passing to systems
  private generateId = () => `ent_${this.nextId++}`;
  private generateSuffix = () => (this.nextId).toString(36);

  constructor() {
    this.reset();
  }

  reset() {
    this.critters = [];
    this.food = [];
    this.species.clear();
    this.time = 0;
    this.foodGrid.clear();
    this.critterGrid.clear();
    this.events.clear(); // Clear old listeners to avoid memory leaks? 
    // Actually we shouldn't clear listeners because React components are still mounted.
    // Ideally reset events.emit('RESET')
    
    const rootSpeciesId = 'species_0';
    this.species.set(rootSpeciesId, {
      id: rootSpeciesId,
      name: 'Aqua Primus',
      parentId: null,
      generation: 0,
      color: Constants.BASE_GENOME.color,
      count: 0,
      extinct: false,
      firstAppearedAt: 0,
    });

    // Spawn Initial Life
    for(let i=0; i<Constants.INITIAL_POPULATION; i++) {
        this.spawnCritter(
            Math.random() * (Constants.BIOME_WATER_WIDTH - 50) + 20, 
            Math.random() * Constants.WORLD_HEIGHT, 
            rootSpeciesId, 
            Constants.BASE_GENOME
        );
    }
  
    // Initial Food Scatter
    for (let i = 0; i < 5000; i++) {
        EnvironmentSystem.spawnRandomFood(this.food, this.foodGrid, this.generateId);
    }
    
    this.events.emit('LOG', { message: 'World Reset. Simulation Initialized.', type: 'system' });
  }

  private spawnCritter(x: number, y: number, speciesId: string, genome: Genome) {
    const critter: Critter = {
      id: this.generateId(),
      speciesId,
      position: { x, y },
      velocity: { x: (Math.random() - 0.5), y: (Math.random() - 0.5) },
      energy: Constants.STARTING_ENERGY,
      age: 0,
      genome: { ...genome },
      state: 'wandering',
      targetId: null,
      heading: Math.random() * Math.PI * 2,
      gridIndex: 0
    };
    
    this.critters.push(critter);
    this.critterGrid.add(critter);

    const spec = this.species.get(speciesId);
    if (spec) spec.count++;
  }

  // --- Core Loop ---
  update() {
    this.time++;
    
    // 1. Environment System
    EnvironmentSystem.update(this.food, this.foodGrid, this.generateId);

    // 2. Creature Update Loop
    for (let i = this.critters.length - 1; i >= 0; i--) {
      const critter = this.critters[i];
      critter.age++;
      
      this.decideAction(critter);
      GeneticSystem.applyDrift(critter);
      CreatureSystem.move(critter, this.critterGrid);
      CreatureSystem.enforceBoundaries(critter);
      CreatureSystem.calculateMetabolism(critter);

      if (critter.energy <= 0 || critter.age > 4000) {
        this.killCritter(i);
      }
    }

    // Cleanup Eaten Food periodically
    if (this.time % 5 === 0) { 
        this.food = this.food.filter(f => f.energyValue > 0);
    }

    // Emit Stats Update periodically (approx every 0.5s at 60fps) to decouple UI frame rate
    if (this.time % 30 === 0) {
        this.events.emit('STATS_UPDATE', {
            time: this.time,
            population: this.critters.length,
            speciesCount: this.species.size, // Approximation
            extinctCount: 0 // Will be calc in app or we can do it here
        });
    }
  }

  // --- AI / Decision Making (Orchestrator Level) ---
  private decideAction(critter: Critter) {
    const isCarnivore = critter.genome.diet > 0.5;

    if (!isCarnivore) {
        const threat = this.findNearestPredator(critter);
        if (threat) {
            critter.state = 'fleeing';
            CreatureSystem.fleeFrom(critter, threat.position);
            return;
        }
    }

    if (critter.energy > critter.genome.reproThreshold) {
        this.reproduce(critter);
        return;
    }

    if (isCarnivore) {
        this.huntPrey(critter);
    } else {
        this.seekFood(critter);
    }
  }

  private findNearestPredator(critter: Critter): Critter | null {
      let nearest: Critter | null = null;
      let minDist = Infinity;
      
      const neighbors = this.critterGrid.query(critter.gridIndex);

      for (const other of neighbors) {
          if (other.id === critter.id) continue;
          if (other.genome.diet > 0.5 && other.genome.size >= critter.genome.size) {
              const d = CreatureSystem.dist(critter.position, other.position);
              if (d < critter.genome.senseRadius && d < minDist) {
                  minDist = d;
                  nearest = other;
              }
          }
      }
      return nearest;
  }

  private huntPrey(critter: Critter) {
      let nearestPrey: Critter | null = null;
      let minDist = Infinity;
      
      const neighbors = this.critterGrid.query(critter.gridIndex);

      for (const other of neighbors) {
         if (other.id === critter.id) continue;
         if (other.speciesId === critter.speciesId) continue; 

         const preyDefenseFactor = 1 + (other.genome.defense || 0); 
         const preyEffectiveSize = other.genome.size * preyDefenseFactor;
         
         const predatorBonus = critter.genome.diet > 0.7 ? 2 : 0;
         const combatAdvantage = (critter.genome.size + critter.genome.mouthSize * 2 + predatorBonus) > (preyEffectiveSize + (other.genome.diet > 0.5 ? other.genome.mouthSize : 0));

         if (combatAdvantage) {
            const d = CreatureSystem.dist(critter.position, other.position);
            if (d < critter.genome.senseRadius && d < minDist) {
                minDist = d;
                nearestPrey = other;
            }
         }
      }

      if (nearestPrey) {
          critter.state = 'hunting';
          critter.targetId = nearestPrey.id;
          CreatureSystem.steerTowards(critter, nearestPrey.position);
          
          if (minDist < critter.genome.size + nearestPrey.genome.size) {
              critter.energy += nearestPrey.energy * Constants.ENERGY_GAIN_MEAT_MULTIPLIER + (nearestPrey.genome.size * 10);
              
              const preyIndex = this.critters.findIndex(c => c.id === nearestPrey!.id);
              if (preyIndex !== -1) this.killCritter(preyIndex);
              
              critter.targetId = null;
          }
      } else {
          critter.state = 'wandering';
          CreatureSystem.wander(critter);
      }
  }

  private seekFood(critter: Critter) {
    let nearestFood: Food | null = null;
    let minDist = Infinity;
    
    const neighbors = this.foodGrid.query(critter.gridIndex);

    for (const f of neighbors) {
        if (f.energyValue <= 0) continue; 

        const d = CreatureSystem.dist(critter.position, f.position);
        if (d < critter.genome.senseRadius && d < minDist) {
            minDist = d;
            nearestFood = f;
        }
    }

    if (nearestFood) {
      critter.state = 'seeking_food';
      critter.targetId = nearestFood.id;
      CreatureSystem.steerTowards(critter, nearestFood.position);

      const eatRange = critter.genome.size + (critter.genome.mouthSize / 2);
      if (minDist < eatRange) {
        critter.energy += nearestFood.energyValue;
        nearestFood.energyValue = 0; 
        this.foodGrid.remove(nearestFood); // Immediate removal from spatial hash

        critter.targetId = null;
      }
    } else {
      critter.state = 'wandering';
      CreatureSystem.wander(critter);
    }
  }

  private reproduce(parent: Critter) {
    if (this.critters.length >= Constants.MAX_POPULATION) return;

    // Use Genetic System
    const { genome, speciesId, newSpecies } = GeneticSystem.createOffspring(parent, this.species, this.time, this.generateSuffix);

    if (newSpecies) {
        this.events.emit('SPECIES_NEW', newSpecies);
        this.events.emit('LOG', { message: `New Branch: ${newSpecies.name} (Gen ${newSpecies.generation})`, type: 'species', color: newSpecies.color });
    }

    const babyEnergy = parent.energy * 0.4; 
    parent.energy -= (parent.energy * 0.5); 

    this.spawnCritter(
        parent.position.x + (Math.random() * 20 - 10),
        parent.position.y + (Math.random() * 20 - 10),
        speciesId,
        genome
    );

    const baby = this.critters[this.critters.length - 1];
    baby.energy = babyEnergy;
  }

  private killCritter(index: number) {
    const c = this.critters[index];
    this.critterGrid.remove(c);

    const s = this.species.get(c.speciesId);
    if (s) {
        s.count--;
        if (s.count <= 0 && !s.extinct) {
            s.extinct = true;
            this.events.emit('SPECIES_EXTINCT', s);
            this.events.emit('LOG', { message: `${s.name} has gone extinct.`, type: 'extinct' });
        }
    }
    this.critters.splice(index, 1);
  }
}