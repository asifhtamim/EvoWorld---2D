export interface Vector2 {
  x: number;
  y: number;
}

export interface Genome {
  speed: number;        // Base metabolic speed
  size: number;         // Body mass
  senseRadius: number;  // Vision
  reproThreshold: number; // Energy required to reproduce (Mutation parameter for Rate)
  color: string;        
  diet: number;         // 0.0 = Herbivore, 1.0 = Carnivore
  amphibious: number;   // 0.0 = Water specialized, 1.0 = Land specialized
  
  // Morphology
  limbCount: number;    // 0 to 8 (Legs or Fins)
  limbLength: number;   // Affects stride/speed
  mouthSize: number;    // Affects combat/eating speed
}

export interface Species {
  id: string;
  name: string;
  parentId: string | null;
  generation: number;
  color: string;
  count: number;
  extinct: boolean;
  firstAppearedAt: number;
}

export interface Critter {
  id: string;
  speciesId: string;
  position: Vector2;
  velocity: Vector2;
  energy: number;
  age: number;
  genome: Genome;
  state: 'wandering' | 'seeking_food' | 'fleeing' | 'hunting';
  targetId: string | null;
  heading: number; // For smooth rotation
}

export interface Food {
  id: string;
  position: Vector2;
  energyValue: number;
  age: number; // For growth mechanics
}

export interface SimulationStats {
  population: number;
  foodCount: number;
  speciesCount: number;
  time: number;
  fps: number;
}

export interface TreeNode {
  name: string;
  attributes?: {
    count: number;
    extinct: boolean;
    color: string;
  };
  children?: TreeNode[];
}