import React, { useState, useEffect, useRef, useCallback } from 'react';
import { X, RotateCw, Image as ImageIcon, CheckCircle, Maximize2, Eye, Award, ChevronDown, Shapes, Zap, Lightbulb, Clock, RotateCcw, Save } from 'lucide-react';
import { PuzzleConfig, Piece, Difficulty, PuzzleStyle, SavedGameState } from '../types';
import { createPuzzlePieces, checkSnap } from '../utils/puzzleUtils';
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
  const [isChaosMode, setIsChaosMode] = useState(false);
  const [isComplete, setIsComplete] = useState(false);
  const [draggedPieceId, setDraggedPieceId] = useState<number | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [isLoaded, setIsLoaded] = useState(false);
  const [autoSaveTrigger, setAutoSaveTrigger] = useState(0); // Counter to trigger effects
  
  // Hint State
  const [hintsRemaining, setHintsRemaining] = useState(0);
  const [hintPieceId, setHintPieceId] = useState<number | null>(null);
  
  // Ref for the board container to calculate pixels from percentages
  const boardRef = useRef<HTMLDivElement>(null);
  const dragOffset = useRef({ x: 0, y: 0 });
  
  // Physics state for chaos mode
  const velocities = useRef<Record<number, {vx: number, vy: number}>>({});

  // Initialize Game (Load Save or Create New)
  useEffect(() => {
    // Check local storage
    const saveKey = `mosaic_save_${puzzle.id}`;
    const savedDataStr = localStorage.getItem(saveKey);
    
    if (savedDataStr) {
        try {
            const savedGame: SavedGameState = JSON.parse(savedDataStr);
            // Verify basic integrity
            if (savedGame.puzzleId === puzzle.id && Array.isArray(savedGame.pieces)) {
                setDifficulty(savedGame.difficulty);
                setStyle(savedGame.style);
                setPieces(savedGame.pieces);
                setElapsedTime(savedGame.elapsedTime);
                setHintsRemaining(savedGame.hintsRemaining);
                setIsChaosMode(savedGame.isChaosMode);
                setIsLoaded(true);
                return;
            }
        } catch (e) {
            console.error("Failed to load save", e);
        }
    }

    // Default Initialization if no save
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
    setIsChaosMode(false);
    velocities.current = {};
    setIsLoaded(true);
    
    // Clear any existing save for a "clean" start logic if explicitly called
    localStorage.removeItem(`mosaic_save_${puzzle.id}`);
  };

  const handleRestart = () => {
    if (window.confirm("Restart this puzzle? Progress will be lost.")) {
        initializeNewGame(difficulty, style);
    }
  };

  // Handle Setting Changes (Triggers Reset)
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
            // Trigger auto-save check every 5 seconds roughly via dependency on time
            if ((t + 1) % 5 === 0) setAutoSaveTrigger(prev => prev + 1);
            return t + 1;
        });
    }, 1000);
    return () => clearInterval(timer);
  }, [isComplete, isLoaded]);

  // Auto-Save Logic
  useEffect(() => {
    if (!isLoaded || isComplete || pieces.length === 0) return;
    
    const saveState: SavedGameState = {
        puzzleId: puzzle.id,
        pieces,
        difficulty,
        style,
        elapsedTime,
        hintsRemaining,
        isChaosMode,
        lastPlayed: Date.now()
    };
    
    localStorage.setItem(`mosaic_save_${puzzle.id}`, JSON.stringify(saveState));
  }, [autoSaveTrigger, pieces, isComplete, difficulty, style, isLoaded]); // Saves on moves (pieces change) or timer trigger

  // Cleanup on Unmount (Save one last time)
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
                isChaosMode,
                lastPlayed: Date.now()
            };
            localStorage.setItem(`mosaic_save_${puzzle.id}`, JSON.stringify(saveState));
          }
      };
  }, [pieces, difficulty, style, elapsedTime, isComplete, hintsRemaining, isChaosMode]);


  // Chaos Mode Physics Loop
  useEffect(() => {
    if (!isChaosMode || isComplete) return;

    const interval = setInterval(() => {
      setPieces(prev => {
        return prev.map(p => {
          if (p.isLocked || p.id === draggedPieceId || p.id === hintPieceId) return p;

          // Initialize velocity if missing
          if (!velocities.current[p.id]) {
            velocities.current[p.id] = { vx: 0, vy: 0 };
          }
          const v = velocities.current[p.id];

          // Random steering (Brownian motion)
          // Adjust velocity slightly
          v.vx += (Math.random() - 0.5) * 0.05;
          v.vy += (Math.random() - 0.5) * 0.05;

          // Dampen / Clamp speed
          const maxSpeed = 0.3;
          v.vx = Math.max(-maxSpeed, Math.min(maxSpeed, v.vx));
          v.vy = Math.max(-maxSpeed, Math.min(maxSpeed, v.vy));

          // Apply position
          let newX = p.currentX + v.vx;
          let newY = p.currentY + v.vy;

          // Soft bounds (bounce)
          // Allow pieces to float slightly off board but bounce back
          if (newX < -15) v.vx += 0.05; // Push right
          if (newX > 105) v.vx -= 0.05; // Push left
          if (newY < -15) v.vy += 0.05;
          if (newY > 105) v.vy -= 0.05;

          return { ...p, currentX: newX, currentY: newY };
        });
      });
    }, 50); // 20fps for performance balance

    return () => clearInterval(interval);
  }, [isChaosMode, isComplete, draggedPieceId, hintPieceId]);

  // Handle Rotation
  const handleRotate = (e: React.MouseEvent, id: number) => {
    e.preventDefault();
    e.stopPropagation(); 
    if (!DIFFICULTY_SETTINGS[difficulty].rotate) return;
    
    setPieces(prev => prev.map(p => {
      if (p.id !== id || p.isLocked) return p;
      return { ...p, rotation: (p.rotation + 90) % 360 };
    }));
  };
  
  // Handle Hint
  const handleHint = () => {
    if (hintsRemaining <= 0 || isComplete || hintPieceId !== null) return;
    
    // Find unlocked pieces
    const unlocked = pieces.filter(p => !p.isLocked);
    if (unlocked.length === 0) return;

    // Pick random piece to hint
    const randomPiece = unlocked[Math.floor(Math.random() * unlocked.length)];
    setHintPieceId(randomPiece.id);
    setHintsRemaining(prev => prev - 1);

    // Auto-clear hint after 3 seconds
    setTimeout(() => {
        setHintPieceId(null);
    }, 3000);
  };

  // Dragging Logic
  const handlePointerDown = (e: React.PointerEvent, piece: Piece) => {
    if (e.button !== 0) return;
    if (piece.isLocked || isComplete) return;
    
    e.currentTarget.setPointerCapture(e.pointerId);
    setDraggedPieceId(piece.id);

    if (boardRef.current) {
      const rect = boardRef.current.getBoundingClientRect();
      const pieceXPx = (piece.currentX / 100) * rect.width;
      const pieceYPx = (piece.currentY / 100) * rect.height;
      
      dragOffset.current = {
        x: e.clientX - rect.left - pieceXPx,
        y: e.clientY - rect.top - pieceYPx
      };
    }
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (draggedPieceId === null || !boardRef.current) return;
    
    const rect = boardRef.current.getBoundingClientRect();
    const newXPx = e.clientX - rect.left - dragOffset.current.x;
    const newYPx = e.clientY - rect.top - dragOffset.current.y;
    
    let newX = (newXPx / rect.width) * 100;
    let newY = (newYPx / rect.height) * 100;

    setPieces(prev => prev.map(p => 
      p.id === draggedPieceId ? { ...p, currentX: newX, currentY: newY } : p
    ));
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (draggedPieceId === null) return;
    
    const piece = pieces.find(p => p.id === draggedPieceId);
    if (piece) {
        if (checkSnap(piece, difficulty)) {
            setPieces(prev => prev.map(p => 
                p.id === draggedPieceId 
                ? { ...p, currentX: p.correctX, currentY: p.correctY, isLocked: true, rotation: 0 } 
                : p
            ));
            // If the snapped piece was the hint piece, clear hint immediately
            if (draggedPieceId === hintPieceId) {
                setHintPieceId(null);
            }
        }
    }
    
    setDraggedPieceId(null);
    e.currentTarget.releasePointerCapture(e.pointerId);
  };

  // Check Completion
  useEffect(() => {
    if (pieces.length > 0 && pieces.every(p => p.isLocked)) {
      if (!isComplete) {
          setIsComplete(true);
          // Save will be cleared by parent or effect
          localStorage.removeItem(`mosaic_save_${puzzle.id}`);
          if (onComplete) onComplete();
      }
    }
  }, [pieces, isComplete, onComplete, puzzle.id]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };
  
  const activeHintPiece = pieces.find(p => p.id === hintPieceId);

  return (
    <div className="h-screen w-full flex flex-col bg-slate-100 overflow-hidden relative">
      {/* Background */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-slate-200 via-slate-100 to-slate-200 -z-10"></div>
    
      {/* Top Bar - Glassmorphism */}
      <div className="h-20 absolute top-0 left-0 right-0 z-20 px-6 flex items-center justify-between glass-panel shadow-sm">
        <div className="flex items-center gap-6">
          <button onClick={onExit} className="p-2.5 hover:bg-white/50 rounded-full transition-colors text-slate-600 border border-transparent hover:border-slate-200" title="Save & Exit">
            <X size={24} />
          </button>
          
          <div className="flex flex-col">
             <h2 className="font-serif text-lg text-slate-800 leading-tight">{puzzle.title}</h2>
             <div className="flex items-center gap-3 text-xs text-slate-500 mt-1">
               {/* Controls */}
               <div className="flex items-center gap-2 bg-slate-100/50 p-1 rounded-lg border border-slate-200/50">
                    {/* Difficulty Selector */}
                   <div className="relative group">
                     <select 
                       value={difficulty}
                       onChange={(e) => handleSettingChange(e.target.value as Difficulty, style)}
                       className="appearance-none bg-transparent pl-2 pr-5 py-0.5 cursor-pointer text-slate-700 font-medium focus:outline-none capitalize"
                     >
                       {(Object.keys(DIFFICULTY_SETTINGS) as Difficulty[]).map((d) => (
                         <option key={d} value={d}>{d}</option>
                       ))}
                     </select>
                     <ChevronDown size={10} className="absolute right-1 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                   </div>
                   
                   <div className="w-px h-3 bg-slate-300"></div>

                   {/* Style Selector */}
                   <div className="relative group">
                     <select 
                       value={style}
                       onChange={(e) => handleSettingChange(difficulty, e.target.value as PuzzleStyle)}
                       className="appearance-none bg-transparent pl-2 pr-5 py-0.5 cursor-pointer text-slate-700 font-medium focus:outline-none capitalize"
                     >
                        <option value="classic">Grid</option>
                        <option value="mosaic">Mosaic</option>
                     </select>
                     <Shapes size={10} className="absolute right-1 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                   </div>
               </div>
               
               {/* Restart Button */}
               <button 
                  onClick={handleRestart}
                  className="p-1 hover:bg-slate-200 rounded text-slate-500 hover:text-red-500 transition-colors"
                  title="Restart Puzzle"
               >
                  <RotateCcw size={14} />
               </button>

               {/* Chaos Mode Toggle */}
               <button
                  onClick={() => setIsChaosMode(!isChaosMode)}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md border transition-all ${
                    isChaosMode 
                    ? 'bg-amber-100 border-amber-200 text-amber-700 shadow-sm' 
                    : 'bg-white/50 border-slate-200 text-slate-500 hover:border-slate-300'
                    }`}
                  title="Chaos Mode: Pieces drift over time"
               >
                 <Zap size={10} className={isChaosMode ? 'fill-amber-700' : ''} />
                 <span className="font-medium">Chaos</span>
               </button>
             </div>
          </div>
        </div>
        
        <div className="flex items-center gap-4">
           <div className="flex items-center gap-2 font-mono text-slate-600 bg-white/50 px-4 py-1.5 rounded-full border border-slate-200/50 shadow-sm">
             <Clock size={14} className="text-slate-400" />
             {formatTime(elapsedTime)}
           </div>
           
           <div className="flex gap-2">
             <button
                onClick={handleHint}
                disabled={hintsRemaining === 0 || isComplete || hintPieceId !== null}
                className={`flex items-center gap-2 px-4 py-2 rounded-full transition-all font-medium text-sm shadow-sm border ${
                    hintsRemaining > 0 && !isComplete 
                    ? 'text-amber-700 bg-amber-50 border-amber-100 hover:bg-amber-100 hover:shadow' 
                    : 'text-slate-400 bg-slate-50 border-slate-100 cursor-not-allowed'
                }`}
             >
                <Lightbulb size={16} className={hintPieceId !== null ? 'animate-pulse fill-amber-700' : ''} />
                <span>{hintsRemaining}</span>
             </button>

             <button 
                className="p-2.5 text-indigo-600 bg-indigo-50 hover:bg-indigo-100 border border-indigo-100 rounded-full transition-colors shadow-sm"
                onPointerDown={() => setShowPreview(true)}
                onPointerUp={() => setShowPreview(false)}
                onPointerLeave={() => setShowPreview(false)}
                title="Hold to Preview"
             >
                <Eye size={20} />
             </button>
           </div>
        </div>
      </div>

      {/* Main Game Area */}
      <div className="flex-1 relative overflow-hidden flex items-center justify-center p-8 pt-24">
        
        {/* The Board Container */}
        <div 
          ref={boardRef}
          className="relative shadow-2xl shadow-indigo-500/10 bg-white/40 backdrop-blur-sm rounded-xl border border-white/40"
          style={{
            width: 'min(90vw, 75vh)',
            aspectRatio: '1/1',
          }}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
        >
            {/* Grid Pattern (Guide) - Only show for Classic/Grid style */}
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

            {/* Ghost Image (Hint) */}
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

            {/* Hint Indicator (Ghost Piece at Target) */}
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
                                filter="drop-shadow(0 0 4px rgba(250, 204, 21, 0.5))"
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
                    onPointerDown={(e) => handlePointerDown(e, piece)}
                    onContextMenu={(e) => handleRotate(e, piece.id)}
                    onDoubleClick={(e) => handleRotate(e, piece.id)}
                    className={`absolute cursor-grab active:cursor-grabbing transition-shadow ${
                        piece.isLocked ? 'z-0 transition-all duration-500 ease-out' : 'z-10 drop-shadow-xl'
                    } ${isHintTarget ? 'z-50' : ''}`}
                    style={{
                        width: `${piece.width}%`,
                        height: `${piece.height}%`,
                        left: `${piece.currentX}%`,
                        top: `${piece.currentY}%`,
                        transform: `rotate(${piece.rotation}deg) ${isHintTarget ? 'scale(1.1)' : ''}`,
                        zIndex: draggedPieceId === piece.id ? 50 : (piece.isLocked ? 1 : (isHintTarget ? 40 : 10)),
                        opacity: showPreview ? 0 : 1,
                        touchAction: 'none',
                        transition: draggedPieceId === piece.id ? 'none' : 'transform 0.2s, left 0.2s, top 0.2s'
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
                                {/* Filter for 3D bezel effect */}
                                <filter id={`bezel-${piece.id}`}>
                                   <feGaussianBlur in="SourceAlpha" stdDeviation="0.5" result="blur"/>
                                   <feSpecularLighting in="blur" surfaceScale="2" specularConstant="1" specularExponent="10" lightingColor="white" result="specular">
                                      <fePointLight x="-5000" y="-10000" z="20000"/>
                                   </feSpecularLighting>
                                   <feComposite in="specular" in2="SourceAlpha" operator="in" result="specular"/>
                                   <feComposite in="SourceGraphic" in2="specular" operator="arithmetic" k1="0" k2="1" k3="1" k4="0"/>
                                </filter>
                            </defs>
                            
                            <g>
                                {/* The Image Clipped by the Path */}
                                <image 
                                    href={puzzle.src} 
                                    x="0" y="0" 
                                    width="100" height="100" 
                                    preserveAspectRatio="none"
                                    clipPath={`url(#clip-${piece.id})`}
                                />
                                
                                {/* Outline / Border */}
                                {!piece.isLocked && (
                                    <path 
                                        d={piece.pathData} 
                                        fill="none" 
                                        stroke={isHintTarget ? "#facc15" : "rgba(255,255,255,0.5)"}
                                        strokeWidth={isHintTarget ? "2" : "0.5"}
                                        vectorEffect="non-scaling-stroke"
                                        filter="drop-shadow(0 1px 2px rgba(0,0,0,0.2))"
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
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-md animate-in fade-in duration-700">
           <div className="bg-white p-10 rounded-[2rem] shadow-2xl max-w-md w-full text-center transform animate-in zoom-in-95 duration-500 border border-white/20">
              <div className="relative inline-block mb-6">
                 <div className="absolute inset-0 bg-green-100 rounded-full blur-xl opacity-70"></div>
                 <div className="h-24 w-24 bg-gradient-to-tr from-emerald-50 to-emerald-100 text-emerald-600 rounded-full flex items-center justify-center relative shadow-sm">
                    <Award size={48} />
                 </div>
              </div>
              
              <h2 className="text-4xl font-serif font-medium text-slate-800 mb-3">Beautiful!</h2>
              <p className="text-slate-500 mb-8 text-lg">You completed {puzzle.title} in <span className="font-mono font-medium text-slate-700">{formatTime(elapsedTime)}</span>.</p>
              
              <div className="flex gap-4 justify-center">
                 <button onClick={onExit} className="px-8 py-3.5 rounded-2xl bg-slate-50 text-slate-600 font-medium hover:bg-slate-100 transition-colors border border-slate-200">
                    Gallery
                 </button>
                 <button 
                    onClick={() => {
                        initializeNewGame(difficulty, style);
                    }}
                    className="px-8 py-3.5 rounded-2xl bg-indigo-600 text-white font-medium hover:bg-indigo-700 transition-all shadow-lg hover:shadow-indigo-500/30 flex items-center gap-2"
                 >
                    <RotateCw size={18} /> Play Again
                 </button>
              </div>
           </div>
        </div>
      )}
    </div>
  );
};

export default GameBoard;