import React, { useState, useEffect, useRef } from 'react';
import { Home, Puzzle, Settings, Image as ImageIcon, Sparkles, Clock, ArrowLeft, RotateCcw, Flame, Play, ChevronRight, Wand2, History, Layers, HelpCircle, X, MousePointer2, RotateCw, Shapes, Eye, Lightbulb, Zap, Check } from 'lucide-react';
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
  const [savedGameIds, setSavedGameIds] = useState<Set<string>>(new Set());
  const [completedPuzzleIds, setCompletedPuzzleIds] = useState<Set<string>>(new Set());
  const [showHowToPlay, setShowHowToPlay] = useState(false);
  
  // Gallery State (starts with initial, extends with discoveries)
  const [galleryPuzzles, setGalleryPuzzles] = useState<PuzzleConfig[]>(INITIAL_PUZZLES);
  const [activeCategory, setActiveCategory] = useState<string>('Nature');
  const initializationRef = useRef(false);

  // Daily Streak State
  const [streak, setStreak] = useState(0);

  // Check for saved games
  const checkForSavedGames = () => {
      const saves = new Set<string>();
      for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (key && key.startsWith('mosaic_save_')) {
              const puzzleId = key.replace('mosaic_save_', '');
              saves.add(puzzleId);
          }
      }
      setSavedGameIds(saves);
  };

  // Android Back Button Handling (History API)
  useEffect(() => {
    const handlePopState = (event: PopStateEvent) => {
        // When hardware back button is pressed, or history.back() is called
        if (currentView !== 'home') {
            setCurrentView('home');
            setSelectedPuzzle(null);
            checkForSavedGames();
        }
    };

    window.addEventListener('popstate', handlePopState);
    
    // Set initial history state
    window.history.replaceState({ view: 'home' }, '');

    return () => window.removeEventListener('popstate', handlePopState);
  }, [currentView]);

  // Initialize: Load streak, Completed Puzzles, Add new daily discovery puzzle & Check saves
  useEffect(() => {
    // 0. Check Saves
    checkForSavedGames();

    // 0.5 Load Completed Puzzles
    try {
        const savedCompleted = localStorage.getItem('mosaic_completed_ids');
        if (savedCompleted) {
            setCompletedPuzzleIds(new Set(JSON.parse(savedCompleted)));
        }
    } catch (e) {
        console.error("Failed to load completed puzzles", e);
    }

    // 1. Streak Logic
    const storedStreak = parseInt(localStorage.getItem('mosaic_streak') || '0');
    const lastWin = localStorage.getItem('mosaic_last_win');
    const today = new Date().toDateString();
    const yesterday = new Date(Date.now() - 86400000).toDateString();

    if (lastWin && lastWin !== today && lastWin !== yesterday) {
        setStreak(0);
        localStorage.setItem('mosaic_streak', '0');
    } else {
        setStreak(storedStreak);
    }

    // 2. New Puzzle Discovery Logic (Run once per session/mount)
    if (!initializationRef.current) {
        initializationRef.current = true;
        
        let storedDiscoveries: PuzzleConfig[] = [];
        try {
            const storedDiscoveriesStr = localStorage.getItem('mosaic_discoveries');
            if (storedDiscoveriesStr) {
                const parsed = JSON.parse(storedDiscoveriesStr);
                if (Array.isArray(parsed)) {
                    storedDiscoveries = parsed;
                }
            }
        } catch (e) {
            console.error("Failed to parse discoveries from local storage", e);
            // Reset if corrupt
            localStorage.removeItem('mosaic_discoveries');
        }
        
        // Helper to extract picsum ID
        const getPicsumId = (url: string) => {
            if (!url) return -1;
            const match = url.match(/\/id\/(\d+)\//);
            return match ? parseInt(match[1]) : -1;
        };

        const usedIds = new Set<number>();
        [...INITIAL_PUZZLES, ...storedDiscoveries].forEach(p => {
            if (p && p.src) {
                const id = getPicsumId(p.src);
                if (id !== -1) usedIds.add(id);
            }
        });

        // Try to find a new unique image ID
        let newId = -1;
        let attempts = 0;
        while (attempts < 50) {
            // Picsum IDs go up to ~1084, picking safe range
            const candidate = Math.floor(Math.random() * 800) + 10; 
            if (!usedIds.has(candidate)) {
                newId = candidate;
                break;
            }
            attempts++;
        }

        if (newId !== -1) {
            const adjectives = ["Hidden", "Silent", "Cosmic", "Vibrant", "Misty", "Ancient", "Glass", "Neon", "Rustic", "Golden", "Ethereal", "Quiet", "Frozen", "Blooming"];
            const nouns = ["Fragment", "Vista", "Echo", "Dream", "Horizon", "Oasis", "Whisper", "Journey", "Valley", "Light", "Shadow", "River", "Summit", "Harbor"];
            const randomTitle = `${adjectives[Math.floor(Math.random() * adjectives.length)]} ${nouns[Math.floor(Math.random() * nouns.length)]}`;

            const newPuzzle: PuzzleConfig = {
                id: `discovery-${Date.now()}`,
                title: randomTitle,
                src: `https://picsum.photos/id/${newId}/800/800`,
                difficulty: 'normal',
                category: 'Discovery'
            };

            // Add new puzzle to the front of discoveries (newest first)
            storedDiscoveries = [newPuzzle, ...storedDiscoveries];
            localStorage.setItem('mosaic_discoveries', JSON.stringify(storedDiscoveries));
        }

        setGalleryPuzzles([...INITIAL_PUZZLES, ...storedDiscoveries]);
    }
  }, []);

  // Update saved games when view changes (e.g. coming back from a game)
  useEffect(() => {
    if (currentView !== 'game') {
        checkForSavedGames();
    }
  }, [currentView]);

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
    // Push history state so Android Back button works
    window.history.pushState({ view: 'game' }, '');
    setSelectedPuzzle(puzzle);
    setCurrentView('game');
  };

  const navigateToView = (view: AppView) => {
    // Push history state so Android Back button works
    window.history.pushState({ view }, '');
    setCurrentView(view);
  };

  const handleBack = () => {
    // Trigger popstate, which handles the view change logic
    window.history.back();
  };
  
  const handlePuzzleComplete = () => {
     if (selectedPuzzle) {
        // 1. Remove in-progress save
        localStorage.removeItem(`mosaic_save_${selectedPuzzle.id}`);
        
        // 2. Mark as completed (persist to localStorage)
        const newCompleted = new Set(completedPuzzleIds);
        newCompleted.add(selectedPuzzle.id);
        setCompletedPuzzleIds(newCompleted);
        localStorage.setItem('mosaic_completed_ids', JSON.stringify(Array.from(newCompleted)));
     }
     
     checkForSavedGames();

     if (selectedPuzzle && selectedPuzzle.isDaily) {
         const today = new Date().toDateString();
         const lastWin = localStorage.getItem('mosaic_last_win');
         
         if (lastWin !== today) {
             const yesterday = new Date(Date.now() - 86400000).toDateString();
             const currentStored = parseInt(localStorage.getItem('mosaic_streak') || '0');
             
             let newStreak = 1;
             if (lastWin === yesterday) {
                 newStreak = currentStored + 1;
             }
             
             setStreak(newStreak);
             localStorage.setItem('mosaic_streak', newStreak.toString());
             localStorage.setItem('mosaic_last_win', today);
         }
     }
  };

  const renderHowToPlay = () => (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 animate-in fade-in duration-200" onClick={() => setShowHowToPlay(false)}>
      <div className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto custom-scrollbar relative animate-in zoom-in-95 duration-200" onClick={(e) => e.stopPropagation()}>
         {/* Close button */}
         <button onClick={() => setShowHowToPlay(false)} className="absolute top-4 right-4 p-3 hover:bg-slate-100 rounded-full text-slate-500 transition-colors">
           <X size={28} />
         </button>
         
         <div className="p-8 md:p-10">
           <div className="flex items-center gap-3 mb-8">
              <div className="bg-indigo-100 p-3 rounded-xl text-indigo-600">
                  <HelpCircle size={32} />
              </div>
              <h2 className="text-3xl font-serif text-slate-800">How to Play</h2>
           </div>
  
           <div className="space-y-8">
              <section>
                  <h3 className="text-lg font-bold text-slate-800 mb-3 flex items-center gap-2">
                      <MousePointer2 size={20} className="text-indigo-500"/> The Basics
                  </h3>
                  <p className="text-slate-600 leading-relaxed text-lg">
                      Drag and drop pieces to reconstruct the image. When a piece is close to its correct position (and rotation), it will <strong className="text-indigo-600">snap</strong> and lock into place.
                  </p>
              </section>
  
              <section className="grid md:grid-cols-2 gap-6">
                  <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100">
                       <h3 className="font-bold text-slate-800 mb-3 flex items-center gap-2">
                          <RotateCw size={18} className="text-orange-500"/> Rotation
                       </h3>
                       <p className="text-slate-600">
                          In <strong>Hard</strong> and <strong>Expert</strong> difficulties, pieces may need to be rotated.
                          <br/><br/>
                          Simply <strong>Tap</strong> a piece quickly to rotate it 90 degrees.
                       </p>
                  </div>
              </section>
  
              <section>
                   <h3 className="text-lg font-bold text-slate-800 mb-4">Tools & Features</h3>
                   <ul className="space-y-4">
                      <li className="flex items-start gap-4">
                          <div className="bg-indigo-50 p-2.5 rounded-xl text-indigo-600 mt-0.5"><Eye size={20} /></div>
                          <div>
                              <span className="font-bold text-slate-800 block">Preview</span>
                              <span className="text-slate-500">Hold the eye button to peek at the completed image.</span>
                          </div>
                      </li>
                      <li className="flex items-start gap-4">
                          <div className="bg-amber-50 p-2.5 rounded-xl text-amber-600 mt-0.5"><Lightbulb size={20} /></div>
                          <div>
                              <span className="font-bold text-slate-800 block">Hint</span>
                              <span className="text-slate-500">Highlights a random loose piece and shows you exactly where it belongs.</span>
                          </div>
                      </li>
                   </ul>
              </section>
           </div>
           
           <div className="mt-10 pt-6 border-t border-slate-100 flex justify-end">
              <button onClick={() => setShowHowToPlay(false)} className="px-8 py-4 bg-slate-900 text-white rounded-xl font-medium hover:bg-slate-800 transition-colors shadow-lg shadow-slate-900/10 text-lg">
                  Got it, let's play!
              </button>
           </div>
         </div>
      </div>
    </div>
  );

  const renderHome = () => {
    const isDailyCompleted = completedPuzzleIds.has(INITIAL_PUZZLES[0].id);

    return (
    <div className="flex flex-col h-screen w-full max-w-5xl mx-auto p-6 lg:p-12 relative overflow-y-auto custom-scrollbar">
      {/* Background Decorative Elements */}
      <div className="fixed top-0 left-0 w-full h-full overflow-hidden -z-10 pointer-events-none">
          <div className="absolute top-[-10%] right-[-5%] w-[500px] h-[500px] rounded-full bg-indigo-100/50 blur-3xl"></div>
          <div className="absolute bottom-[-10%] left-[-10%] w-[600px] h-[600px] rounded-full bg-rose-50/50 blur-3xl"></div>
      </div>

      <button 
        onClick={() => setShowHowToPlay(true)}
        className="absolute top-6 right-6 lg:top-10 lg:right-10 p-4 bg-white/80 backdrop-blur-sm hover:bg-white text-slate-600 rounded-full shadow-sm border border-slate-200 transition-all z-10 group active:scale-95"
        title="How to Play"
      >
        <HelpCircle size={28} className="group-hover:text-indigo-600 transition-colors" />
      </button>

      <header className="mb-12 text-center space-y-3 pt-8 flex-shrink-0">
        <h1 className="text-6xl md:text-7xl font-medium tracking-tight text-slate-900 drop-shadow-sm">Mosaic</h1>
        <p className="text-slate-500 text-lg md:text-xl font-light tracking-wide">Find your peace, piece by piece.</p>
      </header>

      {/* Daily Challenge Banner */}
      <div className="mb-12 flex-shrink-0">
        <div 
            className="group relative overflow-hidden rounded-[2rem] cursor-pointer shadow-xl shadow-orange-900/10 transition-all duration-500 hover:shadow-2xl hover:shadow-orange-900/20 active:scale-[0.99]"
            onClick={() => startPuzzle({ ...INITIAL_PUZZLES[0], difficulty: 'normal', isDaily: true })}
        >
            <div className="absolute inset-0 bg-gradient-to-br from-amber-500 to-orange-600 transition-transform duration-700 group-hover:scale-105"></div>
            <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10"></div>
            
            <div className="relative p-8 md:p-12 flex flex-col md:flex-row items-center justify-between gap-6">
                <div className="text-center md:text-left text-white">
                    <div className="flex items-center justify-center md:justify-start gap-2 mb-3">
                        <div className="bg-white/20 backdrop-blur-sm p-1.5 rounded-lg">
                            <Clock size={18} className="text-white" />
                        </div>
                        <span className="text-sm font-bold uppercase tracking-widest text-orange-50">Daily Challenge</span>
                    </div>
                    <h3 className="text-3xl md:text-4xl font-serif italic mb-2">Golden Hour in Kyoto</h3>
                    <p className="text-orange-100 font-light max-w-md text-lg">Complete today's puzzle to keep your mindfulness streak alive.</p>
                </div>

                <div className="flex items-center gap-6">
                    {streak > 0 && (
                        <div className="flex flex-col items-center bg-white/10 backdrop-blur-md rounded-2xl p-4 min-w-[90px] border border-white/10">
                            <div className="flex items-center gap-1 text-white font-bold text-3xl">
                                <Flame size={28} className="fill-orange-300 text-orange-300 animate-pulse" />
                                <span>{streak}</span>
                            </div>
                            <span className="text-xs text-orange-100 uppercase tracking-wide font-medium">Streak</span>
                        </div>
                    )}
                    <button className={`px-10 py-4 rounded-full font-bold text-lg shadow-lg transition-colors flex items-center gap-3 active:scale-95 ${isDailyCompleted ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-200' : 'bg-white text-orange-600 hover:bg-orange-50'}`}>
                        {isDailyCompleted ? (
                             <><Check size={24} /> Completed</>
                        ) : (
                             <><Play size={20} className="fill-current" /> Play Now</>
                        )}
                    </button>
                </div>
            </div>
        </div>
      </div>

      {/* Main Mode Selection */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pb-10 flex-shrink-0">
        {/* Gallery Card */}
        <div className="group bg-white p-8 md:p-10 rounded-[2.5rem] shadow-sm border border-slate-100 transition-all duration-300 hover:shadow-xl hover:-translate-y-1 hover:border-indigo-100 cursor-pointer relative overflow-hidden active:scale-[0.99]"
             onClick={() => navigateToView('gallery')}>
          <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity transform group-hover:scale-110 duration-700">
              <ImageIcon size={140} />
          </div>
          
          <div className="h-16 w-16 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center mb-6 shadow-inner group-hover:bg-indigo-600 group-hover:text-white transition-colors duration-300">
            <ImageIcon size={32} />
          </div>
          <h2 className="text-3xl font-medium text-slate-800 mb-3">Classic Gallery</h2>
          <p className="text-slate-500 leading-relaxed mb-8 text-lg">Browse our curated collection of high-resolution photography and art.</p>
          <div className="flex items-center text-indigo-600 font-bold text-lg group-hover:translate-x-2 transition-transform">
              Explore Collection <ChevronRight size={20} />
          </div>
        </div>

        {/* AI Studio Card */}
        <div className="group bg-white p-8 md:p-10 rounded-[2.5rem] shadow-sm border border-slate-100 transition-all duration-300 hover:shadow-xl hover:-translate-y-1 hover:border-emerald-100 cursor-pointer relative overflow-hidden active:scale-[0.99]"
             onClick={() => navigateToView('create')}>
          <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity transform group-hover:scale-110 duration-700">
              <Sparkles size={140} />
          </div>

          <div className="h-16 w-16 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center mb-6 shadow-inner group-hover:bg-emerald-600 group-hover:text-white transition-colors duration-300">
            <Wand2 size={32} />
          </div>
          <h2 className="text-3xl font-medium text-slate-800 mb-3">AI Studio</h2>
          <p className="text-slate-500 leading-relaxed mb-8 text-lg">Turn your imagination into a playable puzzle with the power of Gemini.</p>
          <div className="flex items-center text-emerald-600 font-bold text-lg group-hover:translate-x-2 transition-transform">
              Create New <ChevronRight size={20} />
          </div>
        </div>
      </div>
    </div>
  );
  };

  const renderGallery = () => {
    // Filter categories
    const categories = ['Nature', 'Urban', 'Spring', 'Summer', 'Autumn', 'Winter', 'Indoor', 'Discovery'];
    
    // Ensure galleryPuzzles is an array before filtering
    const safePuzzles = Array.isArray(galleryPuzzles) ? galleryPuzzles : [];
    
    const filteredPuzzles = safePuzzles.filter(p => {
        if (!p) return false;
        if (activeCategory === 'All') return true;
        if (activeCategory === 'Discovery') return p.id && p.id.startsWith('discovery-');
        return p.category === activeCategory;
    });

    return (
    <div className="h-screen flex flex-col p-6 lg:p-10 max-w-7xl mx-auto w-full relative">
      <div className="fixed top-0 left-0 w-full h-full bg-slate-50 -z-10"></div>
      
      <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-6 flex-shrink-0">
        <div className="flex items-center gap-4">
            <button onClick={handleBack} className="p-4 bg-white hover:bg-slate-100 rounded-full shadow-sm border border-slate-100 transition-colors group active:scale-95">
            <ArrowLeft size={28} className="text-slate-600 group-hover:text-slate-900" />
            </button>
            <div>
                <h2 className="text-3xl text-slate-800">Puzzle Gallery</h2>
                <p className="text-slate-500 text-sm">Select a masterpiece to begin</p>
            </div>
        </div>

        {/* Category Filters - Larger touch targets */}
        <div className="flex items-center gap-3 overflow-x-auto pb-4 md:pb-0 custom-scrollbar max-w-full">
            {categories.map(cat => (
                <button 
                    key={cat}
                    onClick={() => setActiveCategory(cat)}
                    className={`px-6 py-3 rounded-full text-base font-medium transition-all whitespace-nowrap active:scale-95 ${
                        activeCategory === cat 
                        ? 'bg-slate-800 text-white shadow-md' 
                        : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                    }`}
                >
                    {cat}
                </button>
            ))}
        </div>
      </div>

      {filteredPuzzles.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-slate-400">
            <ImageIcon size={48} className="opacity-20 mb-4" />
            <p>No puzzles found in this category.</p>
        </div>
      ) : (
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 overflow-y-auto custom-scrollbar pb-20 flex-1 min-h-0 pr-2">
        {filteredPuzzles.map((puzzle, index) => {
          if (!puzzle) return null;
          const hasSave = savedGameIds.has(puzzle.id);
          const isCompleted = completedPuzzleIds.has(puzzle.id);
          
          return (
          <div key={puzzle.id} 
               onClick={() => startPuzzle(puzzle)}
               style={{ animationDelay: `${index * 50}ms` }}
               className="group bg-white rounded-3xl shadow-sm hover:shadow-xl transition-all duration-300 hover:-translate-y-1 overflow-hidden border border-slate-100 flex flex-col cursor-pointer active:scale-[0.98]">
            <div className="relative aspect-square overflow-hidden bg-slate-100">
                <img src={puzzle.src} alt={puzzle.title} className="w-full h-full object-cover" />
                
                {isCompleted ? (
                    <div className="absolute inset-0 bg-emerald-900/20 flex items-center justify-center">
                         <div className="bg-emerald-500 text-white p-3 rounded-full shadow-lg animate-in zoom-in duration-300">
                             <Check size={24} strokeWidth={3} />
                         </div>
                    </div>
                ) : (
                    <div className="absolute inset-0 bg-black/10 flex items-center justify-center">
                        <div className="bg-white/90 p-4 rounded-full shadow-lg">
                            <Play size={24} className="fill-indigo-600 text-indigo-600 ml-1" />
                        </div>
                    </div>
                )}
            </div>
            
            <div className="p-5 flex flex-col gap-2">
                <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-400">{puzzle.category || 'Classic'}</span>
                    {puzzle.difficulty && (
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md uppercase tracking-wide border ${
                            puzzle.difficulty === 'easy' ? 'text-emerald-600 border-emerald-100 bg-emerald-50' :
                            puzzle.difficulty === 'normal' ? 'text-blue-600 border-blue-100 bg-blue-50' :
                            puzzle.difficulty === 'hard' ? 'text-orange-600 border-orange-100 bg-orange-50' :
                            'text-rose-600 border-rose-100 bg-rose-50'
                        }`}>
                            {puzzle.difficulty}
                        </span>
                    )}
                </div>
                <h3 className="font-serif text-lg text-slate-800 leading-tight truncate" title={puzzle.title}>{puzzle.title}</h3>
                
                <div className="flex flex-wrap gap-2 mt-1">
                    {hasSave && (
                       <div className="flex items-center gap-1.5 text-xs font-medium text-amber-600 bg-amber-50 px-2.5 py-1 rounded-md w-fit border border-amber-100">
                          <History size={12} /> Resume
                       </div>
                    )}
                    {isCompleted && (
                       <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-md w-fit border border-emerald-100 uppercase tracking-wide">
                          <Check size={12} strokeWidth={3} /> Solved
                       </div>
                    )}
                </div>
            </div>
          </div>
        )})}
      </div>
      )}
    </div>
  );
  };

  const renderCreate = () => (
    <div className="h-screen flex flex-col p-6 lg:p-10 max-w-6xl mx-auto w-full overflow-y-auto custom-scrollbar">
      <div className="flex items-center gap-4 mb-8 flex-shrink-0">
        <button onClick={handleBack} className="p-4 bg-white hover:bg-slate-100 rounded-full shadow-sm border border-slate-100 transition-colors group active:scale-95">
          <ArrowLeft size={28} className="text-slate-600 group-hover:text-slate-900" />
        </button>
        <div>
            <h2 className="text-3xl text-slate-800">AI Puzzle Studio</h2>
            <p className="text-slate-500 text-sm">Powered by Gemini</p>
        </div>
      </div>

      <div className="bg-white p-8 lg:p-12 rounded-[2rem] shadow-lg border border-indigo-50/50 mb-12 relative overflow-hidden flex-shrink-0">
        <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-50 rounded-full blur-3xl -mr-16 -mt-16 pointer-events-none"></div>
        
        <label className="block text-xl font-serif italic text-slate-700 mb-6 relative z-10">What kind of puzzle should we dream up?</label>
        <div className="flex flex-col md:flex-row gap-4 relative z-10">
          <input 
            type="text" 
            value={promptInput}
            onChange={(e) => setPromptInput(e.target.value)}
            placeholder="E.g., A cozy library with flying books..."
            className="flex-1 px-6 py-5 rounded-2xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-slate-50 text-slate-800 shadow-inner text-xl placeholder:text-slate-400"
            onKeyDown={(e) => e.key === 'Enter' && handleGeneratePuzzle()}
          />
          <button 
            onClick={handleGeneratePuzzle}
            disabled={isGenerating || !promptInput}
            className={`px-10 py-5 rounded-2xl font-bold text-white text-lg flex items-center justify-center gap-3 transition-all min-w-[180px] active:scale-95 ${
              isGenerating 
                ? 'bg-indigo-300 cursor-wait' 
                : 'bg-indigo-600 hover:bg-indigo-700 shadow-lg hover:shadow-indigo-500/30'
            }`}
          >
            {isGenerating ? (
              <>
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                <span>Dreaming...</span>
              </>
            ) : (
              <><Sparkles size={24} /> Generate</>
            )}
          </button>
        </div>
      </div>

      <div className="flex items-center gap-3 mb-6 flex-shrink-0">
        <Sparkles size={24} className="text-indigo-500" />
        <h3 className="text-2xl font-medium text-slate-800">Your Creations</h3>
      </div>
      
      {generatedImages.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-slate-400 border-2 border-dashed border-slate-200 rounded-[2rem] p-12 bg-slate-50/50 min-h-[300px]">
          <div className="w-24 h-24 bg-slate-100 rounded-full flex items-center justify-center mb-6">
             <ImageIcon size={40} className="opacity-40" />
          </div>
          <p className="text-xl">No generated puzzles yet.</p>
          <p className="text-base opacity-70 mt-2">Enter a prompt above to get started.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 overflow-y-auto custom-scrollbar pb-10 flex-shrink-0">
          {generatedImages.map((img, index) => {
            const hasSave = savedGameIds.has(img.id);
            const isCompleted = completedPuzzleIds.has(img.id);
            return (
            <div key={img.id} 
                 onClick={() => startPuzzle({ id: img.id, src: img.src, title: img.title, difficulty: 'normal' })}
                 className="group bg-white rounded-3xl shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 overflow-hidden flex flex-col cursor-pointer border border-slate-100 active:scale-[0.98]"
                 style={{ animationDelay: `${index * 100}ms` }}>
              <div className="relative aspect-square overflow-hidden bg-slate-100">
                 <img src={img.src} alt={img.title} className="w-full h-full object-cover" />
                 
                 {isCompleted ? (
                    <div className="absolute inset-0 bg-emerald-900/20 flex items-center justify-center">
                         <div className="bg-emerald-500 text-white p-3 rounded-full shadow-lg">
                             <Check size={20} strokeWidth={3} />
                         </div>
                    </div>
                ) : (
                     <div className="absolute inset-0 bg-black/10 flex items-center justify-center">
                        <div className="bg-white/90 p-3 rounded-full shadow-lg">
                            <Play size={20} className="fill-indigo-600 text-indigo-600 ml-0.5" />
                        </div>
                    </div>
                )}
              </div>
              
              <div className="p-4 flex flex-col gap-1">
                 <div className="flex items-center gap-1.5 text-xs text-indigo-500 font-medium">
                    <Sparkles size={12} /> AI Generated
                 </div>
                 <span className="font-serif text-slate-800 truncate leading-tight text-lg">{img.title}</span>
                 
                 <div className="flex flex-wrap gap-2 mt-1">
                    {hasSave && (
                       <div className="flex items-center gap-1 text-[10px] font-medium text-amber-600 bg-amber-50 px-2 py-0.5 rounded-md w-fit border border-amber-100">
                          <History size={10} /> Resume
                       </div>
                    )}
                    {isCompleted && (
                       <div className="flex items-center gap-1 text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md w-fit border border-emerald-100 uppercase tracking-wide">
                          <Check size={10} strokeWidth={3} /> Solved
                       </div>
                    )}
                 </div>
              </div>
            </div>
          )})}
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
          onComplete={handlePuzzleComplete}
        />
      )}
      {showHowToPlay && renderHowToPlay()}
    </div>
  );
};

export default App;