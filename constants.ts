export const WORLD_WIDTH = 4000;
export const WORLD_HEIGHT = 4000;

// Biome Config
export const BIOME_WATER_WIDTH = 1400; // Left side is ocean
export const BIOME_FOREST_WIDTH = 1000; // Middle section
// Scrub is the rest (WORLD_WIDTH - 1400 - 1000 = 1600)

export const BIOME_FOREST_FRICTION = 0.85; 
export const BIOME_SCRUB_FRICTION = 0.98;
export const BIOME_WATER_DRAG = 0.92; 

export const BIOME_WATER_GROWTH = 30.0; 
export const BIOME_FOREST_GROWTH = 0.13; 
export const BIOME_SCRUB_GROWTH = 0.039; 

export const INITIAL_POPULATION = 20; // Increased start
export const MAX_POPULATION = 800; // Increased cap for large world
export const MAX_FOOD = 2500; // Increased food cap

// Energy Physics
export const ENERGY_COST_MOVE_BASE = 0.02; 
export const ENERGY_COST_PER_LIMB = 0.005; 
export const ENERGY_COST_MOUTH_SIZE = 0.01;
export const ENERGY_COST_EXIST = 0.02; 
export const ENERGY_GAIN_FOOD = 70; 
export const ENERGY_GAIN_MEAT_MULTIPLIER = 1.0; 
export const STARTING_ENERGY = 120; 
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
  REPRO_THRESHOLD: { RATE: 0.2, VARIANCE: 0.15 } 
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
  amphibious: 0.0 
};