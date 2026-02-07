import { Critter, Vector2 } from '../types';
import * as Constants from '../constants';
import { SpatialHash } from '../core/SpatialHash';

export class CreatureSystem {
  
  // --- Physics ---

  static move(critter: Critter, spatial: SpatialHash<Critter>) {
    const inWater = critter.position.x < Constants.BIOME_WATER_WIDTH;
    let friction = inWater ? Constants.BIOME_WATER_DRAG : Constants.BIOME_FOREST_FRICTION;
    
    if (!inWater && critter.position.x > Constants.BIOME_WATER_WIDTH + Constants.BIOME_FOREST_WIDTH) {
        friction = Constants.BIOME_SCRUB_FRICTION;
    }

    critter.velocity.x *= friction;
    critter.velocity.y *= friction;

    critter.position.x += critter.velocity.x;
    critter.position.y += critter.velocity.y;

    spatial.updateSpatialIndex(critter);
  }

  static enforceBoundaries(critter: Critter) {
    const margin = 10;
    if (critter.position.x < margin) critter.velocity.x = Math.abs(critter.velocity.x);
    if (critter.position.x > Constants.WORLD_WIDTH - margin) critter.velocity.x = -Math.abs(critter.velocity.x);
    if (critter.position.y < margin) critter.velocity.y = Math.abs(critter.velocity.y);
    if (critter.position.y > Constants.WORLD_HEIGHT - margin) critter.velocity.y = -Math.abs(critter.velocity.y);
  }

  static normalizeVelocity(critter: Critter) {
    const inWater = critter.position.x < Constants.BIOME_WATER_WIDTH;

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

  // --- Metabolism ---

  static calculateMetabolism(critter: Critter) {
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
      critter.energy -= (Constants.ENERGY_COST_EXIST + limbCost + mouthCost + moveCost + sizeCost + defenseCost + suffocation);
  }

  // --- Helpers ---
  
  static dist(a: Vector2, b: Vector2) {
    return Math.sqrt((a.x - b.x)**2 + (a.y - b.y)**2);
  }

  static steerTowards(critter: Critter, target: Vector2) {
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
    CreatureSystem.normalizeVelocity(critter);
  }

  static fleeFrom(critter: Critter, threat: Vector2) {
      const dx = critter.position.x - threat.x;
      const dy = critter.position.y - threat.y;
      const dist = Math.sqrt(dx*dx + dy*dy);
      if (dist > 0) {
          critter.velocity.x += (dx / dist) * 1.0; 
          critter.velocity.y += (dy / dist) * 1.0;
      }
      CreatureSystem.normalizeVelocity(critter);
  }

  static wander(critter: Critter) {
    critter.velocity.x += (Math.random() - 0.5) * 1.5;
    critter.velocity.y += (Math.random() - 0.5) * 1.5;
    CreatureSystem.normalizeVelocity(critter);
  }
}