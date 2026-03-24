export type LadderType = 'classical' | 'rapid' | 'blitz' | 'bullet' | 'chess960';

export interface Player {
  id: string;
  name: string;
  isPresent: boolean;
  rankings: Record<LadderType, number>;
  createdAt: string;
}

export interface Game {
  id: string;
  whitePlayerId: string;
  blackPlayerId: string;
  result: 'white' | 'black' | 'draw' | 'cancelled';
  ladderType: LadderType;
  timestamp: string;
}

export interface Pairing {
  id: string;
  whitePlayerId: string;
  blackPlayerId?: string; // Optional for 'Bye'
  ladderType: LadderType;
  status: 'draft' | 'published' | 'completed' | 'finalized' | 'cancelled';
  boardNumber?: number;
  result?: 'white' | 'black' | 'draw';
}

export interface Ban {
  id: string;
  player1Id: string;
  player2Id: string;
}

export interface UserProfile {
  uid: string;
  email: string;
  playerIds: string[];
  role: 'admin' | 'user';
  isApproved: boolean;
}
