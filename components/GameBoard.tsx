import React, { useState, useEffect, useRef, memo, useCallback } from 'react';
import { X, Image as ImageIcon, Eye, Lightbulb, RotateCcw, Settings2, Home, Check } from 'lucide-react';
import { PuzzleConfig, Piece, Difficulty, PuzzleStyle, SavedGameState } from '../types';
import { createPuzzlePieces } from '../utils/puzzleUtils';
import { DIFFICULTY_SETTINGS } from '../constants';

// --- Sub-Components for Performance Isolation ---

// 1. Timer Component (Memoized)
// Isolates the 1-second tick re-renders from the main GameBoard to prevent drag stutter
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
// Prevents React from diffing the 100+ pieces when unrelated state (like UI overlays) changes
const PuzzlePieceLayer = memo(({ 
    pieces, 
    puzzleSrc, 
    pieceRefs, 
    onPointerDown, 
    onDoubleClick,
    onContextRotate, 
    hintPieceId, 
    showPreview 
}: {
    pieces: Piece[];
    puzzleSrc: string;
    pieceRefs: React.MutableRefObject<Record<number, HTMLDivElement | null>>;
    onPointerDown: (e: React.PointerEvent, p: Piece) => void;
    onDoubleClick: (e: React.MouseEvent, p: Piece) => void;
    onContextRotate: (e: React.MouseEvent, id: number) => void;
    hintPieceId: number | null;
    showPreview: boolean;
}) => {
    return (
        <>
            {pieces.map((piece) => {
                const isHintTarget = piece.id === hintPieceId;
                return (
                <div
                    key={piece.id}
                    ref={(el) => { pieceRefs.current[piece.id] = el; }}
                    onPointerDown={(e) => onPointerDown(e, piece)}
                    onDoubleClick={(e) => onDoubleClick(e, piece)}
                    onContextMenu={(e) => onContextRotate(e, piece.id)}
                    className={`absolute cursor-grab active:cursor-grabbing touch-none select-none ${
                        piece.isLocked ? 'z-0 transition-all duration-500 ease-out' : 'z-10'
                    } ${isHintTarget ? 'z-50' : ''}`}
                    style={{
                        width: `${piece.width}%`,
                        height: `${piece.height}%`,
                        left: `${piece.currentX}%`,
                        top: `${piece.currentY}%`,
                        // Initial transform only. Drag updates happen via direct DOM manipulation for 60fps
                        transform: `rotate(${piece.rotation}deg) ${isHintTarget ? 'scale(1.1)' : ''}`,
                        zIndex: piece.isLocked ? 1 : (isHintTarget ? 40 : 10),
                        opacity: showPreview ? 0 : 1,
                        // Optimize painting
                        willChange: 'transform',
                    }}
                >
                    {/* Visual highlighter for hint */}
                    {isHintTarget && (
                        <div className="absolute -inset-2 border-4 border-yellow-400 rounded-xl animate-ping opacity-75 pointer-events-none"></div>
                    )}

                    {piece.shape === 'classic' ? (
                        <div 
                            style={{
                                width: '100%',
                                height: '100%',
                                backgroundImage: `url(${puzzleSrc})`,
                                backgroundSize: `${(100 * 100 / piece.width)}% ${(100 * 100 / piece.height)}%`,
                                backgroundPosition: `${piece.bgX}% ${piece.bgY}%`,
                                border: isHintTarget ? '3px solid #facc15' : (piece.isLocked ? 'none' : '1px solid rgba(255,255,255,0.6)'),
                                // Use performant box-shadow instead of filters
                                boxShadow: piece.isLocked ? 'none' : '0 4px 6px rgba(0,0,0,0.15), 0 1px 3px rgba(0,0,0,0.1)',
                                borderRadius: '3px'
                            }}
                        >
                             {/* Highlight/Sheen effect */}
                             {!piece.isLocked && (
                                <div className="absolute inset-0 border-[0.5px] border-white/40 rounded-sm pointer-events-none"></div>
                             )}
                        </div>
                    ) : (
                        <svg 
                            viewBox={piece.viewBox}
                            width="100%" 
                            height="100%"
                            style={{ overflow: 'visible' }}
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
                                />
                                {!piece.isLocked && (
                                    <path 
                                        d={piece.pathData} 
                                        fill="none" 
                                        stroke={isHintTarget ? "#facc15" : "rgba(255,255,255,0.5)"}
                                        strokeWidth={isHintTarget ? "3" : "0.5"}
                                        vectorEffect="non-scaling-stroke"
                                    />
                                )}
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
  
  // Hint State
  const [hintsRemaining, setHintsRemaining] = useState(0);
  const [hintPieceId, setHintPieceId] = useState<number | null>(null);

  // Time tracking via ref to avoid re-renders
  const elapsedTimeRef = useRef(0);
  const autoSaveIntervalRef = useRef<number>(0);
  
  // Refs for High-Performance Dragging
  const boardRef = useRef<HTMLDivElement>(null);
  const pieceRefs = useRef<Record<number, HTMLDivElement | null>>({});
  
  // Drag State (Mutable ref)
  const dragRef = useRef<{
    active: boolean;
    isSticky: boolean;
    pieceId: number | null;
    startX: number;
    startY: number;
    currentX: number;
    currentY: number;
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
                return;
            }
        } catch (e) {
            console.error("Failed to load save", e);
        }
    }

    initializeNewGame(puzzle.difficulty || 'normal', 'classic');
  }, [puzzle.id]);

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

  // Auto-save on unmount or interval
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
  const performRotation = (pieceId: number) => {
    if (!DIFFICULTY_SETTINGS[difficulty].rotate) return;
    const targetPiece = pieces.find(p => p.id === pieceId);
    if (!targetPiece || targetPiece.isLocked) return;
    
    setPieces(prev => prev.map(p => {
      if (p.groupId === targetPiece.groupId && !p.isLocked) {
         return { ...p, rotation: (p.rotation + 90) % 360 };
      }
      return p;
    }));
  };

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
      
      const { startX, startY, currentX, currentY, groupCache } = dragRef.current;
      const dx = currentX - startX;
      const dy = currentY - startY;

      for (let i = 0; i < groupCache.length; i++) {
          const item = groupCache[i];
          // Simple direct transform
          item.el.style.transform = `translate3d(${dx}px, ${dy}px, 0) rotate(${item.rotation}deg) scale(1.1)`;
      }
      
      rafRef.current = requestAnimationFrame(updateDragVisuals);
  };

  // --- Core Drag Logic ---

  const startDrag = (clientX: number, clientY: number, piece: Piece, isSticky: boolean) => {
    if (boardRef.current) {
        // For sticky drag, we MUST allow pointer events on board so we can detect the drop click
        // For normal drag, we disable them to prevent interference, but enabling them is fine if we manage bubbling
        boardRef.current.style.pointerEvents = isSticky ? 'auto' : 'none';
    }

    const groupMembers = pieces.filter(p => p.groupId === piece.groupId);
    const groupCache: { id: number; el: HTMLDivElement; rotation: number }[] = [];
    const startPositions: Record<number, {x: number, y: number}> = {};
    
    groupMembers.forEach(p => {
        const el = pieceRefs.current[p.id];
        if (el) {
            groupCache.push({ id: p.id, el, rotation: p.rotation });
            startPositions[p.id] = { x: p.currentX, y: p.currentY };
            el.style.transition = 'none';
            el.style.zIndex = '100';
            el.style.boxShadow = '0 20px 30px rgba(0,0,0,0.3)'; 
            el.style.transform = `rotate(${p.rotation}deg) scale(1.1)`;
            
            // If sticky, set pointer events to none on the dragged pieces so clicks pass through to board
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
        groupCache,
        startPositions,
        startTime: Date.now(),
        initialPieces: pieces 
    };

    window.addEventListener('pointermove', handleWindowPointerMove, { passive: false });
    
    if (isSticky) {
        // Sticky drop is handled by a separate global click listener
        setTimeout(() => {
             window.addEventListener('pointerdown', handleStickyDrop, { once: true, capture: true });
        }, 50); // Delay slightly to avoid catching the double-click release
    } else {
        window.addEventListener('pointerup', handleWindowPointerUp);
    }

    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(updateDragVisuals);
  };

  const endDrag = (endX: number, endY: number, wasSticky: boolean) => {
    dragRef.current.active = false;
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    
    window.removeEventListener('pointermove', handleWindowPointerMove);
    window.removeEventListener('pointerup', handleWindowPointerUp);
    window.removeEventListener('pointerdown', handleStickyDrop); // cleanup

    if (boardRef.current) {
        boardRef.current.style.pointerEvents = 'auto';
    }

    const { startX, startY, startTime, pieceId, groupCache, startPositions, initialPieces } = dragRef.current;

    // Cleanup styles
    const cleanupStyles = () => {
        groupCache.forEach(item => {
            if (item.el) {
                item.el.style.transform = '';
                item.el.style.zIndex = '';
                item.el.style.cursor = '';
                item.el.style.boxShadow = '';
                item.el.style.transition = '';
                item.el.style.pointerEvents = ''; // Reset pointer events
            }
        });
    };

    // Tap Detection (Only for non-sticky regular clicks)
    const dist = Math.hypot(endX - startX, endY - startY);
    const time = Date.now() - startTime;
    
    if (!wasSticky && dist < 10 && time < 300 && pieceId !== null) {
         cleanupStyles();
         performRotation(pieceId);
         return;
    }

    // Drop Logic
    const draggedPiece = initialPieces.find(p => p.id === pieceId);
    
    if (draggedPiece && boardRef.current) {
        const rect = boardRef.current.getBoundingClientRect();
        const settings = DIFFICULTY_SETTINGS[difficulty];
        const pieceW = 100 / settings.cols;
        const pieceH = 100 / settings.rows;
        
        const totalDxPixels = endX - startX;
        const totalDyPixels = endY - startY;
        
        const deltaCol = Math.round((totalDxPixels / rect.width) * settings.cols);
        const deltaRow = Math.round((totalDyPixels / rect.height) * settings.rows);
        
        const groupMembers = initialPieces.filter(p => p.groupId === draggedPiece.groupId);
        let validMove = true;
        const swapRequests: { source: {x:number, y:number}, target: {x:number, y:number}, pieceId: number }[] = [];
        
        for (const member of groupMembers) {
            const mStart = startPositions[member.id];
            const mStartCol = Math.round(mStart.x / pieceW);
            const mStartRow = Math.round(mStart.y / pieceH);
            
            const mTargetCol = mStartCol + deltaCol;
            const mTargetRow = mStartRow + deltaRow;
            
            if (mTargetCol < 0 || mTargetCol >= settings.cols || mTargetRow < 0 || mTargetRow >= settings.rows) {
                validMove = false;
                break;
            }
            
            const mTargetX = mTargetCol * pieceW;
            const mTargetY = mTargetRow * pieceH;
            
            const resident = initialPieces.find(p => 
                p.groupId !== draggedPiece.groupId && 
                Math.abs(p.currentX - mTargetX) < 1 &&
                Math.abs(p.currentY - mTargetY) < 1
            );
            
            if (resident && resident.isLocked) {
                validMove = false;
                break;
            }
            
            swapRequests.push({
                pieceId: member.id,
                source: { x: mStart.x, y: mStart.y },
                target: { x: mTargetX, y: mTargetY }
            });
        }
        
        if (validMove) {
            let newPieces = [...initialPieces];
            const movedIds = new Set(groupMembers.map(m => m.id));
            
            newPieces = newPieces.map(p => {
                const req = swapRequests.find(r => r.pieceId === p.id);
                if (req) {
                    const isCorrect = Math.abs(req.target.x - p.correctX) < 0.1 && 
                                      Math.abs(req.target.y - p.correctY) < 0.1 && 
                                      p.rotation === 0;
                    return { ...p, currentX: req.target.x, currentY: req.target.y, isLocked: isCorrect };
                }
                const displacingReq = swapRequests.find(r => 
                    Math.abs(p.currentX - r.target.x) < 1 &&
                    Math.abs(p.currentY - r.target.y) < 1
                );
                if (displacingReq && !movedIds.has(p.id)) {
                    const isCorrect = Math.abs(displacingReq.source.x - p.correctX) < 0.1 &&
                                      Math.abs(displacingReq.source.y - p.correctY) < 0.1 &&
                                      p.rotation === 0;
                    return { ...p, currentX: displacingReq.source.x, currentY: displacingReq.source.y, isLocked: isCorrect };
                }
                return p;
            });
            
            // Group Merging Logic
            let merged = true;
            while(merged) {
                merged = false;
                const currentGroupMembers = newPieces.filter(p => p.groupId === draggedPiece.groupId);
                for (const member of currentGroupMembers) {
                    const col = Math.round(member.currentX / pieceW);
                    const row = Math.round(member.currentY / pieceH);
                    const neighbors = [{ dc: 1, dr: 0 }, { dc: 0, dr: 1 }, { dc: -1, dr: 0 }, { dc: 0, dr: -1 }];
                    for (const n of neighbors) {
                        const nX = (col + n.dc) * pieceW;
                        const nY = (row + n.dr) * pieceH;
                        const neighborPiece = newPieces.find(p => p.groupId !== member.groupId && Math.abs(p.currentX - nX) < 1 && Math.abs(p.currentY - nY) < 1);
                        if (neighborPiece) {
                            const correctDX = neighborPiece.correctX - member.correctX;
                            const correctDY = neighborPiece.correctY - member.correctY;
                            const expectedDX = n.dc * pieceW;
                            const expectedDY = n.dr * pieceH;
                            if (Math.abs(correctDX - expectedDX) < 1 && Math.abs(correctDY - expectedDY) < 1 && member.rotation === neighborPiece.rotation) {
                                const targetGroupId = member.groupId;
                                const sourceGroupId = neighborPiece.groupId;
                                newPieces = newPieces.map(p => p.groupId === sourceGroupId ? { ...p, groupId: targetGroupId } : p);
                                merged = true;
                                break; 
                            }
                        }
                    }
                    if (merged) break;
                }
            }
            setPieces(newPieces);
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
    startDrag(e.clientX, e.clientY, piece, false);
  }, [pieces]);

  const handleDoubleClick = useCallback((e: React.MouseEvent, piece: Piece) => {
      if (piece.isLocked) return;
      e.stopPropagation();
      e.preventDefault();
      // Double click starts "sticky" drag
      startDrag(e.clientX, e.clientY, piece, true);
  }, [pieces]);


  // UI Formatting
  const activeHintPiece = pieces.find(p => p.id === hintPieceId);
  const difficultyConfig = DIFFICULTY_SETTINGS[difficulty];

  // Render
  return (
    <div className="fixed inset-0 bg-slate-100 flex flex-col overflow-hidden touch-none select-none">
      
      {/* 1. Header (Info & Exit) - Kept high and out of way */}
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

      {/* Settings Dropdown (Floating) */}
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

      {/* 2. Main Game Area - Maximize Space */}
      <div className="flex-1 relative flex items-center justify-center overflow-hidden p-4">
        
        {/* Board Container */}
        <div 
          ref={boardRef}
          className="relative shadow-2xl shadow-indigo-900/10 bg-white rounded-lg transition-all"
          style={{
            width: 'min(92vw, 62vh)', // Adjusted for bottom bar space
            aspectRatio: '1/1',
            touchAction: 'none' // Critical for browser handling
          }}
        >
            {/* Grid Lines */}
            {style === 'classic' && (
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

            {/* Ghost Image (Low Opacity Guide) */}
            <div 
                className="absolute inset-0 pointer-events-none opacity-5 grayscale"
                style={{
                    backgroundImage: `url(${puzzle.src})`,
                    backgroundSize: 'cover'
                }}
            />

            {/* Hint Ghost */}
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

            {/* Pieces Layer */}
            {isLoaded && (
                <PuzzlePieceLayer 
                    pieces={pieces}
                    puzzleSrc={puzzle.src}
                    pieceRefs={pieceRefs}
                    onPointerDown={handlePointerDown}
                    onDoubleClick={handleDoubleClick}
                    onContextRotate={(e, id) => { e.preventDefault(); performRotation(id); }}
                    hintPieceId={hintPieceId}
                    showPreview={showPreview}
                />
            )}

            {/* Full Preview Overlay */}
            <div 
                className={`absolute inset-0 z-50 transition-all duration-300 pointer-events-none origin-center ${showPreview ? 'opacity-100 scale-100' : 'opacity-0 scale-95'}`}
            >
                <img src={puzzle.src} className="w-full h-full object-cover rounded-lg shadow-2xl" alt="preview" />
            </div>
        </div>
      </div>

      {/* 3. Bottom Control Dock (Thumb Zone) */}
      <div className="h-auto px-6 flex items-center justify-center gap-6 z-40 pointer-events-none pb-safe-bottom">
         <div className="pointer-events-auto flex items-center gap-3 bg-white/90 backdrop-blur-xl p-3 rounded-3xl shadow-2xl border border-white/40 ring-1 ring-black/5">
             
             {/* Restart */}
             <button 
                onClick={handleRestart}
                className="flex flex-col items-center justify-center w-20 h-16 rounded-2xl text-slate-500 hover:bg-slate-100 active:bg-slate-200 active:scale-95 transition-all"
             >
                <RotateCcw size={24} className="mb-1" />
                <span className="text-[10px] font-bold uppercase tracking-wider">Reset</span>
             </button>

             <div className="w-px h-10 bg-slate-200"></div>

             {/* Hint */}
             <button 
                onClick={handleHint}
                disabled={hintsRemaining === 0}
                className={`flex flex-col items-center justify-center w-20 h-16 rounded-2xl transition-all active:scale-95 ${
                    hintsRemaining > 0 
                    ? 'text-amber-600 hover:bg-amber-50 active:bg-amber-100' 
                    : 'text-slate-300'
                }`}
             >
                <div className="relative">
                    <Lightbulb size={24} className={`mb-1 ${hintsRemaining > 0 ? 'fill-amber-100' : ''}`} />
                    <span className="absolute -top-1 -right-2 bg-amber-500 text-white text-[9px] w-4 h-4 flex items-center justify-center rounded-full font-bold">
                        {hintsRemaining}
                    </span>
                </div>
                <span className="text-[10px] font-bold uppercase tracking-wider">Hint</span>
             </button>
             
             {/* Preview (Hold Interaction) */}
             <button 
                onPointerDown={() => setShowPreview(true)}
                onPointerUp={() => setShowPreview(false)}
                onPointerLeave={() => setShowPreview(false)}
                className="flex flex-col items-center justify-center w-20 h-16 rounded-2xl text-indigo-600 hover:bg-indigo-50 active:bg-indigo-100 active:scale-95 transition-all"
             >
                <Eye size={24} className="mb-1 fill-indigo-100" />
                <span className="text-[10px] font-bold uppercase tracking-wider">Peek</span>
             </button>
         </div>
      </div>

      {/* Completion Modal */}
      {isComplete && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-md animate-in fade-in duration-500 p-6">
           <div className="bg-white p-8 rounded-[2.5rem] shadow-2xl max-w-sm w-full text-center animate-in zoom-in-95 duration-300">
              <div className="w-20 h-20 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-6">
                 <Check size={40} strokeWidth={4} />
              </div>
              <h2 className="text-3xl font-serif font-bold text-slate-800 mb-2">Complete!</h2>
              <p className="text-slate-500 mb-8">{puzzle.title} solved.</p>
              <div className="flex gap-3">
                 <button onClick={onExit} className="flex-1 py-4 rounded-2xl bg-slate-100 text-slate-700 font-bold hover:bg-slate-200">
                    Gallery
                 </button>
                 <button 
                    onClick={() => initializeNewGame(difficulty, style)}
                    className="flex-1 py-4 rounded-2xl bg-slate-900 text-white font-bold hover:bg-slate-800 shadow-xl shadow-slate-900/20"
                 >
                    Again
                 </button>
              </div>
           </div>
        </div>
      )}
    </div>
  );
};

export default GameBoard;