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
    <div className="w-full h-full min-h-[200px]">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
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
  );
};

export default StatsPanel;