import React, { useState, useEffect, useRef } from 'react';
import { Home, Puzzle, Settings, Image as ImageIcon, Sparkles, Clock, ArrowLeft, RotateCcw, Flame, Play, ChevronRight, Wand2, History, Layers, HelpCircle, X, MousePointer2, RotateCw, Shapes, Eye, Lightbulb, Zap, Check, CloudDownload, WifiOff, Wifi, Activity, AlertTriangle, Upload, Plus, Trash2 } from 'lucide-react';
import GameBoard from './components/GameBoard';
import { generateImage } from './services/geminiService';
import { syncPuzzleImage, getFullQualityImage, saveGeneratedPuzzle, loadSavedGeneratedPuzzles, persistGeneratedMetadata, saveUserUploadedPuzzle, loadUserUploadedPuzzles, deleteUserUploadedPuzzle, deleteGeneratedPuzzle, checkImagesExistInDB, reconcileDatabase } from './services/offlineStorage';
import { loadUserStats, formatTime } from './services/statsService';
import { GameState, Difficulty, PuzzleConfig, AppView, GeneratedImage, UserStats } from './types';
import { INITIAL_PUZZLES } from './constants';

const INITIAL_CATEGORIES = ['Classic Cars', 'Animals', 'Cats', 'Disney Characters', 'Historical Buildings', 'People', 'Abstract', 'Nature', 'Urban', 'Spring', 'Summer', 'Autumn', 'Winter', 'Indoor', 'Fine Art & Masterpieces', 'Icons & Logos', 'Movies & TV Shows', 'Album Covers', 'Abstract & Colour Gradients'];

const DIFFICULTY_RANK: Record<string, number> = {
  'easy': 1,
  'normal': 2,
  'hard': 3,
  'expert': 4
};

const App: React.FC = () => {
  const [categories, setCategories] = useState<string[]>(INITIAL_CATEGORIES);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');

  const [currentView, setCurrentView] = useState<AppView>('home');
  const [selectedPuzzle, setSelectedPuzzle] = useState<PuzzleConfig | null>(null);
  const [generatedImages, setGeneratedImages] = useState<GeneratedImage[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [promptInput, setPromptInput] = useState('');
  const [savedGameIds, setSavedGameIds] = useState<Set<string>>(new Set());
  const [completedPuzzleIds, setCompletedPuzzleIds] = useState<Set<string>>(new Set());
  const [showHowToPlay, setShowHowToPlay] = useState(false);
  
  // Upload State
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadPreview, setUploadPreview] = useState<string | null>(null);
  const [uploadCategory, setUploadCategory] = useState(INITIAL_CATEGORIES[0]);
  const [uploadTitle, setUploadTitle] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  
  // Error State for graceful failure handling
  const [error, setError] = useState<{title: string, message: string} | null>(null);
  
  // Gallery State
  const [galleryPuzzles, setGalleryPuzzles] = useState<PuzzleConfig[]>(INITIAL_PUZZLES);
  const [activeCategory, setActiveCategory] = useState<string>('Classic Cars');
  const [thumbnails, setThumbnails] = useState<Record<string, string>>({});
  const [syncProgress, setSyncProgress] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const [hiddenPuzzleIds, setHiddenPuzzleIds] = useState<Set<string>>(new Set());
  const [isOfflineMode, setIsOfflineMode] = useState(false);
  const [userStats, setUserStats] = useState<UserStats>({ totalPoints: 0, bestTimes: { easy: null, normal: null, hard: null, expert: null } });
  
  const initializationRef = useRef(false);

  // Load User Stats
  useEffect(() => {
      setUserStats(loadUserStats());
      
      // Load custom categories
      const savedCategories = localStorage.getItem('mosaic_custom_categories');
      if (savedCategories) {
          try {
              const parsed = JSON.parse(savedCategories);
              setCategories([...INITIAL_CATEGORIES, ...parsed]);
          } catch (e) {
              console.error("Failed to load categories", e);
          }
      }
  }, []);

  // Load Offline Mode Preference
  useEffect(() => {
      const savedOffline = localStorage.getItem('mosaic_offline_mode');
      if (savedOffline) {
          setIsOfflineMode(JSON.parse(savedOffline));
      }
  }, []);

  // Save Offline Mode Preference
  useEffect(() => {
      localStorage.setItem('mosaic_offline_mode', JSON.stringify(isOfflineMode));
  }, [isOfflineMode]);

  // Daily Streak & Puzzle State
  const [streak, setStreak] = useState(0);
  const [dailyPuzzle, setDailyPuzzle] = useState<PuzzleConfig | null>(null);

  // Check for saved games (Safely)
  const checkForSavedGames = () => {
      try {
          const saves = new Set<string>();
          for (let i = 0; i < localStorage.length; i++) {
              const key = localStorage.key(i);
              if (key && key.startsWith('mosaic_save_')) {
                  const puzzleId = key.replace('mosaic_save_', '');
                  saves.add(puzzleId);
              }
          }
          setSavedGameIds(saves);
      } catch (e) {
          console.warn("LocalStorage access denied or failed", e);
      }
  };

  // Load Generated Images from IndexedDB (Migration handled in service)
  useEffect(() => {
    reconcileDatabase().then(() => {
        loadSavedGeneratedPuzzles().then(puzzles => {
            setGeneratedImages(puzzles);
        });
    });
  }, []);

  // Persist Metadata only (no base64) when state changes
  useEffect(() => {
    if (generatedImages.length > 0) {
        persistGeneratedMetadata(generatedImages);
    }
  }, [generatedImages]);

  // Initial History Setup
  useEffect(() => {
      window.history.replaceState({ view: 'home' }, '');
  }, []);

  // Android Back Button Handling (History API)
  useEffect(() => {
    const handlePopState = (event: PopStateEvent) => {
        // Use history state to determine view, fallback to home
        const nextView = event.state?.view || 'home';
        setCurrentView(nextView);
        setSelectedPuzzle(null);
        checkForSavedGames();
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Background Scraper / Sync
  useEffect(() => {
      let isCancelled = false;
      
      const runSync = async () => {
          setIsSyncing(true);
          const allPuzzles = [...galleryPuzzles];
          
          // 1. Identify puzzles that need syncing (no thumbnail yet)
          const puzzlesToSync = allPuzzles.filter(p => !thumbnails[p.id]);
          
          if (puzzlesToSync.length === 0) {
              setIsSyncing(false);
              return;
          }

          // 2. Check DB in batch for existing images to avoid unnecessary network calls
          const idsToCheck = puzzlesToSync.map(p => p.id);
          let existingInDB = new Set<string>();
          try {
              existingInDB = await checkImagesExistInDB(idsToCheck);
          } catch (e) {
              console.warn("Batch DB check failed", e);
          }
          
          // Process in chunks to avoid blocking UI
          const CHUNK_SIZE = 5;
          let completed = 0;

          for (let i = 0; i < puzzlesToSync.length; i += CHUNK_SIZE) {
              if (isCancelled) break;
              
              const chunk = puzzlesToSync.slice(i, i + CHUNK_SIZE);
              
              await Promise.all(chunk.map(async (p) => {
                   if (isCancelled) return;
                   
                   // Don't sync user uploads or discoveries that already have local blob URLs
                   if (p.isUserUpload || (p.src && p.src.startsWith('blob:'))) {
                       setThumbnails(prev => ({ ...prev, [p.id]: p.src }));
                       return;
                   }

                   // Optimization: If we know it's in DB from batch check, we can skip the individual DB check inside syncPuzzleImage
                   // However, syncPuzzleImage handles retrieving the blob, so we still call it, but it will be fast.
                   // The main win here is avoiding the network fetch if we know it's local.
                   
                   const result = await syncPuzzleImage(p);
                   if (!isCancelled && result.isLocal) {
                       setThumbnails(prev => ({ ...prev, [p.id]: result.thumbUrl }));
                   }
              }));
              
              completed += chunk.length;
              if (!isCancelled) {
                setSyncProgress(Math.min(100, Math.round((completed / puzzlesToSync.length) * 100)));
              }
              
              // Small delay to yield to main thread
              await new Promise(r => setTimeout(r, 50));
          }
          if (!isCancelled) setIsSyncing(false);
      };
      
      // Run sync when gallery changes (e.g. discovery added) or on mount
      // Delay slightly to let app mount first
      const timeout = setTimeout(runSync, 1000);
      
      return () => {
          isCancelled = true;
          clearTimeout(timeout);
      };
  }, [galleryPuzzles]); // Changed dependency to full array to catch updates properly

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
    try {
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
    } catch(e) {}

    // 1.5 Generate Dynamic Daily Puzzle
    const today = new Date().toDateString();
    const dateSeed = today.replace(/ /g, '-');
    setDailyPuzzle({
        id: `daily-${dateSeed}`,
        title: `Daily Challenge: ${new Date().toLocaleDateString(undefined, { month: 'long', day: 'numeric' })}`,
        src: `https://picsum.photos/seed/${dateSeed}/800/800`,
        difficulty: 'normal',
        category: 'Daily',
        isDaily: true
    });

    const initPuzzles = async () => {
         // Load Hidden Puzzles
         let hidden = new Set<string>();
         try {
             const hiddenStr = localStorage.getItem('mosaic_hidden_ids');
             if (hiddenStr) {
                 hidden = new Set(JSON.parse(hiddenStr));
                 setHiddenPuzzleIds(hidden);
             }
         } catch(e) { console.error(e); }

         let storedDiscoveries: PuzzleConfig[] = [];
         
         // Load Discoveries
         try {
            const storedDiscoveriesStr = localStorage.getItem('mosaic_discoveries');
            if (storedDiscoveriesStr) {
                const parsed = JSON.parse(storedDiscoveriesStr);
                if (Array.isArray(parsed)) storedDiscoveries = parsed;
            }
         } catch (e) {
             localStorage.removeItem('mosaic_discoveries');
         }

         // Generate New Discovery if needed
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

        let newId = -1;
        let attempts = 0;
        while (attempts < 50) {
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

            storedDiscoveries = [newPuzzle, ...storedDiscoveries];
            try {
                localStorage.setItem('mosaic_discoveries', JSON.stringify(storedDiscoveries));
            } catch(e) {}
        }

        // Load User Uploads
        const userUploads = await loadUserUploadedPuzzles();

        let allPuzzles = [...INITIAL_PUZZLES, ...storedDiscoveries, ...userUploads];
        
        // Randomize difficulty for unsolved puzzles
        const difficulties: Difficulty[] = ['easy', 'normal', 'hard', 'expert'];
        // We need to use the locally loaded completed set because state update is async
        let currentCompleted = new Set<string>();
        try {
            const savedCompleted = localStorage.getItem('mosaic_completed_ids');
            if (savedCompleted) {
                currentCompleted = new Set(JSON.parse(savedCompleted));
            }
        } catch (e) {}

        allPuzzles = allPuzzles.map(p => {
            if (!currentCompleted.has(p.id)) {
                const randomDiff = difficulties[Math.floor(Math.random() * difficulties.length)];
                return { ...p, difficulty: randomDiff };
            }
            return p;
        });

        // Filter out hidden puzzles
        setGalleryPuzzles(allPuzzles.filter(p => !hidden.has(p.id)));
    };

    if (!initializationRef.current) {
        initializationRef.current = true;
        initPuzzles();
    }
  }, []);

  // Update saved games when view changes
  useEffect(() => {
    if (currentView !== 'game') {
        checkForSavedGames();
    }
  }, [currentView]);

  const handleGeneratePuzzle = async () => {
    if (!promptInput.trim()) return;
    setIsGenerating(true);
    setError(null);
    try {
      const base64Image = await generateImage(promptInput);
      if (base64Image) {
        const newId = `gen-${Date.now()}`;
        
        const metadata = {
            id: newId,
            src: '', // Placeholder
            title: promptInput,
            isAi: true
        };

        // Save to IndexedDB and get Object URL
        const objectUrl = await saveGeneratedPuzzle(newId, base64Image, metadata);
        
        const newPuzzle: GeneratedImage = {
          ...metadata,
          src: objectUrl, // Use blob URL for display
        };
        
        setGeneratedImages(prev => [newPuzzle, ...prev]);
        setPromptInput('');
      } else {
        throw new Error("No image data received.");
      }
    } catch (error: any) {
      console.error("Failed to generate puzzle:", error);
      
      let title = "Generation Failed";
      let message = "Could not generate image. Please try again.";
      
      const errStr = error.toString().toLowerCase();
      const errMsg = error.message?.toLowerCase() || "";

      if (errStr.includes('429') || errMsg.includes('quota') || errMsg.includes('resource exhausted') || errStr.includes('too many requests')) {
          title = "Quota Exceeded";
          message = "You have reached the API usage limit. Please try again later.";
      } else if (errMsg.includes('api key')) {
          title = "Configuration Error";
          message = "API Key is missing or invalid.";
      }

      setError({ title, message });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleUploadFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
        const file = e.target.files[0];
        // Validate Size (5MB)
        if (file.size > 5 * 1024 * 1024) {
            alert("File is too large. Maximum size is 5MB.");
            return;
        }
        
        setUploadFile(file);
        setUploadTitle(file.name.split('.')[0]); // Default title
        
        // Create preview
        const reader = new FileReader();
        reader.onload = (ev) => {
            setUploadPreview(ev.target?.result as string);
        };
        reader.readAsDataURL(file);
    }
  };

  const handleUploadSubmit = async () => {
      if (!uploadFile || !uploadCategory) return;
      setIsUploading(true);
      try {
          const newPuzzle = await saveUserUploadedPuzzle(uploadFile, uploadTitle || 'Untitled', uploadCategory);
          setGalleryPuzzles(prev => [newPuzzle, ...prev]);
          
          // Reset and Close
          setShowUploadModal(false);
          setUploadFile(null);
          setUploadPreview(null);
          setUploadTitle('');
          setUploadCategory(categories[0]);
          setActiveCategory(uploadCategory); // Switch to the category we just uploaded to
      } catch (e) {
          console.error("Upload failed", e);
          setError({ title: "Upload Failed", message: "Could not save your image. Please try again." });
      } finally {
          setIsUploading(false);
      }
  };

  const handleDeletePuzzle = async (puzzle: PuzzleConfig) => {
      if (!window.confirm("Are you sure you want to delete this puzzle? This action cannot be undone.")) {
          return;
      }

      try {
          if (puzzle.isUserUpload) {
              await deleteUserUploadedPuzzle(puzzle.id);
          } else if (puzzle.id.startsWith('discovery-')) {
              // Handle discovery removal from storage
              const storedDiscoveriesStr = localStorage.getItem('mosaic_discoveries');
              if (storedDiscoveriesStr) {
                  let stored: PuzzleConfig[] = JSON.parse(storedDiscoveriesStr);
                  stored = stored.filter(p => p.id !== puzzle.id);
                  localStorage.setItem('mosaic_discoveries', JSON.stringify(stored));
              }
          } else {
              // Default puzzle - Hide via ID exclusion
              const newHidden = new Set(hiddenPuzzleIds);
              newHidden.add(puzzle.id);
              setHiddenPuzzleIds(newHidden);
              localStorage.setItem('mosaic_hidden_ids', JSON.stringify(Array.from(newHidden)));
          }

          // Update State
          setGalleryPuzzles(prev => prev.filter(p => p.id !== puzzle.id));
          
          // Cleanup thumbnails cache
          setThumbnails(prev => {
              const newThumbnails = { ...prev };
              delete newThumbnails[puzzle.id];
              return newThumbnails;
          });
      } catch (e) {
          console.error("Failed to delete puzzle", e);
          setError({ title: "Delete Failed", message: "Could not delete the puzzle. Please try again." });
      }
  };

  const handleDeleteGenerated = async (id: string) => {
      if (!window.confirm("Delete this AI generated puzzle?")) return;
      try {
          await deleteGeneratedPuzzle(id);
          setGeneratedImages(prev => prev.filter(img => img.id !== id));
      } catch (e) {
          console.error("Failed to delete generated puzzle", e);
      }
  };

  const startPuzzle = async (puzzle: PuzzleConfig) => {
    // Check if we have a high-res local version
    const localSrc = await getFullQualityImage(puzzle.id, puzzle.src);
    
    // Create a modified puzzle config with the local source
    const puzzleToStart = { ...puzzle, src: localSrc };

    window.history.pushState({ view: 'game' }, '');
    setSelectedPuzzle(puzzleToStart);
    setCurrentView('game');
  };

  const navigateToView = (view: AppView) => {
    window.history.pushState({ view }, '');
    setCurrentView(view);
  };

  const handleBack = () => {
    window.history.back();
  };
  
  const handleAddCategory = () => {
      const trimmed = newCategoryName.trim();
      if (!trimmed) return;
      
      if (categories.includes(trimmed)) {
          alert('Category already exists!');
          return;
      }
      
      const newCategories = [...categories, trimmed];
      setCategories(newCategories);
      
      // Save only custom categories to storage
      const customOnly = newCategories.filter(c => !INITIAL_CATEGORIES.includes(c));
      localStorage.setItem('mosaic_custom_categories', JSON.stringify(customOnly));
      
      setNewCategoryName('');
      setShowCategoryModal(false);
      setActiveCategory(trimmed);
  };

  const handlePuzzleComplete = () => {
     if (selectedPuzzle) {
        try {
            localStorage.removeItem(`mosaic_save_${selectedPuzzle.id}`);
            
            const newCompleted = new Set(completedPuzzleIds);
            newCompleted.add(selectedPuzzle.id);
            setCompletedPuzzleIds(newCompleted);
            localStorage.setItem('mosaic_completed_ids', JSON.stringify(Array.from(newCompleted)));
            
            // Reload stats
            setUserStats(loadUserStats());
        } catch(e) {}
     }
     
     checkForSavedGames();

     if (selectedPuzzle && selectedPuzzle.isDaily) {
         try {
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
         } catch(e) {}
     }
  };

  const renderHowToPlay = () => (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 animate-in fade-in duration-200" onClick={() => setShowHowToPlay(false)}>
      <div className="bg-white rounded-3xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto custom-scrollbar relative animate-in zoom-in-95 duration-200" onClick={(e) => e.stopPropagation()}>
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
                      Drag and drop pieces to reconstruct the image. When a piece is close to its correct position, it will <strong className="text-indigo-600">snap</strong> and lock into place.
                  </p>
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

  const renderUploadModal = () => (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 animate-in fade-in duration-200" onClick={() => setShowUploadModal(false)}>
        <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto relative animate-in zoom-in-95 duration-200" onClick={(e) => e.stopPropagation()}>
           <button onClick={() => setShowUploadModal(false)} className="absolute top-4 right-4 p-2 hover:bg-slate-100 rounded-full text-slate-500 transition-colors z-10">
             <X size={24} />
           </button>
           
           <div className="p-8">
               <div className="flex items-center gap-3 mb-6">
                   <div className="bg-indigo-50 p-3 rounded-xl text-indigo-600">
                       <Upload size={24} />
                   </div>
                   <h2 className="text-2xl font-serif text-slate-800">Upload to Gallery</h2>
               </div>

               <div className="space-y-6">
                   {/* File Input Area */}
                   <div className="relative">
                       <input 
                         type="file" 
                         accept="image/jpeg, image/png, image/webp"
                         onChange={handleUploadFileSelect}
                         className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                       />
                       <div className={`border-2 border-dashed rounded-2xl p-8 flex flex-col items-center justify-center text-center transition-colors ${uploadPreview ? 'border-indigo-200 bg-indigo-50/30' : 'border-slate-200 hover:border-indigo-400 hover:bg-slate-50'}`}>
                           {uploadPreview ? (
                               <div className="relative w-full aspect-square md:aspect-video rounded-lg overflow-hidden shadow-sm">
                                   <img src={uploadPreview} alt="Preview" className="w-full h-full object-cover" />
                               </div>
                           ) : (
                               <>
                                   <div className="w-12 h-12 bg-indigo-50 text-indigo-500 rounded-full flex items-center justify-center mb-3">
                                       <Plus size={24} />
                                   </div>
                                   <p className="font-medium text-slate-700">Click to choose an image</p>
                                   <p className="text-sm text-slate-400 mt-1">JPEG, PNG, WebP (Max 5MB)</p>
                               </>
                           )}
                       </div>
                   </div>

                   {/* Title Input */}
                   <div>
                       <label className="block text-sm font-bold text-slate-700 mb-2">Title</label>
                       <input 
                         type="text" 
                         value={uploadTitle}
                         onChange={(e) => setUploadTitle(e.target.value)}
                         placeholder="My Custom Puzzle"
                         className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-800 bg-slate-50"
                       />
                   </div>

                   {/* Category Dropdown */}
                   <div>
                       <label className="block text-sm font-bold text-slate-700 mb-2">Category</label>
                       <div className="relative">
                           <select 
                             value={uploadCategory}
                             onChange={(e) => setUploadCategory(e.target.value)}
                             className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-800 bg-slate-50 appearance-none cursor-pointer"
                           >
                               {CATEGORIES.map(cat => (
                                   <option key={cat} value={cat}>{cat}</option>
                               ))}
                           </select>
                           <ChevronRight className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 rotate-90 pointer-events-none" size={16} />
                       </div>
                   </div>
               </div>

               <div className="mt-8 pt-6 border-t border-slate-100 flex justify-end gap-3">
                   <button 
                     onClick={() => setShowUploadModal(false)}
                     className="px-6 py-3 text-slate-600 font-bold hover:bg-slate-50 rounded-xl transition-colors"
                   >
                       Cancel
                   </button>
                   <button 
                     onClick={handleUploadSubmit}
                     disabled={!uploadFile || isUploading}
                     className={`px-8 py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-200 flex items-center gap-2 ${isUploading ? 'opacity-70 cursor-wait' : ''}`}
                   >
                       {isUploading ? 'Saving...' : 'Add to Library'}
                   </button>
               </div>
           </div>
        </div>
      </div>
  );

  const renderHome = () => {
    const isDailyCompleted = dailyPuzzle && completedPuzzleIds.has(dailyPuzzle.id);
    const apiKeyExists = typeof process !== 'undefined' && !!process.env?.API_KEY;

    return (
    <div className="flex flex-col h-screen w-full max-w-5xl mx-auto p-6 lg:p-12 relative overflow-y-auto custom-scrollbar">
      <div className="fixed top-0 left-0 w-full h-full overflow-hidden -z-10 pointer-events-none">
          <div className="absolute top-[-10%] right-[-5%] w-[500px] h-[500px] rounded-full bg-indigo-100/50 blur-3xl"></div>
          <div className="absolute bottom-[-10%] left-[-10%] w-[600px] h-[600px] rounded-full bg-rose-50/50 blur-3xl"></div>
      </div>
      
      {/* API Dashboard Stats */}
      <div className="absolute top-6 left-6 flex flex-col gap-3 z-10 md:top-10 md:left-10">
          {/* Status Card */}
          <div className="flex items-center gap-3 px-4 py-3 bg-white/90 backdrop-blur-md rounded-2xl shadow-sm border border-slate-200/60 transition-all hover:scale-105 select-none">
              <div className="relative flex h-3 w-3">
                  {apiKeyExists && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>}
                  <span className={`relative inline-flex rounded-full h-3 w-3 ${apiKeyExists ? 'bg-emerald-500' : 'bg-rose-500'}`}></span>
              </div>
              <div className="flex flex-col">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider leading-none mb-0.5">API Status</span>
                  <span className={`text-xs font-bold leading-none ${apiKeyExists ? 'text-slate-700' : 'text-rose-500'}`}>
                      {apiKeyExists ? 'Connected' : 'No Key'}
                  </span>
              </div>
          </div>

          {/* Usage Card (Only if connected) */}
          {apiKeyExists && (
              <div className="flex items-center gap-3 px-4 py-3 bg-white/90 backdrop-blur-md rounded-2xl shadow-sm border border-slate-200/60 transition-all hover:scale-105 select-none delay-75 animate-in fade-in slide-in-from-left-2">
                  <div className="bg-indigo-50 text-indigo-500 p-1 rounded-md">
                      <Activity size={14} />
                  </div>
                  <div className="flex flex-col">
                      <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider leading-none mb-0.5">Usage</span>
                      <span className="text-xs font-bold text-slate-700 leading-none">
                          {generatedImages.length} Gen{generatedImages.length !== 1 ? 's' : ''}
                      </span>
                  </div>
              </div>
          )}
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

      {dailyPuzzle && (
      <div className="mb-12 flex-shrink-0">
        <div 
            className="group relative overflow-hidden rounded-[2rem] cursor-pointer shadow-xl shadow-orange-900/10 transition-all duration-500 hover:shadow-2xl hover:shadow-orange-900/20 active:scale-[0.99]"
            onClick={() => startPuzzle(dailyPuzzle)}
        >
            <div className="absolute inset-0 bg-gradient-to-br from-amber-500 to-orange-600 transition-transform duration-700 group-hover:scale-105"></div>
            <div className="absolute inset-0 opacity-20 bg-cover bg-center mix-blend-overlay" style={{ backgroundImage: `url(${dailyPuzzle.src})` }}></div>
            
            <div className="relative p-8 md:p-12 flex flex-col md:flex-row items-center justify-between gap-6">
                <div className="text-center md:text-left text-white">
                    <div className="flex items-center justify-center md:justify-start gap-2 mb-3">
                        <div className="bg-white/20 backdrop-blur-sm p-1.5 rounded-lg">
                            <Clock size={18} className="text-white" />
                        </div>
                        <span className="text-sm font-bold uppercase tracking-widest text-orange-50">Daily Challenge</span>
                    </div>
                    <h3 className="text-3xl md:text-4xl font-serif italic mb-2">{dailyPuzzle.title}</h3>
                    <p className="text-orange-100 font-light max-w-md text-lg">A new random puzzle every 24 hours.</p>
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
      )}

      {/* Stats Section */}
      <div className="mb-10 w-full">
          <div className="bg-white rounded-[2rem] p-6 md:p-8 shadow-sm border border-slate-100">
              <div className="flex items-center gap-3 mb-6">
                  <div className="bg-amber-100 p-2.5 rounded-xl text-amber-600">
                      <Activity size={24} />
                  </div>
                  <h2 className="text-2xl font-serif font-bold text-slate-800">Your Progress</h2>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
                  {/* Total Points */}
                  <div className="bg-slate-50 rounded-2xl p-5 border border-slate-100 flex flex-col justify-center items-center text-center lg:col-span-1">
                      <span className="text-slate-500 text-xs font-bold uppercase tracking-wider mb-1">Total Score</span>
                      <span className="text-3xl font-mono font-bold text-indigo-600">{userStats.totalPoints.toLocaleString()}</span>
                  </div>

                  {/* Best Times */}
                  <div className="lg:col-span-4 grid grid-cols-2 md:grid-cols-4 gap-4">
                      {(['easy', 'normal', 'hard', 'expert'] as Difficulty[]).map(diff => (
                          <div key={diff} className="bg-slate-50 rounded-2xl p-4 border border-slate-100 flex flex-col items-center">
                              <span className="text-slate-400 text-[10px] font-bold uppercase tracking-widest mb-2">{diff}</span>
                              <span className={`font-mono font-bold text-lg ${userStats.bestTimes[diff] ? 'text-slate-700' : 'text-slate-300'}`}>
                                  {formatTime(userStats.bestTimes[diff]!)}
                              </span>
                          </div>
                      ))}
                  </div>
              </div>
          </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pb-10 flex-shrink-0">
        <div className="group bg-white p-8 md:p-10 rounded-[2.5rem] shadow-sm border border-slate-100 transition-all duration-300 hover:shadow-xl hover:-translate-y-1 hover:border-indigo-100 cursor-pointer relative overflow-hidden active:scale-[0.99]"
             onClick={() => navigateToView('gallery')}>
          <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity transform group-hover:scale-110 duration-700">
              <ImageIcon size={140} />
          </div>
          
          <div className="h-16 w-16 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center mb-6 shadow-inner group-hover:bg-indigo-600 group-hover:text-white transition-colors duration-300">
            <ImageIcon size={32} />
          </div>
          <h2 className="text-3xl font-medium text-slate-800 mb-3">Classic Gallery</h2>
          <p className="text-slate-500 leading-relaxed mb-8 text-lg">Browse collections including Classic Cars, Animals, and more.</p>
          <div className="flex items-center text-indigo-600 font-bold text-lg group-hover:translate-x-2 transition-transform">
              Explore Collection <ChevronRight size={20} />
          </div>
        </div>

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

  const renderGallery = () => (
    <div className="flex flex-col h-screen bg-slate-50">
      <header className="flex-shrink-0 px-6 py-4 bg-white/80 backdrop-blur-md border-b border-slate-200 flex items-center justify-between sticky top-0 z-20">
        <div className="flex items-center gap-4">
          <button onClick={() => navigateToView('home')} className="p-2 hover:bg-slate-100 rounded-full text-slate-500 transition-colors">
            <ArrowLeft size={24} />
          </button>
          <h2 className="text-xl font-serif font-bold text-slate-800">Gallery</h2>
        </div>
        <div className="flex items-center gap-3">
             <button
                onClick={() => setIsOfflineMode(!isOfflineMode)}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl font-bold transition-colors text-sm border ${isOfflineMode ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}
                title={isOfflineMode ? "Disable Offline Mode" : "Enable Offline Mode"}
             >
                 {isOfflineMode ? <WifiOff size={18} /> : <Wifi size={18} />}
                 <span className="hidden md:inline">{isOfflineMode ? 'Offline Mode' : 'Online'}</span>
             </button>
             <button 
                onClick={() => setShowUploadModal(true)}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-50 text-indigo-600 rounded-xl font-bold hover:bg-indigo-100 transition-colors text-sm"
             >
                 <Upload size={18} />
                 <span className="hidden md:inline">Upload</span>
             </button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Categories Sidebar */}
        <aside className="w-64 bg-white border-r border-slate-200 overflow-y-auto hidden md:block pb-safe-bottom custom-scrollbar">
           <div className="p-4 space-y-1">
               <button 
                 onClick={() => setActiveCategory('All')}
                 className={`w-full text-left px-4 py-3 rounded-xl font-medium transition-colors ${activeCategory === 'All' ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-50'}`}
               >
                   All Puzzles
               </button>
               {categories.map(cat => (
                   <button 
                     key={cat}
                     onClick={() => setActiveCategory(cat)}
                     className={`w-full text-left px-4 py-3 rounded-xl font-medium transition-colors ${activeCategory === cat ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-50'}`}
                   >
                       {cat}
                   </button>
               ))}
               
               <button 
                 onClick={() => setShowCategoryModal(true)}
                 className="w-full text-left px-4 py-3 rounded-xl font-medium text-indigo-600 hover:bg-indigo-50 flex items-center gap-2 mt-2 border border-dashed border-indigo-200"
               >
                   <Plus size={18} /> Add Category
               </button>
           </div>
        </aside>

        {/* Mobile Categories (Horizontal Scroll) */}
        <div className="md:hidden absolute top-[73px] left-0 right-0 bg-white border-b border-slate-100 z-10 overflow-x-auto whitespace-nowrap p-2 scrollbar-hide">
            <div className="flex gap-2 px-2">
                <button 
                    onClick={() => setActiveCategory('All')}
                    className={`px-4 py-2 rounded-full text-sm font-bold border transition-colors ${activeCategory === 'All' ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-600 border-slate-200'}`}
                >
                    All
                </button>
                {categories.map(cat => (
                    <button 
                        key={cat}
                        onClick={() => setActiveCategory(cat)}
                        className={`px-4 py-2 rounded-full text-sm font-bold border transition-colors ${activeCategory === cat ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-600 border-slate-200'}`}
                    >
                        {cat}
                    </button>
                ))}
                <button 
                    onClick={() => setShowCategoryModal(true)}
                    className="px-4 py-2 rounded-full text-sm font-bold border border-dashed border-indigo-300 text-indigo-600 bg-indigo-50 flex items-center gap-1"
                >
                    <Plus size={14} /> New
                </button>
            </div>
        </div>

        {/* Puzzle Grid */}
        <main className="flex-1 overflow-y-auto p-4 md:p-8 pt-16 md:pt-8 bg-slate-50 scroll-smooth custom-scrollbar">
             <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 md:gap-6 pb-32">
                 {galleryPuzzles
                    .filter(p => activeCategory === 'All' || p.category === activeCategory)
                    .filter(p => {
                        if (!isOfflineMode) return true;
                        // In offline mode, only show puzzles that have a local thumbnail/blob
                        return p.isUserUpload || (p.src && p.src.startsWith('blob:')) || !!thumbnails[p.id];
                    })
                    .sort((a, b) => {
                        const rankA = DIFFICULTY_RANK[a.difficulty || 'normal'] || 2;
                        const rankB = DIFFICULTY_RANK[b.difficulty || 'normal'] || 2;
                        return rankA - rankB;
                    })
                    .map(puzzle => {
                     const isCompleted = completedPuzzleIds.has(puzzle.id);
                     const displaySrc = thumbnails[puzzle.id] || puzzle.src;
                     const isAvailableLocally = puzzle.isUserUpload || (puzzle.src && puzzle.src.startsWith('blob:')) || !!thumbnails[puzzle.id];
                     
                     return (
                         <div 
                           key={puzzle.id} 
                           className={`group relative aspect-square bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden cursor-pointer hover:shadow-lg hover:-translate-y-1 transition-all duration-300 ${!isAvailableLocally && isOfflineMode ? 'opacity-50 grayscale' : ''}`}
                           onClick={() => startPuzzle(puzzle)}
                         >
                             <div className="absolute inset-0 bg-slate-100">
                                 <img 
                                    src={displaySrc} 
                                    alt={puzzle.title}
                                    className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                                    loading="lazy"
                                 />
                             </div>

                             <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                             
                             {isCompleted && (
                                 <div className="absolute top-2 right-2 bg-emerald-500 text-white p-1.5 rounded-full shadow-lg z-10">
                                     <Check size={12} strokeWidth={3} />
                                 </div>
                             )}

                             <button 
                                onClick={(e) => { e.stopPropagation(); handleDeletePuzzle(puzzle); }}
                                className="absolute top-2 left-2 bg-white/90 text-rose-500 p-2 rounded-full shadow-sm opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-all hover:bg-rose-50 z-10"
                                title="Delete"
                             >
                                 <Trash2 size={14} />
                             </button>

                             <div className="absolute bottom-0 left-0 right-0 p-4 transform translate-y-2 group-hover:translate-y-0 transition-transform">
                                 <h3 className="text-white font-bold text-sm truncate shadow-black drop-shadow-md">{puzzle.title}</h3>
                                 <div className="flex items-center justify-between mt-1">
                                     <span className="text-[10px] text-white/80 uppercase tracking-wider font-medium">{puzzle.difficulty || 'Normal'}</span>
                                     <div className="bg-white/20 backdrop-blur-sm rounded-full p-1.5">
                                         <Play size={12} className="text-white fill-current" />
                                     </div>
                                 </div>
                             </div>
                         </div>
                     );
                 })}
             </div>
        </main>
      </div>
    </div>
  );

  const renderCreate = () => (
    <div className="flex flex-col h-screen bg-slate-50">
      <header className="flex-shrink-0 px-6 py-4 bg-white/80 backdrop-blur-md border-b border-slate-200 flex items-center gap-4 sticky top-0 z-20">
          <button onClick={() => navigateToView('home')} className="p-2 hover:bg-slate-100 rounded-full text-slate-500 transition-colors">
            <ArrowLeft size={24} />
          </button>
          <h2 className="text-xl font-serif font-bold text-slate-800">AI Studio</h2>
      </header>
      
      <main className="flex-1 overflow-y-auto p-4 md:p-8 pb-32 custom-scrollbar">
         <div className="max-w-4xl mx-auto">
             
             <div className="bg-white rounded-3xl p-6 md:p-10 shadow-sm border border-slate-100 mb-12">
                 <div className="flex items-center gap-3 mb-6">
                     <div className="bg-gradient-to-br from-indigo-500 to-purple-600 text-white p-3 rounded-xl shadow-lg shadow-indigo-200">
                         <Sparkles size={24} />
                     </div>
                     <div>
                         <h3 className="text-2xl font-serif font-bold text-slate-800">Create New Puzzle</h3>
                         <p className="text-slate-500">Describe what you want to play, and AI will paint it.</p>
                     </div>
                 </div>

                 <div className="relative">
                     <textarea
                         value={promptInput}
                         onChange={(e) => setPromptInput(e.target.value)}
                         placeholder="A futuristic city in the clouds, cyberpunk style..."
                         className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 md:p-6 text-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all resize-none h-32 md:h-40 shadow-inner"
                     />
                     <button
                        onClick={handleGeneratePuzzle}
                        disabled={isGenerating || !promptInput.trim()}
                        className={`absolute bottom-4 right-4 px-6 py-3 rounded-xl font-bold flex items-center gap-2 transition-all shadow-lg ${
                            isGenerating || !promptInput.trim()
                            ? 'bg-slate-200 text-slate-400 cursor-not-allowed shadow-none'
                            : 'bg-indigo-600 text-white hover:bg-indigo-700 hover:scale-105 active:scale-95 shadow-indigo-200'
                        }`}
                     >
                         {isGenerating ? (
                             <>
                                 <RotateCw size={18} className="animate-spin" /> Generating...
                             </>
                         ) : (
                             <>
                                 Generate <Wand2 size={18} />
                             </>
                         )}
                     </button>
                 </div>
             </div>

             {generatedImages.length > 0 && (
                 <div>
                     <h3 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2">
                         <History size={20} className="text-slate-400" /> Your Creations
                     </h3>
                     <div className="grid grid-cols-2 md:grid-cols-3 gap-4 md:gap-6">
                         {generatedImages.map((img) => (
                             <div 
                               key={img.id}
                               className="group relative aspect-square bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden cursor-pointer hover:shadow-lg transition-all"
                               onClick={() => startPuzzle({ ...img, category: 'AI Generated', difficulty: 'normal' } as PuzzleConfig)}
                             >
                                 <img src={img.src} alt={img.title} className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" />
                                 
                                 <button 
                                    onClick={(e) => { e.stopPropagation(); handleDeleteGenerated(img.id); }}
                                    className="absolute top-2 right-2 bg-white/90 text-rose-500 p-2 rounded-full shadow-sm opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-all hover:bg-rose-50 z-10"
                                    title="Delete"
                                 >
                                     <Trash2 size={16} />
                                 </button>

                                 <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/80 to-transparent">
                                     <p className="text-white font-medium text-sm line-clamp-2">{img.title}</p>
                                     <div className="flex items-center gap-2 mt-2">
                                         <span className="text-[10px] bg-white/20 backdrop-blur-md text-white px-2 py-0.5 rounded-full">AI Generated</span>
                                     </div>
                                 </div>
                             </div>
                         ))}
                     </div>
                 </div>
             )}
         </div>
      </main>
    </div>
  );

  if (currentView === 'game' && selectedPuzzle) {
    return (
      <GameBoard 
        puzzle={selectedPuzzle} 
        onExit={() => {
            setCurrentView('home');
            setSelectedPuzzle(null);
        }}
        onComplete={handlePuzzleComplete}
      />
    );
  }

  return (
    <>
      {/* Background Ambience */}
      <div className="fixed inset-0 bg-slate-50 -z-20"></div>

      {currentView === 'home' && renderHome()}
      {currentView === 'gallery' && renderGallery()}
      {currentView === 'create' && renderCreate()}
      
      {showHowToPlay && renderHowToPlay()}
      {showUploadModal && renderUploadModal()}
      
      {/* Add Category Modal */}
      {showCategoryModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in">
              <div className="bg-white rounded-3xl p-6 w-full max-w-md shadow-2xl">
                  <div className="flex justify-between items-center mb-6">
                      <h3 className="text-xl font-serif font-bold text-slate-800">Add New Category</h3>
                      <button onClick={() => setShowCategoryModal(false)} className="p-2 hover:bg-slate-100 rounded-full text-slate-400">
                          <X size={20} />
                      </button>
                  </div>
                  
                  <div className="space-y-4">
                      <div>
                          <label className="block text-sm font-bold text-slate-500 uppercase tracking-wider mb-2">Category Name</label>
                          <input 
                              type="text" 
                              value={newCategoryName}
                              onChange={(e) => setNewCategoryName(e.target.value)}
                              placeholder="e.g., Space, Food, Travel"
                              className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                              autoFocus
                          />
                      </div>
                      
                      <button 
                          onClick={handleAddCategory}
                          disabled={!newCategoryName.trim()}
                          className={`w-full py-3 rounded-xl font-bold transition-colors ${!newCategoryName.trim() ? 'bg-slate-100 text-slate-400' : 'bg-indigo-600 text-white hover:bg-indigo-700'}`}
                      >
                          Create Category
                      </button>
                  </div>
              </div>
          </div>
      )}

      {/* Global Error Toast */}
      {error && (
        <div className="fixed bottom-6 right-6 z-[100] animate-in slide-in-from-bottom-5 fade-in duration-300">
          <div className="bg-white rounded-xl shadow-2xl border border-rose-100 p-4 flex items-start gap-3 max-w-sm">
             <div className="bg-rose-100 text-rose-600 p-2 rounded-lg">
                 <AlertTriangle size={20} />
             </div>
             <div className="flex-1">
                 <h4 className="font-bold text-slate-800 text-sm mb-1">{error.title}</h4>
                 <p className="text-slate-600 text-xs leading-relaxed">{error.message}</p>
             </div>
             <button onClick={() => setError(null)} className="text-slate-400 hover:text-slate-600">
                 <X size={16} />
             </button>
          </div>
        </div>
      )}
    </>
  );
};

export default App;