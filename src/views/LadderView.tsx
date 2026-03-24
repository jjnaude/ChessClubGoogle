import React, { useState, useEffect } from 'react';
import { chessService } from '../services/chessService';
import { Player, LadderType } from '../types';
import { Trophy, Medal, Search, ChevronRight, Hash } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';

export const LadderView: React.FC = () => {
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedLadder, setSelectedLadder] = useState<LadderType>('classical');
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    const unsub = chessService.onPlayersChange(setPlayers);
    setLoading(false);
    return () => unsub();
  }, []);

  const sortedPlayers = [...players].sort((a, b) => 
    (b.rankings[selectedLadder] || 1200) - (a.rankings[selectedLadder] || 1200)
  );

  const filteredPlayers = sortedPlayers.filter(p => 
    p.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) return <div className="p-8 text-center">Loading rankings...</div>;

  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight flex items-center gap-3">
            <Trophy className="h-8 w-8 text-indigo-600" /> Club Rankings
          </h1>
          <p className="text-gray-500">Official standings across all club ladders.</p>
        </div>
        
        <div className="flex bg-white rounded-xl shadow-sm border border-gray-100 p-1">
          {(['classical', 'rapid', 'blitz', 'bullet', 'chess960'] as LadderType[]).map((ladder) => (
            <button 
              key={ladder}
              onClick={() => setSelectedLadder(ladder)}
              className={cn(
                "px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all",
                selectedLadder === ladder ? "bg-indigo-600 text-white shadow-md" : "text-gray-500 hover:bg-gray-50"
              )}
            >
              {ladder}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-3xl shadow-xl border border-gray-100 overflow-hidden">
        <div className="p-6 border-b border-gray-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="relative flex-grow max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input 
              type="text" 
              placeholder="Search rankings..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-2xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 w-full"
            />
          </div>
          <div className="flex items-center gap-2 text-xs font-bold text-gray-400 uppercase">
            <Hash className="h-3 w-3" /> {filteredPlayers.length} Players Ranked
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-gray-50 text-gray-500 text-[10px] uppercase tracking-[0.2em] font-black">
              <tr>
                <th className="px-8 py-4">Rank</th>
                <th className="px-8 py-4">Player</th>
                <th className="px-8 py-4 text-right">Rating</th>
                <th className="px-8 py-4 text-right">Trend</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              <AnimatePresence mode="popLayout">
                {filteredPlayers.map((player, index) => (
                  <motion.tr 
                    layout
                    key={player.id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="hover:bg-indigo-50/30 transition-colors group"
                  >
                    <td className="px-8 py-5">
                      <div className="flex items-center gap-3">
                        {index === 0 && <Medal className="h-5 w-5 text-yellow-500" />}
                        {index === 1 && <Medal className="h-5 w-5 text-gray-400" />}
                        {index === 2 && <Medal className="h-5 w-5 text-amber-600" />}
                        <span className={cn(
                          "font-black text-lg",
                          index < 3 ? "text-indigo-600" : "text-gray-300"
                        )}>
                          {index + 1}
                        </span>
                      </div>
                    </td>
                    <td className="px-8 py-5">
                      <div className="font-bold text-gray-900 group-hover:text-indigo-600 transition-colors">{player.name}</div>
                      <div className="text-[10px] text-gray-400 uppercase font-bold tracking-widest">Active Player</div>
                    </td>
                    <td className="px-8 py-5 text-right">
                      <div className="text-xl font-black text-gray-900 tabular-nums">
                        {player.rankings[selectedLadder] || 1200}
                      </div>
                    </td>
                    <td className="px-8 py-5 text-right">
                      <div className="flex items-center justify-end gap-1 text-green-500 font-bold text-xs">
                        <ChevronRight className="h-3 w-3 -rotate-90" /> 0
                      </div>
                    </td>
                  </motion.tr>
                ))}
              </AnimatePresence>
            </tbody>
          </table>
          {filteredPlayers.length === 0 && (
            <div className="p-20 text-center">
              <Search className="h-12 w-12 text-gray-200 mx-auto mb-4" />
              <p className="text-gray-400 font-medium">No players found matching your search.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
