import { Piece, Difficulty, PuzzleStyle } from "../types";
import { DIFFICULTY_SETTINGS } from "../constants";

// Helper to generate a random number between min and max
const randomRange = (min: number, max: number) => Math.random() * (max - min) + min;

// Generate a random Bezier curve definition for an edge
// Returns path command string segment
const generateEdge = (x1: number, y1: number, x2: number, y2: number, seed: number) => {
  // Simple cubic bezier curve
  // We displace control points perpendicular to the line
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.sqrt(dx * dx + dy * dy);
  
  // Perpendicular vector
  const nx = -dy / len;
  const ny = dx / len;

  // Randomize magnitude of curvature (15-30% of edge length)
  // Use a deterministic-ish way or just random is fine for this use case
  // But shared edges must be identical. We'll handle sharing by generating once.
  
  const curveScale = 0.25; // 25% jitter
  const variance = (Math.random() - 0.5) * curveScale * len;
  const variance2 = (Math.random() - 0.5) * curveScale * len;

  const cp1x = x1 + dx * 0.33 + nx * variance;
  const cp1y = y1 + dy * 0.33 + ny * variance;

  const cp2x = x1 + dx * 0.66 + nx * variance2;
  const cp2y = y1 + dy * 0.66 + ny * variance2;

  return `C ${cp1x.toFixed(2)} ${cp1y.toFixed(2)}, ${cp2x.toFixed(2)} ${cp2y.toFixed(2)}, ${x2.toFixed(2)} ${y2.toFixed(2)}`;
};

export const createPuzzlePieces = (difficulty: Difficulty, style: PuzzleStyle = 'classic'): Piece[] => {
  const settings = DIFFICULTY_SETTINGS[difficulty];
  const { rows, cols, rotate } = settings;
  const pieces: Piece[] = [];
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

  if (style === 'classic') {
    // Standard Grid Logic
    for (let i = 0; i < count; i++) {
      const row = Math.floor(i / cols);
      const col = i % cols;

      const correctX = col * pieceWidth;
      const correctY = row * pieceHeight;
      
      // Use shuffled position
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
  } else {
    // Mosaic (Organic) Logic
    
    // 1. Generate Vertices
    // We create a grid of vertices, perturbing the internal ones
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

    // 2. Generate Edges
    // Store path strings for shared edges
    // Horizontal edges: H[row][col] connects (row, col) -> (row, col+1)
    // Vertical edges: V[row][col] connects (row, col) -> (row+1, col)
    const hEdges: string[][] = [];
    const vEdges: string[][] = [];

    // Horizontal
    for (let r = 0; r <= rows; r++) {
      hEdges[r] = [];
      for (let c = 0; c < cols; c++) {
        const p1 = verts[r][c];
        const p2 = verts[r][c+1];
        // Don't curve boundary edges for clean puzzle border
        if (r === 0 || r === rows) {
          hEdges[r][c] = `L ${p2.x.toFixed(2)} ${p2.y.toFixed(2)}`;
        } else {
          hEdges[r][c] = generateEdge(p1.x, p1.y, p2.x, p2.y, r * 100 + c);
        }
      }
    }

    // Vertical
    for (let r = 0; r < rows; r++) {
      vEdges[r] = [];
      for (let c = 0; c <= cols; c++) {
        const p1 = verts[r][c];
        const p2 = verts[r+1][c];
        // Don't curve boundary edges
        if (c === 0 || c === cols) {
          vEdges[r][c] = `L ${p2.x.toFixed(2)} ${p2.y.toFixed(2)}`;
        } else {
          vEdges[r][c] = generateEdge(p1.x, p1.y, p2.x, p2.y, r * 100 + c + 5000);
        }
      }
    }

    // 3. Construct Pieces
    // Re-doing the loop with deterministic generation to handle the "Reverse" issue cleanly
    // We will generate the path segments on the fly using a deterministic random based on edge ID.
    const getEdgePath = (p1: {x:number, y:number}, p2: {x:number, y:number}, edgeId: string, reverse: boolean) => {
        // Seeded random
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
        else d += getEdgePath(pTL, pTR, `h-${r}-${c}`, false) + " ";
        
        // Right
        if (c === cols - 1) d += `L ${pBR.x.toFixed(2)} ${pBR.y.toFixed(2)} `;
        else d += getEdgePath(pTR, pBR, `v-${r}-${c+1}`, false) + " ";
        
        // Bottom
        if (r === rows - 1) d += `L ${pBL.x.toFixed(2)} ${pBL.y.toFixed(2)} `;
        else d += getEdgePath(pBR, pBL, `h-${r+1}-${c}`, true) + " ";
        
        // Left
        if (c === 0) d += `L ${pTL.x.toFixed(2)} ${pTL.y.toFixed(2)} `;
        else d += getEdgePath(pBL, pTL, `v-${r}-${c}`, true) + " ";
        
        d += "Z";
        
        const xs = [pTL.x, pTR.x, pBR.x, pBL.x];
        const ys = [pTL.y, pTR.y, pBR.y, pBL.y];
        const minX = Math.min(...xs) - 5; // 5% padding for curves
        const maxX = Math.max(...xs) + 5;
        const minY = Math.min(...ys) - 5;
        const maxY = Math.max(...ys) + 5;
        
        const w = maxX - minX;
        const h = maxY - minY;
        
        // Use shuffled grid positions
        const index = r * cols + c;
        const currentX = positions[index].x;
        const currentY = positions[index].y;

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
    
    return finalPieces.sort(() => Math.random() - 0.5);
  }
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
