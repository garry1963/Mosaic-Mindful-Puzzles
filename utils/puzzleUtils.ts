import { Piece, Difficulty } from "../types";
import { DIFFICULTY_SETTINGS } from "../constants";

export const createPuzzlePieces = (difficulty: Difficulty): Piece[] => {
  const settings = DIFFICULTY_SETTINGS[difficulty];
  const { rows, cols, rotate } = settings;
  const pieces: Piece[] = [];
  const count = rows * cols;
  
  const pieceWidth = 100 / cols;
  const pieceHeight = 100 / rows;

  for (let i = 0; i < count; i++) {
    const row = Math.floor(i / cols);
    const col = i % cols;

    const correctX = col * pieceWidth;
    const correctY = row * pieceHeight;

    // Scatter logic: Random position within the board (0-100 range roughly)
    // We add some buffer so they don't fly off screen entirely, 
    // but they should be initially messy.
    // Using a simpler scatter for now: random position in a wider container 
    // or just randomized within the frame.
    
    // Ideally, scatter zone is separate, but for this single-canvas approach, 
    // let's randomize them on the board but ensure they are distinguishable.
    const currentX = Math.random() * (100 - pieceWidth);
    const currentY = Math.random() * (100 - pieceHeight);
    
    const rotation = rotate ? Math.floor(Math.random() * 4) * 90 : 0;

    pieces.push({
      id: i,
      correctX,
      correctY,
      currentX,
      currentY,
      width: pieceWidth,
      height: pieceHeight,
      isLocked: false,
      bgX: col * 100 / (cols - 1), // CSS background-position percentage
      bgY: row * 100 / (rows - 1),
      rotation
    });
  }
  
  // Shuffle drawing order implicitly by array order? 
  // We might want to render them in a specific order (locked ones bottom).
  // But shuffling the array initially helps "mix" them visually.
  return pieces.sort(() => Math.random() - 0.5);
};

export const checkSnap = (piece: Piece, difficulty: Difficulty): boolean => {
  const settings = DIFFICULTY_SETTINGS[difficulty];
  const threshold = settings.snapThreshold;

  const dx = Math.abs(piece.currentX - piece.correctX);
  const dy = Math.abs(piece.currentY - piece.correctY);

  // If rotation is enabled, must be 0 (or 360) to snap
  const isRotationCorrect = !settings.rotate || (piece.rotation % 360 === 0);

  return dx < threshold && dy < threshold && isRotationCorrect;
};