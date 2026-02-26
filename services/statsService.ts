import { Difficulty, UserStats } from '../types';

const STATS_KEY = 'mosaic_user_stats';

const DEFAULT_STATS: UserStats = {
  totalPoints: 0,
  bestTimes: {
    easy: null,
    normal: null,
    hard: null,
    expert: null,
  }
};

export const loadUserStats = (): UserStats => {
  try {
    const stored = localStorage.getItem(STATS_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      // Merge with default to ensure structure integrity
      return { 
          totalPoints: parsed.totalPoints || 0,
          bestTimes: { ...DEFAULT_STATS.bestTimes, ...(parsed.bestTimes || {}) }
      };
    }
  } catch (e) {
    console.error("Failed to load stats", e);
  }
  return DEFAULT_STATS;
};

export const saveUserStats = (stats: UserStats) => {
  try {
    localStorage.setItem(STATS_KEY, JSON.stringify(stats));
  } catch (e) {
    console.error("Failed to save stats", e);
  }
};

export const calculateScore = (difficulty: Difficulty, timeSeconds: number): number => {
  // Base points per difficulty
  const config = {
    easy: { base: 100, targetTime: 60 },
    normal: { base: 300, targetTime: 180 },
    hard: { base: 600, targetTime: 300 },
    expert: { base: 1200, targetTime: 600 }
  };

  const { base, targetTime } = config[difficulty];
  
  // Ensure timeSeconds is at least 1 to avoid division by zero
  const safeTime = Math.max(1, timeSeconds);
  
  // Bonus based on speed relative to target time
  // If faster than target, multiplier > 1. If slower, multiplier < 1.
  const timeMultiplier = targetTime / safeTime;
  
  // Score = Base + (Base * TimeMultiplier)
  // This rewards speed significantly.
  // Example: 2x faster = 3x base score.
  // Example: 2x slower = 1.5x base score.
  
  const score = Math.floor(base + (base * timeMultiplier));
  
  return score;
};

export const updateUserStats = (difficulty: Difficulty, timeSeconds: number): { stats: UserStats, score: number, isNewRecord: boolean } => {
    const stats = loadUserStats();
    const score = calculateScore(difficulty, timeSeconds);
    
    stats.totalPoints += score;
    
    let isNewRecord = false;
    const currentBest = stats.bestTimes[difficulty];
    
    if (currentBest === null || timeSeconds < currentBest) {
        stats.bestTimes[difficulty] = timeSeconds;
        isNewRecord = true;
    }
    
    saveUserStats(stats);
    
    return { stats, score, isNewRecord };
};

export const resetBestTimes = (): UserStats => {
    const stats = loadUserStats();
    stats.bestTimes = {
        easy: null,
        normal: null,
        hard: null,
        expert: null
    };
    saveUserStats(stats);
    return stats;
};

export const resetBestTimeForDifficulty = (difficulty: Difficulty): UserStats => {
    const stats = loadUserStats();
    stats.bestTimes[difficulty] = null;
    saveUserStats(stats);
    return stats;
};

export const formatTime = (seconds: number | null): string => {
    if (seconds === null || seconds === undefined) return '--:--';
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
};
