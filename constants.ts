import { PuzzleConfig } from "./types";

export const INITIAL_PUZZLES: PuzzleConfig[] = [
  // Existing & Categorized
  {
    id: 'p1',
    title: 'Serene Lake',
    src: 'https://picsum.photos/id/10/800/800',
    difficulty: 'easy',
    category: 'Nature'
  },
  {
    id: 'p2',
    title: 'Mountain Fog',
    src: 'https://picsum.photos/id/16/800/800',
    difficulty: 'normal',
    category: 'Nature'
  },
  {
    id: 'p3',
    title: 'Autumn Path',
    src: 'https://picsum.photos/id/28/800/800',
    difficulty: 'hard',
    category: 'Autumn'
  },
  {
    id: 'p4',
    title: 'City Lights',
    src: 'https://picsum.photos/id/54/800/800',
    difficulty: 'expert',
    category: 'Urban'
  },
  {
    id: 'p5',
    title: 'Morning Dew',
    src: 'https://picsum.photos/id/104/800/800',
    difficulty: 'normal',
    category: 'Spring'
  },
  {
    id: 'p6',
    title: 'Coastal Cliff',
    src: 'https://picsum.photos/id/29/800/800',
    difficulty: 'normal',
    category: 'Summer'
  },
  {
    id: 'p7',
    title: 'Strawberry Fields',
    src: 'https://picsum.photos/id/108/800/800',
    difficulty: 'easy',
    category: 'Summer'
  },
  {
    id: 'p8',
    title: 'Urban Geometry',
    src: 'https://picsum.photos/id/122/800/800',
    difficulty: 'hard',
    category: 'Urban'
  },
  {
    id: 'p9',
    title: 'Starry Night',
    src: 'https://picsum.photos/id/142/800/800',
    difficulty: 'expert',
    category: 'Nature'
  },
  {
    id: 'p10',
    title: 'Rainy Window',
    src: 'https://picsum.photos/id/184/800/800',
    difficulty: 'normal',
    category: 'Autumn'
  },
  {
    id: 'p11',
    title: 'Old Library',
    src: 'https://picsum.photos/id/192/800/800',
    difficulty: 'hard',
    category: 'Indoor'
  },
  {
    id: 'p12',
    title: 'Deep Forest',
    src: 'https://picsum.photos/id/234/800/800',
    difficulty: 'normal',
    category: 'Nature'
  },
  {
    id: 'p13',
    title: 'Winter Peak',
    src: 'https://picsum.photos/id/239/800/800',
    difficulty: 'easy',
    category: 'Winter'
  },
  {
    id: 'p14',
    title: 'Desert Dunes',
    src: 'https://picsum.photos/id/249/800/800',
    difficulty: 'hard',
    category: 'Nature'
  },
  {
    id: 'p15',
    title: 'Coffee Break',
    src: 'https://picsum.photos/id/251/800/800',
    difficulty: 'easy',
    category: 'Indoor'
  },
  {
    id: 'p16',
    title: 'Ancient Stone',
    src: 'https://picsum.photos/id/268/800/800',
    difficulty: 'expert',
    category: 'Nature'
  },
  {
    id: 'p17',
    title: 'Golden Gate',
    src: 'https://picsum.photos/id/364/800/800',
    difficulty: 'normal',
    category: 'Urban'
  },
  {
    id: 'p18',
    title: 'Vintage Vibes',
    src: 'https://picsum.photos/id/389/800/800',
    difficulty: 'normal',
    category: 'Indoor'
  },
  {
    id: 'p19',
    title: 'Lighthouse',
    src: 'https://picsum.photos/id/400/800/800',
    difficulty: 'hard',
    category: 'Summer'
  },
  {
    id: 'p20',
    title: 'Misty River',
    src: 'https://picsum.photos/id/410/800/800',
    difficulty: 'easy',
    category: 'Nature'
  },

  // SPRING PACK
  { id: 's1', title: 'Cherry Blossom', src: 'https://picsum.photos/id/360/800/800', difficulty: 'normal', category: 'Spring' },
  { id: 's2', title: 'Green Shoot', src: 'https://picsum.photos/id/406/800/800', difficulty: 'easy', category: 'Spring' },
  { id: 's3', title: 'Floral Meadow', src: 'https://picsum.photos/id/429/800/800', difficulty: 'hard', category: 'Spring' },
  { id: 's4', title: 'Gentle Stream', src: 'https://picsum.photos/id/412/800/800', difficulty: 'normal', category: 'Spring' },

  // SUMMER PACK
  { id: 'su1', title: 'Azure Coast', src: 'https://picsum.photos/id/431/800/800', difficulty: 'normal', category: 'Summer' },
  { id: 'su2', title: 'Sunflowers', src: 'https://picsum.photos/id/444/800/800', difficulty: 'hard', category: 'Summer' },
  { id: 'su3', title: 'Palm Shadows', src: 'https://picsum.photos/id/452/800/800', difficulty: 'easy', category: 'Summer' },
  { id: 'su4', title: 'Clear Sky', src: 'https://picsum.photos/id/453/800/800', difficulty: 'normal', category: 'Summer' },

  // AUTUMN PACK
  { id: 'au1', title: 'Golden Leaves', src: 'https://picsum.photos/id/465/800/800', difficulty: 'normal', category: 'Autumn' },
  { id: 'au2', title: 'Harvest Time', src: 'https://picsum.photos/id/486/800/800', difficulty: 'hard', category: 'Autumn' },
  { id: 'au3', title: 'Foggy Woods', src: 'https://picsum.photos/id/491/800/800', difficulty: 'expert', category: 'Autumn' },
  { id: 'au4', title: 'Rustic Barn', src: 'https://picsum.photos/id/511/800/800', difficulty: 'easy', category: 'Autumn' },

  // WINTER PACK
  { id: 'w1', title: 'Snowy Peaks', src: 'https://picsum.photos/id/551/800/800', difficulty: 'hard', category: 'Winter' },
  { id: 'w2', title: 'Frozen Lake', src: 'https://picsum.photos/id/566/800/800', difficulty: 'expert', category: 'Winter' },
  { id: 'w3', title: 'Cozy Fire', src: 'https://picsum.photos/id/571/800/800', difficulty: 'easy', category: 'Winter' },
  { id: 'w4', title: 'Ice Crystals', src: 'https://picsum.photos/id/577/800/800', difficulty: 'normal', category: 'Winter' },
];

export const DIFFICULTY_SETTINGS = {
  easy: { rows: 3, cols: 3, snapThreshold: 5, rotate: false, hints: 5 },
  normal: { rows: 5, cols: 5, snapThreshold: 4, rotate: false, hints: 3 },
  hard: { rows: 7, cols: 7, snapThreshold: 3, rotate: true, hints: 1 },
  expert: { rows: 10, cols: 10, snapThreshold: 2, rotate: true, hints: 0 },
};
