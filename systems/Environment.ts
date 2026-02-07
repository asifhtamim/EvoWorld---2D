import { Food, Vector2 } from '../types';
import * as Constants from '../constants';
import { SpatialHash } from '../core/SpatialHash';

export class EnvironmentSystem {
  static spawnRandomFood(foodList: Food[], grid: SpatialHash<Food>, generateId: () => string) {
     const x = Math.random() * Constants.WORLD_WIDTH;
     const y = Math.random() * Constants.WORLD_HEIGHT;
     EnvironmentSystem.createFood(x, y, foodList, grid, generateId);
  }

  static spawnFoodInZone(minX: number, maxX: number, foodList: Food[], grid: SpatialHash<Food>, generateId: () => string) {
      const x = minX + Math.random() * (maxX - minX);
      const y = Math.random() * Constants.WORLD_HEIGHT;
      EnvironmentSystem.createFood(x, y, foodList, grid, generateId);
  }

  static createFood(x: number, y: number, foodList: Food[], grid: SpatialHash<Food>, generateId: () => string) {
      const f: Food = {
          id: generateId(),
          position: { x, y },
          energyValue: Constants.ENERGY_GAIN_FOOD,
          age: 0,
          gridIndex: 0 // Will be set by add
      };
      grid.add(f);
      foodList.push(f);
  }

  static update(foodList: Food[], grid: SpatialHash<Food>, generateId: () => string) {
    // 1. Ambient Spawns
    for (let i = 0; i < 10; i++) {
        if (foodList.length < Constants.MAX_FOOD) this.spawnRandomFood(foodList, grid, generateId);
    }

    if (Math.random() < 0.5) {
         const scrubStart = Constants.BIOME_WATER_WIDTH + Constants.BIOME_FOREST_WIDTH;
         this.spawnFoodInZone(scrubStart, Constants.WORLD_WIDTH, foodList, grid, generateId);
    }

    const beachStart = Constants.BIOME_WATER_WIDTH - 50;
    const beachEnd = Constants.BIOME_WATER_WIDTH + 100;
    if (Math.random() < 0.3) {
        this.spawnFoodInZone(beachStart, beachEnd, foodList, grid, generateId);
    }

    if (foodList.length >= Constants.MAX_FOOD) return;

    // Safety net for low population
    if (foodList.length < 5000) {
        let oceanFoodCount = 0;
        // Approximation for speed
        for(let i=0; i<100; i++) {
            if (foodList[i] && foodList[i].position.x < Constants.BIOME_WATER_WIDTH) oceanFoodCount++;
        }
        if (oceanFoodCount < 10) { // relative check
             for(let i=0; i<30; i++) this.spawnFoodInZone(5, Constants.BIOME_WATER_WIDTH - 5, foodList, grid, generateId);
        }
    }

    // 2. Existing plants spread seeds
    const subsetSize = Math.min(foodList.length, 50);
    
    for(let i=0; i<subsetSize; i++) {
        if (foodList.length >= Constants.MAX_FOOD) break;

        const parent = foodList[Math.floor(Math.random() * foodList.length)];
        
        let growthChance = 0.01;
        const px = parent.position.x;

        if (px > beachStart && px < beachEnd) {
            growthChance = Constants.BIOME_FOREST_GROWTH * 2; 
        } else if (px < Constants.BIOME_WATER_WIDTH) {
            growthChance = Constants.BIOME_WATER_GROWTH;
        } else if (px < Constants.BIOME_WATER_WIDTH + Constants.BIOME_FOREST_WIDTH) {
            growthChance = Constants.BIOME_FOREST_GROWTH;
        } else {
            growthChance = Constants.BIOME_SCRUB_GROWTH;
        }

        const guaranteedSpawns = Math.floor(growthChance);
        const remainderChance = growthChance % 1;
        
        let spawnsToAttempt = Math.min(50, guaranteedSpawns + (Math.random() < remainderChance ? 1 : 0));

        for(let k = 0; k < spawnsToAttempt; k++) {
            if (foodList.length >= Constants.MAX_FOOD) break;

            const angle = Math.random() * Math.PI * 2;
            let dist = 15 + Math.random() * 80;
            if (px < Constants.BIOME_WATER_WIDTH) {
                dist = 20 + Math.random() * 350; 
            }

            const newX = parent.position.x + Math.cos(angle) * dist;
            const newY = parent.position.y + Math.sin(angle) * dist;

            if (newX > 0 && newX < Constants.WORLD_WIDTH && newY > 0 && newY < Constants.WORLD_HEIGHT) {
                EnvironmentSystem.createFood(newX, newY, foodList, grid, generateId);
            }
        }
    }
  }
}