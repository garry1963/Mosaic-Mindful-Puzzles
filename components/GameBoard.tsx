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
  const pointerStartPos = useRef({ x: 0, y: 0 });
  const dragStartTime = useRef(0);
  
  // Store start positions for ALL dragged pieces (key = piece.id)
  const dragStartPositions = useRef<Record<number, {x: number, y: number}>>({});
  
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
        isChaosMode: false,
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
                isChaosMode: false,
                lastPlayed: Date.now()
            };
            localStorage.setItem(`mosaic_save_${puzzle.id}`, JSON.stringify(saveState));
          }
      };
  }, [pieces, difficulty, style, elapsedTime, isComplete, hintsRemaining]);


  // Handle Rotation Logic (Separated for reuse)
  const performRotation = (pieceId: number) => {
    if (!DIFFICULTY_SETTINGS[difficulty].rotate) return;
    
    const targetPiece = pieces.find(p => p.id === pieceId);
    if (!targetPiece || targetPiece.isLocked) return;
    
    setPieces(prev => prev.map(p => {
      // Rotate all members of the group
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
    
    // Track start for tap detection
    pointerStartPos.current = { x: e.clientX, y: e.clientY };
    dragStartTime.current = Date.now();
    
    // Record start positions for ALL pieces in the group
    const group = pieces.filter(p => p.groupId === piece.groupId);
    dragStartPositions.current = {};
    group.forEach(p => {
        dragStartPositions.current[p.id] = { x: p.currentX, y: p.currentY };
    });

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
    
    const draggedPiece = pieces.find(p => p.id === draggedPieceId);
    if (!draggedPiece) return;

    const rect = boardRef.current.getBoundingClientRect();
    
    // Calculate new position for the PRIMARY dragged piece
    const newXPx = e.clientX - rect.left - dragOffset.current.x;
    const newYPx = e.clientY - rect.top - dragOffset.current.y;
    
    const newPrimaryX = (newXPx / rect.width) * 100;
    const newPrimaryY = (newYPx / rect.height) * 100;
    
    const dx = newPrimaryX - draggedPiece.currentX;
    const dy = newPrimaryY - draggedPiece.currentY;

    // Move ALL pieces in the group by delta
    setPieces(prev => prev.map(p => {
        if (p.groupId === draggedPiece.groupId) {
            return { ...p, currentX: p.currentX + dx, currentY: p.currentY + dy };
        }
        return p;
    }));
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (draggedPieceId === null) return;
    
    // Tap Detection
    const dist = Math.hypot(e.clientX - pointerStartPos.current.x, e.clientY - pointerStartPos.current.y);
    const time = Date.now() - dragStartTime.current;

    // If it's a tap (short time, minimal movement), interpret as Rotation
    if (dist < 10 && time < 300) {
         performRotation(draggedPieceId);
         setDraggedPieceId(null);
         e.currentTarget.releasePointerCapture(e.pointerId);
         return;
    }

    const draggedPiece = pieces.find(p => p.id === draggedPieceId);
    if (draggedPiece) {
        const settings = DIFFICULTY_SETTINGS[difficulty];
        const pieceW = 100 / settings.cols;
        const pieceH = 100 / settings.rows;
        
        // Identify all members of the dragging group
        const groupMembers = pieces.filter(p => p.groupId === draggedPiece.groupId);
        
        // Calculate Grid Delta based on the primary dragged piece's movement
        // Where did it start?
        const startPos = dragStartPositions.current[draggedPiece.id];
        const startCol = Math.round(startPos.x / pieceW);
        const startRow = Math.round(startPos.y / pieceH);
        
        // Where is it now? (Center based)
        const centerX = draggedPiece.currentX + pieceW / 2;
        const centerY = draggedPiece.currentY + pieceH / 2;
        const targetCol = Math.floor(centerX / pieceW);
        const targetRow = Math.floor(centerY / pieceH);
        
        const deltaCol = targetCol - startCol;
        const deltaRow = targetRow - startRow;
        
        let validMove = true;
        const swapRequests: { source: {x:number, y:number}, target: {x:number, y:number}, pieceId: number }[] = [];
        
        // 1. Validate Bounds and prepare swap requests
        for (const member of groupMembers) {
            const mStart = dragStartPositions.current[member.id];
            const mStartCol = Math.round(mStart.x / pieceW);
            const mStartRow = Math.round(mStart.y / pieceH);
            
            const mTargetCol = mStartCol + deltaCol;
            const mTargetRow = mStartRow + deltaRow;
            
            // Bounds Check
            if (mTargetCol < 0 || mTargetCol >= settings.cols || mTargetRow < 0 || mTargetRow >= settings.rows) {
                validMove = false;
                break;
            }
            
            // Collision Check with LOCKED pieces
            const mTargetX = mTargetCol * pieceW;
            const mTargetY = mTargetRow * pieceH;
            
            // Find what is currently at the target
            const resident = pieces.find(p => 
                p.groupId !== draggedPiece.groupId && // Not part of my group
                Math.abs(p.currentX - mTargetX) < 1 &&
                Math.abs(p.currentY - mTargetY) < 1
            );
            
            if (resident && resident.isLocked) {
                validMove = false; // Cannot displace locked pieces
                break;
            }
            
            swapRequests.push({
                pieceId: member.id,
                source: { x: mStart.x, y: mStart.y },
                target: { x: mTargetX, y: mTargetY }
            });
        }
        
        if (validMove) {
            // 2. Perform Move & Swap
            let newPieces = [...pieces];
            
            // Identify victims (pieces at target locations)
            const victims: Piece[] = [];
            const movedIds = new Set(groupMembers.map(m => m.id));
            
            swapRequests.forEach(req => {
                const victim = newPieces.find(p => 
                    !movedIds.has(p.id) &&
                    Math.abs(p.currentX - req.target.x) < 1 &&
                    Math.abs(p.currentY - req.target.y) < 1
                );
                if (victim) victims.push(victim);
            });
            
            // Execute updates
            newPieces = newPieces.map(p => {
                // If it's a group member, move to target
                const req = swapRequests.find(r => r.pieceId === p.id);
                if (req) {
                    // Check for lock
                    // A group member locks if it hits its correct spot AND has correct rotation
                    const isCorrect = Math.abs(req.target.x - p.correctX) < 0.1 && 
                                      Math.abs(req.target.y - p.correctY) < 0.1 && 
                                      p.rotation === 0;
                    return { ...p, currentX: req.target.x, currentY: req.target.y, isLocked: isCorrect };
                }
                
                // If it's a victim, move to source of the piece that displaced it
                const displacingReq = swapRequests.find(r => 
                    Math.abs(p.currentX - r.target.x) < 1 &&
                    Math.abs(p.currentY - r.target.y) < 1
                );
                
                if (displacingReq && !movedIds.has(p.id)) {
                    // Victim check for lock (unlikely if moving to empty, but good practice)
                    const isCorrect = Math.abs(displacingReq.source.x - p.correctX) < 0.1 &&
                                      Math.abs(displacingReq.source.y - p.correctY) < 0.1 &&
                                      p.rotation === 0;
                    return { ...p, currentX: displacingReq.source.x, currentY: displacingReq.source.y, isLocked: isCorrect };
                }
                
                return p;
            });

            // 3. JOIN Logic (Merge Groups)
            // Check adjacency for all moved group members
            let merged = true;
            while(merged) {
                merged = false;
                // We map over newPieces to find potential merges
                // We need to look for any piece in the just-moved group
                // that is adjacent to a compatible neighbor
                
                // Refresh group member list from newPieces state
                const currentGroupMembers = newPieces.filter(p => p.groupId === draggedPiece.groupId);
                
                for (const member of currentGroupMembers) {
                    // currentX is left offset (Col), currentY is top offset (Row)
                    const col = Math.round(member.currentX / pieceW);
                    const row = Math.round(member.currentY / pieceH);

                    // Check neighbors (Right, Down, Left, Up)
                    const neighbors = [
                        { dc: 1, dr: 0, mySide: 'right' },
                        { dc: 0, dr: 1, mySide: 'bottom' },
                        { dc: -1, dr: 0, mySide: 'left' },
                        { dc: 0, dr: -1, mySide: 'top' }
                    ];

                    for (const n of neighbors) {
                        const nX = (col + n.dc) * pieceW;
                        const nY = (row + n.dr) * pieceH;
                        
                        // Find piece at neighbor loc
                        const neighborPiece = newPieces.find(p => 
                            p.groupId !== member.groupId && // Not already in group
                            Math.abs(p.currentX - nX) < 1 &&
                            Math.abs(p.currentY - nY) < 1
                        );

                        if (neighborPiece) {
                            // Check compatibility
                            // Are they SUPPOSED to be neighbors?
                            // Compare correct coordinates
                            const correctDX = neighborPiece.correctX - member.correctX;
                            const correctDY = neighborPiece.correctY - member.correctY;
                            
                            const expectedDX = n.dc * pieceW;
                            const expectedDY = n.dr * pieceH;

                            // Also check rotations match (must have same rotation to join)
                            if (Math.abs(correctDX - expectedDX) < 1 && 
                                Math.abs(correctDY - expectedDY) < 1 &&
                                member.rotation === neighborPiece.rotation) 
                            {
                                // MERGE
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

        } else {
            // Revert to start
            setPieces(prev => prev.map(p => {
                if (p.groupId === draggedPiece.groupId) {
                    const start = dragStartPositions.current[p.id];
                    return { ...p, currentX: start.x, currentY: start.y };
                }
                return p;
            }));
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
    <div className="h-screen w-full flex flex-col bg-slate-100 overflow-hidden relative select-none">
      {/* Background */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-slate-200 via-slate-100 to-slate-200 -z-10"></div>
    
      {/* Top Bar - Optimized for Tablet Touch */}
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
                    {/* Difficulty Selector */}
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
               
               {/* Restart Button */}
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
            width: 'min(95vw, 65vh)', // Adjusted for tablet spacing
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
                const isDragging = draggedPieceId !== null && pieces.find(p => p.id === draggedPieceId)?.groupId === piece.groupId;
                return (
                <div
                    key={piece.id}
                    onPointerDown={(e) => handlePointerDown(e, piece)}
                    onContextMenu={(e) => handleContextRotate(e, piece.id)}
                    className={`absolute cursor-grab active:cursor-grabbing transition-shadow ${
                        piece.isLocked ? 'z-0 transition-all duration-500 ease-out' : 'z-10 drop-shadow-xl'
                    } ${isHintTarget ? 'z-50' : ''}`}
                    style={{
                        width: `${piece.width}%`,
                        height: `${piece.height}%`,
                        left: `${piece.currentX}%`,
                        top: `${piece.currentY}%`,
                        transform: `rotate(${piece.rotation}deg) ${isHintTarget ? 'scale(1.1)' : ''}`,
                        zIndex: isDragging ? 50 : (piece.isLocked ? 1 : (isHintTarget ? 40 : 10)),
                        opacity: showPreview ? 0 : 1,
                        touchAction: 'none',
                        transition: isDragging ? 'none' : 'transform 0.2s, left 0.2s, top 0.2s'
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