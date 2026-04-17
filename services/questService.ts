import { UserStats, QuestProgress, Difficulty, PuzzleConfig } from '../types';
import { QUESTS, CHALLENGES } from '../constants';
import { loadUserStats, saveUserStats } from './statsService';

const CATEGORIES = ['Classic Cars', 'Animals', 'Cats', 'Disney Characters', 'Historical Buildings', 'People', 'Abstract', 'Nature', 'Urban', 'Spring', 'Summer', 'Autumn', 'Winter', 'Indoor', 'Fine Art & Masterpieces', 'Icons & Logos', 'Movies & TV Shows', 'Album Covers', 'Abstract & Colour Gradients'];

const getNextMonday = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1) + 7; // next Monday
  return new Date(d.setDate(diff)).getTime();
};

const getNextMidnight = () => {
  const d = new Date();
  d.setHours(24, 0, 0, 0);
  return d.getTime();
};

export const initializeQuests = (stats: UserStats): UserStats => {
  let updated = false;
  const now = Date.now();

  if (!stats.weeklyResetTime || now >= stats.weeklyResetTime) {
    stats.weeklyResetTime = getNextMonday();
    stats.weeklyCategory = CATEGORIES[Math.floor(Math.random() * CATEGORIES.length)];
    // Reset weekly quests (QUESTS)
    stats.questProgress = {};
    updated = true;
  }

  if (!stats.dailyResetTime || now >= stats.dailyResetTime) {
    stats.dailyResetTime = getNextMidnight();
    stats.dailyCategory = CATEGORIES[Math.floor(Math.random() * CATEGORIES.length)];
    // Reset daily challenges (CHALLENGES)
    stats.challengeProgress = {};
    updated = true;
  }

  if (!stats.questProgress) {
    stats.questProgress = {};
    updated = true;
  }
  if (!stats.challengeProgress) {
    stats.challengeProgress = {};
    updated = true;
  }

  QUESTS.forEach(q => {
    if (!stats.questProgress![q.id]) {
      stats.questProgress![q.id] = { questId: q.id, currentValue: 0, isCompleted: false, isClaimed: false };
      updated = true;
    }
  });

  CHALLENGES.forEach(c => {
    if (!stats.challengeProgress![c.id]) {
      stats.challengeProgress![c.id] = { questId: c.id, currentValue: 0, isCompleted: false, isClaimed: false };
      updated = true;
    }
  });

  if (updated) {
    saveUserStats(stats);
  }
  return stats;
};

export const updateQuestProgress = (
  puzzle: PuzzleConfig,
  difficulty: Difficulty,
  timeSeconds: number,
  scoreEarned: number
) => {
  const stats = loadUserStats();
  initializeQuests(stats);

  let updated = false;
  let totalRewardPoints = 0;

  const processList = (definitions: typeof QUESTS, progressMap: Record<string, QuestProgress>, pointsToProcess: number, isMainPass: boolean) => {
    definitions.forEach(def => {
      const progress = progressMap[def.id];
      if (progress.isCompleted) return;

      let newValue = progress.currentValue;

      if (isMainPass) {
        switch (def.type) {
          case 'COMPLETE_COUNT':
            if (!def.targetDifficulty || def.targetDifficulty === difficulty) {
              newValue += 1;
            }
            break;
          case 'COMPLETE_CATEGORY':
            const targetCat = def.id === 'q2' ? stats.weeklyCategory : (def.id === 'c3' ? stats.dailyCategory : def.targetCategory);
            if (targetCat === puzzle.category) {
              newValue += 1;
            }
            break;
          case 'SPEED_RUN':
            if (def.targetDifficulty === difficulty && timeSeconds <= def.targetValue) {
              newValue = def.targetValue; // Mark as done
            }
            break;
        }
      }

      if (def.type === 'EARN_POINTS' && pointsToProcess > 0) {
        newValue += pointsToProcess;
      }

      if (newValue !== progress.currentValue) {
        progress.currentValue = newValue;
        if (progress.currentValue >= def.targetValue) {
          progress.isCompleted = true;
          // Auto-collect points
          progress.isClaimed = true;
          stats.totalPoints += def.rewardPoints;
          totalRewardPoints += def.rewardPoints;
        }
        updated = true;
      }
    });
  };

  processList(QUESTS, stats.questProgress!, scoreEarned, true);
  processList(CHALLENGES, stats.challengeProgress!, scoreEarned, true);

  // If any quests were completed and gave reward points, those points also count towards EARN_POINTS
  if (totalRewardPoints > 0) {
      processList(QUESTS, stats.questProgress!, totalRewardPoints, false);
      processList(CHALLENGES, stats.challengeProgress!, totalRewardPoints, false);
  }

  if (updated) {
    saveUserStats(stats);
  }
  return stats;
};

export const claimReward = (questId: string, isChallenge: boolean = false): UserStats => {
  // Keeping this for backward compatibility or manual claims if any are missed
  const stats = loadUserStats();
  
  const progressMap = isChallenge ? stats.challengeProgress : stats.questProgress;
  const definitions = isChallenge ? CHALLENGES : QUESTS;
  
  if (!progressMap) return stats;

  const progress = progressMap[questId];
  const def = definitions.find(d => d.id === questId);

  if (progress && def && progress.isCompleted && !progress.isClaimed) {
    progress.isClaimed = true;
    stats.totalPoints += def.rewardPoints;
    
    // Check EARN_POINTS quests since totalPoints increased
    const checkEarnPoints = (defs: typeof QUESTS, pMap: Record<string, QuestProgress>) => {
        defs.forEach(d => {
            if (d.type === 'EARN_POINTS' && pMap[d.id] && !pMap[d.id].isCompleted) {
                pMap[d.id].currentValue += def.rewardPoints;
                if (pMap[d.id].currentValue >= d.targetValue) {
                    pMap[d.id].isCompleted = true;
                    pMap[d.id].isClaimed = true;
                    stats.totalPoints += d.rewardPoints;
                }
            }
        });
    };
    
    if (stats.questProgress) checkEarnPoints(QUESTS, stats.questProgress);
    if (stats.challengeProgress) checkEarnPoints(CHALLENGES, stats.challengeProgress);

    saveUserStats(stats);
  }

  return stats;
};
