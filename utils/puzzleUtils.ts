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

  if (style === 'classic') {
    // Standard Grid Logic
    for (let i = 0; i < count; i++) {
      const row = Math.floor(i / cols);
      const col = i % cols;

      const correctX = col * pieceWidth;
      const correctY = row * pieceHeight;
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
        bgX: col * 100 / (cols - 1),
        bgY: row * 100 / (rows - 1),
        rotation,
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
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const id = r * cols + c;
        
        // Define corners
        const pTL = verts[r][c];
        // const pTR = verts[r][c+1]; // Implied by edges
        // const pBR = verts[r+1][c+1]; // Implied by edges
        // const pBL = verts[r+1][c]; // Implied by edges

        // Construct path: Move to TL -> Top Edge -> Right Edge -> Bottom Edge (Reversed) -> Left Edge (Reversed) -> Close
        
        let pathStr = `M ${pTL.x.toFixed(2)} ${pTL.y.toFixed(2)} `;
        
        // Top Edge
        pathStr += hEdges[r][c] + " ";

        // Right Edge
        pathStr += vEdges[r][c+1] + " ";

        // Bottom Edge (Reversed)
        // To reverse a Bezier C x1 y1, x2 y2, x3 y3 -> C x2 y2, x1 y1, x0 y0
        // But we stored string strings.
        // It's easier to just draw lines back for boundaries, but for curves we need the data.
        // Simplification: Let's regenerate the reversed curve or parse.
        // To save code complexity, let's just generate the edge "forward" from TR to TL for bottom edge of a cell?
        // No, shared edges must look same.
        // Let's store edge control points instead of strings?
        // Okay, quick fix: The edge generator above is nice, but reversing string is hard.
        // Let's re-generate the edge string from right-to-left using same seed but swapped points?
        // A curve P1->P2 with random offset +N is the same as P2->P1 with random offset -N.
        // That requires keeping the noise consistent.
        // Let's cheat: "Curved Mosaic" implies standard flow.
        // Let's just create a closed polygon logic where we call `generateEdge` specifically for this cell,
        // but ensure `generateEdge` is deterministic based on coordinates/index so neighbors match.
        // Better:
        // We actually need to draw the path in one direction for the SVG fill to work.
        // Let's revert to storing the curve data structure.
        
      }
    }
    
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
        
        // If it's a boundary (dx or dy is 0 AND on grid line?), make straight
        // We know boundaries from indices in the loop below, but here we just have points.
        // Let's pass 'isBoundary' param?
        // Simplified: The caller handles L or C. 
        
        const len = Math.sqrt(dx * dx + dy * dy);
        const nx = -dy / len;
        const ny = dx / len;
        
        const curveScale = 0.25;
        // Jitter. If we reverse, we swap p1/p2. 
        // We want the curve to bulge the SAME way relative to space.
        // Normal vector flips when direction flips.
        // If we want same curve, we need `variance` to flip sign if we swap.
        // But `floatVal` is based on ID.
        
        let variance = (floatVal - 0.5) * curveScale * len;
        let variance2 = (floatVal2 - 0.5) * curveScale * len;
        
        if (reverse) {
            // If traversing P2->P1, the normal (-dy, dx) is opposite to P1->P2.
            // So to keep the point in same geometric spot, we don't need to negate variance if we use the calculated normal for the current direction.
            // Wait: Normal of P1->P2 is N. Normal of P2->P1 is -N.
            // Point = Mid + N * V.
            // We want Point to be same.
            // Mid is same.
            // So if N flips, V must flip.
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
        
        // Calculate Bounding Box for this piece to define viewBox and container size
        // Approximate bbox from the 4 corners is "okay" but curves might go outside.
        // We add a padding to the corner-based bbox.
        const xs = [pTL.x, pTR.x, pBR.x, pBL.x];
        const ys = [pTL.y, pTR.y, pBR.y, pBL.y];
        const minX = Math.min(...xs) - 5; // 5% padding for curves
        const maxX = Math.max(...xs) + 5;
        const minY = Math.min(...ys) - 5;
        const maxY = Math.max(...ys) + 5;
        
        const w = maxX - minX;
        const h = maxY - minY;
        
        // Random placement
        const currentX = Math.random() * (100 - pieceWidth);
        const currentY = Math.random() * (100 - pieceHeight);
        const rotation = rotate ? Math.floor(Math.random() * 4) * 90 : 0;
        
        finalPieces.push({
            id: r * cols + c,
            correctX: minX, // Logic: The SVG is placed here. The path draws relative to 0,0 of board? 
                           // No, path data is in 0-100 board coordinates.
                           // If we place the SVG at `minX` left, we must translate path?
                           // Actually, let's keep path data absolute (0-100).
                           // Then SVG viewBox should simply be "0 0 100 100"? 
                           // If viewBox is "0 0 100 100", the piece takes up whole board space, mostly empty.
                           // That works but might catch clicks on empty space?
                           // Better: viewBox = `${minX} ${minY} ${w} ${h}`.
                           // And correct position is `minX`, `minY` (in %).
                           
            correctY: minY,
            width: w,
            height: h,
            currentX,
            currentY,
            isLocked: false,
            bgX: 0, // Not used for svg
            bgY: 0, // Not used for svg
            rotation,
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