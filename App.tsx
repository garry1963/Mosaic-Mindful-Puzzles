import React, { useState, useEffect } from 'react';
import { Home, Puzzle, Settings, Image as ImageIcon, Sparkles, Clock, ArrowLeft, RotateCcw } from 'lucide-react';
import GameBoard from './components/GameBoard';
import { generateImage } from './services/geminiService';
import { GameState, Difficulty, PuzzleConfig, AppView, GeneratedImage } from './types';
import { INITIAL_PUZZLES } from './constants';

const App: React.FC = () => {
  const [currentView, setCurrentView] = useState<AppView>('home');
  const [selectedPuzzle, setSelectedPuzzle] = useState<PuzzleConfig | null>(null);
  const [generatedImages, setGeneratedImages] = useState<GeneratedImage[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [promptInput, setPromptInput] = useState('');

  // AI Generation Handler
  const handleGeneratePuzzle = async () => {
    if (!promptInput.trim()) return;
    setIsGenerating(true);
    try {
      const base64Image = await generateImage(promptInput);
      if (base64Image) {
        const newPuzzle: GeneratedImage = {
          id: `gen-${Date.now()}`,
          src: base64Image,
          title: promptInput,
          isAi: true
        };
        setGeneratedImages(prev => [newPuzzle, ...prev]);
        setPromptInput('');
      }
    } catch (error) {
      console.error("Failed to generate puzzle:", error);
      alert("Could not generate image. Please check API Key or try a different prompt.");
    } finally {
      setIsGenerating(false);
    }
  };

  const startPuzzle = (puzzle: PuzzleConfig) => {
    setSelectedPuzzle(puzzle);
    setCurrentView('game');
  };

  const handleBack = () => {
    if (currentView === 'game') {
      // Confirm exit if game in progress? For MVP, just go back.
      setCurrentView('home');
      setSelectedPuzzle(null);
    } else {
      setCurrentView('home');
    }
  };

  const renderHome = () => (
    <div className="flex flex-col h-screen w-full max-w-4xl mx-auto p-6">
      <header className="mb-8 text-center space-y-2">
        <h1 className="text-4xl font-light tracking-tight text-slate-800">Mosaic</h1>
        <p className="text-slate-500">Mindful Puzzles & Spatial Logic</p>
      </header>

      {/* Main Mode Selection */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-10">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 hover:shadow-md transition-shadow cursor-pointer"
             onClick={() => setCurrentView('gallery')}>
          <div className="h-12 w-12 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center mb-4">
            <ImageIcon size={24} />
          </div>
          <h2 className="text-xl font-medium text-slate-800">Classic Gallery</h2>
          <p className="text-slate-500 text-sm mt-1">Explore a curated collection of beautiful imagery.</p>
        </div>

        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 hover:shadow-md transition-shadow cursor-pointer"
             onClick={() => setCurrentView('create')}>
          <div className="h-12 w-12 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center mb-4">
            <Sparkles size={24} />
          </div>
          <h2 className="text-xl font-medium text-slate-800">AI Studio</h2>
          <p className="text-slate-500 text-sm mt-1">Describe a scene and let Gemini create a unique puzzle.</p>
        </div>
      </div>

      {/* Daily Challenge (Mockup) */}
      <div className="bg-gradient-to-r from-amber-50 to-orange-50 p-6 rounded-2xl border border-orange-100 flex items-center justify-between cursor-pointer hover:opacity-90 transition-opacity"
           onClick={() => startPuzzle({ ...INITIAL_PUZZLES[0], difficulty: 'normal' })}>
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Clock size={16} className="text-orange-600" />
            <span className="text-xs font-bold uppercase tracking-wider text-orange-600">Daily Challenge</span>
          </div>
          <h3 className="text-lg font-medium text-slate-800">Golden Hour in Kyoto</h3>
        </div>
        <button className="bg-white text-orange-600 px-4 py-2 rounded-lg text-sm font-medium shadow-sm">Play</button>
      </div>
    </div>
  );

  const renderGallery = () => (
    <div className="h-screen flex flex-col p-6 max-w-5xl mx-auto w-full">
      <div className="flex items-center gap-4 mb-6">
        <button onClick={handleBack} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
          <ArrowLeft size={24} className="text-slate-600" />
        </button>
        <h2 className="text-2xl font-light text-slate-800">Puzzle Gallery</h2>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 overflow-y-auto custom-scrollbar pb-10">
        {INITIAL_PUZZLES.map((puzzle) => (
          <div key={puzzle.id} 
               onClick={() => startPuzzle(puzzle)}
               className="group relative aspect-square rounded-xl overflow-hidden cursor-pointer shadow-sm hover:shadow-lg transition-all">
            <img src={puzzle.src} alt={puzzle.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-end p-4">
              <span className="text-white font-medium">{puzzle.title}</span>
              <span className="text-white/80 text-xs">Classic Collection</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  const renderCreate = () => (
    <div className="h-screen flex flex-col p-6 max-w-4xl mx-auto w-full">
      <div className="flex items-center gap-4 mb-6">
        <button onClick={handleBack} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
          <ArrowLeft size={24} className="text-slate-600" />
        </button>
        <h2 className="text-2xl font-light text-slate-800">AI Puzzle Studio</h2>
      </div>

      <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-100 mb-8">
        <label className="block text-sm font-medium text-slate-700 mb-2">What kind of puzzle should we build?</label>
        <div className="flex gap-2">
          <input 
            type="text" 
            value={promptInput}
            onChange={(e) => setPromptInput(e.target.value)}
            placeholder="E.g., A futuristic city in the clouds, painted in watercolor..."
            className="flex-1 px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-slate-50"
            onKeyDown={(e) => e.key === 'Enter' && handleGeneratePuzzle()}
          />
          <button 
            onClick={handleGeneratePuzzle}
            disabled={isGenerating || !promptInput}
            className={`px-6 py-3 rounded-xl font-medium text-white flex items-center gap-2 transition-all ${
              isGenerating ? 'bg-indigo-300' : 'bg-indigo-600 hover:bg-indigo-700 shadow-md hover:shadow-lg'
            }`}
          >
            {isGenerating ? (
              <>Generating...</>
            ) : (
              <><Sparkles size={18} /> Create</>
            )}
          </button>
        </div>
      </div>

      <h3 className="text-lg font-medium text-slate-700 mb-4">Your Creations</h3>
      {generatedImages.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-slate-400 border-2 border-dashed border-slate-200 rounded-2xl">
          <ImageIcon size={48} className="mb-4 opacity-50" />
          <p>No generated puzzles yet.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 overflow-y-auto custom-scrollbar pb-10">
          {generatedImages.map((img) => (
            <div key={img.id} 
                 onClick={() => startPuzzle({ id: img.id, src: img.src, title: img.title, difficulty: 'normal' })}
                 className="group relative aspect-square rounded-xl overflow-hidden cursor-pointer shadow-sm hover:shadow-lg transition-all">
              <img src={img.src} alt={img.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent flex flex-col justify-end p-4">
                <span className="text-white font-medium truncate">{img.title}</span>
                <span className="text-indigo-200 text-xs flex items-center gap-1"><Sparkles size={10} /> AI Generated</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans selection:bg-indigo-100">
      {currentView === 'home' && renderHome()}
      {currentView === 'gallery' && renderGallery()}
      {currentView === 'create' && renderCreate()}
      {currentView === 'game' && selectedPuzzle && (
        <GameBoard 
          puzzle={selectedPuzzle} 
          onExit={handleBack} 
        />
      )}
    </div>
  );
};

export default App;