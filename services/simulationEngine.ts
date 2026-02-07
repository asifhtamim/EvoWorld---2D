import { Critter, Food, Species, Genome, Vector2, ToolMode } from '../types';
import * as Constants from '../constants';
import { SpatialHash } from '../core/SpatialHash';
import { GeneticSystem } from '../systems/Genetics';
import { EnvironmentSystem } from '../systems/Environment';
import { CreatureSystem } from '../systems/Creature';
import { BehaviorSystem } from '../systems/Behavior';
import { EventBus } from '../core/EventBus';

export class SimulationEngine {
  public events = new EventBus();
  
  critters: Critter[] = [];
  critterMap: Map<string, Critter> = new Map(); // O(1) lookup
  
  food: Food[] = [];
  species: Map<string, Species> = new Map();
  time: number = 0;
  
  // Selection State
  selectedCritterId: string | null = null;
  
  // Modular Spatial Partitioning
  foodGrid: SpatialHash<Food> = new SpatialHash();
  critterGrid: SpatialHash<Critter> = new SpatialHash();

  private nextId = 0;
  private generateId = () => `ent_${this.nextId++}`;
  private generateSuffix = () => (this.nextId).toString(36);

  constructor() {
    this.reset();
  }

  reset() {
    this.critters = [];
    this.critterMap.clear();
    this.food = [];
    this.species.clear();
    this.time = 0;
    this.selectedCritterId = null;
    this.foodGrid.clear();
    this.critterGrid.clear();
    this.events.clear();
    
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

    for(let i=0; i<Constants.INITIAL_POPULATION; i++) {
        this.spawnCritter(
            Math.random() * (Constants.BIOME_WATER_WIDTH - 50) + 20, 
            Math.random() * Constants.WORLD_HEIGHT, 
            rootSpeciesId, 
            Constants.BASE_GENOME
        );
    }
  
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
      targetPosition: null,
      nextThinkTime: this.time + Math.random() * 20, // Stagger initial thinking
      heading: Math.random() * Math.PI * 2,
      gridIndex: 0
    };
    
    this.critters.push(critter);
    this.critterMap.set(critter.id, critter);
    this.critterGrid.add(critter);

    const spec = this.species.get(speciesId);
    if (spec) spec.count++;
  }

  // --- Interaction API ---

  handleInteraction(x: number, y: number, mode: ToolMode) {
      if (mode === 'inspect') {
          const clicked = this.findCritterAt(x, y);
          this.selectedCritterId = clicked ? clicked.id : null;
          if (clicked) {
              const spec = this.species.get(clicked.speciesId);
              this.events.emit('LOG', { message: `Selected: ${spec?.name} (Energy: ${Math.round(clicked.energy)})`, color: clicked.genome.color });
          } else {
              this.selectedCritterId = null;
          }
          this.events.emit('SELECTION_CHANGED', this.selectedCritterId);
      } 
      else if (mode === 'feed') {
          for(let i=0; i<Constants.FEED_AMOUNT; i++) {
              const fx = x + (Math.random() * Constants.FEED_RADIUS * 2 - Constants.FEED_RADIUS);
              const fy = y + (Math.random() * Constants.FEED_RADIUS * 2 - Constants.FEED_RADIUS);
              if (fx > 0 && fx < Constants.WORLD_WIDTH && fy > 0 && fy < Constants.WORLD_HEIGHT) {
                EnvironmentSystem.createFood(fx, fy, this.food, this.foodGrid, this.generateId);
              }
          }
          this.events.emit('LOG', { message: 'Divine Intervention: Manna from heaven.', type: 'system' });
      }
      else if (mode === 'smite') {
          const victim = this.findCritterAt(x, y);
          if (victim) {
              const idx = this.critters.findIndex(c => c.id === victim.id);
              if (idx !== -1) {
                  this.killCritter(idx);
                  this.events.emit('LOG', { message: 'Divine Intervention: Smited!', type: 'extinct' });
              }
          }
      }
      else if (mode === 'meteor') {
          const center = {x, y};
          let killCount = 0;
          for (let i = this.critters.length - 1; i >= 0; i--) {
              if (CreatureSystem.dist(this.critters[i].position, center) < Constants.METEOR_RADIUS) {
                  this.killCritter(i);
                  killCount++;
              }
          }
          this.food = this.food.filter(f => CreatureSystem.dist(f.position, center) > Constants.METEOR_RADIUS);
          this.events.emit('LOG', { message: `Divine Intervention: Meteor Impact! ${killCount} killed.`, type: 'extinct' });
      }
  }

  private findCritterAt(x: number, y: number): Critter | undefined {
      const idx = this.critterGrid.getIndex({x, y});
      const candidates = this.critterGrid.query(idx);
      const clickRadius = 20; 
      
      let best: Critter | undefined;
      let closestDist = Infinity;

      for(const c of candidates) {
          const d = CreatureSystem.dist(c.position, {x, y});
          if (d < c.genome.size + clickRadius && d < closestDist) {
              closestDist = d;
              best = c;
          }
      }
      return best;
  }
  
  getSelectedCritter(): Critter | undefined {
      if (!this.selectedCritterId) return undefined;
      // O(1) Lookup optimization
      return this.critterMap.get(this.selectedCritterId);
  }

  // --- Core Loop ---
  update() {
    this.time++;
    EnvironmentSystem.update(this.food, this.foodGrid, this.generateId);

    // Creature Update Loop
    for (let i = this.critters.length - 1; i >= 0; i--) {
      const critter = this.critters[i];
      critter.age++;
      
      // 1. AI Decision (Behavior System) - Throttled
      if (this.time >= critter.nextThinkTime) {
          const neighbors = this.critterGrid.query(critter.gridIndex);
          const foodNeighbors = critter.genome.diet <= 0.5 ? this.foodGrid.query(critter.gridIndex) : [];
          
          // Modifies critter state/target in place
          BehaviorSystem.think(critter, neighbors, foodNeighbors, this.time);
      }
      
      // 2. Continuous Action Execution (Tracking)
      // Even if we didn't "think" this frame, we need to steer towards our target
      if (critter.targetId) {
          if (critter.state === 'hunting') {
              // Track Prey
              const prey = this.critterMap.get(critter.targetId);
              if (prey) {
                  critter.targetPosition = prey.position; // Update tracking position
              } else {
                  // Prey died or lost
                  critter.state = 'wandering';
                  critter.targetId = null;
                  critter.nextThinkTime = this.time; // Re-think immediately
              }
          } 
          // Note: seeking_food targets usually don't move, so targetPosition remains valid
      }

      // Apply Steering
      if (critter.state === 'fleeing' && critter.targetPosition) {
          CreatureSystem.fleeFrom(critter, critter.targetPosition);
      } else if ((critter.state === 'hunting' || critter.state === 'seeking_food') && critter.targetPosition) {
          CreatureSystem.steerTowards(critter, critter.targetPosition);
          this.handleInteractionLogic(critter);
      } else if (critter.state === 'wandering') {
          CreatureSystem.wander(critter);
      } else if (critter.state === 'resting') {
          critter.velocity.x *= 0.8;
          critter.velocity.y *= 0.8;
      }

      // 3. Physics & Biology
      GeneticSystem.applyDrift(critter);
      CreatureSystem.move(critter, this.critterGrid);
      CreatureSystem.enforceBoundaries(critter);
      CreatureSystem.calculateMetabolism(critter);

      if (critter.energy > critter.genome.reproThreshold && critter.state !== 'fleeing' && critter.state !== 'hunting') {
           this.reproduce(critter);
      }

      if (critter.energy <= 0 || critter.age > 4000) {
        this.killCritter(i);
      }
    }

    if (this.time % 5 === 0) { 
        this.food = this.food.filter(f => f.energyValue > 0);
    }

    if (this.time % 30 === 0) {
        this.events.emit('STATS_UPDATE', {
            time: this.time,
            population: this.critters.length,
            speciesCount: this.species.size, 
            extinctCount: 0 
        });
    }
  }

  private handleInteractionLogic(critter: Critter) {
      if (!critter.targetId || !critter.targetPosition) return;
      
      const d = CreatureSystem.dist(critter.position, critter.targetPosition);
      
      if (critter.state === 'hunting') {
           const attackRange = critter.genome.size + critter.genome.mouthSize;
           if (d < attackRange) {
              const prey = this.critterMap.get(critter.targetId);
              if (prey) {
                  const preyIdx = this.critters.findIndex(c => c.id === prey.id); // Slow, but infrequent
                  if (preyIdx !== -1) {
                      critter.energy += prey.energy * Constants.ENERGY_GAIN_MEAT_MULTIPLIER + (prey.genome.size * 10);
                      this.killCritter(preyIdx);
                  }
              }
              critter.state = 'wandering';
              critter.targetId = null;
           }
      } 
      else if (critter.state === 'seeking_food') {
           const eatRange = critter.genome.size + (critter.genome.mouthSize / 2);
           if (d < eatRange) {
               // We need the food object. Spatial query is fast.
               const localFood = this.foodGrid.query(critter.gridIndex);
               const f = localFood.find(fd => fd.id === critter.targetId);
               if (f && f.energyValue > 0) {
                   critter.energy += f.energyValue;
                   f.energyValue = 0;
                   this.foodGrid.remove(f);
               }
               critter.state = 'wandering';
               critter.targetId = null;
           }
      }
  }

  private reproduce(parent: Critter) {
    if (this.critters.length >= Constants.MAX_POPULATION) return;

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
    if (this.selectedCritterId === c.id) {
        this.selectedCritterId = null; // Deselect if died
        this.events.emit('SELECTION_CHANGED', null);
    }
    
    this.critterGrid.remove(c);
    this.critterMap.delete(c.id); // Remove from Map

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