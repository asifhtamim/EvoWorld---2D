
import { Critter, Vector2, BiomeType } from '../types';
import * as Constants from '../constants';
import { SpatialHash } from '../core/SpatialHash';
import { TerrainSystem } from '../core/TerrainSystem';

export class CreatureSystem {
  
  // --- Physics ---

  static move(critter: Critter, spatial: SpatialHash<Critter>) {
    const biome = TerrainSystem.getBiomeAt(critter.position.x, critter.position.y);
    let friction = Constants.FRICTION_LAND;

    if (biome === BiomeType.DEEP_OCEAN || biome === BiomeType.OCEAN) {
        friction = Constants.FRICTION_WATER;
    } else if (biome === BiomeType.MOUNTAIN) {
        friction = Constants.FRICTION_MOUNTAIN;
    } else if (biome === BiomeType.JUNGLE) {
        friction = Constants.FRICTION_SWAMP;
    }

    critter.velocity.x *= friction;
    critter.velocity.y *= friction;

    critter.position.x += critter.velocity.x;
    critter.position.y += critter.velocity.y;

    spatial.updateSpatialIndex(critter);
  }

  static enforceBoundaries(critter: Critter) {
    const margin = 10;
    if (critter.position.x < margin) {
        critter.position.x = margin;
        critter.velocity.x = Math.abs(critter.velocity.x);
        critter.heading = 0;
    }
    if (critter.position.x > Constants.WORLD_WIDTH - margin) {
        critter.position.x = Constants.WORLD_WIDTH - margin;
        critter.velocity.x = -Math.abs(critter.velocity.x);
        critter.heading = Math.PI;
    }
    if (critter.position.y < margin) {
        critter.position.y = margin;
        critter.velocity.y = Math.abs(critter.velocity.y);
        critter.heading = Math.PI / 2;
    }
    if (critter.position.y > Constants.WORLD_HEIGHT - margin) {
        critter.position.y = Constants.WORLD_HEIGHT - margin;
        critter.velocity.y = -Math.abs(critter.velocity.y);
        critter.heading = -Math.PI / 2;
    }
  }

  static normalizeVelocity(critter: Critter) {
    const biome = TerrainSystem.getBiomeAt(critter.position.x, critter.position.y);
    const inWater = (biome === BiomeType.OCEAN || biome === BiomeType.DEEP_OCEAN);

    let suitability = 0;
    if (inWater) {
        suitability = 1.0 - critter.genome.amphibious; 
    } else {
        suitability = critter.genome.amphibious; 
    }
    
    let maxSpeed = critter.genome.speed;
    
    // Armor slows you down slightly
    if (critter.genome.defense > 0.2) {
        maxSpeed *= (1.0 - (critter.genome.defense * 0.3));
    }

    if (biome === BiomeType.MOUNTAIN) {
        maxSpeed *= 0.4;
    }

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

    // Limit speed
    if (currentSpeed > maxSpeed) {
      const ratio = maxSpeed / currentSpeed;
      critter.velocity.x *= ratio;
      critter.velocity.y *= ratio;
    }
    
    // Note: We no longer force heading to match velocity. 
    // Heading now drives velocity (Steering Behavior), not the other way around.
  }

  // --- Metabolism ---

  static calculateMetabolism(critter: Critter) {
      const g = critter.genome;
      const biome = TerrainSystem.getBiomeAt(critter.position.x, critter.position.y);
      const inWater = (biome === BiomeType.OCEAN || biome === BiomeType.DEEP_OCEAN);
      
      const envVal = inWater ? 0.0 : 1.0;
      const mismatch = Math.abs(g.amphibious - envVal);
      let suffocation = 0;
      if (mismatch > 0.3) {
          suffocation = (mismatch - 0.3) * Constants.SUFFOCATION_PENALTY;
      }
      
      const limbCost = g.limbCount * Constants.ENERGY_COST_PER_LIMB;
      const mouthCost = g.mouthSize * Constants.ENERGY_COST_MOUTH_SIZE;
      const sizeCost = (g.size * g.size) * 0.005;
      const defenseCost = (g.defense * g.size) * Constants.ENERGY_COST_DEFENSE;

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
      
      let totalCost = Constants.ENERGY_COST_EXIST + limbCost + mouthCost + moveCost + sizeCost + defenseCost + suffocation;
      
      // Resting Logic
      if (critter.state === 'resting') {
          totalCost *= Constants.ENERGY_COST_RESTING_MULTIPLIER;
      }

      critter.energy -= totalCost;
  }

  // --- Helpers ---
  
  static dist(a: Vector2, b: Vector2) {
    return Math.sqrt((a.x - b.x)**2 + (a.y - b.y)**2);
  }

  static turnTowards(critter: Critter, targetAngle: number) {
      // Calculate Turn Speed / Agility
      const biome = TerrainSystem.getBiomeAt(critter.position.x, critter.position.y);
      const inWater = (biome === BiomeType.OCEAN || biome === BiomeType.DEEP_OCEAN);
      let turnSpeed = 0.1; // Base agility

      if (inWater) {
           turnSpeed += (critter.genome.limbCount * 0.02);
           if (critter.genome.amphibious > 0.6) turnSpeed *= 0.5; 
      } else {
           turnSpeed += (critter.genome.limbCount * 0.015);
           if (critter.genome.amphibious < 0.4) turnSpeed *= 0.2; 
      }
      
      // Large creatures turn slower
      turnSpeed *= Math.max(0.3, 1.0 - (critter.genome.size * 0.03));

      let diff = targetAngle - critter.heading;
      // Normalize angle difference to -PI to PI
      while (diff < -Math.PI) diff += Math.PI * 2;
      while (diff > Math.PI) diff -= Math.PI * 2;
      
      if (Math.abs(diff) < turnSpeed) {
          critter.heading = targetAngle;
      } else {
          critter.heading += Math.sign(diff) * turnSpeed;
      }
  }

  static applyForwardForce(critter: Critter, multiplier: number = 1.0) {
      // Acceleration is less than max speed, letting friction stabilize it
      const accel = 0.5 * multiplier; 
      critter.velocity.x += Math.cos(critter.heading) * accel;
      critter.velocity.y += Math.sin(critter.heading) * accel;
  }

  static steerTowards(critter: Critter, target: Vector2) {
    const dx = target.x - critter.position.x;
    const dy = target.y - critter.position.y;
    const distSq = dx*dx + dy*dy;
    
    if (distSq > 0) {
      const targetAngle = Math.atan2(dy, dx);
      CreatureSystem.turnTowards(critter, targetAngle);
      CreatureSystem.applyForwardForce(critter, 1.0);
    }
    CreatureSystem.normalizeVelocity(critter);
  }

  static fleeFrom(critter: Critter, threat: Vector2) {
      const dx = critter.position.x - threat.x;
      const dy = critter.position.y - threat.y;
      
      const threatAngle = Math.atan2(dy, dx);
      // Flee = Move towards opposite angle
      const targetAngle = threatAngle + Math.PI;
      
      CreatureSystem.turnTowards(critter, targetAngle);
      // Fleeing is panicked, so move faster
      CreatureSystem.applyForwardForce(critter, 1.5);

      CreatureSystem.normalizeVelocity(critter);
  }

  static wander(critter: Critter) {
    // Smooth wander: modify heading slightly rather than adding random velocity
    const WANDER_JITTER = 0.15; // Max radians to turn per tick
    critter.heading += (Math.random() - 0.5) * WANDER_JITTER;
    
    CreatureSystem.applyForwardForce(critter, 0.8);
    CreatureSystem.normalizeVelocity(critter);
  }
}
