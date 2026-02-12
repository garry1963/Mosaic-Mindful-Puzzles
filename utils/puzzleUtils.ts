import { Piece, Difficulty, PuzzleStyle } from "../types";
import { DIFFICULTY_SETTINGS } from "../constants";

// Helper to generate a random number between min and max
const randomRange = (min: number, max: number): number => {
  return Math.random() * (max - min) + min;
};

// Internal helper for Mosaic edge generation
const getMosaicEdgePath = (p1: {x:number, y:number}, p2: {x:number, y:number}, edgeId: string, reverse: boolean): string => {
    // Seeded random simulation
    const str = edgeId;
    let h = 0x811c9dc5;
    for (let i = 0; i < str.length; i++) {
        h ^= str.charCodeAt(i);
        h = Math.imul(h, 0x01000193);
    }
    const floatVal = ((h >>> 0) / 4294967296);
    const floatVal2 = (((h ^ 12345) >>> 0) / 4294967296);

    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    
    const len = Math.sqrt(dx * dx + dy * dy);
    const nx = -dy / len;
    const ny = dx / len;
    
    const curveScale = 0.25;
    
    let variance = (floatVal - 0.5) * curveScale * len;
    let variance2 = (floatVal2 - 0.5) * curveScale * len;
    
    if (reverse) {
        variance = -variance;
        variance2 = -variance2;
    }

    const cp1x = p1.x + dx * 0.33 + nx * variance;
    const cp1y = p1.y + dy * 0.33 + ny * variance;
    const cp2x = p1.x + dx * 0.66 + nx * variance2;
    const cp2y = p1.y + dy * 0.66 + ny * variance2;

    return `C ${cp1x.toFixed(2)} ${cp1y.toFixed(2)}, ${cp2x.toFixed(2)} ${cp2y.toFixed(2)}, ${p2.x.toFixed(2)} ${p2.y.toFixed(2)}`;
};

// Internal helper to generate Mosaic pieces specifically
const generateMosaicPieces = (rows: number, cols: number, pieceWidth: number, pieceHeight: number, rotate: boolean, positions: {x: number, y: number}[]): Piece[] => {
    // 1. Generate Vertices
    const verts: {x: number, y: number}[][] = [];
    for (let r = 0; r <= rows; r++) {
      verts[r] = [];
      for (let c = 0; c <= cols; c++) {
        let x = c * pieceWidth;
        let y = r * pieceHeight;
  
        // Perturb internal vertices
        if (r > 0 && r < rows && c > 0 && c < cols) {
          const maxJitterX = pieceWidth * 0.25;
          const maxJitterY = pieceHeight * 0.25;
          x += randomRange(-maxJitterX, maxJitterX);
          y += randomRange(-maxJitterY, maxJitterY);
        }
        verts[r][c] = { x, y };
      }
    }
  
    const finalPieces: Piece[] = [];
    
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const pTL = verts[r][c];
        const pTR = verts[r][c+1];
        const pBR = verts[r+1][c+1];
        const pBL = verts[r+1][c];
        
        let d = `M ${pTL.x.toFixed(2)} ${pTL.y.toFixed(2)} `;
        
        // Top
        if (r === 0) d += `L ${pTR.x.toFixed(2)} ${pTR.y.toFixed(2)} `;
        else d += getMosaicEdgePath(pTL, pTR, `h-${r}-${c}`, false) + " ";
        
        // Right
        if (c === cols - 1) d += `L ${pBR.x.toFixed(2)} ${pBR.y.toFixed(2)} `;
        else d += getMosaicEdgePath(pTR, pBR, `v-${r}-${c+1}`, false) + " ";
        
        // Bottom
        if (r === rows - 1) d += `L ${pBL.x.toFixed(2)} ${pBL.y.toFixed(2)} `;
        else d += getMosaicEdgePath(pBR, pBL, `h-${r+1}-${c}`, true) + " ";
        
        // Left
        if (c === 0) d += `L ${pTL.x.toFixed(2)} ${pTL.y.toFixed(2)} `;
        else d += getMosaicEdgePath(pBL, pTL, `v-${r}-${c}`, true) + " ";
        
        d += "Z";
        
        const xs = [pTL.x, pTR.x, pBR.x, pBL.x];
        const ys = [pTL.y, pTR.y, pBR.y, pBL.y];
        
        // Dynamic Padding: 35% of the piece dimension covers max jitter (25%) + curve variance
        const paddingX = pieceWidth * 0.35;
        const paddingY = pieceHeight * 0.35;

        const minX = Math.min(...xs) - paddingX;
        const maxX = Math.max(...xs) + paddingX;
        const minY = Math.min(...ys) - paddingY;
        const maxY = Math.max(...ys) + paddingY;
        
        const w = maxX - minX;
        const h = maxY - minY;
        
        // Use shuffled grid positions
        const index = r * cols + c;
        
        // Correct offset calculation:
        // We need to apply the same bounding-box offset to the shuffled grid position
        // that exists for the correct grid position.
        const originalGridX = c * pieceWidth;
        const originalGridY = r * pieceHeight;
        const offsetX = minX - originalGridX;
        const offsetY = minY - originalGridY;
        
        const currentX = positions[index].x + offsetX;
        const currentY = positions[index].y + offsetY;
  
        const rotation = rotate ? Math.floor(Math.random() * 4) * 90 : 0;
        
        finalPieces.push({
            id: r * cols + c,
            correctX: minX,
            correctY: minY,
            width: w,
            height: h,
            currentX,
            currentY,
            isLocked: false,
            bgX: 0, 
            bgY: 0, 
            rotation,
            groupId: `group-${r * cols + c}`,
            shape: 'mosaic',
            pathData: d,
            viewBox: `${minX} ${minY} ${w} ${h}`
        });
      }
    }
    
    return finalPieces;
};

export const createPuzzlePieces = (difficulty: Difficulty, style: PuzzleStyle = 'classic'): Piece[] => {
  const settings = DIFFICULTY_SETTINGS[difficulty];
  const { rows, cols, rotate } = settings;
  const count = rows * cols;
  
  // Grid Dimensions
  const pieceWidth = 100 / cols;
  const pieceHeight = 100 / rows;

  // Generate shuffled grid positions
  const positions: {x: number, y: number}[] = [];
  for(let r=0; r<rows; r++) {
      for(let c=0; c<cols; c++) {
          positions.push({
              x: c * pieceWidth,
              y: r * pieceHeight
          });
      }
  }
  
  // Fisher-Yates shuffle
  for (let i = positions.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [positions[i], positions[j]] = [positions[j], positions[i]];
  }

  // --- Classic Style ---
  if (style === 'classic') {
    const pieces: Piece[] = [];
    for (let i = 0; i < count; i++) {
      const row = Math.floor(i / cols);
      const col = i % cols;

      const correctX = col * pieceWidth;
      const correctY = row * pieceHeight;
      
      const currentX = positions[i].x;
      const currentY = positions[i].y;

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
        bgX: col * 100 / (cols - 1),
        bgY: row * 100 / (rows - 1),
        rotation,
        groupId: `group-${i}`,
        shape: 'classic'
      });
    }
    return pieces.sort(() => Math.random() - 0.5);
  }

  // --- Mosaic Style ---
  const mosaicPieces = generateMosaicPieces(rows, cols, pieceWidth, pieceHeight, rotate, positions);
  return mosaicPieces.sort(() => Math.random() - 0.5);
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