
export type AppView = 'home' | 'gallery' | 'create' | 'game' | 'quests';

export type Difficulty = 'easy' | 'normal' | 'hard' | 'expert';

export type PuzzleStyle = 'classic' | 'mosaic';

export type QuestType = 'COMPLETE_COUNT' | 'COMPLETE_CATEGORY' | 'SPEED_RUN' | 'EARN_POINTS';

export interface QuestDefinition {
  id: string;
  title: string;
  description: string;
  rewardPoints: number;
  type: QuestType;
  targetValue: number;
  targetCategory?: string;
  targetDifficulty?: Difficulty;
}

export interface QuestProgress {
  questId: string;
  currentValue: number;
  isCompleted: boolean;
  isClaimed: boolean;
}

export interface PuzzleConfig {
  id: string;
  src: string;
  title: string;
  difficulty?: Difficulty;
  isDaily?: boolean;
  category?: string;
  isUserUpload?: boolean;
  isAi?: boolean;
}

export interface GeneratedImage {
  id: string;
  src: string;
  title: string;
  isAi: boolean;
  category?: string;
}

export interface Piece {
  id: number;
  correctX: number; // Percentage 0-100 (Top-Left of the bounding box)
  correctY: number; // Percentage 0-100
  currentX: number; // Percentage 0-100
  currentY: number; // Percentage 0-100
  width: number;    // Percentage
  height: number;   // Percentage
  isLocked: boolean;
  bgX: number;      // Percentage position for background image (for Classic)
  bgY: number;      // Percentage position for background image (for Classic)
  rotation: number; // Degrees
  
  // Grouping
  groupId: string;
  
  // New properties for Mosaic style
  shape: PuzzleStyle;
  pathData?: string; // SVG Path string (in 0-100 coordinate space)
  viewBox?: string;  // SVG ViewBox string "minX minY w h"
}

export interface SavedGameState {
  puzzleId: string;
  pieces: Piece[];
  difficulty: Difficulty;
  style: PuzzleStyle;
  elapsedTime: number;
  hintsRemaining: number;
  isChaosMode: boolean;
  lastPlayed: number;
}

export interface UserStats {
  totalPoints: number;
  bestTimes: {
    easy: number | null;
    normal: number | null;
    hard: number | null;
    expert: number | null;
  };
  questProgress?: Record<string, QuestProgress>;
  challengeProgress?: Record<string, QuestProgress>;
  weeklyResetTime?: number;
  dailyResetTime?: number;
  weeklyCategory?: string;
  dailyCategory?: string;
}

export interface GameState {
  pieces: Piece[];
  startTime: number;
  isComplete: boolean;
  moveCount: number;
}