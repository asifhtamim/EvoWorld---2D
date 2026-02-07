
import { Genome, Species, Critter } from '../types';
import * as Constants from '../constants';

export class GeneticSystem {
  static mutate(val: number, cfg: any, min: number = 0.1): { value: number, change: number } {
    if (Math.random() < cfg.RATE) {
        const change = (Math.random() * 2 - 1) * cfg.VARIANCE;
        return { value: Math.max(min, val * (1 + change)), change: Math.abs(change) };
    }
    return { value: val, change: 0 };
  }

  static createOffspring(parent: Critter, speciesMap: Map<string, Species>, time: number, getNextId: () => string): { genome: Genome, speciesId: string, newSpecies?: Species } {
    const newGenome: Genome = { ...parent.genome };
    let mutationMetric = 0;
    const C = Constants.MUTATION_CONFIG;

    // Numerical Mutations
    const mSpeed = this.mutate(newGenome.speed, C.SPEED);
    newGenome.speed = mSpeed.value; mutationMetric += mSpeed.change;

    const mSize = this.mutate(newGenome.size, C.SIZE, 3);
    newGenome.size = mSize.value; mutationMetric += mSize.change;

    const mSense = this.mutate(newGenome.senseRadius, C.SENSE, 20);
    newGenome.senseRadius = mSense.value; mutationMetric += mSense.change;

    const mLimbL = this.mutate(newGenome.limbLength, C.LIMB_LENGTH, 1);
    newGenome.limbLength = mLimbL.value; mutationMetric += mLimbL.change;

    const mMouth = this.mutate(newGenome.mouthSize, C.MOUTH_SIZE, 1);
    newGenome.mouthSize = mMouth.value; mutationMetric += mMouth.change;

    const mRepro = this.mutate(newGenome.reproThreshold, C.REPRO_THRESHOLD, 50);
    newGenome.reproThreshold = mRepro.value; mutationMetric += mRepro.change;

    // Defense Mutation
    if (Math.random() < C.DEFENSE.RATE) {
        const change = (Math.random() * 2 - 1) * C.DEFENSE.VARIANCE;
        newGenome.defense = Math.max(0, Math.min(1.0, (newGenome.defense || 0) + change));
        mutationMetric += Math.abs(change) * 2;
    }

    // Amphibious Mutation
    if (Math.random() < C.AMPHIBIOUS.RATE) {
         const change = (Math.random() * 2 - 1) * C.AMPHIBIOUS.VARIANCE;
         newGenome.amphibious = Math.max(0, Math.min(1, newGenome.amphibious + change));
         mutationMetric += Math.abs(change) * 3; 
    }

    // Structural Mutation (Limb Count)
    if (Math.random() < C.LIMB_COUNT.RATE) {
        const change = Math.random() < 0.5 ? -1 : 1;
        newGenome.limbCount = Math.max(0, Math.min(8, newGenome.limbCount + change));
        mutationMetric += 0.2; 
    }

    // Diet Mutation
    if (Math.random() < C.DIET.RATE) {
        const change = (Math.random() * 2 - 1) * C.DIET.VARIANCE;
        newGenome.diet = Math.max(0, Math.min(1, newGenome.diet + change));
        mutationMetric += Math.abs(change) * 2;
    }

    // Color Mutation
    let h = 200, s = 70, l = 50;
    const hslMatch = parent.genome.color.match(/hsl\((\d+),\s*(\d+)%,\s*(\d+)%\)/);
    if (hslMatch) {
      h = parseInt(hslMatch[1]); s = parseInt(hslMatch[2]); l = parseInt(hslMatch[3]);
    }
    h = (h + (Math.random() * 6 - 3) + 360) % 360;

    // Speciation Check
    let childSpeciesId = parent.speciesId;
    let newSpecies: Species | undefined;

    if (mutationMetric > Constants.SPECIATION_THRESHOLD) {
      const parentSpecies = speciesMap.get(parent.speciesId);
      const suffix = getNextId(); 
      const newSpeciesId = `species_${suffix}`;
      h = (h + 30) % 360; 
      
      newSpecies = {
        id: newSpeciesId,
        name: `Gen ${suffix.toUpperCase()}`,
        parentId: parentSpecies ? parentSpecies.id : null,
        generation: (parentSpecies ? parentSpecies.generation : 0) + 1,
        color: `hsl(${Math.round(h)}, ${s}%, ${l}%)`,
        count: 0,
        extinct: false,
        firstAppearedAt: time
      };
      
      speciesMap.set(newSpeciesId, newSpecies);
      childSpeciesId = newSpeciesId;
    }
    
    newGenome.color = `hsl(${Math.round(h)}, ${s}%, ${l}%)`;
    return { genome: newGenome, speciesId: childSpeciesId, newSpecies };
  }

  static applyDrift(critter: Critter) {
    // Disabled drift for now - mutations only occur at reproduction
    /*
    if (Math.random() > Constants.GENETIC_DRIFT_RATE) return;
    const drift = () => 1 + ((Math.random() * 2 - 1) * Constants.GENETIC_DRIFT_SCALE);
    critter.genome.speed *= drift();
    critter.genome.size *= drift();
    */
  }
}
