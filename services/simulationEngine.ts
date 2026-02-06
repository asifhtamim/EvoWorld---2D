import { Critter, Food, Species, Genome, Vector2 } from '../types';
import * as Constants from '../constants';

export class SimulationEngine {
  critters: Critter[] = [];
  food: Food[] = [];
  species: Map<string, Species> = new Map();
  time: number = 0;
  
  // Spatial Partitioning
  foodGrid: Food[][] = [];
  critterGrid: Critter[][] = [];

  private nextId = 0;
  private generateId() { return `ent_${this.nextId++}`; }

  constructor() {
    this.initGrids();
    this.reset();
  }

  private initGrids() {
      const totalCells = Constants.GRID_COLS * Constants.GRID_ROWS;
      this.foodGrid = new Array(totalCells).fill(null).map(() => []);
      this.critterGrid = new Array(totalCells).fill(null).map(() => []);
  }

  private getGridIndex(x: number, y: number): number {
      const col = Math.floor(x / Constants.GRID_CELL_SIZE);
      const row = Math.floor(y / Constants.GRID_CELL_SIZE);
      // Clamp to bounds to be safe
      const c = Math.max(0, Math.min(Constants.GRID_COLS - 1, col));
      const r = Math.max(0, Math.min(Constants.GRID_ROWS - 1, row));
      return c + r * Constants.GRID_COLS;
  }

  reset() {
    this.critters = [];
    this.food = [];
    this.species.clear();
    this.time = 0;
    
    // Clear grids
    const totalCells = Constants.GRID_COLS * Constants.GRID_ROWS;
    for(let i=0; i<totalCells; i++) {
        this.foodGrid[i] = [];
        this.critterGrid[i] = [];
    }

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
  
    // Initial Food Scatter
    for (let i = 0; i < 5000; i++) {
        this.spawnRandomFood();
    }
  }

  private spawnCritter(x: number, y: number, speciesId: string, genome: Genome) {
    const idx = this.getGridIndex(x, y);
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
      gridIndex: idx
    };
    
    this.critters.push(critter);
    this.critterGrid[idx].push(critter);

    const spec = this.species.get(speciesId);
    if (spec) spec.count++;
  }

  private spawnRandomFood() {
     const x = Math.random() * Constants.WORLD_WIDTH;
     const y = Math.random() * Constants.WORLD_HEIGHT;
     const idx = this.getGridIndex(x, y);
     
     const f: Food = {
      id: this.generateId(),
      position: { x, y },
      energyValue: Constants.ENERGY_GAIN_FOOD,
      age: 0,
      gridIndex: idx
    };

    this.food.push(f);
    this.foodGrid[idx].push(f);
  }

  private spawnFoodInZone(minX: number, maxX: number) {
      const x = minX + Math.random() * (maxX - minX);
      const y = Math.random() * Constants.WORLD_HEIGHT;
      const idx = this.getGridIndex(x, y);

      const f: Food = {
          id: this.generateId(),
          position: { x, y },
          energyValue: Constants.ENERGY_GAIN_FOOD,
          age: 0,
          gridIndex: idx
      };

      this.food.push(f);
      this.foodGrid[idx].push(f);
  }

  // --- Plant Cellular Automata ---
  private growPlants() {
    // 1. Ambient Spawns
    for (let i = 0; i < 10; i++) {
        if (this.food.length < Constants.MAX_FOOD) this.spawnRandomFood();
    }

    if (Math.random() < 0.5) {
         const scrubStart = Constants.BIOME_WATER_WIDTH + Constants.BIOME_FOREST_WIDTH;
         this.spawnFoodInZone(scrubStart, Constants.WORLD_WIDTH);
    }

    const beachStart = Constants.BIOME_WATER_WIDTH - 50;
    const beachEnd = Constants.BIOME_WATER_WIDTH + 100;
    if (Math.random() < 0.3) {
        this.spawnFoodInZone(beachStart, beachEnd);
    }

    if (this.food.length >= Constants.MAX_FOOD) return;

    // Safety net
    if (this.food.length < 5000) {
        // Only check ocean if significantly below cap to avoid iteration
        const oceanFoodCount = this.food.reduce((acc, f) => (f.position.x < Constants.BIOME_WATER_WIDTH ? acc + 1 : acc), 0);
        if (oceanFoodCount < 500) {
            for(let i=0; i<30; i++) this.spawnFoodInZone(5, Constants.BIOME_WATER_WIDTH - 5);
        }
    }

    // 2. Existing plants spread seeds
    const subsetSize = Math.min(this.food.length, 50);
    
    for(let i=0; i<subsetSize; i++) {
        if (this.food.length >= Constants.MAX_FOOD) break;

        const parent = this.food[Math.floor(Math.random() * this.food.length)];
        
        let growthChance = 0.01;

        if (parent.position.x > beachStart && parent.position.x < beachEnd) {
            growthChance = Constants.BIOME_FOREST_GROWTH * 2; 
        } else if (parent.position.x < Constants.BIOME_WATER_WIDTH) {
            growthChance = Constants.BIOME_WATER_GROWTH;
        } else if (parent.position.x < Constants.BIOME_WATER_WIDTH + Constants.BIOME_FOREST_WIDTH) {
            growthChance = Constants.BIOME_FOREST_GROWTH;
        } else {
            growthChance = Constants.BIOME_SCRUB_GROWTH;
        }

        const guaranteedSpawns = Math.floor(growthChance);
        const remainderChance = growthChance % 1;
        
        let spawnsToAttempt = Math.min(50, guaranteedSpawns + (Math.random() < remainderChance ? 1 : 0));

        for(let k = 0; k < spawnsToAttempt; k++) {
            if (this.food.length >= Constants.MAX_FOOD) break;

            const angle = Math.random() * Math.PI * 2;
            let dist = 15 + Math.random() * 80;
            if (parent.position.x < Constants.BIOME_WATER_WIDTH) {
                dist = 20 + Math.random() * 350; 
            }

            const newX = parent.position.x + Math.cos(angle) * dist;
            const newY = parent.position.y + Math.sin(angle) * dist;

            if (newX > 0 && newX < Constants.WORLD_WIDTH && newY > 0 && newY < Constants.WORLD_HEIGHT) {
                const idx = this.getGridIndex(newX, newY);
                const f: Food = {
                    id: this.generateId(),
                    position: { x: newX, y: newY },
                    energyValue: Constants.ENERGY_GAIN_FOOD,
                    age: 0,
                    gridIndex: idx
                };
                this.food.push(f);
                this.foodGrid[idx].push(f);
            }
        }
    }
  }

  // --- Core Loop ---
  update() {
    this.time++;
    this.growPlants();

    // Critter Update Loop
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

    // Cleanup Eaten Food efficiently
    // We mark eaten food by setting energyValue to 0 (or -1) during decideAction
    // Then filter once per tick.
    if (this.time % 5 === 0) { // Optimization: Only shrink array every 5 ticks
        this.food = this.food.filter(f => f.energyValue > 0);
    } else {
        // Quick pass if we want, but array.filter is expensive on 35k items.
        // Actually, let's filter only when necessary, or just skip rendering dead food.
        // But for memory management, we must remove.
        // Let's stick to doing it every frame but optimized:
        // Swapping is tricky with grid.
        // Simple Filter is robust.
        this.food = this.food.filter(f => f.energyValue > 0);
    }

    this.species.forEach(s => {
      if (s.count === 0 && !s.extinct) s.extinct = true;
    });
  }

  // Helpers for Spatial Query
  private getNeighborIndices(centerIdx: number): number[] {
    const indices = [centerIdx];
    const col = centerIdx % Constants.GRID_COLS;
    const row = Math.floor(centerIdx / Constants.GRID_COLS);

    for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
            if (dx === 0 && dy === 0) continue;
            const nc = col + dx;
            const nr = row + dy;
            if (nc >= 0 && nc < Constants.GRID_COLS && nr >= 0 && nr < Constants.GRID_ROWS) {
                indices.push(nc + nr * Constants.GRID_COLS);
            }
        }
    }
    return indices;
  }

  private calculateMetabolism(critter: Critter) {
      const g = critter.genome;
      const inWater = critter.position.x < Constants.BIOME_WATER_WIDTH;
      
      const envVal = inWater ? 0.0 : 1.0;
      const mismatch = Math.abs(g.amphibious - envVal);
      let suffocation = 0;
      if (mismatch > 0.3) {
          suffocation = (mismatch - 0.3) * Constants.SUFFOCATION_PENALTY;
      }
      
      const limbCost = g.limbCount * Constants.ENERGY_COST_PER_LIMB;
      const mouthCost = g.mouthSize * Constants.ENERGY_COST_MOUTH_SIZE;
      const sizeCost = (g.size * g.size) * 0.005;
      const speed = Math.sqrt(critter.velocity.x**2 + critter.velocity.y**2);
      
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

    if (!isCarnivore) {
        const threat = this.findNearestPredator(critter);
        if (threat) {
            critter.state = 'fleeing';
            this.fleeFrom(critter, threat.position);
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
      
      // Optimization: Check only local grid cells
      const indices = this.getNeighborIndices(critter.gridIndex);

      for (const idx of indices) {
          const cell = this.critterGrid[idx];
          for (const other of cell) {
              if (other.id === critter.id) continue;
              if (other.genome.diet > 0.5 && other.genome.size >= critter.genome.size) {
                  const d = this.dist(critter.position, other.position);
                  if (d < critter.genome.senseRadius && d < minDist) {
                      minDist = d;
                      nearest = other;
                  }
              }
          }
      }
      return nearest;
  }

  private huntPrey(critter: Critter) {
      let nearestPrey: Critter | null = null;
      let minDist = Infinity;
      
      // Optimization: Grid Lookup
      const indices = this.getNeighborIndices(critter.gridIndex);

      for (const idx of indices) {
          const cell = this.critterGrid[idx];
          for (const other of cell) {
             if (other.id === critter.id) continue;
             if (other.speciesId === critter.speciesId) continue; 

             const combatAdvantage = (critter.genome.size + critter.genome.mouthSize * 2) > (other.genome.size + (other.genome.diet > 0.5 ? other.genome.mouthSize : 0));

             if (combatAdvantage) {
                const d = this.dist(critter.position, other.position);
                if (d < critter.genome.senseRadius && d < minDist) {
                    minDist = d;
                    nearestPrey = other;
                }
             }
          }
      }

      if (nearestPrey) {
          critter.state = 'hunting';
          critter.targetId = nearestPrey.id;
          this.steerTowards(critter, nearestPrey.position);
          
          if (minDist < critter.genome.size + nearestPrey.genome.size) {
              critter.energy += nearestPrey.energy * Constants.ENERGY_GAIN_MEAT_MULTIPLIER + (nearestPrey.genome.size * 10);
              
              // Kill prey (Find index in master list - this is slow O(N), but hunting is rarer than grazing)
              // Better: Mark as dead and cleanup.
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
    
    // Optimization: Check only local grid cells for food
    const indices = this.getNeighborIndices(critter.gridIndex);

    for (const idx of indices) {
        const cell = this.foodGrid[idx];
        // Reverse iterate to allow removal if we wanted, but we're just reading
        for (let i = 0; i < cell.length; i++) {
            const f = cell[i];
            if (f.energyValue <= 0) continue; // Already eaten

            const d = this.dist(critter.position, f.position);
            if (d < critter.genome.senseRadius && d < minDist) {
                minDist = d;
                nearestFood = f;
            }
        }
    }

    if (nearestFood) {
      critter.state = 'seeking_food';
      critter.targetId = nearestFood.id;
      this.steerTowards(critter, nearestFood.position);

      const eatRange = critter.genome.size + (critter.genome.mouthSize / 2);
      if (minDist < eatRange) {
        critter.energy += nearestFood.energyValue;
        nearestFood.energyValue = 0; // Mark as eaten
        
        // Remove from Grid immediately to prevent others eating it this tick
        const cell = this.foodGrid[nearestFood.gridIndex];
        const fIdx = cell.indexOf(nearestFood);
        if (fIdx > -1) cell.splice(fIdx, 1);

        critter.targetId = null;
      }
    } else {
      critter.state = 'wandering';
      this.wander(critter);
    }
  }

  private reproduce(parent: Critter) {
    if (this.critters.length >= Constants.MAX_POPULATION) return;

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
    newGenome.reproThreshold = mutate(newGenome.reproThreshold, C.REPRO_THRESHOLD, 50); 
    
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

    const babyEnergy = parent.energy * 0.4; 
    parent.energy -= (parent.energy * 0.5); 

    this.spawnCritter(
        parent.position.x + (Math.random() * 20 - 10),
        parent.position.y + (Math.random() * 20 - 10),
        childSpeciesId,
        newGenome
    );

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
    
    if (!inWater && critter.position.x > Constants.BIOME_WATER_WIDTH + Constants.BIOME_FOREST_WIDTH) {
        friction = Constants.BIOME_SCRUB_FRICTION;
    }

    critter.velocity.x *= friction;
    critter.velocity.y *= friction;

    critter.position.x += critter.velocity.x;
    critter.position.y += critter.velocity.y;

    // Grid Update
    // Check if grid cell changed
    const newGridIndex = this.getGridIndex(critter.position.x, critter.position.y);
    if (newGridIndex !== critter.gridIndex) {
        // Remove from old cell
        const oldCell = this.critterGrid[critter.gridIndex];
        const idx = oldCell.indexOf(critter);
        if (idx > -1) oldCell.splice(idx, 1);

        // Add to new cell
        critter.gridIndex = newGridIndex;
        this.critterGrid[newGridIndex].push(critter);
    }
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
    
    // Remove from grid
    const cell = this.critterGrid[c.gridIndex];
    const idx = cell.indexOf(c);
    if (idx > -1) cell.splice(idx, 1);

    const s = this.species.get(c.speciesId);
    if (s) s.count--;
    this.critters.splice(index, 1);
  }

  private dist(a: Vector2, b: Vector2) {
    return Math.sqrt((a.x - b.x)**2 + (a.y - b.y)**2);
  }
}