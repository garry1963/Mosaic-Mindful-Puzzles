import React, { useState, useEffect, useRef, memo, useCallback, useLayoutEffect } from 'react';
import { X, Image as ImageIcon, Eye, Lightbulb, RotateCcw, Settings2, Home, Check } from 'lucide-react';
import { PuzzleConfig, Piece, Difficulty, PuzzleStyle, SavedGameState } from '../types';
import { createPuzzlePieces } from '../utils/puzzleUtils';
import { DIFFICULTY_SETTINGS } from '../constants';
import { updateUserStats, formatTime } from '../services/statsService';

// --- Sub-Components for Performance Isolation ---

// 1. Timer Component (Memoized)
const GameTimer = memo(({ initialTime, onTimeUpdate }: { initialTime: number, onTimeUpdate: (t: number) => void }) => {
  const [time, setTime] = useState(initialTime);
  
  useEffect(() => {
    const timer = setInterval(() => {
      setTime(t => {
        const next = t + 1;
        onTimeUpdate(next); // Sync back to parent ref only
        return next;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [onTimeUpdate]);

  const mins = Math.floor(time / 60);
  const secs = time % 60;
  return (
    <div className="font-mono text-xl font-bold text-slate-700 tabular-nums tracking-tight">
      {mins}:{secs.toString().padStart(2, '0')}
    </div>
  );
});

GameTimer.displayName = 'GameTimer';

// 2. Piece Layer (Memoized)
const PuzzlePieceLayer = memo(({ 
    pieces, 
    puzzleSrc, 
    pieceRefs, 
    onPointerDown, 
    onDoubleClick,
    hintPieceId, 
    showPreview 
}: {
    pieces: Piece[];
    puzzleSrc: string;
    pieceRefs: React.MutableRefObject<Record<number, HTMLDivElement | null>>;
    onPointerDown: (e: React.PointerEvent, p: Piece) => void;
    onDoubleClick: (e: React.MouseEvent, p: Piece) => void;
    hintPieceId: number | null;
    showPreview: boolean;
}) => {
    return (
        <>
            {pieces.map((piece) => {
                const isHintTarget = piece.id === hintPieceId;

                // Seamless logic: 
                // 1. Locked pieces scale 1.01 (1% overlap) to seal seams.
                // 2. Loose pieces scale 1.0 for dragging precision.
                // 3. Hint targets scale 1.1 for visibility.
                const scale = isHintTarget ? 'scale(1.1)' : (piece.isLocked ? 'scale(1.01)' : 'scale(1)');
                
                // Border Logic
                // If locked, no border (seamless)
                let borderColor = 'rgba(255,255,255,0.8)'; // Default loose
                let borderWidth = '1px';

                if (isHintTarget) {
                    borderColor = '#facc15'; // Yellow
                    borderWidth = '3px';
                }

                if (piece.isLocked) {
                    borderColor = 'transparent';
                    borderWidth = '0';
                }

                return (
                <div
                    key={piece.id}
                    ref={(el) => { pieceRefs.current[piece.id] = el; }}
                    draggable={false}
                    onPointerDown={(e) => onPointerDown(e, piece)}
                    onDoubleClick={(e) => onDoubleClick(e, piece)}
                    onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); }}
                    className={`absolute cursor-grab active:cursor-grabbing touch-none select-none ${
                        piece.isLocked ? 'z-0 transition-all duration-500 ease-out' : 'z-10'
                    } ${isHintTarget ? 'z-50' : ''}`}
                    style={{
                        width: `${piece.width}%`,
                        height: `${piece.height}%`,
                        left: `${piece.currentX}%`,
                        top: `${piece.currentY}%`,
                        // Initial transform only. Drag updates happen via direct DOM manipulation for 60fps
                        transform: `rotate(${piece.rotation}deg) ${scale}`,
                        zIndex: piece.isLocked ? 1 : (isHintTarget ? 40 : 10),
                        opacity: showPreview ? 0 : 1,
                        imageRendering: piece.isLocked ? 'pixelated' : 'auto', 
                        willChange: piece.isLocked ? 'unset' : 'transform',
                        WebkitTouchCallout: 'none',
                    }}
                >
                    {/* Visual highlighter for hint */}
                    {isHintTarget && (
                        <div className="absolute -inset-2 border-4 border-yellow-400 rounded-xl animate-ping opacity-75 pointer-events-none"></div>
                    )}

                    {piece.shape === 'classic' ? (
                        <div 
                            draggable={false}
                            style={{
                                width: '100%',
                                height: '100%',
                                backgroundImage: `url(${puzzleSrc})`,
                                backgroundSize: `${(100 * 100 / piece.width)}% ${(100 * 100 / piece.height)}%`,
                                backgroundPosition: `${piece.bgX}% ${piece.bgY}%`,
                                border: piece.isLocked ? 'none' : `${borderWidth} solid ${borderColor}`,
                                boxShadow: piece.isLocked ? 'none' : '0 4px 6px rgba(0,0,0,0.2), 0 1px 3px rgba(0,0,0,0.1)',
                                borderRadius: piece.isLocked ? '0' : '2px',
                                boxSizing: 'border-box',
                                WebkitTouchCallout: 'none',
                                outline: 'none'
                            }}
                        >
                             {/* Highlight/Sheen effect only on loose pieces */}
                             {!piece.isLocked && (
                                <div className="absolute inset-0 border-[0.5px] border-white/40 rounded-sm pointer-events-none"></div>
                             )}
                        </div>
                    ) : (
                        <svg 
                            viewBox={piece.viewBox}
                            width="100%" 
                            height="100%"
                            style={{ overflow: 'visible', WebkitTouchCallout: 'none', shapeRendering: piece.isLocked ? 'crispEdges' : 'geometricPrecision' }}
                        >
                            <defs>
                                <clipPath id={`clip-${piece.id}`}>
                                    <path d={piece.pathData} />
                                </clipPath>
                            </defs>
                            <g>
                                <image 
                                    href={puzzleSrc} 
                                    x="0" y="0" 
                                    width="100" height="100" 
                                    preserveAspectRatio="none"
                                    clipPath={`url(#clip-${piece.id})`}
                                    style={{ pointerEvents: 'none' }} 
                                />
                                <path 
                                    d={piece.pathData} 
                                    fill="none" 
                                    stroke={borderColor}
                                    strokeWidth={piece.isLocked ? "0" : (isHintTarget ? "3" : "0.5")}
                                    vectorEffect="non-scaling-stroke"
                                />
                            </g>
                        </svg>
                    )}
                </div>
                );
            })}
        </>
    );
});
PuzzlePieceLayer.displayName = 'PuzzlePieceLayer';

// --- Main Component ---

interface GameBoardProps {
  puzzle: PuzzleConfig;
  onExit: () => void;
  onComplete?: () => void;
}

const GameBoard: React.FC<GameBoardProps> = ({ puzzle, onExit, onComplete }) => {
  const [pieces, setPieces] = useState<Piece[]>([]);
  const [difficulty, setDifficulty] = useState<Difficulty>(puzzle.difficulty || 'normal');
  const [style, setStyle] = useState<PuzzleStyle>('classic');
  const [isComplete, setIsComplete] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [isLoaded, setIsLoaded] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [score, setScore] = useState(0);
  const [isNewRecord, setIsNewRecord] = useState(false);
  
  const [boardDimensions, setBoardDimensions] = useState<{width: string, height: string}>({ width: 'min(92vw, 62vh)', height: 'min(92vw, 62vh)' });

  // Hint State
  const [hintsRemaining, setHintsRemaining] = useState(0);
  const [hintPieceId, setHintPieceId] = useState<number | null>(null);

  // Time tracking via ref to avoid re-renders
  const elapsedTimeRef = useRef(0);
  
  // Refs for High-Performance Dragging
  const boardRef = useRef<HTMLDivElement>(null);
  const pieceRefs = useRef<Record<number, HTMLDivElement | null>>({});
  
  // Drag State
  const dragRef = useRef<{
    active: boolean;
    isSticky: boolean;
    pieceId: number | null;
    startX: number;
    startY: number;
    currentX: number;
    currentY: number;
    visualYOffset: number; 
    groupCache: { id: number; el: HTMLDivElement; rotation: number }[];
    startPositions: Record<number, {x: number, y: number}>;
    startTime: number;
    initialPieces: Piece[];
  }>({
    active: false,
    isSticky: false,
    pieceId: null,
    startX: 0,
    startY: 0,
    currentX: 0,
    currentY: 0,
    visualYOffset: 0,
    groupCache: [],
    startPositions: {},
    startTime: 0,
    initialPieces: []
  });

  const rafRef = useRef<number | null>(null);

  // Initialize Game
  useEffect(() => {
    const saveKey = `mosaic_save_${puzzle.id}`;
    const savedDataStr = localStorage.getItem(saveKey);
    let loadedFromSave = false;
    
    if (savedDataStr) {
        try {
            const savedGame: SavedGameState = JSON.parse(savedDataStr);
            if (savedGame.puzzleId === puzzle.id && Array.isArray(savedGame.pieces)) {
                setDifficulty(savedGame.difficulty);
                setStyle(savedGame.style);
                setPieces(savedGame.pieces);
                elapsedTimeRef.current = savedGame.elapsedTime;
                setHintsRemaining(savedGame.hintsRemaining);
                setIsLoaded(true);
                loadedFromSave = true;
            }
        } catch (e) {
            console.error("Failed to load save", e);
        }
    }

    if (!loadedFromSave) {
        initializeNewGame(puzzle.difficulty || 'normal', 'classic');
    }
  }, [puzzle.id]);

  // Pixel Perfect Resizing
  useLayoutEffect(() => {
    const calculateSize = () => {
        const settings = DIFFICULTY_SETTINGS[difficulty];
        const vw = window.innerWidth;
        const vh = window.innerHeight;
        const maxSide = Math.min(vw * 0.92, vh * 0.62);
        const cellSize = Math.floor(maxSide / settings.cols);
        const exactSize = cellSize * settings.cols;
        
        setBoardDimensions({
            width: `${exactSize}px`,
            height: `${exactSize}px`
        });
    };

    calculateSize();
    const handleResize = () => requestAnimationFrame(calculateSize);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [difficulty]);

  const initializeNewGame = (diff: Difficulty, st: PuzzleStyle) => {
    const newPieces = createPuzzlePieces(diff, st);
    setPieces(newPieces);
    setDifficulty(diff);
    setStyle(st);
    setIsComplete(false);
    elapsedTimeRef.current = 0;
    setHintsRemaining(DIFFICULTY_SETTINGS[diff].hints);
    setHintPieceId(null);
    setIsLoaded(true);
    localStorage.removeItem(`mosaic_save_${puzzle.id}`);
  };

  const saveGame = () => {
    if (!isLoaded || isComplete || pieces.length === 0) return;
    const saveState: SavedGameState = {
        puzzleId: puzzle.id,
        pieces,
        difficulty,
        style,
        elapsedTime: elapsedTimeRef.current,
        hintsRemaining,
        isChaosMode: false,
        lastPlayed: Date.now()
    };
    localStorage.setItem(`mosaic_save_${puzzle.id}`, JSON.stringify(saveState));
  };

  useEffect(() => {
      const interval = setInterval(saveGame, 5000);
      return () => {
          clearInterval(interval);
          saveGame();
          if (rafRef.current) cancelAnimationFrame(rafRef.current);
          window.removeEventListener('pointermove', handleWindowPointerMove);
          window.removeEventListener('pointerup', handleWindowPointerUp);
          window.removeEventListener('pointerdown', handleStickyDrop);
          
          if (boardRef.current) {
              boardRef.current.style.pointerEvents = 'auto';
          }
      };
  }, [pieces, isComplete, difficulty, style, isLoaded]);

  // Game Logic

  const handleHint = () => {
    if (hintsRemaining <= 0 || isComplete || hintPieceId !== null) return;
    const unlocked = pieces.filter(p => !p.isLocked);
    if (unlocked.length === 0) return;
    const randomPiece = unlocked[Math.floor(Math.random() * unlocked.length)];
    setHintPieceId(randomPiece.id);
    setHintsRemaining(prev => prev - 1);
    setTimeout(() => { setHintPieceId(null); }, 3000);
  };

  const handleRestart = () => {
    if (window.confirm("Restart this puzzle?")) {
        initializeNewGame(difficulty, style);
    }
  };

  // --- Optimized Animation Loop ---
  const updateDragVisuals = () => {
      if (!dragRef.current.active) return;
      
      const { startX, startY, currentX, currentY, groupCache, visualYOffset } = dragRef.current;
      const dx = currentX - startX;
      const dy = (currentY - startY) + visualYOffset;

      for (let i = 0; i < groupCache.length; i++) {
          const item = groupCache[i];
          item.el.style.transform = `translate3d(${dx}px, ${dy}px, 0) rotate(${item.rotation}deg) scale(1.1)`;
      }
      
      rafRef.current = requestAnimationFrame(updateDragVisuals);
  };

  // --- Core Drag Logic ---

  const startDrag = (clientX: number, clientY: number, piece: Piece, isSticky: boolean, pointerType: string, event: React.PointerEvent | React.MouseEvent) => {
    if (event.target instanceof Element && 'setPointerCapture' in event.target && event.type === 'pointerdown') {
        try {
            (event.target as Element).setPointerCapture((event as React.PointerEvent).pointerId);
        } catch (e) {
            // Ignore capture errors
        }
    }

    const groupMembers = [piece];
    
    const groupCache: { id: number; el: HTMLDivElement; rotation: number }[] = [];
    const startPositions: Record<number, {x: number, y: number}> = {};
    const visualYOffset = (pointerType === 'touch' && !isSticky) ? -90 : 0;
    
    groupMembers.forEach(p => {
        const el = pieceRefs.current[p.id];
        if (el) {
            groupCache.push({ id: p.id, el, rotation: p.rotation });
            startPositions[p.id] = { x: p.currentX, y: p.currentY };
            el.style.transition = 'none';
            el.style.zIndex = '100';
            el.style.boxShadow = '0 20px 30px rgba(0,0,0,0.3)'; 
            el.style.transform = `translate3d(0, ${visualYOffset}px, 0) rotate(${p.rotation}deg) scale(1.1)`;
            
            if (isSticky) {
                el.style.pointerEvents = 'none';
            }
        }
    });

    dragRef.current = {
        active: true,
        isSticky,
        pieceId: piece.id,
        startX: clientX,
        startY: clientY,
        currentX: clientX,
        currentY: clientY,
        visualYOffset,
        groupCache,
        startPositions,
        startTime: Date.now(),
        initialPieces: pieces 
    };

    window.addEventListener('pointermove', handleWindowPointerMove, { passive: false });
    
    if (isSticky) {
        setTimeout(() => {
             window.addEventListener('pointerdown', handleStickyDrop, { once: true, capture: true });
        }, 50);
    } else {
        window.addEventListener('pointerup', handleWindowPointerUp);
        window.addEventListener('pointercancel', handleWindowPointerUp);
    }

    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(updateDragVisuals);
  };

  const endDrag = (endX: number, endY: number, wasSticky: boolean) => {
    dragRef.current.active = false;
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    
    window.removeEventListener('pointermove', handleWindowPointerMove);
    window.removeEventListener('pointerup', handleWindowPointerUp);
    window.removeEventListener('pointercancel', handleWindowPointerUp);
    window.removeEventListener('pointerdown', handleStickyDrop);

    const { startX, startY, startTime, pieceId, groupCache, startPositions, initialPieces, visualYOffset } = dragRef.current;

    const cleanupStyles = () => {
        groupCache.forEach(item => {
            if (item.el) {
                item.el.style.transform = '';
                item.el.style.zIndex = '';
                item.el.style.cursor = '';
                item.el.style.boxShadow = '';
                item.el.style.transition = '';
                item.el.style.pointerEvents = '';
            }
        });
    };

    // Tap Detection (Only for non-sticky regular clicks)
    const dist = Math.hypot(endX - startX, endY - startY);
    const time = Date.now() - startTime;
    
    // If it's a quick tap without much movement (dist < 5px)
    if (!wasSticky && dist < 5 && time < 500 && pieceId !== null) {
         cleanupStyles();
         return;
    }

    // STRICT GRID DROP LOGIC (Only runs if moved > 5px)
    const draggedPiece = initialPieces.find(p => p.id === pieceId);
    
    if (draggedPiece && boardRef.current) {
        const rect = boardRef.current.getBoundingClientRect();
        const settings = DIFFICULTY_SETTINGS[difficulty];
        
        const totalDxPixels = endX - startX;
        const totalDyPixels = (endY - startY) + visualYOffset;
        
        const deltaXPercent = (totalDxPixels / rect.width) * 100;
        const deltaYPercent = (totalDyPixels / rect.height) * 100;
        
        const startPos = startPositions[draggedPiece.id];
        const cellW = 100 / settings.cols;
        const cellH = 100 / settings.rows;

        const currentCenterX = startPos.x + deltaXPercent + draggedPiece.width / 2;
        const currentCenterY = startPos.y + deltaYPercent + draggedPiece.height / 2;
        
        const targetCol = Math.floor(currentCenterX / cellW);
        const targetRow = Math.floor(currentCenterY / cellH);

        const startCol = Math.floor((startPos.x + draggedPiece.width / 2) / cellW);
        const startRow = Math.floor((startPos.y + draggedPiece.height / 2) / cellH);
        
        let validMove = false;
        let swapTargetId: number | null = null;
        let targetX = startPos.x;
        let targetY = startPos.y;
        
        if (targetCol >= 0 && targetCol < settings.cols && targetRow >= 0 && targetRow < settings.rows) {
            const cellOffsetX = startPos.x - (startCol * cellW);
            const cellOffsetY = startPos.y - (startRow * cellH);
            
            const newCssX = targetCol * cellW + cellOffsetX;
            const newCssY = targetRow * cellH + cellOffsetY;
            
            const occupant = initialPieces.find(p => {
                if (p.id === draggedPiece.id) return false;
                const pCol = Math.floor((p.currentX + p.width/2) / cellW);
                const pRow = Math.floor((p.currentY + p.height/2) / cellH);
                return pCol === targetCol && pRow === targetRow;
            });

            if (!occupant) {
                validMove = true;
                targetX = newCssX;
                targetY = newCssY;
            } else if (!occupant.isLocked) {
                validMove = true;
                swapTargetId = occupant.id;
                targetX = newCssX;
                targetY = newCssY;
            } else {
                validMove = false;
            }
        }
        
        if (validMove) {
             let newPieces = [...initialPieces];
             
             newPieces = newPieces.map(p => {
                 if (p.id === draggedPiece.id) {
                     const isCorrectSlot = Math.abs(targetX - p.correctX) < settings.snapThreshold && 
                                           Math.abs(targetY - p.correctY) < settings.snapThreshold;
                     
                     return {
                         ...p,
                         currentX: targetX,
                         currentY: targetY,
                         isLocked: isCorrectSlot && p.rotation === 0
                     };
                 }
                 if (swapTargetId !== null && p.id === swapTargetId) {
                     return {
                         ...p,
                         currentX: startPos.x,
                         currentY: startPos.y
                     };
                 }
                 return p;
             });

             setPieces(newPieces);
             
             if (newPieces.every(p => p.isLocked)) {
                const finalTime = elapsedTimeRef.current;
                const result = updateUserStats(difficulty, finalTime);
                setScore(result.score);
                setIsNewRecord(result.isNewRecord);
                setIsComplete(true);
                if (onComplete) onComplete();
            }
        }
    }
    cleanupStyles();
  };

  // --- Event Handlers ---

  const handleWindowPointerMove = (e: PointerEvent) => {
    if (!dragRef.current.active) return;
    e.preventDefault(); 
    dragRef.current.currentX = e.clientX;
    dragRef.current.currentY = e.clientY;
  };

  const handleWindowPointerUp = (e: PointerEvent) => {
    if (!dragRef.current.active || dragRef.current.isSticky) return;
    endDrag(e.clientX, e.clientY, false);
  };

  const handleStickyDrop = (e: PointerEvent) => {
      e.preventDefault();
      e.stopPropagation();
      endDrag(e.clientX, e.clientY, true);
  };

  const handlePointerDown = useCallback((e: React.PointerEvent, piece: Piece) => {
    if (e.button !== 0 || piece.isLocked) return;
    e.stopPropagation(); 
    e.preventDefault(); 
    startDrag(e.clientX, e.clientY, piece, false, e.pointerType, e);
  }, [pieces]);

  const handleDoubleClick = useCallback((e: React.MouseEvent, piece: Piece) => {
      if (piece.isLocked) return;
      e.stopPropagation();
      e.preventDefault();
      startDrag(e.clientX, e.clientY, piece, true, 'mouse', e);
  }, [pieces]);


  // UI Formatting
  const activeHintPiece = pieces.find(p => p.id === hintPieceId);
  const difficultyConfig = DIFFICULTY_SETTINGS[difficulty];

  return (
    <div className="fixed inset-0 bg-slate-100 flex flex-col overflow-hidden touch-none select-none">
      
      {/* 1. Header (Info & Exit) */}
      <header className="px-4 md:px-8 flex items-center justify-between z-30 bg-white/80 backdrop-blur-md border-b border-slate-200/60 shadow-sm pt-safe-top h-auto py-3">
        <button 
            onClick={onExit} 
            className="w-12 h-12 flex items-center justify-center rounded-full hover:bg-slate-100 text-slate-500 active:bg-slate-200 transition-all active:scale-95"
            aria-label="Exit Game"
        >
            <Home size={26} />
        </button>
        
        <div className="flex flex-col items-center">
             <h1 className="font-serif text-slate-800 font-semibold text-lg leading-none mb-1">{puzzle.title}</h1>
             <GameTimer initialTime={elapsedTimeRef.current} onTimeUpdate={(t) => elapsedTimeRef.current = t} />
        </div>
        
        <button 
            onClick={() => setShowSettings(!showSettings)}
            className={`w-12 h-12 flex items-center justify-center rounded-full transition-all active:scale-95 ${showSettings ? 'bg-indigo-100 text-indigo-600' : 'hover:bg-slate-100 text-slate-500'}`}
        >
             <Settings2 size={26} />
        </button>
      </header>

      {/* Settings Dropdown */}
      {showSettings && (
         <div className="absolute top-20 right-4 z-50 bg-white p-4 rounded-2xl shadow-xl border border-slate-100 w-64 animate-in fade-in slide-in-from-top-4">
            <h3 className="text-sm font-bold text-slate-400 uppercase mb-3">Difficulty</h3>
            <div className="space-y-2">
                {(Object.keys(DIFFICULTY_SETTINGS) as Difficulty[]).map(d => (
                    <button
                        key={d}
                        onClick={() => {
                            if(window.confirm("Restart game with new difficulty?")) {
                                initializeNewGame(d, style);
                                setShowSettings(false);
                            }
                        }}
                        className={`w-full text-left px-4 py-3 rounded-xl capitalize font-medium transition-colors ${difficulty === d ? 'bg-indigo-50 text-indigo-700' : 'hover:bg-slate-50 text-slate-600'}`}
                    >
                        {d}
                    </button>
                ))}
            </div>
         </div>
      )}

      {/* 2. Main Game Area */}
      <div className="flex-1 relative flex items-center justify-center overflow-hidden p-4">
        
        <div 
          ref={boardRef}
          className="relative shadow-2xl shadow-indigo-900/10 bg-white rounded-lg transition-all"
          style={{
            width: boardDimensions.width,
            height: boardDimensions.height,
            touchAction: 'none'
          }}
          onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); }}
        >
            {isComplete && (
                <div className="absolute inset-0 z-40 animate-in fade-in duration-1000">
                    <img src={puzzle.src} className="w-full h-full object-cover rounded-lg" alt="Completed Puzzle" />
                </div>
            )}

            {style === 'classic' && !isComplete && (
                <div 
                    className="absolute inset-0 pointer-events-none opacity-10"
                    style={{
                    backgroundImage: `
                        linear-gradient(to right, #0f172a 1px, transparent 1px),
                        linear-gradient(to bottom, #0f172a 1px, transparent 1px)
                    `,
                    backgroundSize: `${100 / difficultyConfig.cols}% ${100 / difficultyConfig.rows}%`
                    }}
                />
            )}

            {!isComplete && (
                <div 
                    className="absolute inset-0 pointer-events-none opacity-5 grayscale"
                    style={{
                        backgroundImage: `url(${puzzle.src})`,
                        backgroundSize: 'cover'
                    }}
                />
            )}

            {activeHintPiece && (
                <div 
                    className="absolute z-40 pointer-events-none animate-pulse opacity-50"
                    style={{
                         width: `${activeHintPiece.width}%`,
                         height: `${activeHintPiece.height}%`,
                         left: `${activeHintPiece.correctX}%`,
                         top: `${activeHintPiece.correctY}%`,
                         backgroundColor: '#facc15'
                    }}
                />
            )}

            {isLoaded && !isComplete && (
                <PuzzlePieceLayer 
                    pieces={pieces}
                    puzzleSrc={puzzle.src}
                    pieceRefs={pieceRefs}
                    onPointerDown={handlePointerDown}
                    onDoubleClick={handleDoubleClick}
                    hintPieceId={hintPieceId}
                    showPreview={showPreview}
                />
            )}

            <div 
                className={`absolute inset-0 z-50 transition-all duration-300 pointer-events-none origin-center ${showPreview ? 'opacity-100 scale-100' : 'opacity-0 scale-95'}`}
                style={{ visibility: showPreview ? 'visible' : 'hidden' }}
            >
                <img src={puzzle.src} className="w-full h-full object-cover rounded-lg shadow-2xl" alt="preview" />
            </div>
        </div>
      </div>

      {/* 3. Bottom Control Dock */}
      {!isComplete && (
      <div className="h-auto px-6 flex items-center justify-center gap-6 z-40 pointer-events-none pb-safe-bottom">
         <div className="pointer-events-auto flex items-center gap-3 bg-white/90 backdrop-blur-xl p-3 rounded-3xl shadow-2xl border border-white/40 ring-1 ring-black/5">
             
             {/* Restart */}
             <button 
                onClick={handleRestart}
                className="flex flex-col items-center justify-center w-16 h-16 rounded-2xl text-slate-500 hover:bg-slate-100 active:bg-slate-200 active:scale-95 transition-all"
             >
                <RotateCcw size={22} className="mb-1" />
                <span className="text-[10px] font-bold uppercase tracking-wider">Reset</span>
             </button>

             <div className="w-px h-10 bg-slate-200"></div>

             {/* Hint */}
             <button 
                onClick={handleHint}
                disabled={hintsRemaining === 0}
                className={`flex flex-col items-center justify-center w-16 h-16 rounded-2xl transition-all active:scale-95 ${
                    hintsRemaining > 0 
                    ? 'text-amber-600 hover:bg-amber-50 active:bg-amber-100' 
                    : 'text-slate-300'
                }`}
             >
                <div className="relative">
                    <Lightbulb size={22} className={`mb-1 ${hintsRemaining > 0 ? 'fill-amber-100' : ''}`} />
                    <span className="absolute -top-1 -right-2 bg-amber-500 text-white text-[9px] w-4 h-4 flex items-center justify-center rounded-full font-bold">
                        {hintsRemaining}
                    </span>
                </div>
                <span className="text-[10px] font-bold uppercase tracking-wider">Hint</span>
             </button>
             
             {/* Preview */}
             <button 
                onPointerDown={() => setShowPreview(true)}
                onPointerUp={() => setShowPreview(false)}
                onPointerLeave={() => setShowPreview(false)}
                className="flex flex-col items-center justify-center w-16 h-16 rounded-2xl text-indigo-600 hover:bg-indigo-50 active:bg-indigo-100 active:scale-95 transition-all"
             >
                <Eye size={22} className="mb-1 fill-indigo-100" />
                <span className="text-[10px] font-bold uppercase tracking-wider">Peek</span>
             </button>
         </div>
      </div>
      )}

      {/* Completion Overlay */}
      {isComplete && (
        <div className="absolute inset-x-0 bottom-0 z-50 flex flex-col items-center justify-end pb-8 bg-gradient-to-t from-black/80 via-transparent to-transparent animate-in fade-in duration-1000 pointer-events-none pb-safe-bottom">
           <div className="bg-white/90 backdrop-blur-md p-6 rounded-3xl shadow-2xl max-w-sm w-full text-center mx-4 mb-4 pointer-events-auto border border-white/50">
              <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4 shadow-inner">
                 <Check size={32} strokeWidth={4} />
              </div>
              <h2 className="text-2xl font-serif font-bold text-slate-800 mb-1">Masterpiece Complete!</h2>
              
              <div className="mb-6 w-full">
                  <div className="mt-4 p-4 bg-slate-50 rounded-xl border border-slate-100">
                      <div className="flex justify-between items-center mb-2">
                          <span className="text-slate-500 text-xs font-bold uppercase tracking-wider">Time</span>
                          <span className="text-slate-800 font-mono font-bold text-lg">{formatTime(elapsedTimeRef.current)}</span>
                      </div>
                      <div className="flex justify-between items-center">
                          <span className="text-slate-500 text-xs font-bold uppercase tracking-wider">Score</span>
                          <span className="text-indigo-600 font-mono font-bold text-xl">{score.toLocaleString()}</span>
                      </div>
                      {isNewRecord && (
                          <div className="mt-3 text-center">
                              <span className="inline-block bg-amber-100 text-amber-700 text-xs font-bold px-3 py-1 rounded-full animate-bounce shadow-sm border border-amber-200">
                                  🏆 New Record!
                              </span>
                          </div>
                      )}
                  </div>
              </div>
              
              <div className="flex gap-3">
                  <button 
                    onClick={() => initializeNewGame(difficulty, style)}
                    className="flex-1 py-3 rounded-2xl bg-slate-100 text-slate-700 font-bold hover:bg-slate-200 transition-colors"
                 >
                    Play Again
                 </button>
                 <button onClick={onExit} className="flex-1 py-3 rounded-2xl bg-slate-900 text-white font-bold hover:bg-slate-800 shadow-lg shadow-slate-900/20 transition-colors">
                    Gallery
                 </button>
              </div>
           </div>
        </div>
      )}
    </div>
  );
};

export default GameBoard;