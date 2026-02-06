import { Critter, Food, Species, Genome, Vector2 } from '../types';
import * as Constants from '../constants';

export class SimulationEngine {
  critters: Critter[] = [];
  food: Food[] = [];
  species: Map<string, Species> = new Map();
  time: number = 0;
  
  private nextId = 0;
  private generateId() { return `ent_${this.nextId++}`; }

  constructor() {
    this.reset();
  }

  reset() {
    this.critters = [];
    this.food = [];
    this.species.clear();
    this.time = 0;

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

    // Spawn Initial Life IN WATER (Left side)
    for(let i=0; i<Constants.INITIAL_POPULATION; i++) {
        this.spawnCritter(
            Math.random() * (Constants.BIOME_WATER_WIDTH - 50) + 20, 
            Math.random() * Constants.WORLD_HEIGHT, 
            rootSpeciesId, 
            Constants.BASE_GENOME
        );
    }
  
    // Initial Food Scatter (Everywhere, to tempt them onto land)
    for (let i = 0; i < 80; i++) {
        this.spawnRandomFood();
    }
  }

  private spawnCritter(x: number, y: number, speciesId: string, genome: Genome) {
    this.critters.push({
      id: this.generateId(),
      speciesId,
      position: { x, y },
      velocity: { x: (Math.random() - 0.5), y: (Math.random() - 0.5) },
      energy: Constants.STARTING_ENERGY,
      age: 0,
      genome: { ...genome },
      state: 'wandering',
      targetId: null,
      heading: Math.random() * Math.PI * 2
    });

    const spec = this.species.get(speciesId);
    if (spec) spec.count++;
  }

  private spawnRandomFood() {
     this.food.push({
      id: this.generateId(),
      position: {
        x: Math.random() * Constants.WORLD_WIDTH,
        y: Math.random() * Constants.WORLD_HEIGHT
      },
      energyValue: Constants.ENERGY_GAIN_FOOD,
      age: 0
    });
  }

  private spawnFoodInZone(minX: number, maxX: number) {
      this.food.push({
          id: this.generateId(),
          position: {
              x: minX + Math.random() * (maxX - minX),
              y: Math.random() * Constants.WORLD_HEIGHT
          },
          energyValue: Constants.ENERGY_GAIN_FOOD,
          age: 0
      });
  }

  // --- Plant Cellular Automata ---
  private growPlants() {
    // 1. Random "Wind/Current" Spawns
    if (Math.random() < 0.1) this.spawnRandomFood();

    // 1b. Beach Bait: Constant small chance to spawn food in the transition zone (220-280)
    // This lures creatures to the edge.
    // Adjusted transition zone for larger world map
    const beachStart = Constants.BIOME_WATER_WIDTH - 30;
    const beachEnd = Constants.BIOME_WATER_WIDTH + 50;
    if (Math.random() < 0.08) {
        this.spawnFoodInZone(beachStart, beachEnd);
    }

    if (this.food.length >= Constants.MAX_FOOD) return;

    // 1c. Ocean Floor Floor (Safety Net)
    // If water food is critically low, force spawn to prevent extinction.
    // Increased spawn count to 3 and widened the range (5 to Width-5) to help scattered creatures.
    const oceanFoodCount = this.food.reduce((acc, f) => (f.position.x < Constants.BIOME_WATER_WIDTH ? acc + 1 : acc), 0);
    if (oceanFoodCount < 20) {
        this.spawnFoodInZone(5, Constants.BIOME_WATER_WIDTH - 5);
        this.spawnFoodInZone(5, Constants.BIOME_WATER_WIDTH - 5);
        this.spawnFoodInZone(5, Constants.BIOME_WATER_WIDTH - 5);
    }

    // 2. Existing plants spread seeds
    const subsetSize = Math.min(this.food.length, 30);
    for(let i=0; i<subsetSize; i++) {
        // Pick a random parent
        const parent = this.food[Math.floor(Math.random() * this.food.length)];
        
        let growthChance = 0.01;

        // Transition Zone (Beach) Logic: High growth to sustain beach-goers
        if (parent.position.x > beachStart && parent.position.x < beachEnd) {
            growthChance = 0.40; // High growth rate on the shoreline
        } else if (parent.position.x < Constants.BIOME_WATER_WIDTH) {
            growthChance = Constants.BIOME_WATER_GROWTH;
        } else if (parent.position.x < Constants.BIOME_WATER_WIDTH + Constants.BIOME_FOREST_WIDTH) {
            growthChance = Constants.BIOME_FOREST_GROWTH;
        } else {
            growthChance = Constants.BIOME_SCRUB_GROWTH;
        }

        // Handle growthChance > 1 (e.g. 30.0 for water)
        // Guaranteed spawns = floor(chance). Probabilistic remainder = chance % 1
        const guaranteedSpawns = Math.floor(growthChance);
        const remainderChance = growthChance % 1;
        
        const spawnsToAttempt = guaranteedSpawns + (Math.random() < remainderChance ? 1 : 0);

        for(let k = 0; k < spawnsToAttempt; k++) {
            // Stop if we hit cap mid-loop
            if (this.food.length >= Constants.MAX_FOOD) break;

            const angle = Math.random() * Math.PI * 2;
            
            // Distribute widely in water to avoid clumps (as requested)
            let dist = 10 + Math.random() * 40;
            if (parent.position.x < Constants.BIOME_WATER_WIDTH) {
                dist = 20 + Math.random() * 200; // MUCH wider spread for water
            }

            const newX = parent.position.x + Math.cos(angle) * dist;
            const newY = parent.position.y + Math.sin(angle) * dist;

            if (newX > 0 && newX < Constants.WORLD_WIDTH && newY > 0 && newY < Constants.WORLD_HEIGHT) {
                this.food.push({
                    id: this.generateId(),
                    position: { x: newX, y: newY },
                    energyValue: Constants.ENERGY_GAIN_FOOD,
                    age: 0
                });
            }
        }
    }
  }

  // --- Core Loop ---
  update() {
    this.time++;
    this.growPlants();

    for (let i = this.critters.length - 1; i >= 0; i--) {
      const critter = this.critters[i];
      critter.age++;
      
      this.decideAction(critter);
      this.applyGeneticDrift(critter);
      this.move(critter);
      this.enforceBoundaries(critter);
      this.calculateMetabolism(critter);

      if (critter.energy <= 0 || critter.age > 4000) {
        this.killCritter(i);
      }
    }

    this.species.forEach(s => {
      if (s.count === 0 && !s.extinct) s.extinct = true;
    });
  }

  private calculateMetabolism(critter: Critter) {
      const g = critter.genome;
      const inWater = critter.position.x < Constants.BIOME_WATER_WIDTH;
      
      // 1. Biome Check & Suffocation
      const envVal = inWater ? 0.0 : 1.0;
      const mismatch = Math.abs(g.amphibious - envVal);
      
      let suffocation = 0;
      if (mismatch > 0.3) {
          suffocation = (mismatch - 0.3) * Constants.SUFFOCATION_PENALTY;
      }
      
      // 2. Base Costs
      const limbCost = g.limbCount * Constants.ENERGY_COST_PER_LIMB;
      const mouthCost = g.mouthSize * Constants.ENERGY_COST_MOUTH_SIZE;
      const sizeCost = (g.size * g.size) * 0.005;
      
      const speed = Math.sqrt(critter.velocity.x**2 + critter.velocity.y**2);
      
      // 3. Movement Efficiency based on Morphology & Biome
      let efficiency = 1.0;
      
      if (inWater) {
          if (g.amphibious > 0.5) efficiency = 0.2; 
          if (g.amphibious < 0.5 && g.limbCount > 0) efficiency *= 1.2;
      } else {
          if (g.amphibious < 0.5) efficiency = 0.1;
          if (g.limbCount >= 2 && g.limbCount <= 6) efficiency *= 1.1;
      }

      const moveCost = (speed * (g.size * 0.1) * Constants.ENERGY_COST_MOVE_BASE) / efficiency;

      critter.energy -= (Constants.ENERGY_COST_EXIST + limbCost + mouthCost + moveCost + sizeCost + suffocation);
  }

  private applyGeneticDrift(critter: Critter) {
    if (Math.random() > Constants.GENETIC_DRIFT_RATE) return;
    const drift = () => 1 + ((Math.random() * 2 - 1) * Constants.GENETIC_DRIFT_SCALE);
    critter.genome.speed *= drift();
    critter.genome.size *= drift();
  }

  private decideAction(critter: Critter) {
    const isCarnivore = critter.genome.diet > 0.5;

    // Herbivores flee from carnivores
    if (!isCarnivore) {
        const threat = this.findNearestPredator(critter);
        if (threat) {
            critter.state = 'fleeing';
            this.fleeFrom(critter, threat.position);
            return;
        }
    }

    // Reproduction Check (Treating creature as a pair unit)
    if (critter.energy > critter.genome.reproThreshold) {
        // Must have some maturity or cooldown to prevent instant explosions? 
        // Energy cost handles cooldown naturally.
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
      for (const other of this.critters) {
          if (other.id === critter.id) continue;
          if (other.genome.diet > 0.5 && other.genome.size >= critter.genome.size) {
              const d = this.dist(critter.position, other.position);
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

      for (const other of this.critters) {
          if (other.id === critter.id) continue;
          if (other.speciesId === critter.speciesId) continue; 

          // Carnivore logic
          const combatAdvantage = (critter.genome.size + critter.genome.mouthSize * 2) > (other.genome.size + (other.genome.diet > 0.5 ? other.genome.mouthSize : 0));

          if (combatAdvantage) {
              const d = this.dist(critter.position, other.position);
              if (d < critter.genome.senseRadius && d < minDist) {
                  minDist = d;
                  nearestPrey = other;
              }
          }
      }

      if (nearestPrey) {
          critter.state = 'hunting';
          critter.targetId = nearestPrey.id;
          this.steerTowards(critter, nearestPrey.position);
          
          if (minDist < critter.genome.size + nearestPrey.genome.size) {
              critter.energy += nearestPrey.energy * Constants.ENERGY_GAIN_MEAT_MULTIPLIER + (nearestPrey.genome.size * 10);
              const preyIndex = this.critters.findIndex(c => c.id === nearestPrey!.id);
              if (preyIndex !== -1) this.killCritter(preyIndex);
              critter.targetId = null;
          }
      } else {
          critter.state = 'wandering';
          this.wander(critter);
      }
  }

  private seekFood(critter: Critter) {
    let nearestFood: Food | null = null;
    let minDist = Infinity;

    for (const f of this.food) {
      const d = this.dist(critter.position, f.position);
      if (d < critter.genome.senseRadius && d < minDist) {
        minDist = d;
        nearestFood = f;
      }
    }

    if (nearestFood) {
      critter.state = 'seeking_food';
      critter.targetId = nearestFood.id;
      this.steerTowards(critter, nearestFood.position);

      const eatRange = critter.genome.size + (critter.genome.mouthSize / 2);
      if (minDist < eatRange) {
        critter.energy += nearestFood.energyValue;
        this.food = this.food.filter(f => f.id !== nearestFood!.id);
        critter.targetId = null;
      }
    } else {
      critter.state = 'wandering';
      this.wander(critter);
    }
  }

  private reproduce(parent: Critter) {
    if (this.critters.length >= Constants.MAX_POPULATION) return;

    // Single parent reproduction (Pair splitting)
    const newGenome: Genome = { ...parent.genome };

    let mutationMetric = 0;
    const C = Constants.MUTATION_CONFIG;

    const mutate = (val: number, cfg: any, min: number = 0.1) => {
        if (Math.random() < cfg.RATE) {
            const change = (Math.random() * 2 - 1) * cfg.VARIANCE;
            mutationMetric += Math.abs(change);
            return Math.max(min, val * (1 + change));
        }
        return val;
    };

    newGenome.speed = mutate(newGenome.speed, C.SPEED);
    newGenome.size = mutate(newGenome.size, C.SIZE, 3);
    newGenome.senseRadius = mutate(newGenome.senseRadius, C.SENSE, 20);
    newGenome.limbLength = mutate(newGenome.limbLength, C.LIMB_LENGTH, 1);
    newGenome.mouthSize = mutate(newGenome.mouthSize, C.MOUTH_SIZE, 1);
    newGenome.reproThreshold = mutate(newGenome.reproThreshold, C.REPRO_THRESHOLD, 50); // Mutate reproduction rate
    
    // Amphibious Mutation
    if (Math.random() < C.AMPHIBIOUS.RATE) {
         const change = (Math.random() * 2 - 1) * C.AMPHIBIOUS.VARIANCE;
         newGenome.amphibious = Math.max(0, Math.min(1, newGenome.amphibious + change));
         mutationMetric += Math.abs(change) * 3; 
    }

    if (Math.random() < C.LIMB_COUNT.RATE) {
        const change = Math.random() < 0.5 ? -1 : 1;
        newGenome.limbCount = Math.max(0, Math.min(8, newGenome.limbCount + change));
        mutationMetric += 0.2; 
    }

    if (Math.random() < C.DIET.RATE) {
        const change = (Math.random() * 2 - 1) * C.DIET.VARIANCE;
        newGenome.diet = Math.max(0, Math.min(1, newGenome.diet + change));
        mutationMetric += Math.abs(change) * 2;
    }

    // Color Logic
    let h = 200, s = 70, l = 50;
    const hslMatch = parent.genome.color.match(/hsl\((\d+),\s*(\d+)%,\s*(\d+)%\)/);
    if (hslMatch) {
      h = parseInt(hslMatch[1]); s = parseInt(hslMatch[2]); l = parseInt(hslMatch[3]);
    }
    
    h = (h + (Math.random() * 6 - 3) + 360) % 360;

    let childSpeciesId = parent.speciesId;
    if (mutationMetric > Constants.SPECIATION_THRESHOLD) {
      const parentSpecies = this.species.get(parent.speciesId);
      const suffix = (this.nextId).toString(36);
      const newSpeciesId = `species_${suffix}`;
      h = (h + 30) % 360; 
      
      this.species.set(newSpeciesId, {
        id: newSpeciesId,
        name: `Gen ${suffix.toUpperCase()}`,
        parentId: parentSpecies ? parentSpecies.id : null,
        generation: (parentSpecies ? parentSpecies.generation : 0) + 1,
        color: `hsl(${Math.round(h)}, ${s}%, ${l}%)`,
        count: 0,
        extinct: false,
        firstAppearedAt: this.time
      });
      childSpeciesId = newSpeciesId;
    }
    newGenome.color = `hsl(${Math.round(h)}, ${s}%, ${l}%)`;

    // Energy Costs
    const babyEnergy = parent.energy * 0.4; // 40% to baby
    parent.energy -= (parent.energy * 0.5); // 50% cost (10% loss to entropy)

    this.spawnCritter(
        parent.position.x + (Math.random() * 20 - 10),
        parent.position.y + (Math.random() * 20 - 10),
        childSpeciesId,
        newGenome
    );

    // Apply baby energy
    const baby = this.critters[this.critters.length - 1];
    baby.energy = babyEnergy;
  }

  private wander(critter: Critter) {
    critter.velocity.x += (Math.random() - 0.5) * 1.5;
    critter.velocity.y += (Math.random() - 0.5) * 1.5;
    this.normalizeVelocity(critter);
  }

  private steerTowards(critter: Critter, target: Vector2) {
    const dx = target.x - critter.position.x;
    const dy = target.y - critter.position.y;
    const dist = Math.sqrt(dx*dx + dy*dy);
    if (dist > 0) {
      const inWater = critter.position.x < Constants.BIOME_WATER_WIDTH;
      let turnSpeed = 0.05;

      // Specialized Turning
      if (inWater) {
          turnSpeed += (critter.genome.limbCount * 0.03);
          if (critter.genome.amphibious > 0.6) turnSpeed *= 0.5; 
      } else {
          turnSpeed += (critter.genome.limbCount * 0.015);
          if (critter.genome.amphibious < 0.4) turnSpeed *= 0.2; 
      }
      
      critter.velocity.x += (dx / dist) * turnSpeed;
      critter.velocity.y += (dy / dist) * turnSpeed;
    }
    this.normalizeVelocity(critter);
  }

  private fleeFrom(critter: Critter, threat: Vector2) {
      const dx = critter.position.x - threat.x;
      const dy = critter.position.y - threat.y;
      const dist = Math.sqrt(dx*dx + dy*dy);
      if (dist > 0) {
          critter.velocity.x += (dx / dist) * 1.0; 
          critter.velocity.y += (dy / dist) * 1.0;
      }
      this.normalizeVelocity(critter);
  }

  private normalizeVelocity(critter: Critter) {
    const inWater = critter.position.x < Constants.BIOME_WATER_WIDTH;

    let suitability = 0;
    if (inWater) {
        suitability = 1.0 - critter.genome.amphibious; 
    } else {
        suitability = critter.genome.amphibious; 
    }
    
    let maxSpeed = critter.genome.speed;
    
    if (inWater) {
        maxSpeed += (critter.genome.limbLength * 0.15); 
        maxSpeed *= (0.2 + (suitability * 0.8)); 
    } else {
        maxSpeed += (critter.genome.limbLength * 0.4); 
        maxSpeed *= (0.1 + (suitability * 0.9));
    }

    maxSpeed -= (critter.genome.size * 0.05);
    maxSpeed = Math.max(0.1, maxSpeed);

    const currentSpeed = Math.sqrt(critter.velocity.x**2 + critter.velocity.y**2);
    
    if (currentSpeed > 0.1) {
        critter.heading = Math.atan2(critter.velocity.y, critter.velocity.x);
    }

    if (currentSpeed > maxSpeed) {
      const ratio = maxSpeed / currentSpeed;
      critter.velocity.x *= ratio;
      critter.velocity.y *= ratio;
    }
  }

  private move(critter: Critter) {
    const inWater = critter.position.x < Constants.BIOME_WATER_WIDTH;
    let friction = inWater ? Constants.BIOME_WATER_DRAG : Constants.BIOME_FOREST_FRICTION;
    
    // Forest width check
    if (!inWater && critter.position.x > Constants.BIOME_WATER_WIDTH + Constants.BIOME_FOREST_WIDTH) {
        friction = Constants.BIOME_SCRUB_FRICTION;
    }

    critter.velocity.x *= friction;
    critter.velocity.y *= friction;

    critter.position.x += critter.velocity.x;
    critter.position.y += critter.velocity.y;
  }

  private enforceBoundaries(critter: Critter) {
    const margin = 10;
    if (critter.position.x < margin) critter.velocity.x = Math.abs(critter.velocity.x);
    if (critter.position.x > Constants.WORLD_WIDTH - margin) critter.velocity.x = -Math.abs(critter.velocity.x);
    if (critter.position.y < margin) critter.velocity.y = Math.abs(critter.velocity.y);
    if (critter.position.y > Constants.WORLD_HEIGHT - margin) critter.velocity.y = -Math.abs(critter.velocity.y);
  }

  private killCritter(index: number) {
    const c = this.critters[index];
    const s = this.species.get(c.speciesId);
    if (s) s.count--;
    this.critters.splice(index, 1);
  }

  private dist(a: Vector2, b: Vector2) {
    return Math.sqrt((a.x - b.x)**2 + (a.y - b.y)**2);
  }
}