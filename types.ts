export type AppView = 'home' | 'gallery' | 'create' | 'game';

export type Difficulty = 'easy' | 'normal' | 'hard' | 'expert';

export interface PuzzleConfig {
  id: string;
  src: string;
  title: string;
  difficulty?: Difficulty;
}

export interface GeneratedImage {
  id: string;
  src: string;
  title: string;
  isAi: boolean;
}

export interface Piece {
  id: number;
  correctX: number; // Percentage 0-100
  correctY: number; // Percentage 0-100
  currentX: number; // Percentage 0-100
  currentY: number; // Percentage 0-100
  width: number;    // Percentage
  height: number;   // Percentage
  isLocked: boolean;
  bgX: number;      // Percentage position for background image
  bgY: number;      // Percentage position for background image
  rotation: number; // Degrees (0, 90, 180, 270)
}

export interface GameState {
  pieces: Piece[];
  startTime: number;
  isComplete: boolean;
  moveCount: number;
}