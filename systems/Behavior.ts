import { Critter, Food, Vector2 } from '../types';
import { CreatureSystem } from './Creature';

export class BehaviorSystem {
  
  static think(critter: Critter, neighbors: Critter[], food: Food[], time: number) {
    const g = critter.genome;
    const isCarnivore = g.diet > 0.5;

    // --- 1. Identify Context ---
    let nearestPredator: Critter | null = null;
    let nearestPrey: Critter | null = null;
    let nearestFood: Food | null = null;
    let predatorDist = Infinity;
    let preyDist = Infinity;
    let foodDist = Infinity;

    // Scan Neighbors (Predators & Prey)
    for (const other of neighbors) {
        if (other.id === critter.id) continue;
        const d = CreatureSystem.dist(critter.position, other.position);
        if (d > g.senseRadius) continue;

        // Check for Predator
        if (!isCarnivore || (other.genome.size > g.size * 1.5)) {
            if (other.genome.diet > 0.5 && other.genome.size >= g.size * 0.8) {
                if (d < predatorDist) {
                    predatorDist = d;
                    nearestPredator = other;
                }
            }
        }

        // Check for Prey (Only if Carnivore)
        if (isCarnivore && other.speciesId !== critter.speciesId) {
             const preyDefenseFactor = 1 + (other.genome.defense || 0); 
             const preyEffectiveSize = other.genome.size * preyDefenseFactor;
             const combatAdvantage = (g.size + g.mouthSize * 2) > (preyEffectiveSize);
             
             if (combatAdvantage && d < preyDist) {
                 preyDist = d;
                 nearestPrey = other;
             }
        }
    }

    // Scan Food (Only if Herbivore)
    if (!isCarnivore) {
        for (const f of food) {
            if (f.energyValue <= 0) continue;
            const d = CreatureSystem.dist(critter.position, f.position);
            if (d < foodDist && d < g.senseRadius) {
                foodDist = d;
                nearestFood = f;
            }
        }
    }

    // --- 2. Calculate Utility Scores ---
    
    // Fear (Overrides everything)
    const fearScore = nearestPredator ? 1.0 - (predatorDist / g.senseRadius) : 0;
    
    // Hunger (0 to 1)
    const hungerScore = Math.max(0, 1 - (critter.energy / g.reproThreshold)); // As energy drops, hunger rises

    // Fatigue (Low energy but safe)
    const fatigueScore = (critter.energy < g.reproThreshold * 0.3) ? 0.8 : 0.0;

    // --- 3. Arbitrate Decision (Mutate Critter directly) ---

    // Set next think time (randomize to spread load)
    critter.nextThinkTime = time + 5 + Math.random() * 10;

    // High Danger -> Flee
    if (fearScore > 0.6 && nearestPredator) {
        critter.state = 'fleeing';
        critter.targetId = nearestPredator.id;
        critter.targetPosition = nearestPredator.position;
        return;
    }

    // High Hunger -> Eat
    if (hungerScore > 0.4) {
        if (isCarnivore && nearestPrey) {
            critter.state = 'hunting';
            critter.targetId = nearestPrey.id;
            critter.targetPosition = nearestPrey.position; // Initial fix, tracked in engine
            return;
        } 
        if (!isCarnivore && nearestFood) {
            critter.state = 'seeking_food';
            critter.targetId = nearestFood.id;
            critter.targetPosition = nearestFood.position;
            return;
        }
    }

    // Tired & Safe -> Rest
    if (fatigueScore > 0.5 && !nearestPredator) {
        critter.state = 'resting';
        critter.targetId = null;
        critter.targetPosition = null;
        return;
    }

    // Default -> Wander
    if (critter.state !== 'wandering') {
        critter.state = 'wandering';
        critter.targetId = null;
        critter.targetPosition = null;
    }
  }
}