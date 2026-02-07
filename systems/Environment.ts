import { Food, Vector2, BiomeType } from '../types';
import * as Constants from '../constants';
import { SpatialHash } from '../core/SpatialHash';
import { TerrainSystem } from '../core/TerrainSystem';

export class EnvironmentSystem {
  static spawnRandomFood(foodList: Food[], grid: SpatialHash<Food>, generateId: () => string) {
     const x = Math.random() * Constants.WORLD_WIDTH;
     const y = Math.random() * Constants.WORLD_HEIGHT;
     
     // Check validity - Don't spawn on mountains if we want to avoid it, 
     // but let's allow it for now, just fewer.
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
    // 1. Ambient Spawns - Less arbitrary, more biome based
    for (let i = 0; i < 20; i++) {
        if (foodList.length < Constants.MAX_FOOD) this.spawnRandomFood(foodList, grid, generateId);
    }

    if (foodList.length >= Constants.MAX_FOOD) return;

    // 2. Biome-Specific Spreading
    const subsetSize = Math.min(foodList.length, 50);
    
    for(let i=0; i<subsetSize; i++) {
        if (foodList.length >= Constants.MAX_FOOD) break;

        const parent = foodList[Math.floor(Math.random() * foodList.length)];
        const px = parent.position.x;
        const py = parent.position.y;
        
        const biome = TerrainSystem.getBiomeAt(px, py);
        let growthChance = 0.01;

        switch (biome) {
            case BiomeType.DEEP_OCEAN: growthChance = Constants.BIOME_GROWTH_WATER * 0.5; break;
            case BiomeType.OCEAN: growthChance = Constants.BIOME_GROWTH_WATER; break;
            case BiomeType.JUNGLE: growthChance = Constants.BIOME_GROWTH_FOREST * 2.0; break;
            case BiomeType.FOREST: growthChance = Constants.BIOME_GROWTH_FOREST; break;
            case BiomeType.PLAINS: growthChance = Constants.BIOME_GROWTH_PLAINS; break;
            case BiomeType.BEACH: growthChance = 1.0; break;
            default: growthChance = 0.5;
        }

        const guaranteedSpawns = Math.floor(growthChance);
        const remainderChance = growthChance % 1;
        
        let spawnsToAttempt = Math.min(50, guaranteedSpawns + (Math.random() < remainderChance ? 1 : 0));

        for(let k = 0; k < spawnsToAttempt; k++) {
            if (foodList.length >= Constants.MAX_FOOD) break;

            const angle = Math.random() * Math.PI * 2;
            let dist = 15 + Math.random() * 80;
            
            // Water plants spread further
            if (biome === BiomeType.OCEAN) {
                dist = 20 + Math.random() * 200; 
            }

            const newX = parent.position.x + Math.cos(angle) * dist;
            const newY = parent.position.y + Math.sin(angle) * dist;

            if (newX > 0 && newX < Constants.WORLD_WIDTH && newY > 0 && newY < Constants.WORLD_HEIGHT) {
                // Only grow if target biome matches parent biome (roughly) to create clusters
                const newBiome = TerrainSystem.getBiomeAt(newX, newY);
                if (newBiome === biome || 
                   (biome === BiomeType.OCEAN && newBiome === BiomeType.DEEP_OCEAN) ||
                   (biome === BiomeType.JUNGLE && newBiome === BiomeType.FOREST)) {
                    EnvironmentSystem.createFood(newX, newY, foodList, grid, generateId);
                }
            }
        }
    }
  }
}