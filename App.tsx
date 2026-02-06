import React, { useState, useEffect, useRef, useCallback } from 'react';
import WorldCanvas from './components/WorldCanvas';
import StatsPanel from './components/StatsPanel';
import SpeciesTree from './components/SpeciesTree';
import { SimulationEngine } from './services/simulationEngine';
import { Species } from './types';
import { Play, Pause, RefreshCw, FastForward, Activity, Maximize2, Minimize2 } from 'lucide-react';

// --- Card Component ---
interface CardProps {
  id: string;
  title: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  maximizedId: string | null;
  onToggleMaximize: (id: string) => void;
}

const DashboardCard: React.FC<CardProps> = ({ 
  id, title, icon, children, className = "", maximizedId, onToggleMaximize 
}) => {
  const isMaximized = maximizedId === id;
  
  // Clean container class: No fixed positioning. Parent grid handles sizing.
  const containerClasses = `bg-gray-800 rounded-lg shadow-lg border border-gray-700 flex flex-col overflow-hidden relative transition-all duration-300 ${className}`;

  return (
    <div className={containerClasses}>
      <div className="flex items-center justify-between px-4 py-2 bg-gray-850 border-b border-gray-700 shrink-0 select-none">
         <div className="flex items-center gap-2 text-gray-300 font-bold text-xs uppercase tracking-wider">
            {icon}
            {title}
         </div>
         <button 
           onClick={() => onToggleMaximize(id)} 
           className="p-1 text-gray-500 hover:text-white transition rounded hover:bg-gray-700"
           title={isMaximized ? "Minimize" : "Maximize"}
         >
           {isMaximized ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
         </button>
      </div>
      <div className="flex-1 overflow-hidden relative w-full h-full">
        {children}
      </div>
    </div>
  );
};

// --- Main App ---

const App: React.FC = () => {
  const simulationRef = useRef<SimulationEngine>(new SimulationEngine());
  
  const [isPlaying, setIsPlaying] = useState(true);
  const [speed, setSpeed] = useState(1);
  const [, setTick] = useState(0); 
  
  const [statsHistory, setStatsHistory] = useState<{time: number, population: number, species: number}[]>([]);
  const [speciesSnapshot, setSpeciesSnapshot] = useState<Map<string, Species>>(new Map());
  
  // Fullscreen State
  const [maximizedId, setMaximizedId] = useState<string | null>(null);

  const toggleMaximize = (id: string) => {
    setMaximizedId(prev => prev === id ? null : id);
  };

  useEffect(() => {
    const interval = setInterval(() => {
      if (isPlaying) {
        const sim = simulationRef.current;
        setTick(t => t + 1);
        
        setStatsHistory(prev => {
           const newData = [...prev, {
             time: sim.time,
             population: sim.critters.length,
             species: sim.species.size
           }];
           if (newData.length > 50) return newData.slice(newData.length - 50);
           return newData;
        });

        setSpeciesSnapshot(new Map(sim.species));
      }
    }, 500); 

    return () => clearInterval(interval);
  }, [isPlaying]);

  const handleReset = useCallback(() => {
    simulationRef.current.reset();
    setStatsHistory([]);
    setSpeciesSnapshot(new Map());
    setTick(0);
  }, []);

  // --- Layout Helper Classes ---
  const anyMaximized = !!maximizedId;
  const isMaximized = (id: string) => maximizedId === id;

  // Grid Container Class
  const mainGridClass = `grid gap-4 flex-1 min-h-0 w-full transition-all duration-300 ${
    anyMaximized ? 'grid-cols-1 p-0' : 'grid-cols-1 lg:grid-cols-3 p-4'
  }`;

  // Left Column Wrapper (World + QuickStats)
  const leftWrapperClass = anyMaximized && !isMaximized('world') 
    ? 'hidden' 
    : `grid gap-4 min-h-0 ${anyMaximized ? 'h-full grid-rows-1' : 'lg:col-span-2 grid-rows-[1fr_auto]'}`;

  // Right Column Wrapper (Stats + Tree + Log)
  const rightWrapperClass = anyMaximized && !['stats', 'tree', 'log'].includes(maximizedId)
    ? 'hidden'
    : `grid gap-4 min-h-0 ${anyMaximized ? 'h-full grid-rows-1' : 'col-span-1 grid-rows-[minmax(200px,1fr)_minmax(300px,2fr)_minmax(150px,1fr)]'}`;

  // Item Visibility & Sizing
  const getItemClass = (id: string) => {
    if (anyMaximized) {
        return isMaximized(id) ? 'h-full w-full' : 'hidden';
    }
    return 'h-full w-full';
  };

  return (
    <div className="h-screen bg-gray-950 flex flex-col font-sans text-gray-100 overflow-hidden">
      {/* Header - Hidden when maximized for full immersion */}
      {!anyMaximized && (
        <header className="flex justify-between items-center p-4 pb-2 border-b border-gray-800 shrink-0 bg-gray-950 z-10">
          <div>
            <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-green-400 to-blue-500">
              EvoWorld 2D
            </h1>
          </div>
          
          <div className="flex gap-2 bg-gray-900 p-1 rounded-lg border border-gray-800">
              <button
                  onClick={() => setIsPlaying(!isPlaying)}
                  className={`p-2 rounded hover:bg-gray-700 transition ${isPlaying ? 'text-yellow-400' : 'text-green-400'}`}
                  title={isPlaying ? "Pause" : "Play"}
              >
                {isPlaying ? <Pause size={18} /> : <Play size={18} />}
              </button>
              
              <button
                  onClick={() => setSpeed(s => s === 1 ? 2 : s === 2 ? 5 : 1)}
                  className="p-2 rounded hover:bg-gray-700 text-blue-400 transition flex items-center gap-1 font-mono text-xs w-16 justify-center"
              >
                  <FastForward size={18} />
                  <span>{speed}x</span>
              </button>

              <div className="w-px bg-gray-700 mx-1"></div>

              <button 
                  onClick={handleReset}
                  className="p-2 rounded hover:bg-red-900/50 text-red-400 transition"
                  title="Reset World"
              >
                  <RefreshCw size={18} />
              </button>
          </div>
        </header>
      )}

      {/* Main Grid Layout */}
      <main className={mainGridClass}>
        
        {/* Left Wrapper */}
        <div className={leftWrapperClass}>
            <DashboardCard 
              id="world" 
              title="Simulation View" 
              maximizedId={maximizedId} 
              onToggleMaximize={toggleMaximize}
              className={getItemClass('world')}
            >
              <WorldCanvas 
                  simulation={simulationRef.current} 
                  speedMultiplier={isPlaying ? speed : 0} 
              />
            </DashboardCard>

            {/* Quick Stats - Hidden if anything is maximized */}
            {!anyMaximized && (
              <div className="grid grid-cols-4 gap-4 h-24 shrink-0">
                  <div className="bg-gray-800 p-3 rounded border border-gray-700 flex flex-col justify-center">
                      <div className="text-gray-500 text-[10px] uppercase font-bold">Time</div>
                      <div className="text-xl font-mono">{simulationRef.current.time}</div>
                  </div>
                  <div className="bg-gray-800 p-3 rounded border border-gray-700 flex flex-col justify-center">
                      <div className="text-gray-500 text-[10px] uppercase font-bold">Population</div>
                      <div className="text-xl font-mono text-green-400">{simulationRef.current.critters.length}</div>
                  </div>
                  <div className="bg-gray-800 p-3 rounded border border-gray-700 flex flex-col justify-center">
                      <div className="text-gray-500 text-[10px] uppercase font-bold">Species</div>
                      <div className="text-xl font-mono text-blue-400">
                          {Array.from(simulationRef.current.species.values()).filter(s => !s.extinct).length}
                      </div>
                  </div>
                  <div className="bg-gray-800 p-3 rounded border border-gray-700 flex flex-col justify-center">
                      <div className="text-gray-500 text-[10px] uppercase font-bold">Extinct</div>
                      <div className="text-xl font-mono text-red-400">
                          {Array.from(simulationRef.current.species.values()).filter(s => s.extinct).length}
                      </div>
                  </div>
              </div>
            )}
        </div>

        {/* Right Wrapper */}
        <div className={rightWrapperClass}>
            
            <DashboardCard 
              id="stats" 
              title="Population History" 
              maximizedId={maximizedId} 
              onToggleMaximize={toggleMaximize}
              className={getItemClass('stats')}
            >
               <StatsPanel data={statsHistory} />
            </DashboardCard>

            <DashboardCard 
              id="tree" 
              title="Evolutionary Tree" 
              maximizedId={maximizedId} 
              onToggleMaximize={toggleMaximize}
              className={getItemClass('tree')}
            >
              <SpeciesTree speciesMap={speciesSnapshot} />
            </DashboardCard>
            
            <DashboardCard 
              id="log" 
              title="Simulation Log" 
              icon={<Activity size={14} />}
              maximizedId={maximizedId} 
              onToggleMaximize={toggleMaximize}
              className={getItemClass('log')}
            >
              <div className="h-full p-4 overflow-y-auto font-mono text-xs space-y-1 bg-gray-900 scrollbar-thin scrollbar-thumb-gray-700">
                  <p className="text-yellow-500">[System] Simulation initialized.</p>
                  <p className="text-gray-500">[Info] Species Primus started with 1 pair.</p>
                  {Array.from(speciesSnapshot.values()).slice(-20).reverse().map(s => (
                      <p key={s.id}>
                          <span style={{color: s.color}}>●</span> New Branch: {s.name} (Gen {s.generation})
                      </p>
                  ))}
              </div>
            </DashboardCard>

        </div>

      </main>
    </div>
  );
};

export default App;