import React, { useState, useEffect, useRef } from 'react';
import { Home, Puzzle, Settings, Image as ImageIcon, Sparkles, Clock, ArrowLeft, RotateCcw, Flame, Play, ChevronRight, Wand2, History, Layers, HelpCircle, X, MousePointer2, RotateCw, Shapes, Eye, Lightbulb, Zap, Check, CloudDownload, WifiOff, Activity, AlertTriangle, Upload, Plus, Trash2 } from 'lucide-react';
import GameBoard from './components/GameBoard';
import { generateImage } from './services/geminiService';
import { syncPuzzleImage, getFullQualityImage, saveGeneratedPuzzle, loadSavedGeneratedPuzzles, persistGeneratedMetadata, saveUserUploadedPuzzle, loadUserUploadedPuzzles, deleteUserUploadedPuzzle, deleteGeneratedPuzzle } from './services/offlineStorage';
import { GameState, Difficulty, PuzzleConfig, AppView, GeneratedImage } from './types';
import { INITIAL_PUZZLES } from './constants';

const CATEGORIES = ['Classic Cars', 'Animals', 'Cats', 'Disney Characters', 'Historical Buildings', 'People', 'Abstract', 'Nature', 'Urban', 'Spring', 'Summer', 'Autumn', 'Winter', 'Indoor', 'Fine Art & Masterpieces', 'Icons & Logos', 'Movies & TV Shows', 'Album Covers', 'Abstract & Colour Gradients'];

const App: React.FC = () => {
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
  const [uploadCategory, setUploadCategory] = useState(CATEGORIES[0]);
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
  const [previewPuzzle, setPreviewPuzzle] = useState<PuzzleConfig | null>(null);
  const [hiddenPuzzleIds, setHiddenPuzzleIds] = useState<Set<string>>(new Set());
  
  const initializationRef = useRef(false);

  // Daily Streak & Puzzle State
  const [streak, setStreak] = useState(0);
  const [dailyPuzzle, setDailyPuzzle] = useState<PuzzleConfig | null>(null);

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

  // Load Generated Images from IndexedDB (Migration handled in service)
  useEffect(() => {
    loadSavedGeneratedPuzzles().then(puzzles => {
        setGeneratedImages(puzzles);
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
      const runSync = async () => {
          setIsSyncing(true);
          const allPuzzles = [...galleryPuzzles];
          let completed = 0;
          
          // Process in chunks to avoid blocking UI
          const CHUNK_SIZE = 5;
          for (let i = 0; i < allPuzzles.length; i += CHUNK_SIZE) {
              const chunk = allPuzzles.slice(i, i + CHUNK_SIZE);
              
              await Promise.all(chunk.map(async (p) => {
                   // Skip if already has a generated thumbnail (unless it's a retry)
                   if (thumbnails[p.id]) return;
                   
                   // Don't sync user uploads or discoveries that already have local blob URLs
                   if (p.isUserUpload || (p.src && p.src.startsWith('blob:'))) {
                       setThumbnails(prev => ({ ...prev, [p.id]: p.src }));
                       return;
                   }
                   
                   const result = await syncPuzzleImage(p);
                   if (result.isLocal) {
                       setThumbnails(prev => ({ ...prev, [p.id]: result.thumbUrl }));
                   }
              }));
              
              completed += chunk.length;
              setSyncProgress(Math.min(100, Math.round((completed / allPuzzles.length) * 100)));
              
              // Small delay to yield to main thread
              await new Promise(r => setTimeout(r, 50));
          }
          setIsSyncing(false);
      };
      
      // Run sync when gallery changes (e.g. discovery added) or on mount
      // Delay slightly to let app mount first
      const timeout = setTimeout(runSync, 1000);
      return () => clearTimeout(timeout);
  }, [galleryPuzzles.length]); // Dependency on length so new discoveries trigger sync

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

    // 1.5 Generate Dynamic Daily Puzzle
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
            localStorage.setItem('mosaic_discoveries', JSON.stringify(storedDiscoveries));
        }

        // Load User Uploads
        const userUploads = await loadUserUploadedPuzzles();

        const allPuzzles = [...INITIAL_PUZZLES, ...storedDiscoveries, ...userUploads];
        
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
        
        // Save to IndexedDB and get Object URL
        const objectUrl = await saveGeneratedPuzzle(newId, base64Image);
        
        const newPuzzle: GeneratedImage = {
          id: newId,
          src: objectUrl, // Use blob URL for display
          title: promptInput,
          isAi: true
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
  
  const handlePuzzleComplete = () => {
     if (selectedPuzzle) {
        localStorage.removeItem(`mosaic_save_${selectedPuzzle.id}`);
        
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

  // ... (HowToPlay Component remains same) ...
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
    const apiKeyExists = !!process.env.API_KEY;

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

  const renderGallery = () => {
    // Categories included in constant at top
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
                <div className="flex items-center gap-2 text-slate-500 text-sm">
                   {isSyncing ? (
                      <span className="flex items-center gap-1.5 text-indigo-600 font-medium">
                        <CloudDownload size={14} className="animate-pulse" /> Syncing library... {syncProgress}%
                      </span>
                   ) : (
                      <span>Select a masterpiece to begin</span>
                   )}
                </div>
            </div>
        </div>
        
        {/* Category & Upload Section */}
        <div className="flex items-center gap-4 w-full md:w-auto overflow-hidden">
             {/* Upload Button */}
             <button 
                onClick={() => setShowUploadModal(true)}
                className="flex items-center gap-2 px-4 py-3 bg-white border border-slate-200 hover:bg-slate-50 text-indigo-600 rounded-full font-bold shadow-sm transition-all active:scale-95 whitespace-nowrap"
             >
                 <Upload size={18} />
                 <span>Upload</span>
             </button>

            <div className="flex items-center gap-3 overflow-x-auto pb-4 md:pb-0 custom-scrollbar max-w-full">
                {CATEGORIES.map(cat => (
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
      </div>

      {filteredPuzzles.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-slate-400">
            <ImageIcon size={48} className="opacity-20 mb-4" />
            <p>No puzzles found in this category.</p>
        </div>
      ) : (
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 overflow-y-auto custom-scrollbar pb-20 flex-1 min-h-0 pr-2">
        {filteredPuzzles.map((puzzle, index) => {
          if (!puzzle) return null;
          const hasSave = savedGameIds.has(puzzle.id);
          const isCompleted = completedPuzzleIds.has(puzzle.id);
          
          // Use local thumbnail if available, else original src
          const thumbSrc = thumbnails[puzzle.id] || puzzle.src;
          
          return (
          <div key={puzzle.id} 
               onClick={() => startPuzzle(puzzle)}
               style={{ animationDelay: `${index * 50}ms` }}
               className="group bg-white rounded-2xl shadow-sm hover:shadow-xl transition-all duration-300 hover:-translate-y-1 overflow-hidden border border-slate-100 flex flex-col cursor-pointer active:scale-[0.98]">
            <div className="relative aspect-square overflow-hidden bg-slate-100">
                <img 
                    src={thumbSrc} 
                    alt={puzzle.title} 
                    className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105" 
                    loading="lazy" 
                />
                
                {/* Large Touch Target Preview Button for Mobile/Touch overlay */}
                <button
                    className="absolute top-0 right-0 w-12 h-12 flex items-center justify-center text-white/90 bg-slate-900/10 hover:bg-slate-900/40 transition-colors z-20 md:hidden"
                    onPointerDown={(e) => {
                        e.stopPropagation();
                        e.preventDefault(); 
                        setPreviewPuzzle(puzzle);
                    }}
                    onPointerUp={(e) => {
                        e.stopPropagation();
                        setPreviewPuzzle(null);
                    }}
                    onPointerLeave={(e) => {
                        e.stopPropagation();
                        setPreviewPuzzle(null);
                    }}
                    onClick={(e) => e.stopPropagation()}
                    aria-label="Preview"
                >
                    <Eye size={20} className="drop-shadow-md" />
                </button>

                {/* Delete Button (Visible on Hover for Desktop, Always Accessible) */}
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        handleDeletePuzzle(puzzle);
                    }}
                    className="absolute top-2 left-2 p-2 bg-white/90 text-rose-500 rounded-full shadow-sm hover:bg-rose-50 transition-colors z-20 opacity-0 group-hover:opacity-100"
                    title="Delete Puzzle"
                >
                    <Trash2 size={16} />
                </button>

                {isCompleted ? (
                    <div className="absolute inset-0 bg-emerald-900/20 flex items-center justify-center pointer-events-none">
                         <div className="bg-emerald-500 text-white p-2.5 rounded-full shadow-lg animate-in zoom-in duration-300">
                             <Check size={18} strokeWidth={3} />
                         </div>
                    </div>
                ) : (
                    <div className="absolute inset-0 bg-black/10 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none">
                        <div className="bg-white/90 p-3 rounded-full shadow-lg scale-90 group-hover:scale-100 transition-transform">
                            <Play size={20} className="fill-indigo-600 text-indigo-600 ml-0.5" />
                        </div>
                    </div>
                )}
            </div>
            
            <div 
                className="p-3 flex flex-col gap-1.5"
                onMouseEnter={() => setPreviewPuzzle(puzzle)}
                onMouseLeave={() => setPreviewPuzzle(null)}
            >
                <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 truncate max-w-[60%]">{puzzle.category || 'Classic'}</span>
                    {thumbnails[puzzle.id] && (
                        <div className="text-[10px] text-indigo-400 bg-indigo-50 px-1.5 py-0.5 rounded flex items-center gap-1" title="Available Offline">
                            <WifiOff size={8} /> Saved
                        </div>
                    )}
                </div>
                <h3 className="font-serif text-sm font-medium text-slate-800 leading-tight truncate" title={puzzle.title}>{puzzle.title}</h3>
                
                <div className="flex items-center justify-between mt-0.5">
                    <div className="flex flex-wrap gap-1.5 items-center">
                        <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded border capitalize ${
                            (puzzle.difficulty || 'normal') === 'easy' ? 'text-sky-600 bg-sky-50 border-sky-100' :
                            (puzzle.difficulty || 'normal') === 'hard' ? 'text-orange-600 bg-orange-50 border-orange-100' :
                            (puzzle.difficulty || 'normal') === 'expert' ? 'text-rose-600 bg-rose-50 border-rose-100' :
                            'text-slate-500 bg-slate-50 border-slate-100'
                        }`}>
                            {puzzle.difficulty || 'normal'}
                        </span>
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

                    {/* Touchscreen Optimized Preview Button - Visible on all screens for touch access */}
                    <button 
                        onClick={(e) => {
                            e.stopPropagation();
                            setPreviewPuzzle(puzzle);
                        }}
                        className="w-10 h-10 flex items-center justify-center -mr-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-full transition-colors active:scale-95 active:bg-indigo-100"
                        aria-label="Preview Image"
                    >
                        <Eye size={20} />
                    </button>
                </div>
            </div>
          </div>
        )})}
      </div>
      )}

      {/* Floating Preview Window (New Window Style) */}
      {previewPuzzle && (
          <div 
            className="fixed inset-0 z-50 flex items-center justify-center p-6 md:inset-auto md:bottom-6 md:right-6 md:block md:p-0"
            style={{ pointerEvents: 'auto' }}
            onClick={() => setPreviewPuzzle(null)} // Click outside closes on mobile
          >
              {/* Added backdrop blur for mobile focus */}
              <div className="absolute inset-0 bg-slate-900/20 backdrop-blur-sm md:hidden animate-in fade-in duration-200"></div>
              
              <div 
                className="bg-white p-3 rounded-2xl shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-200 w-full max-w-xs md:w-72 ring-4 ring-black/5 mx-auto relative z-10 md:pointer-events-auto"
                onClick={(e) => e.stopPropagation()} // Prevent close when clicking content
              >
                  <button 
                     className="absolute -top-3 -right-3 bg-slate-900 text-white rounded-full p-2 shadow-lg md:hidden z-20"
                     onClick={() => setPreviewPuzzle(null)}
                  >
                     <X size={16} />
                  </button>

                  <div className="aspect-square rounded-xl overflow-hidden mb-3 relative bg-slate-100">
                      <img 
                        src={thumbnails[previewPuzzle.id] || previewPuzzle.src} 
                        className="w-full h-full object-cover"
                        alt="Preview"
                      />
                      <div className="absolute inset-0 ring-1 ring-inset ring-black/10 rounded-xl"></div>
                  </div>
                  <div className="text-center px-1 pb-1">
                      <h4 className="font-serif font-bold text-slate-800 text-lg leading-tight mb-1">{previewPuzzle.title}</h4>
                      <p className="text-xs text-slate-500 uppercase tracking-wider font-medium">{previewPuzzle.category || 'Gallery'}</p>
                      
                       <span className={`inline-block mt-2 text-[10px] font-medium px-2 py-0.5 rounded border capitalize ${
                        (previewPuzzle.difficulty || 'normal') === 'easy' ? 'text-sky-600 bg-sky-50 border-sky-100' :
                        (previewPuzzle.difficulty || 'normal') === 'hard' ? 'text-orange-600 bg-orange-50 border-orange-100' :
                        (previewPuzzle.difficulty || 'normal') === 'expert' ? 'text-rose-600 bg-rose-50 border-rose-100' :
                        'text-slate-500 bg-slate-50 border-slate-100'
                    }`}>
                        {previewPuzzle.difficulty || 'normal'}
                    </span>
                  </div>
              </div>
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
                 
                 {/* Delete Generated Button */}
                 <button
                    onClick={(e) => {
                        e.stopPropagation();
                        handleDeleteGenerated(img.id);
                    }}
                    className="absolute top-2 right-2 p-2 bg-white/90 text-rose-500 rounded-full shadow-sm hover:bg-rose-50 transition-colors opacity-0 group-hover:opacity-100"
                    title="Delete Creation"
                 >
                    <Trash2 size={16} />
                 </button>

                 {isCompleted ? (
                    <div className="absolute inset-0 bg-emerald-900/20 flex items-center justify-center pointer-events-none">
                         <div className="bg-emerald-500 text-white p-3 rounded-full shadow-lg">
                             <Check size={20} strokeWidth={3} />
                         </div>
                    </div>
                ) : (
                     <div className="absolute inset-0 bg-black/10 flex items-center justify-center pointer-events-none">
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
      {showUploadModal && renderUploadModal()}
      
      {/* Global Error Modal */}
      {error && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4 animate-in fade-in">
            <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-xs w-full text-center animate-in zoom-in-95 duration-200">
                <div className="w-12 h-12 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center mx-auto mb-4">
                    <AlertTriangle size={24} />
                </div>
                <h3 className="text-lg font-bold text-slate-800 mb-2">{error.title}</h3>
                <p className="text-slate-500 text-sm mb-6 leading-relaxed">{error.message}</p>
                <button 
                    onClick={() => setError(null)}
                    className="w-full py-3 bg-slate-900 text-white rounded-xl font-bold hover:bg-slate-800 transition-colors"
                >
                    Dismiss
                </button>
            </div>
        </div>
      )}
    </div>
  );
};

export default App;