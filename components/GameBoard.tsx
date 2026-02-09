import React, { useState, useEffect, useRef, useCallback } from 'react';
import { X, RotateCw, Image as ImageIcon, CheckCircle, Maximize2, Eye, Award } from 'lucide-react';
import { PuzzleConfig, Piece, Difficulty } from '../types';
import { createPuzzlePieces, checkSnap } from '../utils/puzzleUtils';
import { DIFFICULTY_SETTINGS } from '../constants';

interface GameBoardProps {
  puzzle: PuzzleConfig;
  onExit: () => void;
}

const GameBoard: React.FC<GameBoardProps> = ({ puzzle, onExit }) => {
  const [pieces, setPieces] = useState<Piece[]>([]);
  const [difficulty, setDifficulty] = useState<Difficulty>(puzzle.difficulty || 'normal');
  const [isComplete, setIsComplete] = useState(false);
  const [draggedPieceId, setDraggedPieceId] = useState<number | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [elapsedTime, setElapsedTime] = useState(0);
  
  // Ref for the board container to calculate pixels from percentages
  const boardRef = useRef<HTMLDivElement>(null);
  const dragOffset = useRef({ x: 0, y: 0 });

  // Initialize Game
  useEffect(() => {
    const newPieces = createPuzzlePieces(difficulty);
    setPieces(newPieces);
    setIsComplete(false);
    setElapsedTime(0);
  }, [difficulty, puzzle.id]);

  // Timer
  useEffect(() => {
    if (isComplete) return;
    const timer = setInterval(() => setElapsedTime(t => t + 1), 1000);
    return () => clearInterval(timer);
  }, [isComplete]);

  // Handle Rotation (Right click or Double click)
  const handleRotate = (e: React.MouseEvent, id: number) => {
    e.preventDefault();
    if (!DIFFICULTY_SETTINGS[difficulty].rotate) return;
    
    setPieces(prev => prev.map(p => {
      if (p.id !== id || p.isLocked) return p;
      return { ...p, rotation: (p.rotation + 90) % 360 };
    }));
  };

  // Dragging Logic
  const handlePointerDown = (e: React.PointerEvent, piece: Piece) => {
    if (piece.isLocked || isComplete) return;
    
    e.currentTarget.setPointerCapture(e.pointerId);
    setDraggedPieceId(piece.id);

    // Bring to front (reorder array slightly without full shuffle, or use Z-index)
    // For simplicity, we just rely on the fact that the last rendered is on top usually, 
    // but in a mapped list, we might need z-index. 
    // We'll set a high z-index style for the dragged piece.

    if (boardRef.current) {
      const rect = boardRef.current.getBoundingClientRect();
      const pieceXPx = (piece.currentX / 100) * rect.width;
      const pieceYPx = (piece.currentY / 100) * rect.height;
      
      // Calculate offset from the top-left of the piece to the pointer
      dragOffset.current = {
        x: e.clientX - rect.left - pieceXPx,
        y: e.clientY - rect.top - pieceYPx
      };
    }
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (draggedPieceId === null || !boardRef.current) return;
    
    const rect = boardRef.current.getBoundingClientRect();
    
    // New position in pixels relative to board
    const newXPx = e.clientX - rect.left - dragOffset.current.x;
    const newYPx = e.clientY - rect.top - dragOffset.current.y;
    
    // Convert back to percentage
    let newX = (newXPx / rect.width) * 100;
    let newY = (newYPx / rect.height) * 100;

    // Constraint to board (optional, allowing slightly off-board is okay)
    // newX = Math.max(-10, Math.min(100, newX));
    // newY = Math.max(-10, Math.min(100, newY));

    setPieces(prev => prev.map(p => 
      p.id === draggedPieceId ? { ...p, currentX: newX, currentY: newY } : p
    ));
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (draggedPieceId === null) return;
    
    const piece = pieces.find(p => p.id === draggedPieceId);
    if (piece) {
        // Check snap
        if (checkSnap(piece, difficulty)) {
            // Snap it!
            setPieces(prev => prev.map(p => 
                p.id === draggedPieceId 
                ? { ...p, currentX: p.correctX, currentY: p.correctY, isLocked: true, rotation: 0 } 
                : p
            ));
        }
    }
    
    setDraggedPieceId(null);
    e.currentTarget.releasePointerCapture(e.pointerId);
  };

  // Check Completion
  useEffect(() => {
    if (pieces.length > 0 && pieces.every(p => p.isLocked)) {
      setIsComplete(true);
    }
  }, [pieces]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="h-screen w-full flex flex-col bg-slate-100 overflow-hidden">
      {/* Top Bar */}
      <div className="h-16 bg-white shadow-sm flex items-center justify-between px-6 z-20">
        <div className="flex items-center gap-4">
          <button onClick={onExit} className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-500">
            <X size={24} />
          </button>
          <div>
             <h2 className="font-medium text-slate-800">{puzzle.title}</h2>
             <div className="text-xs text-slate-500 capitalize">{difficulty} • {pieces.length} Pieces</div>
          </div>
        </div>
        
        <div className="flex items-center gap-6">
           <div className="font-mono text-slate-600 bg-slate-50 px-3 py-1 rounded-md border border-slate-200">
             {formatTime(elapsedTime)}
           </div>
           
           <div className="flex gap-2">
             <button 
                className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-full transition-colors"
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
      <div className="flex-1 relative overflow-hidden flex items-center justify-center p-8">
        
        {/* The Board Container */}
        {/* We use a fixed aspect ratio container that fits within the available space */}
        <div 
          ref={boardRef}
          className="relative shadow-2xl bg-slate-200/50 backdrop-blur-sm rounded-lg"
          style={{
            width: 'min(90vw, 80vh)',
            aspectRatio: '1/1',
            // Background image as a faint hint? Or purely blank? 
            // Let's make it blank or faint grid pattern.
          }}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          // Note: PointerUp on board handles drops if the piece event bubbles or is captured differently, 
          // but we usually attach Up to the piece or window. 
          // Attaching to the piece via setPointerCapture is safer.
        >
            {/* Grid Pattern (Guide) */}
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

            {/* Ghost Image (Hint) - Optional, maybe show very faintly */}
            <div 
                className="absolute inset-0 pointer-events-none opacity-5 grayscale"
                style={{
                    backgroundImage: `url(${puzzle.src})`,
                    backgroundSize: 'cover'
                }}
            />

            {/* Preview Overlay */}
            <div 
                className={`absolute inset-0 z-50 transition-opacity duration-300 pointer-events-none ${showPreview ? 'opacity-100' : 'opacity-0'}`}
            >
                <img src={puzzle.src} className="w-full h-full object-cover rounded-lg" alt="preview" />
            </div>

            {/* Pieces */}
            {pieces.map((piece) => (
                <div
                    key={piece.id}
                    onPointerDown={(e) => handlePointerDown(e, piece)}
                    onContextMenu={(e) => handleRotate(e, piece.id)}
                    className={`absolute cursor-grab active:cursor-grabbing transition-shadow ${piece.isLocked ? 'z-0 transition-all duration-300' : 'z-10 shadow-lg'}`}
                    style={{
                        width: `${piece.width}%`,
                        height: `${piece.height}%`,
                        left: `${piece.currentX}%`,
                        top: `${piece.currentY}%`,
                        backgroundImage: `url(${puzzle.src})`,
                        backgroundSize: `${(100 * 100 / piece.width)}% ${(100 * 100 / piece.height)}%`, // Scale bg to cover full board relative to piece size
                        // Calculate background position based on the grid index
                        backgroundPosition: `${piece.bgX}% ${piece.bgY}%`,
                        transform: `rotate(${piece.rotation}deg)`,
                        zIndex: draggedPieceId === piece.id ? 50 : (piece.isLocked ? 1 : 10),
                        // Visual styles for the piece
                        border: piece.isLocked ? 'none' : '1px solid rgba(255,255,255,0.3)',
                        boxShadow: piece.isLocked ? 'none' : '0 4px 6px -1px rgba(0, 0, 0, 0.3)',
                        opacity: showPreview ? 0 : 1,
                        touchAction: 'none'
                    }}
                >
                    {!piece.isLocked && (
                         // Inner highlight for 3D effect
                         <div className="absolute inset-0 border border-white/20 rounded-sm pointer-events-none"></div>
                    )}
                </div>
            ))}
        </div>
      </div>

      {/* Completion Modal */}
      {isComplete && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm animate-in fade-in duration-500">
           <div className="bg-white p-8 rounded-3xl shadow-2xl max-w-md w-full text-center transform animate-bounce-short">
              <div className="h-20 w-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto mb-6">
                 <Award size={40} />
              </div>
              <h2 className="text-3xl font-bold text-slate-800 mb-2">Beautiful!</h2>
              <p className="text-slate-500 mb-6">You completed {puzzle.title} in {formatTime(elapsedTime)}.</p>
              
              <div className="flex gap-3 justify-center">
                 <button onClick={onExit} className="px-6 py-3 rounded-xl bg-slate-100 text-slate-700 font-medium hover:bg-slate-200 transition-colors">
                    Back to Gallery
                 </button>
                 <button 
                    onClick={() => {
                        setPieces(createPuzzlePieces(difficulty));
                        setIsComplete(false);
                        setElapsedTime(0);
                    }}
                    className="px-6 py-3 rounded-xl bg-indigo-600 text-white font-medium hover:bg-indigo-700 transition-colors flex items-center gap-2"
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