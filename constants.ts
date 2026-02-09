import { PuzzleConfig } from "./types";

export const INITIAL_PUZZLES: PuzzleConfig[] = [
  {
    id: 'p1',
    title: 'Serene Lake',
    src: 'https://picsum.photos/id/10/800/800',
    difficulty: 'easy'
  },
  {
    id: 'p2',
    title: 'Mountain Fog',
    src: 'https://picsum.photos/id/16/800/800',
    difficulty: 'normal'
  },
  {
    id: 'p3',
    title: 'Autumn Path',
    src: 'https://picsum.photos/id/28/800/800',
    difficulty: 'hard'
  },
  {
    id: 'p4',
    title: 'City Lights',
    src: 'https://picsum.photos/id/54/800/800',
    difficulty: 'expert'
  },
  {
    id: 'p5',
    title: 'Abstract Geometric',
    src: 'https://picsum.photos/id/104/800/800',
    difficulty: 'normal'
  }
];

export const DIFFICULTY_SETTINGS = {
  easy: { rows: 3, cols: 3, snapThreshold: 5, rotate: false },
  normal: { rows: 5, cols: 5, snapThreshold: 4, rotate: false },
  hard: { rows: 7, cols: 7, snapThreshold: 3, rotate: true },
  expert: { rows: 10, cols: 10, snapThreshold: 2, rotate: true },
};