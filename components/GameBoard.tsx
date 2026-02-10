import React, { useState, useEffect, useRef } from 'react';
import { X, RotateCw, Image as ImageIcon, Eye, Award, ChevronDown, Lightbulb, Clock, RotateCcw } from 'lucide-react';
import { PuzzleConfig, Piece, Difficulty, PuzzleStyle, SavedGameState } from '../types';
import { createPuzzlePieces } from '../utils/puzzleUtils';
import { DIFFICULTY_SETTINGS } from '../constants';

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
  const [elapsedTime, setElapsedTime] = useState(0);
  const [isLoaded, setIsLoaded] = useState(false);
  const [autoSaveTrigger, setAutoSaveTrigger] = useState(0); 
  
  // Hint State
  const [hintsRemaining, setHintsRemaining] = useState(0);
  const [hintPieceId, setHintPieceId] = useState<number | null>(null);
  
  // Refs for High-Performance Dragging
  const boardRef = useRef<HTMLDivElement>(null);
  const pieceRefs = useRef<Record<number, HTMLDivElement | null>>({});
  
  // Optimized Drag State
  const dragRef = useRef<{
    active: boolean;
    pieceId: number | null;
    startX: number;
    startY: number;
    currentX: number;
    currentY: number;
    groupCache: { id: number; el: HTMLDivElement; rotation: number }[];
    startPositions: Record<number, {x: number, y: number}>;
    startTime: number;
  }>({
    active: false,
    pieceId: null,
    startX: 0,
    startY: 0,
    currentX: 0,
    currentY: 0,
    groupCache: [],
    startPositions: {},
    startTime: 0
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
                setElapsedTime(savedGame.elapsedTime);
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
    setElapsedTime(0);
    setHintsRemaining(DIFFICULTY_SETTINGS[diff].hints);
    setHintPieceId(null);
    setIsLoaded(true);
    localStorage.removeItem(`mosaic_save_${puzzle.id}`);
  };

  const handleRestart = () => {
    if (window.confirm("Restart this puzzle? Progress will be lost.")) {
        initializeNewGame(difficulty, style);
    }
  };

  const handleSettingChange = (newDifficulty: Difficulty, newStyle: PuzzleStyle) => {
    if (pieces.some(p => p.isLocked) || elapsedTime > 10) {
        if (!window.confirm("Changing settings will start a new game. Continue?")) return;
    }
    initializeNewGame(newDifficulty, newStyle);
  };

  // Timer
  useEffect(() => {
    if (isComplete || !isLoaded) return;
    const timer = setInterval(() => {
        setElapsedTime(t => {
            if ((t + 1) % 5 === 0) setAutoSaveTrigger(prev => prev + 1);
            return t + 1;
        });
    }, 1000);
    return () => clearInterval(timer);
  }, [isComplete, isLoaded]);

  // Auto-Save
  useEffect(() => {
    if (!isLoaded || isComplete || pieces.length === 0) return;
    const saveState: SavedGameState = {
        puzzleId: puzzle.id,
        pieces,
        difficulty,
        style,
        elapsedTime,
        hintsRemaining,
        isChaosMode: false,
        lastPlayed: Date.now()
    };
    localStorage.setItem(`mosaic_save_${puzzle.id}`, JSON.stringify(saveState));
  }, [autoSaveTrigger, pieces, isComplete, difficulty, style, isLoaded]);

  // Cleanup
  useEffect(() => {
      return () => {
          if (!isComplete && pieces.length > 0 && elapsedTime > 0) {
             const saveState: SavedGameState = {
                puzzleId: puzzle.id,
                pieces,
                difficulty,
                style,
                elapsedTime,
                hintsRemaining,
                isChaosMode: false,
                lastPlayed: Date.now()
            };
            localStorage.setItem(`mosaic_save_${puzzle.id}`, JSON.stringify(saveState));
          }
          if (rafRef.current) cancelAnimationFrame(rafRef.current);
      };
  }, [pieces, difficulty, style, elapsedTime, isComplete, hintsRemaining]);


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

  const handleContextRotate = (e: React.MouseEvent, id: number) => {
    e.preventDefault();
    e.stopPropagation(); 
    performRotation(id);
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

  // --- Optimized Animation Loop ---
  const updateDragVisuals = () => {
      if (!dragRef.current.active) return;
      
      const { startX, startY, currentX, currentY, groupCache } = dragRef.current;
      const dx = currentX - startX;
      const dy = currentY - startY;

      // Batch DOM updates
      for (let i = 0; i < groupCache.length; i++) {
          const item = groupCache[i];
          // Use translate3d for hardware acceleration
          item.el.style.transform = `translate3d(${dx}px, ${dy}px, 0) rotate(${item.rotation}deg) scale(1.05)`;
      }
      
      rafRef.current = requestAnimationFrame(updateDragVisuals);
  };

  // --- Pointer Handlers ---

  const handlePointerDown = (e: React.PointerEvent, piece: Piece) => {
    if (e.button !== 0 || piece.isLocked || isComplete) return;
    
    // Explicitly capture pointer to ensure we get moves even if cursor leaves element
    e.currentTarget.setPointerCapture(e.pointerId);
    
    // 1. Prepare Group Cache
    // Find all pieces in this group and cache their element references and rotations
    // This avoids O(N) lookups during the move loop
    const groupMembers = pieces.filter(p => p.groupId === piece.groupId);
    const groupCache: { id: number; el: HTMLDivElement; rotation: number }[] = [];
    const startPositions: Record<number, {x: number, y: number}> = {};
    
    groupMembers.forEach(p => {
        const el = pieceRefs.current[p.id];
        if (el) {
            groupCache.push({ id: p.id, el, rotation: p.rotation });
            startPositions[p.id] = { x: p.currentX, y: p.currentY };
            
            // Initial Visual State
            el.style.transition = 'none';
            el.style.zIndex = '100';
            el.style.cursor = 'grabbing';
            // Use simple box-shadow instead of SVG filter for performance
            el.style.boxShadow = '0 10px 25px rgba(0,0,0,0.3)';
            // Initial transform setup
            el.style.transform = `rotate(${p.rotation}deg) scale(1.05)`;
            el.style.willChange = 'transform'; // Hint to browser
        }
    });

    // 2. Initialize Drag State
    dragRef.current = {
        active: true,
        pieceId: piece.id,
        startX: e.clientX,
        startY: e.clientY,
        currentX: e.clientX,
        currentY: e.clientY,
        groupCache,
        startPositions,
        startTime: Date.now()
    };

    // 3. Start Animation Loop
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(updateDragVisuals);
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!dragRef.current.active) return;
    
    // Just update coordinates, the rAF loop handles the heavy lifting
    dragRef.current.currentX = e.clientX;
    dragRef.current.currentY = e.clientY;
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (!dragRef.current.active) return;
    
    e.currentTarget.releasePointerCapture(e.pointerId);
    
    // Stop Animation
    dragRef.current.active = false;
    if (rafRef.current) cancelAnimationFrame(rafRef.current);

    // Cleanup Styles Helper
    const cleanupStyles = () => {
        dragRef.current.groupCache.forEach(item => {
            if (item.el) {
                item.el.style.transform = '';
                item.el.style.zIndex = '';
                item.el.style.cursor = '';
                item.el.style.boxShadow = '';
                item.el.style.transition = '';
                item.el.style.willChange = 'auto';
            }
        });
    };

    const { startX, startY, currentX, currentY, startTime, pieceId, groupCache, startPositions } = dragRef.current;

    // Check for Tap (Rotation)
    const dist = Math.hypot(currentX - startX, currentY - startY);
    const time = Date.now() - startTime;

    if (dist < 10 && time < 300 && pieceId !== null) {
         cleanupStyles();
         performRotation(pieceId);
         return;
    }

    // Handle Drop Logic
    const draggedPiece = pieces.find(p => p.id === pieceId);
    
    if (draggedPiece && boardRef.current) {
        const rect = boardRef.current.getBoundingClientRect();
        const settings = DIFFICULTY_SETTINGS[difficulty];
        const pieceW = 100 / settings.cols;
        const pieceH = 100 / settings.rows;
        
        // Calculate Grid Delta
        const totalDxPixels = currentX - startX;
        const totalDyPixels = currentY - startY;
        
        const deltaCol = Math.round((totalDxPixels / rect.width) * settings.cols);
        const deltaRow = Math.round((totalDyPixels / rect.height) * settings.rows);
        
        const groupMembers = pieces.filter(p => p.groupId === draggedPiece.groupId);
        let validMove = true;
        const swapRequests: { source: {x:number, y:number}, target: {x:number, y:number}, pieceId: number }[] = [];
        
        // Validate & Plan Move
        for (const member of groupMembers) {
            const mStart = startPositions[member.id];
            
            const mStartCol = Math.round(mStart.x / pieceW);
            const mStartRow = Math.round(mStart.y / pieceH);
            
            const mTargetCol = mStartCol + deltaCol;
            const mTargetRow = mStartRow + deltaRow;
            
            // Bounds
            if (mTargetCol < 0 || mTargetCol >= settings.cols || mTargetRow < 0 || mTargetRow >= settings.rows) {
                validMove = false;
                break;
            }
            
            const mTargetX = mTargetCol * pieceW;
            const mTargetY = mTargetRow * pieceH;
            
            // Collision (Locked only)
            const resident = pieces.find(p => 
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
            // Execute Move & Swap
            let newPieces = [...pieces];
            const movedIds = new Set(groupMembers.map(m => m.id));
            
            newPieces = newPieces.map(p => {
                // Dragged Items
                const req = swapRequests.find(r => r.pieceId === p.id);
                if (req) {
                    const isCorrect = Math.abs(req.target.x - p.correctX) < 0.1 && 
                                      Math.abs(req.target.y - p.correctY) < 0.1 && 
                                      p.rotation === 0;
                    return { ...p, currentX: req.target.x, currentY: req.target.y, isLocked: isCorrect };
                }
                
                // Displaced Items (Swap)
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
            
            // Join Groups
            let merged = true;
            while(merged) {
                merged = false;
                const currentGroupMembers = newPieces.filter(p => p.groupId === draggedPiece.groupId);
                for (const member of currentGroupMembers) {
                    const col = Math.round(member.currentX / pieceW);
                    const row = Math.round(member.currentY / pieceH);
                    const neighbors = [
                        { dc: 1, dr: 0 }, { dc: 0, dr: 1 }, { dc: -1, dr: 0 }, { dc: 0, dr: -1 }
                    ];

                    for (const n of neighbors) {
                        const nX = (col + n.dc) * pieceW;
                        const nY = (row + n.dr) * pieceH;
                        
                        const neighborPiece = newPieces.find(p => 
                            p.groupId !== member.groupId &&
                            Math.abs(p.currentX - nX) < 1 &&
                            Math.abs(p.currentY - nY) < 1
                        );

                        if (neighborPiece) {
                            const correctDX = neighborPiece.correctX - member.correctX;
                            const correctDY = neighborPiece.correctY - member.correctY;
                            const expectedDX = n.dc * pieceW;
                            const expectedDY = n.dr * pieceH;

                            if (Math.abs(correctDX - expectedDX) < 1 && 
                                Math.abs(correctDY - expectedDY) < 1 &&
                                member.rotation === neighborPiece.rotation) 
                            {
                                const targetGroupId = member.groupId;
                                const sourceGroupId = neighborPiece.groupId;
                                newPieces = newPieces.map(p => 
                                    p.groupId === sourceGroupId ? { ...p, groupId: targetGroupId } : p
                                );
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
    
    // Always cleanup styles. React re-render will position elements correctly if move was valid.
    cleanupStyles();
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };
  
  const activeHintPiece = pieces.find(p => p.id === hintPieceId);

  return (
    <div className="h-screen w-full flex flex-col bg-slate-100 overflow-hidden relative select-none touch-none">
      {/* Background */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-slate-200 via-slate-100 to-slate-200 -z-10"></div>
    
      {/* Top Bar */}
      <div className="h-24 absolute top-0 left-0 right-0 z-20 px-4 md:px-8 flex items-center justify-between glass-panel shadow-sm">
        <div className="flex items-center gap-4 md:gap-8">
          <button onClick={onExit} className="p-4 hover:bg-white/50 rounded-full transition-colors text-slate-600 border border-transparent hover:border-slate-200 active:scale-95" title="Save & Exit">
            <X size={28} />
          </button>
          
          <div className="flex flex-col gap-1">
             <h2 className="font-serif text-xl text-slate-800 leading-tight">{puzzle.title}</h2>
             <div className="flex items-center gap-3 text-sm text-slate-500">
               {/* Controls */}
               <div className="flex items-center gap-2 bg-slate-100/50 p-1.5 rounded-xl border border-slate-200/50">
                   <div className="relative group">
                     <select 
                       value={difficulty}
                       onChange={(e) => handleSettingChange(e.target.value as Difficulty, style)}
                       className="appearance-none bg-transparent pl-3 pr-8 py-1 cursor-pointer text-slate-700 font-medium focus:outline-none capitalize text-base"
                     >
                       {(Object.keys(DIFFICULTY_SETTINGS) as Difficulty[]).map((d) => (
                         <option key={d} value={d}>{d}</option>
                       ))}
                     </select>
                     <ChevronDown size={14} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                   </div>
               </div>
               
               <button 
                  onClick={handleRestart}
                  className="p-2 hover:bg-slate-200 rounded-lg text-slate-500 hover:text-red-500 transition-colors active:bg-slate-300"
                  title="Restart Puzzle"
               >
                  <RotateCcw size={20} />
               </button>
             </div>
          </div>
        </div>
        
        <div className="flex items-center gap-3 md:gap-6">
           <div className="hidden md:flex items-center gap-2 font-mono text-slate-600 bg-white/50 px-5 py-2 rounded-full border border-slate-200/50 shadow-sm text-base">
             <Clock size={18} className="text-slate-400" />
             {formatTime(elapsedTime)}
           </div>
           
           <div className="flex gap-3">
             <button
                onClick={handleHint}
                disabled={hintsRemaining === 0 || isComplete || hintPieceId !== null}
                className={`flex items-center gap-2 px-5 py-3 rounded-full transition-all font-bold text-base shadow-sm border active:scale-95 ${
                    hintsRemaining > 0 && !isComplete 
                    ? 'text-amber-700 bg-amber-50 border-amber-100 hover:bg-amber-100 hover:shadow' 
                    : 'text-slate-400 bg-slate-50 border-slate-100 cursor-not-allowed'
                }`}
             >
                <Lightbulb size={20} className={hintPieceId !== null ? 'animate-pulse fill-amber-700' : ''} />
                <span>{hintsRemaining}</span>
             </button>

             <button 
                className="p-3.5 text-indigo-600 bg-indigo-50 hover:bg-indigo-100 border border-indigo-100 rounded-full transition-colors shadow-sm active:scale-95 active:bg-indigo-200"
                onPointerDown={() => setShowPreview(true)}
                onPointerUp={() => setShowPreview(false)}
                onPointerLeave={() => setShowPreview(false)}
                title="Hold to Preview"
             >
                <Eye size={24} />
             </button>
           </div>
        </div>
      </div>

      {/* Main Game Area */}
      <div className="flex-1 relative overflow-hidden flex items-center justify-center p-4 md:p-8 pt-28">
        
        {/* The Board Container */}
        <div 
          ref={boardRef}
          className="relative shadow-2xl shadow-indigo-500/10 bg-white/40 backdrop-blur-sm rounded-xl border border-white/40"
          style={{
            width: 'min(95vw, 65vh)',
            aspectRatio: '1/1',
          }}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerLeave={handlePointerUp}
        >
            {/* Grid Pattern */}
            {style === 'classic' && (
                <div 
                    className="absolute inset-0 pointer-events-none opacity-20"
                    style={{
                    backgroundImage: `
                        linear-gradient(to right, #94a3b8 1px, transparent 1px),
                        linear-gradient(to bottom, #94a3b8 1px, transparent 1px)
                    `,
                    backgroundSize: `${100 / DIFFICULTY_SETTINGS[difficulty].cols}% ${100 / DIFFICULTY_SETTINGS[difficulty].rows}%`
                    }}
                />
            )}

            {/* Ghost Image */}
            <div 
                className="absolute inset-0 pointer-events-none opacity-5 grayscale"
                style={{
                    backgroundImage: `url(${puzzle.src})`,
                    backgroundSize: 'cover'
                }}
            />

            {/* Preview Overlay */}
            <div 
                className={`absolute inset-0 z-50 transition-all duration-300 pointer-events-none ${showPreview ? 'opacity-100 scale-100' : 'opacity-0 scale-95'}`}
            >
                <img src={puzzle.src} className="w-full h-full object-cover rounded-xl shadow-2xl" alt="preview" />
            </div>

            {/* Hint Indicator */}
            {activeHintPiece && (
                <div 
                    className="absolute z-40 pointer-events-none animate-pulse"
                    style={{
                         width: `${activeHintPiece.width}%`,
                         height: `${activeHintPiece.height}%`,
                         left: `${activeHintPiece.correctX}%`,
                         top: `${activeHintPiece.correctY}%`,
                    }}
                >
                    {activeHintPiece.shape === 'classic' ? (
                         <div className="w-full h-full border-4 border-yellow-400 bg-yellow-400/30 shadow-[0_0_15px_rgba(250,204,21,0.5)] rounded-sm" />
                    ) : (
                         <svg viewBox={activeHintPiece.viewBox} width="100%" height="100%" style={{overflow: 'visible'}}>
                              <path 
                                d={activeHintPiece.pathData} 
                                fill="rgba(250, 204, 21, 0.3)" 
                                stroke="#facc15" 
                                strokeWidth="3" 
                                vectorEffect="non-scaling-stroke"
                              />
                         </svg>
                    )}
                </div>
            )}

            {/* Pieces */}
            {pieces.map((piece) => {
                const isHintTarget = piece.id === hintPieceId;
                return (
                <div
                    key={piece.id}
                    ref={(el) => { pieceRefs.current[piece.id] = el; }}
                    onPointerDown={(e) => handlePointerDown(e, piece)}
                    onContextMenu={(e) => handleContextRotate(e, piece.id)}
                    className={`absolute cursor-grab active:cursor-grabbing ${
                        piece.isLocked ? 'z-0 transition-all duration-500 ease-out' : 'z-10'
                    } ${isHintTarget ? 'z-50' : ''}`}
                    style={{
                        width: `${piece.width}%`,
                        height: `${piece.height}%`,
                        left: `${piece.currentX}%`,
                        top: `${piece.currentY}%`,
                        transform: `rotate(${piece.rotation}deg) ${isHintTarget ? 'scale(1.1)' : ''}`,
                        zIndex: piece.isLocked ? 1 : (isHintTarget ? 40 : 10),
                        opacity: showPreview ? 0 : 1,
                        touchAction: 'none',
                        transition: 'transform 0.2s, left 0.2s, top 0.2s'
                    }}
                >
                    {/* Visual highlighter for hint */}
                    {isHintTarget && (
                        <div className="absolute -inset-2 border-2 border-yellow-400 rounded-lg animate-ping opacity-75 pointer-events-none"></div>
                    )}

                    {piece.shape === 'classic' ? (
                        // Classic Rectangular Piece
                        <div 
                            style={{
                                width: '100%',
                                height: '100%',
                                backgroundImage: `url(${puzzle.src})`,
                                backgroundSize: `${(100 * 100 / piece.width)}% ${(100 * 100 / piece.height)}%`,
                                backgroundPosition: `${piece.bgX}% ${piece.bgY}%`,
                                border: isHintTarget ? '2px solid #facc15' : (piece.isLocked ? 'none' : '1px solid rgba(255,255,255,0.4)'),
                                boxShadow: piece.isLocked ? 'none' : '0 4px 6px -1px rgba(0, 0, 0, 0.3)',
                                borderRadius: '2px'
                            }}
                        >
                             {!piece.isLocked && (
                                <div className="absolute inset-0 border border-white/20 rounded-sm pointer-events-none"></div>
                             )}
                        </div>
                    ) : (
                        // Mosaic / Organic SVG Piece
                        // Filters removed for performance. Simple stroke used instead.
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
                                    href={puzzle.src} 
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
                                        strokeWidth={isHintTarget ? "2" : "0.5"}
                                        vectorEffect="non-scaling-stroke"
                                    />
                                )}
                            </g>
                        </svg>
                    )}
                </div>
                );
            })}
        </div>
      </div>

      {/* Completion Modal */}
      {isComplete && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-md animate-in fade-in duration-700 p-4">
           <div className="bg-white p-8 md:p-12 rounded-[2.5rem] shadow-2xl max-w-lg w-full text-center transform animate-in zoom-in-95 duration-500 border border-white/20">
              <div className="relative inline-block mb-6">
                 <div className="absolute inset-0 bg-green-100 rounded-full blur-xl opacity-70"></div>
                 <div className="h-28 w-28 bg-gradient-to-tr from-emerald-50 to-emerald-100 text-emerald-600 rounded-full flex items-center justify-center relative shadow-sm mx-auto">
                    <Award size={56} />
                 </div>
              </div>
              
              <h2 className="text-4xl md:text-5xl font-serif font-medium text-slate-800 mb-4">Beautiful!</h2>
              <p className="text-slate-500 mb-10 text-xl">You completed {puzzle.title} in <span className="font-mono font-medium text-slate-700">{formatTime(elapsedTime)}</span>.</p>
              
              <div className="flex flex-col md:flex-row gap-4 justify-center">
                 <button onClick={onExit} className="px-8 py-4 rounded-2xl bg-slate-50 text-slate-600 font-bold text-lg hover:bg-slate-100 transition-colors border border-slate-200 active:scale-95">
                    Gallery
                 </button>
                 <button 
                    onClick={() => {
                        initializeNewGame(difficulty, style);
                    }}
                    className="px-8 py-4 rounded-2xl bg-indigo-600 text-white font-bold text-lg hover:bg-indigo-700 transition-all shadow-lg hover:shadow-indigo-500/30 flex items-center justify-center gap-3 active:scale-95"
                 >
                    <RotateCw size={20} /> Play Again
                 </button>
              </div>
           </div>
        </div>
      )}
    </div>
  );
};

export default GameBoard;