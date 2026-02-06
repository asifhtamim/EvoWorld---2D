import React from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface DataPoint {
  time: number;
  population: number;
  species: number;
}

interface Props {
  data: DataPoint[];
}

const StatsPanel: React.FC<Props> = ({ data }) => {
  return (
    <div className="bg-gray-800 p-4 rounded-lg shadow-lg flex-1 min-h-[200px] flex flex-col">
      <h3 className="text-gray-400 text-sm font-bold mb-2 uppercase">Population History</h3>
      <div className="flex-1 w-full min-h-[150px]">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data}>
            <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
            <XAxis dataKey="time" hide />
            <YAxis stroke="#9ca3af" fontSize={12} />
            <Tooltip 
                contentStyle={{ backgroundColor: '#1f2937', borderColor: '#374151', color: '#fff' }}
                itemStyle={{ color: '#fff' }}
            />
            <Area type="monotone" dataKey="population" stroke="#8884d8" fill="#8884d8" name="Population" />
            <Area type="monotone" dataKey="species" stroke="#82ca9d" fill="#82ca9d" name="Species Count" />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default StatsPanel;