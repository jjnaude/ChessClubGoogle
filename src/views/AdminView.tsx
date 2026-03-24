import React, { useState, useEffect } from 'react';
import { chessService } from '../services/chessService';
import { Player, UserProfile, LadderType, Pairing, Ban } from '../types';
import { 
  Users, 
  Plus, 
  CheckCircle2, 
  XCircle, 
  ShieldAlert, 
  Play, 
  Trophy, 
  Trash2, 
  UserPlus, 
  UserMinus, 
  Ban as BanIcon,
  RefreshCw,
  Search,
  ChevronRight,
  ChevronDown,
  LayoutDashboard,
  Database,
  Check,
  X,
  Edit2
} from 'lucide-react';
import toast from 'react-hot-toast';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';

interface AdminViewProps {
  user: UserProfile;
}

export const AdminView: React.FC<AdminViewProps> = ({ user }) => {
  const [players, setPlayers] = useState<Player[]>([]);
  const [pairings, setPairings] = useState<Pairing[]>([]);
  const [bans, setBans] = useState<Ban[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'players' | 'pairings' | 'bans' | 'users'>('players');
  const [newPlayerName, setNewPlayerName] = useState('');
  const [selectedLadder, setSelectedLadder] = useState<LadderType>('classical');
  const [searchTerm, setSearchTerm] = useState('');
  const [userSearchTerm, setUserSearchTerm] = useState('');
  const [openDropdownUid, setOpenDropdownUid] = useState<string | null>(null);
  const [editingRanking, setEditingRanking] = useState<{playerId: string, ladder: LadderType, value: string} | null>(null);
  const [manualPairing, setManualPairing] = useState<{whiteId: string, blackId: string}>({whiteId: '', blackId: ''});

  useEffect(() => {
    const unsubPlayers = chessService.onPlayersChange(setPlayers);
    const unsubPairings = chessService.onPairingsChange(setPairings);
    const unsubBans = chessService.onBansChange(setBans);
    const unsubUsers = chessService.onUsersChange(setUsers);

    setLoading(false);

    return () => {
      unsubPlayers();
      unsubPairings();
      unsubBans();
      unsubUsers();
    };
  }, []);

  const handleUpdateRanking = async () => {
    if (!editingRanking) return;
    const newValue = parseInt(editingRanking.value);
    if (isNaN(newValue)) {
      toast.error('Please enter a valid number.');
      return;
    }

    try {
      await chessService.updatePlayerRanking(editingRanking.playerId, editingRanking.ladder, newValue);
      setEditingRanking(null);
      toast.success('Ranking updated successfully!');
    } catch (error) {
      console.error('Error updating ranking:', error);
      toast.error('Failed to update ranking.');
    }
  };

  const handleManualPairing = async () => {
    if (!manualPairing.whiteId) {
      toast.error('Please select a White player.');
      return;
    }

    // Check if players are already busy
    const busyPlayerIds = new Set([
      ...pairings.filter(p => ['draft', 'published', 'completed'].includes(p.status)).map(p => p.whitePlayerId),
      ...pairings.filter(p => ['draft', 'published', 'completed'].includes(p.status)).map(p => p.blackPlayerId).filter((id): id is string => !!id)
    ]);

    if (busyPlayerIds.has(manualPairing.whiteId)) {
      toast.error('White player is already in a pairing.');
      return;
    }
    if (manualPairing.blackId && busyPlayerIds.has(manualPairing.blackId)) {
      toast.error('Black player is already in a pairing.');
      return;
    }
    if (manualPairing.whiteId === manualPairing.blackId) {
      toast.error('A player cannot play against themselves.');
      return;
    }

    try {
      await chessService.addPairing(
        manualPairing.whiteId, 
        manualPairing.blackId || undefined, 
        selectedLadder, 
        0 // Board 0 or auto-assign later
      );
      setManualPairing({whiteId: '', blackId: ''});
      toast.success('Manual pairing added to draft!');
    } catch (error) {
      console.error('Error adding manual pairing:', error);
      toast.error('Failed to add manual pairing.');
    }
  };

  const handleAddPlayer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPlayerName.trim()) return;

    try {
      await chessService.addPlayer(newPlayerName.trim());
      setNewPlayerName('');
      toast.success('Player added successfully!');
    } catch (error) {
      console.error('Error adding player:', error);
      toast.error('Failed to add player.');
    }
  };

  const togglePresence = async (player: Player) => {
    try {
      await chessService.updatePlayerPresence(player.id, !player.isPresent);
      toast.success(`${player.name} is now ${!player.isPresent ? 'present' : 'absent'}`);
    } catch (error) {
      console.error('Error updating presence:', error);
      toast.error('Failed to update presence.');
    }
  };

  const handleGeneratePairings = async () => {
    const presentPlayers = players.filter(p => p.isPresent);
    if (presentPlayers.length < 2) {
      toast.error('At least 2 present players are required to generate pairings.');
      return;
    }

    // Simple pairing logic for now: pair by rank
    const sortedPlayers = [...presentPlayers].sort((a, b) => 
      (b.rankings[selectedLadder] || 1200) - (a.rankings[selectedLadder] || 1200)
    );

    // Filter out players already in active pairings
    const busyPlayerIds = new Set([
      ...pairings.filter(p => ['draft', 'published', 'completed'].includes(p.status)).map(p => p.whitePlayerId),
      ...pairings.filter(p => ['draft', 'published', 'completed'].includes(p.status)).map(p => p.blackPlayerId).filter((id): id is string => !!id)
    ]);

    const availablePlayers = sortedPlayers.filter(p => !busyPlayerIds.has(p.id));

    if (availablePlayers.length < 1) {
      toast.error('No more available players to pair.');
      return;
    }

    try {
      // Check for bans
      const isBanned = (p1Id: string, p2Id: string) => {
        return bans.some(b => 
          (b.player1Id === p1Id && b.player2Id === p2Id) || 
          (b.player1Id === p2Id && b.player2Id === p1Id)
        );
      };

      let pairingsCreated = 0;
      let i = 0;
      let boardNumber = 1;
      while (i < availablePlayers.length) {
        const p1 = availablePlayers[i];
        const p2 = availablePlayers[i+1];

        if (!p2) {
          // Odd number of players, create a 'Bye'
          await chessService.addPairing(p1.id, undefined, selectedLadder, 0);
          pairingsCreated++;
          break;
        }

        if (isBanned(p1.id, p2.id)) {
          // Try to find another partner
          let found = false;
          for (let j = i + 2; j < availablePlayers.length; j++) {
            if (!isBanned(p1.id, availablePlayers[j].id)) {
              // Swap
              const temp = availablePlayers[i+1];
              availablePlayers[i+1] = availablePlayers[j];
              availablePlayers[j] = temp;
              found = true;
              break;
            }
          }
          if (!found) {
            // If no partner found, p1 gets a bye
            await chessService.addPairing(p1.id, undefined, selectedLadder, 0);
            pairingsCreated++;
            i++;
            continue;
          }
        }

        await chessService.addPairing(availablePlayers[i].id, availablePlayers[i+1].id, selectedLadder, boardNumber);
        pairingsCreated++;
        i += 2;
        boardNumber++;
      }

      if (pairingsCreated > 0) {
        toast.success(`Generated ${pairingsCreated} new pairings!`);
      } else {
        toast.error('Could not generate any valid pairings due to bans.');
      }
    } catch (error) {
      console.error('Error generating pairings:', error);
      toast.error('Failed to generate pairings.');
    }
  };

  const handleRecordResult = async (pairing: Pairing, result: 'white' | 'black' | 'draw') => {
    try {
      await chessService.updatePairingStatus(pairing.id, 'completed', result);
      toast.success('Result recorded for review.');
    } catch (error) {
      console.error('Error recording result:', error);
      toast.error('Failed to record result.');
    }
  };

  const handlePublishPairings = async () => {
    const draftPairings = pairings.filter(p => p.status === 'draft' && p.ladderType === selectedLadder);
    if (draftPairings.length === 0) return;

    try {
      await Promise.all(draftPairings.map(p => chessService.updatePairingStatus(p.id, 'published')));
      toast.success('Pairings published to players!');
    } catch (error) {
      console.error('Error publishing pairings:', error);
      toast.error('Failed to publish pairings.');
    }
  };

  const handleCancelDrafts = async () => {
    const draftPairings = pairings.filter(p => p.status === 'draft' && p.ladderType === selectedLadder);
    if (draftPairings.length === 0) return;

    try {
      await Promise.all(draftPairings.map(p => chessService.deletePairing(p.id)));
      toast.success('Draft pairings cancelled.');
    } catch (error) {
      console.error('Error cancelling drafts:', error);
      toast.error('Failed to cancel drafts.');
    }
  };

  const handleDeletePairing = async (pairingId: string) => {
    try {
      await chessService.deletePairing(pairingId);
      toast.success('Pairing deleted.');
    } catch (error) {
      console.error('Error deleting pairing:', error);
      toast.error('Failed to delete pairing.');
    }
  };

  const handleFinalizeRound = async () => {
    const completedPairings = pairings.filter(p => p.status === 'completed' && p.ladderType === selectedLadder);
    const publishedPairings = pairings.filter(p => p.status === 'published' && p.ladderType === selectedLadder);

    if (publishedPairings.length > 0) {
      if (!confirm('There are still published pairings without results. Finalize anyway?')) {
        return;
      }
    }

    try {
      await chessService.finalizePairings(completedPairings.map(p => p.id));
      // Also mark remaining published as cancelled or finalized without result
      await Promise.all(publishedPairings.map(p => chessService.updatePairingStatus(p.id, 'finalized')));
      toast.success('Round finalized and rankings updated!');
    } catch (error) {
      console.error('Error finalizing round:', error);
      toast.error('Failed to finalize round.');
    }
  };

  const handleUpdateResult = async (pairingId: string, result: Pairing['result']) => {
    try {
      await chessService.updatePairingResult(pairingId, result);
      toast.success('Result updated.');
    } catch (error) {
      console.error('Error updating result:', error);
      toast.error('Failed to update result.');
    }
  };

  const handleCancelPairing = async (pairingId: string) => {
    try {
      await chessService.updatePairingStatus(pairingId, 'cancelled');
      toast.success('Pairing cancelled.');
    } catch (error) {
      console.error('Error cancelling pairing:', error);
      toast.error('Failed to cancel pairing.');
    }
  };

  const handleAddBan = async (p1Id: string, p2Id: string) => {
    if (p1Id === p2Id) return;
    try {
      await chessService.addBan(p1Id, p2Id);
      toast.success('Ban added.');
    } catch (error) {
      console.error('Error adding ban:', error);
      toast.error('Failed to add ban.');
    }
  };

  const handleRemoveBan = async (banId: string) => {
    try {
      await chessService.removeBan(banId);
      toast.success('Ban removed.');
    } catch (error) {
      console.error('Error removing ban:', error);
      toast.error('Failed to remove ban.');
    }
  };

  const handleApproveUser = async (uid: string) => {
    try {
      await chessService.updateUserProfile(uid, { isApproved: true });
      toast.success('User approved successfully!');
    } catch (error) {
      console.error('Error approving user:', error);
      toast.error('Failed to approve user.');
    }
  };

  const handleLinkPlayer = async (uid: string, playerId: string) => {
    const userToUpdate = users.find(u => u.uid === uid);
    if (!userToUpdate) return;

    const playerIds = [...userToUpdate.playerIds];
    if (playerIds.includes(playerId)) {
      // Unlink
      const index = playerIds.indexOf(playerId);
      playerIds.splice(index, 1);
      toast.success('Player unlinked.');
    } else {
      // Link
      playerIds.push(playerId);
      toast.success('Player linked.');
    }

    try {
      await chessService.updateUserProfile(uid, { playerIds });
    } catch (error) {
      console.error('Error linking player:', error);
      toast.error('Failed to update player links.');
    }
  };

  const filteredPlayers = players.filter(p => 
    p.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredUsers = users.filter(u => 
    u.email.toLowerCase().includes(userSearchTerm.toLowerCase())
  );

  const pendingUsersCount = users.filter(u => !u.isApproved).length;

  if (loading) return <div className="p-8 text-center">Loading admin data...</div>;

  return (
    <div className="space-y-6 max-w-5xl mx-auto flex flex-col min-h-[calc(100vh-12rem)]">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Admin Dashboard</h1>
          <p className="text-gray-500">Manage players, pairings, and club rankings.</p>
        </div>
        <div className="flex bg-white rounded-xl shadow-sm border border-gray-100 p-1">
          <button 
            onClick={() => setActiveTab('players')}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all",
              activeTab === 'players' ? "bg-indigo-600 text-white shadow-md" : "text-gray-600 hover:bg-gray-50"
            )}
          >
            <Users className="h-4 w-4" /> Players
          </button>
          <button 
            onClick={() => setActiveTab('pairings')}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all",
              activeTab === 'pairings' ? "bg-indigo-600 text-white shadow-md" : "text-gray-600 hover:bg-gray-50"
            )}
          >
            <Play className="h-4 w-4" /> Pairings
          </button>
          <button 
            onClick={() => setActiveTab('bans')}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all",
              activeTab === 'bans' ? "bg-indigo-600 text-white shadow-md" : "text-gray-600 hover:bg-gray-50"
            )}
          >
            <ShieldAlert className="h-4 w-4" /> Bans
          </button>
          <button 
            onClick={() => setActiveTab('users')}
            className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all relative",
              activeTab === 'users' ? "bg-indigo-600 text-white shadow-md" : "text-gray-600 hover:bg-gray-50"
            )}
          >
            <Users className="h-4 w-4" /> Users
            {pendingUsersCount > 0 && (
              <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white ring-2 ring-white">
                {pendingUsersCount}
              </span>
            )}
          </button>
        </div>
      </div>

      <AnimatePresence mode="wait">
        {activeTab === 'players' && (
          <motion.div 
            key="players"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-6"
          >
            {/* Add Player Form */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <UserPlus className="h-5 w-5 text-indigo-600" /> Add New Player
              </h2>
              <form onSubmit={handleAddPlayer} className="flex gap-3">
                <input 
                  type="text" 
                  value={newPlayerName}
                  onChange={(e) => setNewPlayerName(e.target.value)}
                  placeholder="Player full name"
                  className="flex-grow px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-all"
                />
                <button 
                  type="submit"
                  className="bg-indigo-600 text-white px-6 py-2 rounded-xl font-semibold hover:bg-indigo-700 transition-all shadow-sm flex items-center gap-2"
                >
                  <Plus className="h-5 w-5" /> Add
                </button>
              </form>
            </div>

            {/* Players List */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
              <div className="p-6 border-bottom border-gray-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <h2 className="text-lg font-semibold flex items-center gap-2">
                  <Database className="h-5 w-5 text-indigo-600" /> Player Database
                </h2>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <input 
                    type="text" 
                    placeholder="Search players..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 w-full md:w-64"
                  />
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wider">
                    <tr>
                      <th className="px-6 py-3 font-medium">Player</th>
                      <th className="px-6 py-3 font-medium">Presence</th>
                      <th className="px-6 py-3 font-medium">Classical</th>
                      <th className="px-6 py-3 font-medium">Rapid</th>
                      <th className="px-6 py-3 font-medium">Blitz</th>
                      <th className="px-6 py-3 font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filteredPlayers.map(player => (
                      <tr key={player.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-4">
                          <div className="font-medium text-gray-900">{player.name}</div>
                          <div className="text-xs text-gray-400">Joined {new Date(player.createdAt).toLocaleDateString()}</div>
                        </td>
                        <td className="px-6 py-4">
                          <button 
                            onClick={() => togglePresence(player)}
                            className={cn(
                              "flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold transition-all",
                              player.isPresent 
                                ? "bg-green-100 text-green-700 hover:bg-green-200" 
                                : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                            )}
                          >
                            {player.isPresent ? <CheckCircle2 className="h-3 w-3" /> : <XCircle className="h-3 w-3" />}
                            {player.isPresent ? 'Present' : 'Absent'}
                          </button>
                        </td>
                        {(['classical', 'rapid', 'blitz'] as LadderType[]).map(ladder => (
                          <td key={ladder} className="px-6 py-4 font-mono text-sm">
                            {editingRanking?.playerId === player.id && editingRanking?.ladder === ladder ? (
                              <div className="flex items-center gap-1">
                                <input 
                                  type="number" 
                                  value={editingRanking.value}
                                  onChange={(e) => setEditingRanking({...editingRanking, value: e.target.value})}
                                  className="w-16 px-1 py-0.5 border border-indigo-300 rounded focus:outline-none focus:ring-1 focus:ring-indigo-500 text-xs"
                                  autoFocus
                                  onKeyDown={(e) => {
                                    if (e.key === 'Enter') handleUpdateRanking();
                                    if (e.key === 'Escape') setEditingRanking(null);
                                  }}
                                />
                                <button onClick={handleUpdateRanking} className="text-green-600 hover:text-green-700">
                                  <Check className="h-3 w-3" />
                                </button>
                                <button onClick={() => setEditingRanking(null)} className="text-red-600 hover:text-red-700">
                                  <X className="h-3 w-3" />
                                </button>
                              </div>
                            ) : (
                              <div 
                                className="flex items-center gap-1 group cursor-pointer hover:text-indigo-600 transition-colors"
                                onClick={() => setEditingRanking({playerId: player.id, ladder, value: String(player.rankings[ladder] || 1200)})}
                              >
                                {player.rankings[ladder] || 1200}
                                <Edit2 className="h-3 w-3 opacity-0 group-hover:opacity-100 transition-opacity" />
                              </div>
                            )}
                          </td>
                        ))}
                        <td className="px-6 py-4">
                          <button className="text-gray-400 hover:text-red-600 transition-colors">
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </motion.div>
        )}

        {activeTab === 'pairings' && (
          <motion.div 
            key="pairings"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-6"
          >
            {/* Manual Pairing Section */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <UserPlus className="h-5 w-5 text-indigo-600" /> Manual Pairing
              </h2>
              <div className="flex flex-wrap gap-4 items-end">
                <div className="flex-grow min-w-[200px]">
                  <label className="block text-xs font-medium text-gray-500 uppercase mb-1">White Player</label>
                  <select 
                    value={manualPairing.whiteId}
                    onChange={(e) => setManualPairing({...manualPairing, whiteId: e.target.value})}
                    className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                  >
                    <option value="">Select White...</option>
                    {players
                      .filter(p => p.isPresent)
                      .filter(p => !pairings.some(pair => 
                        ['draft', 'published', 'completed'].includes(pair.status) && 
                        (pair.whitePlayerId === p.id || pair.blackPlayerId === p.id)
                      ))
                      .map(p => (
                        <option key={p.id} value={p.id}>{p.name} ({p.rankings[selectedLadder] || 1200})</option>
                      ))
                    }
                  </select>
                </div>
                <div className="flex-grow min-w-[200px]">
                  <label className="block text-xs font-medium text-gray-500 uppercase mb-1">Black Player</label>
                  <select 
                    value={manualPairing.blackId}
                    onChange={(e) => setManualPairing({...manualPairing, blackId: e.target.value})}
                    className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                  >
                    <option value="">Bye (No opponent)</option>
                    {players
                      .filter(p => p.isPresent)
                      .filter(p => !pairings.some(pair => 
                        ['draft', 'published', 'completed'].includes(pair.status) && 
                        (pair.whitePlayerId === p.id || pair.blackPlayerId === p.id)
                      ))
                      .filter(p => p.id !== manualPairing.whiteId)
                      .map(p => (
                        <option key={p.id} value={p.id}>{p.name} ({p.rankings[selectedLadder] || 1200})</option>
                      ))
                    }
                  </select>
                </div>
                <button 
                  onClick={handleManualPairing}
                  className="bg-indigo-600 text-white px-6 py-2 rounded-xl font-semibold hover:bg-indigo-700 transition-all shadow-sm flex items-center gap-2 h-[42px]"
                >
                  <Plus className="h-5 w-5" /> Pair
                </button>
              </div>
            </div>

            {/* Pairing Controls */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 flex flex-col md:flex-row items-center justify-between gap-6">
              <div className="flex items-center gap-4 w-full md:w-auto">
                <div className="flex flex-col">
                  <label className="text-xs font-semibold text-gray-400 uppercase mb-1">Select Ladder</label>
                  <select 
                    value={selectedLadder}
                    onChange={(e) => setSelectedLadder(e.target.value as LadderType)}
                    className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-2 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="classical">Classical</option>
                    <option value="rapid">Rapid</option>
                    <option value="blitz">Blitz</option>
                    <option value="bullet">Bullet</option>
                    <option value="chess960">Chess960</option>
                  </select>
                </div>
                <div className="text-center md:text-left">
                  <div className="text-2xl font-bold text-indigo-600">
                    {players.filter(p => p.isPresent).length}
                  </div>
                  <div className="text-xs text-gray-400 uppercase font-semibold">Players Present</div>
                </div>
              </div>
              
              <div className="flex items-center gap-3 w-full md:w-auto">
                {pairings.some(p => ['published', 'completed'].includes(p.status) && p.ladderType === selectedLadder) ? (
                  <button 
                    onClick={handleFinalizeRound}
                    className="w-full md:w-auto bg-indigo-600 text-white px-8 py-3 rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-lg flex items-center justify-center gap-2"
                  >
                    <CheckCircle2 className="h-5 w-5" /> Finalize Round
                  </button>
                ) : (
                  <div className="flex flex-wrap gap-4 w-full md:w-auto">
                    {pairings.some(p => p.status === 'draft' && p.ladderType === selectedLadder) && (
                      <>
                        <button 
                          onClick={handleCancelDrafts}
                          className="flex-1 md:flex-none bg-red-50 text-red-600 px-6 py-3 rounded-xl font-bold hover:bg-red-100 transition-all border border-red-100"
                        >
                          Cancel Draft
                        </button>
                        <button 
                          onClick={handlePublishPairings}
                          className="flex-1 md:flex-none bg-green-600 text-white px-8 py-3 rounded-xl font-bold hover:bg-green-700 transition-all shadow-lg flex items-center justify-center gap-2"
                        >
                          <Play className="h-5 w-5 fill-white" /> Publish Pairings
                        </button>
                      </>
                    )}
                    <button 
                      onClick={handleGeneratePairings}
                      className="flex-1 md:flex-none bg-indigo-600 text-white px-8 py-3 rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-lg flex items-center justify-center gap-2"
                    >
                      <RefreshCw className="h-5 w-5" /> Generate Pairings
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Draft Pairings */}
            {pairings.some(p => p.status === 'draft' && p.ladderType === selectedLadder) && (
              <div className="space-y-4">
                <h3 className="text-sm font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
                  <span className="h-2 w-2 bg-amber-500 rounded-full animate-pulse" /> Draft Pairings (Review)
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {pairings.filter(p => p.status === 'draft' && p.ladderType === selectedLadder).map(pairing => {
                    const white = players.find(pl => pl.id === pairing.whitePlayerId);
                    const black = players.find(pl => pl.id === pairing.blackPlayerId);
                    
                    return (
                      <div key={pairing.id} className="bg-amber-50 rounded-2xl border border-amber-100 p-5 space-y-4 relative overflow-hidden">
                        {pairing.boardNumber !== undefined && pairing.boardNumber > 0 && (
                          <div className="absolute top-0 right-0 bg-amber-500 text-white px-3 py-1 rounded-bl-xl text-[10px] font-black uppercase tracking-widest">
                            Board {pairing.boardNumber}
                          </div>
                        )}
                        <div className="flex items-center justify-between text-xs font-bold text-amber-600 uppercase tracking-wider">
                          <span>{pairing.ladderType} Draft</span>
                          <button 
                            onClick={() => handleDeletePairing(pairing.id)}
                            className="text-amber-400 hover:text-red-600 transition-colors"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                        
                        <div className="flex items-center justify-between gap-4">
                          <div className="flex-1 text-center">
                            <div className="h-12 w-12 bg-white rounded-full mx-auto mb-2 flex items-center justify-center font-bold text-gray-500 border border-amber-100">W</div>
                            <div className="font-bold text-gray-900 truncate">{white?.name || 'Unknown'}</div>
                          </div>
                          <div className="text-2xl font-black text-amber-200 italic">VS</div>
                          <div className="flex-1 text-center">
                            {pairing.blackPlayerId ? (
                              <>
                                <div className="h-12 w-12 bg-gray-900 rounded-full mx-auto mb-2 flex items-center justify-center font-bold text-white">B</div>
                                <div className="font-bold text-gray-900 truncate">{black?.name || 'Unknown'}</div>
                              </>
                            ) : (
                              <div className="font-bold text-amber-600">BYE</div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Published Pairings (Pending Results) */}
            {pairings.some(p => p.status === 'published' && p.ladderType === selectedLadder) && (
              <div className="space-y-4">
                <h3 className="text-sm font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
                  <span className="h-2 w-2 bg-indigo-500 rounded-full animate-pulse" /> Published Pairings (Waiting for Results)
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {pairings.filter(p => p.status === 'published' && p.ladderType === selectedLadder).map(pairing => {
                    const white = players.find(pl => pl.id === pairing.whitePlayerId);
                    const black = players.find(pl => pl.id === pairing.blackPlayerId);
                    
                    return (
                      <div key={pairing.id} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-5 space-y-4 relative overflow-hidden">
                        {pairing.boardNumber !== undefined && pairing.boardNumber > 0 && (
                          <div className="absolute top-0 right-0 bg-indigo-600 text-white px-3 py-1 rounded-bl-xl text-[10px] font-black uppercase tracking-widest">
                            Board {pairing.boardNumber}
                          </div>
                        )}
                        <div className="flex items-center justify-between text-xs font-bold text-gray-400 uppercase tracking-wider">
                          <span>{pairing.ladderType} Pairing</span>
                        </div>
                        
                        <div className="flex items-center justify-between gap-4">
                          <div className="flex-1 text-center">
                            <div className="h-12 w-12 bg-gray-100 rounded-full mx-auto mb-2 flex items-center justify-center font-bold text-gray-500">W</div>
                            <div className="font-bold text-gray-900 truncate">{white?.name || 'Unknown'}</div>
                          </div>
                          <div className="text-2xl font-black text-gray-200 italic">VS</div>
                          <div className="flex-1 text-center">
                            {pairing.blackPlayerId ? (
                              <>
                                <div className="h-12 w-12 bg-gray-900 rounded-full mx-auto mb-2 flex items-center justify-center font-bold text-white">B</div>
                                <div className="font-bold text-gray-900 truncate">{black?.name || 'Unknown'}</div>
                              </>
                            ) : (
                              <div className="font-bold text-amber-600">BYE</div>
                            )}
                          </div>
                        </div>

                        {pairing.blackPlayerId && (
                          <div className="grid grid-cols-3 gap-2 pt-2">
                            <button 
                              onClick={() => handleRecordResult(pairing, 'white')}
                              className="bg-gray-50 hover:bg-indigo-50 text-indigo-600 py-2 rounded-lg text-xs font-bold border border-gray-100 transition-colors"
                            >
                              White Win
                            </button>
                            <button 
                              onClick={() => handleRecordResult(pairing, 'draw')}
                              className="bg-gray-50 hover:bg-gray-100 text-gray-600 py-2 rounded-lg text-xs font-bold border border-gray-100 transition-colors"
                            >
                              Draw
                            </button>
                            <button 
                              onClick={() => handleRecordResult(pairing, 'black')}
                              className="bg-gray-50 hover:bg-indigo-50 text-indigo-600 py-2 rounded-lg text-xs font-bold border border-gray-100 transition-colors"
                            >
                              Black Win
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Round Results (Completed Pairings) */}
            {pairings.some(p => p.status === 'completed' && p.ladderType === selectedLadder) && (
              <div className="space-y-4">
                <h3 className="text-sm font-black text-gray-400 uppercase tracking-widest flex items-center gap-2">
                  <span className="h-2 w-2 bg-green-500 rounded-full" /> Round Results (Review & Finalize)
                </h3>
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                  <table className="w-full text-left">
                    <thead className="bg-gray-50 text-gray-500 text-[10px] uppercase tracking-widest">
                      <tr>
                        <th className="px-6 py-3 font-bold">Board</th>
                        <th className="px-6 py-3 font-bold">White</th>
                        <th className="px-6 py-3 font-bold text-center">Result</th>
                        <th className="px-6 py-3 font-bold">Black</th>
                        <th className="px-6 py-3 font-bold text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {pairings.filter(p => p.status === 'completed' && p.ladderType === selectedLadder).map(pairing => {
                        const white = players.find(pl => pl.id === pairing.whitePlayerId);
                        const black = players.find(pl => pl.id === pairing.blackPlayerId);
                        
                        return (
                          <tr key={pairing.id} className="hover:bg-gray-50 transition-colors">
                            <td className="px-6 py-4 font-black text-gray-300">#{pairing.boardNumber || '-'}</td>
                            <td className="px-6 py-4 font-bold text-gray-900">{white?.name}</td>
                            <td className="px-6 py-4">
                              <div className="flex justify-center gap-1">
                                <button 
                                  onClick={() => handleUpdateResult(pairing.id, 'white')}
                                  className={cn(
                                    "px-2 py-1 rounded text-[10px] font-black uppercase transition-all",
                                    pairing.result === 'white' ? "bg-indigo-600 text-white" : "bg-gray-100 text-gray-400 hover:bg-gray-200"
                                  )}
                                >
                                  W
                                </button>
                                <button 
                                  onClick={() => handleUpdateResult(pairing.id, 'draw')}
                                  className={cn(
                                    "px-2 py-1 rounded text-[10px] font-black uppercase transition-all",
                                    pairing.result === 'draw' ? "bg-gray-600 text-white" : "bg-gray-100 text-gray-400 hover:bg-gray-200"
                                  )}
                                >
                                  D
                                </button>
                                <button 
                                  onClick={() => handleUpdateResult(pairing.id, 'black')}
                                  className={cn(
                                    "px-2 py-1 rounded text-[10px] font-black uppercase transition-all",
                                    pairing.result === 'black' ? "bg-indigo-600 text-white" : "bg-gray-100 text-gray-400 hover:bg-gray-200"
                                  )}
                                >
                                  B
                                </button>
                              </div>
                            </td>
                            <td className="px-6 py-4 font-bold text-gray-900">{black?.name}</td>
                            <td className="px-6 py-4 text-right">
                              <button 
                                onClick={() => chessService.updatePairingStatus(pairing.id, 'published')}
                                className="text-[10px] font-bold text-gray-400 hover:text-indigo-600 uppercase tracking-widest"
                              >
                                Reset
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </motion.div>
        )}

        {activeTab === 'bans' && (
          <motion.div 
            key="bans"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-6"
          >
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <BanIcon className="h-5 w-5 text-red-500" /> Pairing Bans
              </h2>
              <p className="text-sm text-gray-500 mb-6">Prevent specific players from being paired together automatically.</p>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                <div className="flex flex-col">
                  <label className="text-xs font-bold text-gray-400 uppercase mb-1">Player 1</label>
                  <select id="ban-p1" className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                    <option value="">Select player...</option>
                    {players.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
                <div className="flex flex-col">
                  <label className="text-xs font-bold text-gray-400 uppercase mb-1">Player 2</label>
                  <select id="ban-p2" className="bg-gray-50 border border-gray-200 rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                    <option value="">Select player...</option>
                    {players.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
                <div className="flex items-end">
                  <button 
                    onClick={() => {
                      const p1 = (document.getElementById('ban-p1') as HTMLSelectElement).value;
                      const p2 = (document.getElementById('ban-p2') as HTMLSelectElement).value;
                      if (p1 && p2) handleAddBan(p1, p2);
                    }}
                    className="w-full bg-red-500 text-white py-2 rounded-xl font-bold hover:bg-red-600 transition-all shadow-sm"
                  >
                    Add Ban
                  </button>
                </div>
              </div>

              <div className="space-y-3">
                {bans.map(ban => {
                  const p1 = players.find(p => p.id === ban.player1Id);
                  const p2 = players.find(p => p.id === ban.player2Id);
                  return (
                    <div key={ban.id} className="flex items-center justify-between bg-gray-50 p-4 rounded-xl border border-gray-100">
                      <div className="flex items-center gap-4">
                        <div className="font-semibold text-gray-700">{p1?.name || 'Unknown'}</div>
                        <div className="h-px w-8 bg-red-200"></div>
                        <div className="font-semibold text-gray-700">{p2?.name || 'Unknown'}</div>
                      </div>
                      <button 
                        onClick={() => handleRemoveBan(ban.id)}
                        className="text-gray-400 hover:text-red-500 transition-colors"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  );
                })}
                {bans.length === 0 && (
                  <div className="text-center py-8 text-gray-400 italic">No active bans.</div>
                )}
              </div>
            </div>
          </motion.div>
        )}

        {activeTab === 'users' && (
          <motion.div 
            key="users"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="space-y-6 flex-grow flex flex-col"
          >
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 flex-grow flex flex-col">
              <div className="p-6 border-bottom border-gray-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <h2 className="text-lg font-semibold flex items-center gap-2">
                  <Users className="h-5 w-5 text-indigo-600" /> User Management
                </h2>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <input 
                    type="text" 
                    placeholder="Search users..."
                    value={userSearchTerm}
                    onChange={(e) => setUserSearchTerm(e.target.value)}
                    className="pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 w-full md:w-64"
                  />
                </div>
              </div>

              <div className="overflow-x-auto flex-grow">
                <table className="w-full text-left">
                  <thead className="bg-gray-50 text-gray-500 text-xs uppercase tracking-wider">
                    <tr>
                      <th className="px-6 py-3 font-medium">User</th>
                      <th className="px-6 py-3 font-medium">Status</th>
                      <th className="px-6 py-3 font-medium">Linked Players</th>
                      <th className="px-6 py-3 font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {filteredUsers.map(u => (
                      <tr key={u.uid} className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-4">
                          <div className="font-medium text-gray-900">{u.email}</div>
                          <div className="text-xs text-gray-400">UID: {u.uid.substring(0, 8)}...</div>
                        </td>
                        <td className="px-6 py-4">
                          {u.isApproved ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                              <CheckCircle2 className="h-3 w-3" /> Approved
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium bg-amber-100 text-amber-800">
                              <ShieldAlert className="h-3 w-3" /> Pending
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex flex-wrap gap-1">
                            {u.playerIds.map(pid => {
                              const p = players.find(player => player.id === pid);
                              return (
                                <span key={pid} className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-indigo-50 text-indigo-700 text-[10px] font-bold border border-indigo-100">
                                  {p?.name || 'Unknown'}
                                  <button onClick={() => handleLinkPlayer(u.uid, pid)} className="hover:text-red-500">
                                    <XCircle className="h-3 w-3" />
                                  </button>
                                </span>
                              );
                            })}
                            {u.playerIds.length === 0 && <span className="text-xs text-gray-400 italic">No players linked</span>}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-2">
                            {!u.isApproved && (
                              <button 
                                onClick={() => handleApproveUser(u.uid)}
                                className="bg-green-600 text-white px-3 py-1 rounded-lg text-xs font-bold hover:bg-green-700 transition-colors"
                              >
                                Approve
                              </button>
                            )}
                            <div className="relative">
                              <button 
                                onClick={() => setOpenDropdownUid(openDropdownUid === u.uid ? null : u.uid)}
                                className="bg-gray-100 text-gray-600 px-3 py-1 rounded-lg text-xs font-bold hover:bg-gray-200 transition-colors flex items-center gap-1"
                              >
                                Link Player <ChevronDown className={cn("h-3 w-3 transition-transform", openDropdownUid === u.uid && "rotate-180")} />
                              </button>
                              {openDropdownUid === u.uid && (
                                <>
                                  <div 
                                    className="fixed inset-0 z-10" 
                                    onClick={() => setOpenDropdownUid(null)}
                                  />
                                  <div className={cn(
                                    "absolute right-0 mt-1 w-48 bg-white rounded-xl shadow-xl border border-gray-100 py-1 z-20 max-h-60 overflow-y-auto",
                                    filteredUsers.indexOf(u) >= filteredUsers.length - 2 && filteredUsers.length > 3 ? "bottom-full mb-1" : "top-full mt-1"
                                  )}>
                                    {players.filter(p => !u.playerIds.includes(p.id)).map(p => (
                                      <button 
                                        key={p.id}
                                        onClick={() => {
                                          handleLinkPlayer(u.uid, p.id);
                                          setOpenDropdownUid(null);
                                        }}
                                        className="w-full text-left px-4 py-2 text-xs text-gray-700 hover:bg-indigo-50 hover:text-indigo-600 transition-colors"
                                      >
                                        {p.name}
                                      </button>
                                    ))}
                                    {players.filter(p => !u.playerIds.includes(p.id)).length === 0 && (
                                      <div className="px-4 py-2 text-xs text-gray-400 italic">No more players</div>
                                    )}
                                  </div>
                                </>
                              )}
                            </div>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
