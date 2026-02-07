import React, { useState, useEffect, useRef, useCallback } from 'react';
import WorldCanvas from './components/WorldCanvas';
import StatsPanel from './components/StatsPanel';
import SpeciesTree from './components/SpeciesTree';
import { SimulationEngine } from './services/simulationEngine';
import { Species, ToolMode, Critter } from './types';
import { Play, Pause, RefreshCw, FastForward, Activity, Maximize2, Minimize2, Search, Crosshair, Zap, CloudLightning } from 'lucide-react';

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

interface LogEntry {
    id: number;
    message: string;
    type?: string;
    color?: string;
}

const App: React.FC = () => {
  // Use state initializer to ensure SimulationEngine is only created once.
  // Passing 'new SimulationEngine()' directly to useRef would execute the constructor on every render,
  // causing the TerrainSystem to reset (and terrain to flicker/change) repeatedly.
  const [simulationInstance] = useState(() => new SimulationEngine());
  const simulationRef = useRef<SimulationEngine>(simulationInstance);
  
  const [isPlaying, setIsPlaying] = useState(true);
  const [speed, setSpeed] = useState(1);
  const [activeTool, setActiveTool] = useState<ToolMode>('inspect');
  
  const [statsHistory, setStatsHistory] = useState<{time: number, population: number, species: number}[]>([]);
  const [speciesSnapshot, setSpeciesSnapshot] = useState<Map<string, Species>>(new Map());
  const [logs, setLogs] = useState<LogEntry[]>([]);
  
  // HUD & Inspector Stats
  const [hudStats, setHudStats] = useState({ time: 0, population: 0, species: 0, extinct: 0 });
  const [selectedCritter, setSelectedCritter] = useState<Critter | null>(null);

  // Fullscreen State
  const [maximizedId, setMaximizedId] = useState<string | null>(null);

  const toggleMaximize = (id: string) => {
    setMaximizedId(prev => prev === id ? null : id);
  };

  const addLog = useCallback((msg: string, type?: string, color?: string) => {
      setLogs(prev => {
          const newLog = { id: Date.now() + Math.random(), message: msg, type, color };
          return [newLog, ...prev].slice(0, 50);
      });
  }, []);

  // Event Subscriptions
  useEffect(() => {
      const sim = simulationRef.current;
      const events = sim.events;

      // Stats Update
      const unsubStats = events.on('STATS_UPDATE', (data: any) => {
          setHudStats({
              time: data.time,
              population: data.population,
              species: data.speciesCount,
              extinct: data.extinctCount 
          });

          setStatsHistory(prev => {
            const newData = [...prev, {
                time: data.time,
                population: data.population,
                species: data.speciesCount
            }];
            if (newData.length > 50) return newData.slice(newData.length - 50);
            return newData;
          });
          
          setSpeciesSnapshot(new Map(sim.species));

          // If selected, refresh its data reference
          if (sim.selectedCritterId) {
             const freshRef = sim.getSelectedCritter();
             if (freshRef) setSelectedCritter({...freshRef}); // copy to trigger react render
             else setSelectedCritter(null);
          }
      });

      const unsubSelection = events.on('SELECTION_CHANGED', (id: string | null) => {
          if (!id) setSelectedCritter(null);
          else {
              const c = sim.getSelectedCritter();
              if (c) setSelectedCritter({...c});
          }
      });

      const unsubLog = events.on('LOG', (data: any) => {
          addLog(data.message, data.type, data.color);
      });

      return () => {
          unsubStats();
          unsubLog();
          unsubSelection();
      };
  }, [addLog]);

  const handleReset = useCallback(() => {
    simulationRef.current.reset();
    setStatsHistory([]);
    setSpeciesSnapshot(new Map());
    setLogs([]);
    setHudStats({ time: 0, population: 0, species: 0, extinct: 0 });
    setSelectedCritter(null);
  }, []);

  // Layout Helper Classes
  const anyMaximized = !!maximizedId;
  const isMaximized = (id: string) => maximizedId === id;
  const mainGridClass = `grid gap-4 flex-1 min-h-0 w-full transition-all duration-300 ${
    anyMaximized ? 'grid-cols-1 p-0' : 'grid-cols-1 lg:grid-cols-3 p-4'
  }`;
  const leftWrapperClass = anyMaximized && !isMaximized('world') 
    ? 'hidden' 
    : `grid gap-4 min-h-0 ${anyMaximized ? 'h-full grid-rows-1' : 'lg:col-span-2 grid-rows-[1fr_auto]'}`;
  const rightWrapperClass = anyMaximized && !['stats', 'tree', 'log', 'inspector'].includes(maximizedId)
    ? 'hidden'
    : `grid gap-4 min-h-0 ${anyMaximized ? 'h-full grid-rows-1' : 'col-span-1 grid-rows-[minmax(200px,1fr)_minmax(300px,2fr)_minmax(150px,1fr)]'}`;
  const getItemClass = (id: string) => anyMaximized ? (isMaximized(id) ? 'h-full w-full' : 'hidden') : 'h-full w-full';

  return (
    <div className="h-screen bg-gray-950 flex flex-col font-sans text-gray-100 overflow-hidden">
      {!anyMaximized && (
        <header className="flex justify-between items-center p-4 pb-2 border-b border-gray-800 shrink-0 bg-gray-950 z-10">
          <div>
            <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-green-400 to-blue-500">
              EvoWorld 2D
            </h1>
          </div>
          
          {/* Tool Selector */}
          <div className="flex gap-1 bg-gray-900 p-1 rounded-lg border border-gray-800 mx-4">
              <button onClick={() => setActiveTool('inspect')} className={`p-2 rounded flex gap-2 items-center ${activeTool === 'inspect' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'}`}>
                  <Search size={16} /> <span className="text-xs font-bold hidden md:block">Inspect</span>
              </button>
              <button onClick={() => setActiveTool('feed')} className={`p-2 rounded flex gap-2 items-center ${activeTool === 'feed' ? 'bg-green-600 text-white' : 'text-gray-400 hover:text-white'}`}>
                  <Crosshair size={16} /> <span className="text-xs font-bold hidden md:block">Feed</span>
              </button>
              <button onClick={() => setActiveTool('smite')} className={`p-2 rounded flex gap-2 items-center ${activeTool === 'smite' ? 'bg-red-600 text-white' : 'text-gray-400 hover:text-white'}`}>
                  <Zap size={16} /> <span className="text-xs font-bold hidden md:block">Smite</span>
              </button>
              <button onClick={() => setActiveTool('meteor')} className={`p-2 rounded flex gap-2 items-center ${activeTool === 'meteor' ? 'bg-orange-600 text-white' : 'text-gray-400 hover:text-white'}`}>
                  <CloudLightning size={16} /> <span className="text-xs font-bold hidden md:block">Meteor</span>
              </button>
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
              <button onClick={handleReset} className="p-2 rounded hover:bg-red-900/50 text-red-400 transition">
                  <RefreshCw size={18} />
              </button>
          </div>
        </header>
      )}

      <main className={mainGridClass}>
        <div className={leftWrapperClass}>
            <DashboardCard 
              id="world" 
              title={`Simulation View [Tool: ${activeTool.toUpperCase()}]`} 
              maximizedId={maximizedId} 
              onToggleMaximize={toggleMaximize}
              className={getItemClass('world')}
            >
              <WorldCanvas simulation={simulationRef.current} speedMultiplier={isPlaying ? speed : 0} activeTool={activeTool} />
            </DashboardCard>

            {!anyMaximized && (
              <div className="grid grid-cols-4 gap-4 h-24 shrink-0">
                  <div className="bg-gray-800 p-3 rounded border border-gray-700 flex flex-col justify-center">
                      <div className="text-gray-500 text-[10px] uppercase font-bold">Time</div>
                      <div className="text-xl font-mono">{hudStats.time}</div>
                  </div>
                  <div className="bg-gray-800 p-3 rounded border border-gray-700 flex flex-col justify-center">
                      <div className="text-gray-500 text-[10px] uppercase font-bold">Population</div>
                      <div className="text-xl font-mono text-green-400">{hudStats.population}</div>
                  </div>
                  <div className="bg-gray-800 p-3 rounded border border-gray-700 flex flex-col justify-center">
                      <div className="text-gray-500 text-[10px] uppercase font-bold">Species</div>
                      <div className="text-xl font-mono text-blue-400">{hudStats.species}</div>
                  </div>
                  <div className="bg-gray-800 p-3 rounded border border-gray-700 flex flex-col justify-center">
                      <div className="text-gray-500 text-[10px] uppercase font-bold">Extinct</div>
                      <div className="text-xl font-mono text-red-400">
                          {Array.from(simulationRef.current.species.values()).filter((s: Species) => s.extinct).length}
                      </div>
                  </div>
              </div>
            )}
        </div>

        <div className={rightWrapperClass}>
            {/* Inspector Panel - Replaces Stats if something is selected, or sits on top */}
            {selectedCritter ? (
                <div className="bg-gray-800 rounded-lg shadow-lg border border-gray-600 flex flex-col p-4 animate-in fade-in slide-in-from-right-4 duration-200">
                    <div className="flex justify-between items-start mb-4">
                        <div>
                            <h2 className="text-lg font-bold text-white flex items-center gap-2">
                                <span className="w-3 h-3 rounded-full inline-block" style={{background: selectedCritter.genome.color}}></span>
                                {simulationRef.current.species.get(selectedCritter.speciesId)?.name || 'Unknown'}
                            </h2>
                            <div className="text-xs text-gray-400 font-mono">{selectedCritter.id}</div>
                        </div>
                        <button onClick={() => { 
                            simulationRef.current.selectedCritterId = null; 
                            setSelectedCritter(null); 
                        }} className="text-gray-500 hover:text-white">✕</button>
                    </div>
                    
                    <div className="space-y-3 text-sm">
                        <div className="grid grid-cols-2 gap-2">
                            <div className="bg-gray-900 p-2 rounded">
                                <div className="text-[10px] text-gray-500 uppercase">State</div>
                                <div className={`font-bold capitalize ${selectedCritter.state === 'fleeing' ? 'text-red-400' : selectedCritter.state === 'resting' ? 'text-blue-300' : 'text-gray-200'}`}>
                                    {selectedCritter.state.replace('_', ' ')}
                                </div>
                            </div>
                            <div className="bg-gray-900 p-2 rounded">
                                <div className="text-[10px] text-gray-500 uppercase">Age</div>
                                <div className="font-mono">{selectedCritter.age} ticks</div>
                            </div>
                        </div>

                        <div>
                            <div className="flex justify-between text-xs mb-1">
                                <span>Energy</span>
                                <span>{Math.round(selectedCritter.energy)} / {Math.round(selectedCritter.genome.reproThreshold * 2)}</span>
                            </div>
                            <div className="w-full bg-gray-700 h-2 rounded-full overflow-hidden">
                                <div 
                                    className="bg-green-500 h-full transition-all duration-300" 
                                    style={{width: `${Math.min(100, (selectedCritter.energy / (selectedCritter.genome.reproThreshold * 1.5)) * 100)}%`}}
                                ></div>
                            </div>
                        </div>

                        <div className="pt-2 border-t border-gray-700">
                            <div className="text-[10px] text-gray-500 uppercase mb-2 font-bold">Genome</div>
                            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-gray-300">
                                <div className="flex justify-between"><span>Diet:</span> <span className={selectedCritter.genome.diet > 0.5 ? "text-red-400" : "text-green-400"}>{selectedCritter.genome.diet > 0.5 ? "Carnivore" : "Herbivore"}</span></div>
                                <div className="flex justify-between"><span>Size:</span> <span>{selectedCritter.genome.size.toFixed(1)}</span></div>
                                <div className="flex justify-between"><span>Speed:</span> <span>{selectedCritter.genome.speed.toFixed(1)}</span></div>
                                <div className="flex justify-between"><span>Vision:</span> <span>{selectedCritter.genome.senseRadius.toFixed(0)}</span></div>
                                <div className="flex justify-between"><span>Defense:</span> <span>{(selectedCritter.genome.defense * 100).toFixed(0)}%</span></div>
                                <div className="flex justify-between"><span>Limbs:</span> <span>{selectedCritter.genome.limbCount}</span></div>
                            </div>
                        </div>
                    </div>
                </div>
            ) : (
                <DashboardCard 
                id="stats" 
                title="Population History" 
                maximizedId={maximizedId} 
                onToggleMaximize={toggleMaximize}
                className={getItemClass('stats')}
                >
                <StatsPanel data={statsHistory} />
                </DashboardCard>
            )}

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
                  {logs.length === 0 && <p className="text-gray-600 italic">Waiting for events...</p>}
                  {logs.map((log) => (
                      <p key={log.id}>
                          {log.color && <span style={{color: log.color}}>● </span>}
                          <span className={log.type === 'extinct' ? 'text-red-400' : log.type === 'system' ? 'text-yellow-500' : 'text-gray-300'}>
                              {log.message}
                          </span>
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