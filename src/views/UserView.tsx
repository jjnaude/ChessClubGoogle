import React, { useState, useEffect, useRef } from 'react';
import { chessService } from '../services/chessService';
import { Player, UserProfile, Game, Pairing } from '../types';
import { 
  User, 
  Trophy, 
  History, 
  CheckCircle2, 
  XCircle, 
  TrendingUp,
  Clock,
  ChevronRight,
  ShieldAlert,
  Play
} from 'lucide-react';
import toast from 'react-hot-toast';
import { motion } from 'motion/react';
import { cn } from '../lib/utils';

interface UserViewProps {
  user: UserProfile;
}

export const UserView: React.FC<UserViewProps> = ({ user }) => {
  const [linkedPlayers, setLinkedPlayers] = useState<Player[]>([]);
  const [recentGames, setRecentGames] = useState<Game[]>([]);
  const [currentPairings, setCurrentPairings] = useState<Pairing[]>([]);
  const [allPlayers, setAllPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  const prevPairingIds = useRef<string[]>([]);

  useEffect(() => {
    const unsub = chessService.onPlayersChange(setAllPlayers);
    return () => unsub();
  }, []);

  useEffect(() => {
    const unsub = chessService.onPairingsChange((pairings) => {
      const myPairings = pairings.filter(p => 
        p.status === 'published' && 
        (user.playerIds.includes(p.whitePlayerId) || (p.blackPlayerId && user.playerIds.includes(p.blackPlayerId)))
      );
      
      // Check for new pairings to show toast
      myPairings.forEach(p => {
        if (!prevPairingIds.current.includes(p.id)) {
          toast.success('New pairing generated!', { icon: '♟️', duration: 5000 });
        }
      });

      prevPairingIds.current = myPairings.map(p => p.id);
      setCurrentPairings(myPairings);
    });
    return () => unsub();
  }, [user.playerIds]);

  useEffect(() => {
    if (user.playerIds.length === 0) {
      setLoading(false);
      return;
    }

    const unsubscribers = user.playerIds.map(id => 
      chessService.onPlayerChange(id, (player) => {
        setLinkedPlayers(prev => {
          if (!player) return prev.filter(p => p.id !== id);
          const exists = prev.some(p => p.id === id);
          if (exists) {
            return prev.map(p => p.id === id ? player : p);
          } else {
            return [...prev, player];
          }
        });
        setLoading(false);
      })
    );

    return () => unsubscribers.forEach(unsub => unsub());
  }, [user.playerIds]);

  useEffect(() => {
    const unsub = chessService.onGamesChange((games) => {
      const myGames = games.filter(g => 
        user.playerIds.includes(g.whitePlayerId) || user.playerIds.includes(g.blackPlayerId)
      ).sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
      setRecentGames(myGames);
    });
    return () => unsub();
  }, [user.playerIds]);

  const togglePresence = async (player: Player) => {
    try {
      await chessService.updatePlayerPresence(player.id, !player.isPresent);
      toast.success(`${player.name} is now ${!player.isPresent ? 'present' : 'absent'}`);
    } catch (error) {
      console.error('Error updating presence:', error);
      toast.error('Failed to update presence.');
    }
  };

  const handleRecordResult = async (pairing: Pairing, result: 'white' | 'black' | 'draw') => {
    const resultText = result === 'white' ? 'White Win' : result === 'black' ? 'Black Win' : 'Draw';
    if (!confirm(`Are you sure you want to record the result as "${resultText}"?`)) {
      return;
    }

    try {
      if (!pairing.blackPlayerId) return;
      await chessService.updatePairingStatus(pairing.id, 'completed', result);
      toast.success('Result submitted for review!');
    } catch (error) {
      console.error('Error recording result:', error);
      toast.error('Failed to record result.');
    }
  };

  if (!user.isApproved) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center px-4">
        <div className="bg-amber-50 border border-amber-200 p-8 rounded-2xl max-w-md">
          <ShieldAlert className="h-16 w-16 text-amber-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-amber-900 mb-2">Account Pending Approval</h2>
          <p className="text-amber-700">
            Your account is currently waiting for admin approval. Once approved, you'll be able to link your player profile and track your rankings.
          </p>
        </div>
      </div>
    );
  }

  if (loading) return <div className="p-8 text-center">Loading your profile...</div>;

  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      <div className="flex items-center gap-4">
        <div className="h-16 w-16 bg-indigo-100 rounded-full flex items-center justify-center">
          <User className="h-8 w-8 text-indigo-600" />
        </div>
        <div>
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Welcome back!</h1>
          <p className="text-gray-500">{user.email}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Linked Players Section */}
        <div className="md:col-span-2 space-y-6">
          {currentPairings.length > 0 && (
            <div className="bg-indigo-50 border-2 border-indigo-200 rounded-2xl p-6 shadow-lg animate-pulse-subtle">
              <h2 className="text-xl font-black text-indigo-900 mb-4 flex items-center gap-2 uppercase tracking-tight">
                <Play className="h-6 w-6 fill-indigo-600" /> Active Pairing
              </h2>
              <div className="space-y-4">
                {currentPairings.map(pairing => {
                  const isWhite = user.playerIds.includes(pairing.whitePlayerId);
                  const myPlayer = allPlayers.find(p => p.id === (isWhite ? pairing.whitePlayerId : pairing.blackPlayerId));
                  const opponent = allPlayers.find(p => p.id === (isWhite ? pairing.blackPlayerId : pairing.whitePlayerId));
                  
                  return (
                    <div key={pairing.id} className="bg-white rounded-xl p-5 border border-indigo-100 shadow-sm relative overflow-hidden">
                      {pairing.boardNumber !== undefined && pairing.boardNumber > 0 && (
                        <div className="absolute top-0 right-0 bg-indigo-600 text-white px-3 py-1 rounded-bl-xl text-[10px] font-black uppercase tracking-widest">
                          Board {pairing.boardNumber}
                        </div>
                      )}
                      <div className="flex items-center justify-between gap-4">
                        <div className="flex-1 text-center">
                          <div className={cn(
                            "h-12 w-12 rounded-full mx-auto mb-2 flex items-center justify-center font-bold border-2",
                            isWhite ? "bg-white text-gray-900 border-gray-200" : "bg-gray-900 text-white border-gray-900"
                          )}>
                            {isWhite ? 'W' : 'B'}
                          </div>
                          <div className="font-bold text-gray-900 truncate">{myPlayer?.name || 'You'}</div>
                          <div className="text-[10px] text-gray-400 uppercase font-bold">Your Color</div>
                        </div>
                        
                        <div className="text-2xl font-black text-gray-200 italic">VS</div>
                        
                        <div className="flex-1 text-center">
                          {pairing.blackPlayerId ? (
                            <>
                              <div className={cn(
                                "h-12 w-12 rounded-full mx-auto mb-2 flex items-center justify-center font-bold border-2",
                                !isWhite ? "bg-white text-gray-900 border-gray-200" : "bg-gray-900 text-white border-gray-900"
                              )}>
                                {!isWhite ? 'W' : 'B'}
                              </div>
                              <div className="font-bold text-gray-900 truncate">{opponent?.name || 'Unknown'}</div>
                              <div className="text-[10px] text-gray-400 uppercase font-bold">Opponent</div>
                            </>
                          ) : (
                            <div className="flex flex-col items-center justify-center h-full">
                              <div className="h-12 w-12 bg-amber-100 rounded-full mx-auto mb-2 flex items-center justify-center font-bold text-amber-600">
                                <ShieldAlert className="h-6 w-6" />
                              </div>
                              <div className="font-bold text-amber-600">BYE</div>
                              <div className="text-[10px] text-amber-400 uppercase font-bold">No Opponent</div>
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="mt-4 pt-4 border-t border-gray-50 flex flex-col gap-3">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">{pairing.ladderType} Ladder</span>
                          <span className="text-xs font-bold text-indigo-600 bg-indigo-50 px-2 py-1 rounded">Active Match</span>
                        </div>
                        
                        {pairing.blackPlayerId && (
                          <div className="grid grid-cols-3 gap-2">
                            <button 
                              onClick={() => handleRecordResult(pairing, 'white')}
                              className="bg-gray-50 hover:bg-indigo-50 text-indigo-600 py-2 rounded-lg text-[10px] font-bold border border-gray-100 transition-colors"
                            >
                              White Win
                            </button>
                            <button 
                              onClick={() => handleRecordResult(pairing, 'draw')}
                              className="bg-gray-50 hover:bg-gray-100 text-gray-600 py-2 rounded-lg text-[10px] font-bold border border-gray-100 transition-colors"
                            >
                              Draw
                            </button>
                            <button 
                              onClick={() => handleRecordResult(pairing, 'black')}
                              className="bg-gray-50 hover:bg-indigo-50 text-indigo-600 py-2 rounded-lg text-[10px] font-bold border border-gray-100 transition-colors"
                            >
                              Black Win
                            </button>
                          </div>
                        )}
                        
                        {!pairing.blackPlayerId && (
                          <div className="text-center py-2 bg-amber-50 rounded-lg text-xs font-bold text-amber-700">
                            You have a BYE this round.
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
              <Trophy className="h-6 w-6 text-indigo-600" /> Your Player Profiles
            </h2>
            
            <div className="space-y-4">
              {linkedPlayers.map(player => (
                <div key={player.id} className="bg-gray-50 rounded-xl p-5 border border-gray-100">
                  <div className="flex items-center justify-between mb-4">
                    <div className="font-bold text-lg text-gray-900">{player.name}</div>
                    <button 
                      onClick={() => togglePresence(player)}
                      className={cn(
                        "flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold transition-all",
                        player.isPresent 
                          ? "bg-green-600 text-white shadow-md" 
                          : "bg-gray-200 text-gray-600 hover:bg-gray-300"
                      )}
                    >
                      {player.isPresent ? <CheckCircle2 className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
                      {player.isPresent ? 'I am Present' : 'Mark as Present'}
                    </button>
                  </div>
                  
                  <div className="grid grid-cols-3 gap-4">
                    {Object.entries(player.rankings).map(([ladder, rank]) => (
                      <div key={ladder} className="bg-white p-3 rounded-lg border border-gray-100 text-center">
                        <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">{ladder}</div>
                        <div className="text-lg font-black text-indigo-600">{rank}</div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
              {linkedPlayers.length === 0 && (
                <div className="text-center py-12 bg-gray-50 rounded-xl border-2 border-dashed border-gray-200">
                  <User className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-500 font-medium">No player profiles linked yet.</p>
                  <p className="text-sm text-gray-400">Ask an admin to link your account to your player profile.</p>
                </div>
              )}
            </div>
          </div>

          {/* Recent Activity */}
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
            <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
              <History className="h-6 w-6 text-indigo-600" /> Recent Games
            </h2>
            <div className="space-y-3">
              {recentGames.length === 0 ? (
                <div className="text-center py-8 text-gray-400 italic">No recent games found.</div>
              ) : (
                recentGames.map(game => {
                  const isWhite = user.playerIds.includes(game.whitePlayerId);
                  const opponentId = isWhite ? game.blackPlayerId : game.whitePlayerId;
                  const opponent = allPlayers.find(p => p.id === opponentId);
                  const myResult = game.result === 'draw' ? 'Draw' : (
                    (isWhite && game.result === 'white') || (!isWhite && game.result === 'black') ? 'Won' : 'Lost'
                  );
                  
                  return (
                    <div key={game.id} className="flex items-center justify-between p-4 bg-gray-50 rounded-xl border border-gray-100 hover:bg-white hover:shadow-sm transition-all">
                      <div className="flex items-center gap-4">
                        <div className={cn(
                          "h-10 w-10 rounded-full flex items-center justify-center font-bold text-xs",
                          myResult === 'Won' ? "bg-green-100 text-green-700" : 
                          myResult === 'Lost' ? "bg-red-100 text-red-700" : "bg-gray-100 text-gray-700"
                        )}>
                          {myResult[0]}
                        </div>
                        <div>
                          <div className="text-sm font-bold text-gray-900">vs {opponent?.name || 'Unknown'}</div>
                          <div className="flex items-center gap-2 text-[10px] text-gray-400 uppercase font-bold tracking-wider">
                            <Clock className="h-3 w-3" />
                            {game.ladderType} • {new Date(game.timestamp).toLocaleDateString()}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className={cn(
                          "text-xs font-black px-2 py-1 rounded uppercase tracking-tighter",
                          myResult === 'Won' ? "text-green-600 bg-green-50" : 
                          myResult === 'Lost' ? "text-red-600 bg-red-50" : "text-gray-600 bg-gray-100"
                        )}>
                          {myResult}
                        </span>
                        <ChevronRight className="h-4 w-4 text-gray-300" />
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Sidebar Stats */}
        <div className="space-y-6">
          <div className="bg-indigo-600 rounded-2xl p-6 text-white shadow-xl shadow-indigo-100">
            <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
              <TrendingUp className="h-5 w-5" /> Quick Stats
            </h3>
            <div className="space-y-4">
              <div className="flex justify-between items-center border-b border-indigo-500 pb-2">
                <span className="text-indigo-100 text-sm">Total Games</span>
                <span className="font-bold text-xl">{recentGames.length}</span>
              </div>
              <div className="flex justify-between items-center border-b border-indigo-500 pb-2">
                <span className="text-indigo-100 text-sm">Win Rate</span>
                <span className="font-bold text-xl">
                  {recentGames.length > 0 
                    ? Math.round((recentGames.filter(g => {
                        const isWhite = user.playerIds.includes(g.whitePlayerId);
                        return (isWhite && g.result === 'white') || (!isWhite && g.result === 'black');
                      }).length / recentGames.length) * 100)
                    : 0}%
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-indigo-100 text-sm">Active Ladders</span>
                <span className="font-bold text-xl">
                  {new Set(recentGames.map(g => g.ladderType)).size}
                </span>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
            <h3 className="text-gray-900 font-bold mb-4">Club Announcements</h3>
            <div className="space-y-4">
              <div className="border-l-4 border-indigo-500 pl-3">
                <div className="text-xs font-bold text-indigo-600 uppercase">Mar 24, 2026</div>
                <p className="text-sm text-gray-600">Next tournament starts this Friday at 6 PM.</p>
              </div>
              <div className="border-l-4 border-gray-200 pl-3">
                <div className="text-xs font-bold text-gray-400 uppercase">Mar 20, 2026</div>
                <p className="text-sm text-gray-600">New Blitz ladder rules updated.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
