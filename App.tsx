import React, { useState, useEffect, useRef, useCallback } from 'react';
import WorldCanvas from './components/WorldCanvas';
import StatsPanel from './components/StatsPanel';
import SpeciesTree from './components/SpeciesTree';
import { SimulationEngine } from './services/simulationEngine';
import { SimulationStats, Species } from './types';
import { Play, Pause, RefreshCw, FastForward, Activity } from 'lucide-react';

const App: React.FC = () => {
  // UseRef for the engine so it persists across renders without triggering them itself
  const simulationRef = useRef<SimulationEngine>(new SimulationEngine());
  
  const [isPlaying, setIsPlaying] = useState(true);
  const [speed, setSpeed] = useState(1);
  const [tick, setTick] = useState(0); // Used to force UI updates
  
  // History for charts
  const [statsHistory, setStatsHistory] = useState<{time: number, population: number, species: number}[]>([]);
  // Species snapshot for tree
  const [speciesSnapshot, setSpeciesSnapshot] = useState<Map<string, Species>>(new Map());

  // UI Loop (runs slower than game loop)
  useEffect(() => {
    const interval = setInterval(() => {
      if (isPlaying) {
        const sim = simulationRef.current;
        setTick(t => t + 1);
        
        // Update Chart Data (limit to last 50 points)
        setStatsHistory(prev => {
           const newData = [...prev, {
             time: sim.time,
             population: sim.critters.length,
             species: sim.species.size
           }];
           if (newData.length > 50) return newData.slice(newData.length - 50);
           return newData;
        });

        // Update Species Tree Snapshot
        setSpeciesSnapshot(new Map(sim.species));
      }
    }, 500); // Update UI every 500ms

    return () => clearInterval(interval);
  }, [isPlaying]);

  const handleReset = useCallback(() => {
    simulationRef.current.reset();
    setStatsHistory([]);
    setSpeciesSnapshot(new Map());
    setTick(0);
  }, []);

  return (
    <div className="min-h-screen bg-gray-950 p-6 flex flex-col gap-6 font-sans text-gray-100">
      {/* Header */}
      <header className="flex justify-between items-center pb-4 border-b border-gray-800">
        <div>
          <h1 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-green-400 to-blue-500">
            EvoWorld 2D
          </h1>
          <p className="text-gray-400 text-sm mt-1">
            Artificial Life Simulation • Genetic Branching • Survival of the Fittest
          </p>
        </div>
        
        <div className="flex gap-3 bg-gray-900 p-2 rounded-lg border border-gray-800">
             <button
                onClick={() => setIsPlaying(!isPlaying)}
                className={`p-2 rounded hover:bg-gray-700 transition ${isPlaying ? 'text-yellow-400' : 'text-green-400'}`}
                title={isPlaying ? "Pause" : "Play"}
             >
               {isPlaying ? <Pause size={20} /> : <Play size={20} />}
             </button>
             
             <button
                onClick={() => setSpeed(s => s === 1 ? 2 : s === 2 ? 5 : 1)}
                className="p-2 rounded hover:bg-gray-700 text-blue-400 transition flex items-center gap-1 font-mono text-sm"
                title="Simulation Speed"
             >
                <FastForward size={20} />
                <span>{speed}x</span>
             </button>

             <div className="w-px bg-gray-700 mx-1"></div>

             <button 
                onClick={handleReset}
                className="p-2 rounded hover:bg-red-900/50 text-red-400 transition"
                title="Reset World"
             >
                <RefreshCw size={20} />
             </button>
        </div>
      </header>

      {/* Main Content Grid */}
      <main className="grid grid-cols-1 lg:grid-cols-3 gap-6 flex-1">
        
        {/* Left Col: The World */}
        <div className="lg:col-span-2 flex flex-col gap-4">
            <WorldCanvas 
                simulation={simulationRef.current} 
                speedMultiplier={isPlaying ? speed : 0} 
            />
            
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="bg-gray-900 p-3 rounded border border-gray-800">
                    <div className="text-gray-500 text-xs uppercase font-bold">Time</div>
                    <div className="text-xl font-mono">{simulationRef.current.time}</div>
                </div>
                <div className="bg-gray-900 p-3 rounded border border-gray-800">
                    <div className="text-gray-500 text-xs uppercase font-bold">Population</div>
                    <div className="text-xl font-mono text-green-400">{simulationRef.current.critters.length}</div>
                </div>
                <div className="bg-gray-900 p-3 rounded border border-gray-800">
                    <div className="text-gray-500 text-xs uppercase font-bold">Active Species</div>
                    <div className="text-xl font-mono text-blue-400">
                        {Array.from(simulationRef.current.species.values()).filter(s => !s.extinct).length}
                    </div>
                </div>
                <div className="bg-gray-900 p-3 rounded border border-gray-800">
                    <div className="text-gray-500 text-xs uppercase font-bold">Extinct</div>
                    <div className="text-xl font-mono text-red-400">
                        {Array.from(simulationRef.current.species.values()).filter(s => s.extinct).length}
                    </div>
                </div>
            </div>
        </div>

        {/* Right Col: Stats & Tree */}
        <div className="flex flex-col gap-6 h-full">
            <StatsPanel data={statsHistory} />
            <SpeciesTree speciesMap={speciesSnapshot} />
            
            <div className="bg-gray-800 p-4 rounded-lg shadow-lg text-sm text-gray-300">
                <h3 className="flex items-center gap-2 font-bold text-white mb-2">
                    <Activity size={16} />
                    Simulation Log
                </h3>
                <div className="h-32 overflow-y-auto font-mono text-xs space-y-1 pr-2 scrollbar-thin scrollbar-thumb-gray-600">
                    <p className="text-yellow-500">[System] Simulation initialized.</p>
                    <p className="text-gray-500">[Info] Species Primus started with 1 pair.</p>
                    {Array.from(speciesSnapshot.values()).slice(-5).reverse().map(s => (
                        <p key={s.id}>
                            <span style={{color: s.color}}>●</span> New Branch: {s.name} (Gen {s.generation})
                        </p>
                    ))}
                </div>
            </div>
        </div>

      </main>
    </div>
  );
};

export default App;