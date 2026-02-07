export const WORLD_WIDTH = 4000;
export const WORLD_HEIGHT = 4000;

// Optimization Grid
export const GRID_CELL_SIZE = 100;
export const GRID_COLS = Math.ceil(WORLD_WIDTH / GRID_CELL_SIZE);
export const GRID_ROWS = Math.ceil(WORLD_HEIGHT / GRID_CELL_SIZE);

// Terrain & Biome Thresholds (0.0 to 1.0)
export const TERRAIN_SEED = Math.random();
export const TERRAIN_SCALE = 0.0015; // Controls zoom of noise

export const BIOME_THRESHOLDS = {
    DEEP_OCEAN: 0.25,
    OCEAN: 0.45,
    BEACH: 0.50,
    MOUNTAIN: 0.85
};

// Physics Config
export const FRICTION_WATER = 0.92;
export const FRICTION_LAND = 0.85;
export const FRICTION_MOUNTAIN = 0.60; // Hard to move
export const FRICTION_SWAMP = 0.70;

// Growth Rates
export const BIOME_GROWTH_WATER = 200.0; 
export const BIOME_GROWTH_PLAINS = 8.0; 
export const BIOME_GROWTH_FOREST = 25.0; 

export const INITIAL_POPULATION = 60; 
export const MAX_POPULATION = 1500; 
export const MAX_FOOD = 35000; 

// Energy Physics
export const ENERGY_COST_MOVE_BASE = 0.02; 
export const ENERGY_COST_PER_LIMB = 0.005; 
export const ENERGY_COST_MOUTH_SIZE = 0.01;
export const ENERGY_COST_EXIST = 0.02; 
export const ENERGY_COST_DEFENSE = 0.03; 
export const ENERGY_COST_RESTING_MULTIPLIER = 0.3; 

export const ENERGY_GAIN_FOOD = 100; 
export const ENERGY_GAIN_MEAT_MULTIPLIER = 1.0; 
export const STARTING_ENERGY = 300; 
export const SUFFOCATION_PENALTY = 0.5; 

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
  REPRO_THRESHOLD: { RATE: 0.2, VARIANCE: 0.15 },
  DEFENSE: { RATE: 0.15, VARIANCE: 0.25 } 
};

export const BASE_GENOME = {
  speed: 2.0,         
  size: 8,
  senseRadius: 100, 
  reproThreshold: 150, 
  color: 'hsl(200, 70%, 50%)', 
  diet: 0,
  limbCount: 2, 
  limbLength: 5,
  mouthSize: 3,
  amphibious: 0.0,
  defense: 0.0
};

// God Tools
export const METEOR_RADIUS = 200;
export const FEED_RADIUS = 100;
export const FEED_AMOUNT = 20;