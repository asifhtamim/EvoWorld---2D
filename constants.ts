export const WORLD_WIDTH = 800;
export const WORLD_HEIGHT = 600;

// Biome Config
export const BIOME_WATER_WIDTH = 250; // Left side is ocean
// Land starts after water. We keep the old Forest/Scrub split within the land area if we want, 
// or simpler: Water -> Land Transition.
// Let's do: Water (0-250) | Land (250-800)
// Within Land: Forest (250-550) | Scrub (550-800)

export const BIOME_FOREST_FRICTION = 0.85; 
export const BIOME_SCRUB_FRICTION = 0.98;
export const BIOME_WATER_DRAG = 0.92; // Slightly less drag for adapted creatures

export const BIOME_WATER_GROWTH = 0.15; // Algae grows fast
export const BIOME_FOREST_GROWTH = 0.10;   
export const BIOME_SCRUB_GROWTH = 0.03;    

export const INITIAL_POPULATION = 6;
export const MAX_POPULATION = 120; 
export const MAX_FOOD = 450; 

// Energy Physics
export const ENERGY_COST_MOVE_BASE = 0.02; // Increased to make efficiency matter more
export const ENERGY_COST_PER_LIMB = 0.005; 
export const ENERGY_COST_MOUTH_SIZE = 0.01;
export const ENERGY_COST_EXIST = 0.02; 
export const ENERGY_GAIN_FOOD = 70; // Slightly higher to compensate for movement cost
export const ENERGY_GAIN_MEAT_MULTIPLIER = 1.0; 
export const STARTING_ENERGY = 120; 
export const SUFFOCATION_PENALTY = 0.5; // High penalty for wrong biome

export const SPECIATION_THRESHOLD = 0.5; 

// Genetic Drift
export const GENETIC_DRIFT_RATE = 0.1; 
export const GENETIC_DRIFT_SCALE = 0.005; 

// Mutation Config
export const MUTATION_CONFIG = {
  SPEED: { RATE: 0.2, VARIANCE: 0.1 }, 
  SIZE: { RATE: 0.2, VARIANCE: 0.1 }, 
  SENSE: { RATE: 0.2, VARIANCE: 0.1 }, 
  DIET: { RATE: 0.20, VARIANCE: 0.25 }, 
  COLOR: { RATE: 0.1, SHIFT: 20 },
  LIMB_COUNT: { RATE: 0.15, VARIANCE: 1 }, 
  LIMB_LENGTH: { RATE: 0.2, VARIANCE: 0.2 },
  MOUTH_SIZE: { RATE: 0.2, VARIANCE: 0.2 },
  AMPHIBIOUS: { RATE: 0.20, VARIANCE: 0.15 },
  REPRO_THRESHOLD: { RATE: 0.2, VARIANCE: 0.15 } // New param: Affects reproduction rate
};

export const BASE_GENOME = {
  speed: 2.0,         
  size: 8,
  senseRadius: 100, 
  reproThreshold: 150, // Lower = Faster Reproduction
  color: 'hsl(200, 70%, 50%)', // Blue-ish start for aquatic life
  diet: 0,
  limbCount: 2, // Starts as Fins essentially
  limbLength: 5,
  mouthSize: 3,
  amphibious: 0.0 // Starts as fully Aquatic
};