import { 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  query, 
  where, 
  onSnapshot, 
  setDoc, 
  serverTimestamp,
  Timestamp
} from 'firebase/firestore';
import { db, auth } from '../firebase';
import { Player, Game, Pairing, Ban, UserProfile, LadderType } from '../types';

const OperationType = {
  CREATE: 'create',
  UPDATE: 'update',
  DELETE: 'delete',
  LIST: 'list',
  GET: 'get',
  WRITE: 'write',
} as const;

type OperationType = typeof OperationType[keyof typeof OperationType];

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: any;
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export const chessService = {
  // Players
  onPlayersChange: (callback: (players: Player[]) => void) => {
    const q = collection(db, 'players');
    return onSnapshot(q, (snapshot) => {
      const players = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Player));
      callback(players);
    }, (error) => handleFirestoreError(error, OperationType.GET, 'players'));
  },

  getPlayer: async (playerId: string) => {
    const path = `players/${playerId}`;
    try {
      const playerDoc = await getDoc(doc(db, 'players', playerId));
      return playerDoc.exists() ? ({ id: playerDoc.id, ...playerDoc.data() } as Player) : null;
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, path);
    }
  },

  onPlayerChange: (playerId: string, callback: (player: Player | null) => void) => {
    const path = `players/${playerId}`;
    return onSnapshot(doc(db, 'players', playerId), (snapshot) => {
      if (snapshot.exists()) {
        callback({ id: snapshot.id, ...snapshot.data() } as Player);
      } else {
        callback(null);
      }
    }, (error) => handleFirestoreError(error, OperationType.GET, path));
  },

  addPlayer: async (name: string) => {
    const path = 'players';
    try {
      const rankings: Record<LadderType, number> = {
        classical: 1200,
        rapid: 1200,
        blitz: 1200,
        bullet: 1200,
        chess960: 1200,
      };
      await addDoc(collection(db, path), {
        name,
        isPresent: false,
        rankings,
        createdAt: new Date().toISOString(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, path);
    }
  },

  updatePlayerPresence: async (playerId: string, isPresent: boolean) => {
    const path = `players/${playerId}`;
    try {
      await updateDoc(doc(db, 'players', playerId), { isPresent });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  },

  updatePlayerRanking: async (playerId: string, ladderType: LadderType, newRanking: number) => {
    const path = `players/${playerId}`;
    try {
      const playerDoc = await getDoc(doc(db, 'players', playerId));
      if (!playerDoc.exists()) return;
      const rankings = playerDoc.data().rankings || {};
      rankings[ladderType] = newRanking;
      await updateDoc(doc(db, 'players', playerId), { rankings });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  },

  // Games
  onGamesChange: (callback: (games: Game[]) => void) => {
    const q = collection(db, 'games');
    return onSnapshot(q, (snapshot) => {
      const games = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Game));
      callback(games);
    }, (error) => handleFirestoreError(error, OperationType.GET, 'games'));
  },

  addGame: async (whitePlayerId: string, blackPlayerId: string, result: 'white' | 'black' | 'draw', ladderType: LadderType) => {
    const path = 'games';
    try {
      const gameData = {
        whitePlayerId,
        blackPlayerId,
        result,
        ladderType,
        timestamp: new Date().toISOString(),
      };
      await addDoc(collection(db, path), gameData);
      // Update rankings (simplified Elo for now)
      await chessService.updateRankings(gameData as any);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, path);
    }
  },

  updateRankings: async (game: Omit<Game, 'id'>) => {
    const whiteDoc = await getDoc(doc(db, 'players', game.whitePlayerId));
    const blackDoc = await getDoc(doc(db, 'players', game.blackPlayerId));
    
    if (!whiteDoc.exists() || !blackDoc.exists()) return;

    const white = whiteDoc.data() as Player;
    const black = blackDoc.data() as Player;

    const Rw = white.rankings[game.ladderType] || 1200;
    const Rb = black.rankings[game.ladderType] || 1200;

    const Ew = 1 / (1 + Math.pow(10, (Rb - Rw) / 400));
    const Eb = 1 / (1 + Math.pow(10, (Rw - Rb) / 400));

    let Sw = 0.5, Sb = 0.5;
    if (game.result === 'white') { Sw = 1; Sb = 0; }
    else if (game.result === 'black') { Sw = 0; Sb = 1; }
    else if (game.result === 'cancelled') return;

    const K = 32;
    const newRw = Math.round(Rw + K * (Sw - Ew));
    const newRb = Math.round(Rb + K * (Sb - Eb));

    await updateDoc(doc(db, 'players', game.whitePlayerId), {
      [`rankings.${game.ladderType}`]: newRw
    });
    await updateDoc(doc(db, 'players', game.blackPlayerId), {
      [`rankings.${game.ladderType}`]: newRb
    });
  },

  // Pairings
  onPairingsChange: (callback: (pairings: Pairing[]) => void) => {
    const q = collection(db, 'pairings');
    return onSnapshot(q, (snapshot) => {
      const pairings = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Pairing));
      callback(pairings);
    }, (error) => handleFirestoreError(error, OperationType.GET, 'pairings'));
  },

  addPairing: async (whitePlayerId: string, blackPlayerId: string | undefined, ladderType: LadderType, boardNumber?: number) => {
    const path = 'pairings';
    try {
      const pairingData: any = {
        whitePlayerId,
        ladderType,
        status: 'draft',
        timestamp: new Date().toISOString(),
      };
      if (blackPlayerId) {
        pairingData.blackPlayerId = blackPlayerId;
      }
      if (boardNumber !== undefined) {
        pairingData.boardNumber = boardNumber;
      }
      await addDoc(collection(db, path), pairingData);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, path);
    }
  },

  updatePairingStatus: async (pairingId: string, status: Pairing['status'], result?: Pairing['result']) => {
    const path = `pairings/${pairingId}`;
    try {
      const updateData: any = { status };
      if (result) updateData.result = result;
      await updateDoc(doc(db, 'pairings', pairingId), updateData);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  },

  updatePairingResult: async (pairingId: string, result: Pairing['result']) => {
    const path = `pairings/${pairingId}`;
    try {
      await updateDoc(doc(db, 'pairings', pairingId), { result });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  },

  finalizePairings: async (pairingIds: string[]) => {
    try {
      for (const id of pairingIds) {
        const pairingDoc = await getDoc(doc(db, 'pairings', id));
        if (!pairingDoc.exists()) continue;
        const pairing = { id: pairingDoc.id, ...pairingDoc.data() } as Pairing;
        
        if (pairing.status === 'completed' && pairing.result && pairing.blackPlayerId) {
          await chessService.addGame(
            pairing.whitePlayerId,
            pairing.blackPlayerId,
            pairing.result,
            pairing.ladderType
          );
        }
        await updateDoc(doc(db, 'pairings', id), { status: 'finalized' });
      }
    } catch (error) {
      console.error('Error finalizing pairings:', error);
      throw error;
    }
  },

  deletePairing: async (pairingId: string) => {
    const path = `pairings/${pairingId}`;
    try {
      await deleteDoc(doc(db, 'pairings', pairingId));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, path);
    }
  },

  // Bans
  onBansChange: (callback: (bans: Ban[]) => void) => {
    const q = collection(db, 'bans');
    return onSnapshot(q, (snapshot) => {
      const bans = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Ban));
      callback(bans);
    }, (error) => handleFirestoreError(error, OperationType.GET, 'bans'));
  },

  addBan: async (player1Id: string, player2Id: string) => {
    const path = 'bans';
    try {
      await addDoc(collection(db, path), { player1Id, player2Id });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, path);
    }
  },

  removeBan: async (banId: string) => {
    const path = `bans/${banId}`;
    try {
      await deleteDoc(doc(db, 'bans', banId));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, path);
    }
  },

  // User Profiles
  getUserProfile: async (uid: string) => {
    const path = `users/${uid}`;
    try {
      const userDoc = await getDoc(doc(db, 'users', uid));
      return userDoc.exists() ? (userDoc.data() as UserProfile) : null;
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, path);
    }
  },

  createUserProfile: async (profile: UserProfile) => {
    const path = `users/${profile.uid}`;
    try {
      await setDoc(doc(db, 'users', profile.uid), profile);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, path);
    }
  },

  onUsersChange: (callback: (users: UserProfile[]) => void) => {
    const q = collection(db, 'users');
    return onSnapshot(q, (snapshot) => {
      const users = snapshot.docs.map(doc => doc.data() as UserProfile);
      callback(users);
    }, (error) => handleFirestoreError(error, OperationType.GET, 'users'));
  },

  updateUserProfile: async (uid: string, updates: Partial<UserProfile>) => {
    const path = `users/${uid}`;
    try {
      await updateDoc(doc(db, 'users', uid), updates);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  }
};
