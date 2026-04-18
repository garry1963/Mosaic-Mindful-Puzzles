import React, { useState, useEffect, useRef } from 'react';
import { Home, Puzzle, Settings, Image as ImageIcon, Sparkles, Clock, ArrowLeft, RotateCcw, Flame, Play, ChevronRight, Wand2, History, Layers, HelpCircle, X, MousePointer2, RotateCw, Shapes, Eye, Lightbulb, Zap, Check, CloudDownload, WifiOff, Wifi, Activity, AlertTriangle, Upload, Plus, Trash2, Trophy, Target, Gift } from 'lucide-react';
import GameBoard from './components/GameBoard';
import { generateImage } from './services/pexelsService';
import { syncPuzzleImage, getFullQualityImage, saveGeneratedPuzzle, loadSavedGeneratedPuzzles, persistGeneratedMetadata, saveUserUploadedPuzzle, loadUserUploadedPuzzles, deleteUserUploadedPuzzle, deleteGeneratedPuzzle, checkImagesExistInDB, updatePuzzleMetadataInDB } from './services/offlineStorage';
import { rebuildDatabase } from './utils/storage';
import { loadUserStats, formatTime, resetBestTimes, resetBestTimeForDifficulty } from './services/statsService';
import { initializeQuests, claimReward } from './services/questService';
import { GameState, Difficulty, PuzzleConfig, AppView, GeneratedImage, UserStats } from './types';
import { INITIAL_PUZZLES, QUESTS, CHALLENGES } from './constants';
import { DiagnosticsModal } from './components/DiagnosticsModal';

const INITIAL_CATEGORIES = ['Classic Cars', 'Animals', 'Cats', 'Disney Characters', 'Historical Buildings', 'People', 'Abstract', 'Nature', 'Urban', 'Spring', 'Summer', 'Autumn', 'Winter', 'Indoor', 'Fine Art & Masterpieces', 'Icons & Logos', 'Movies & TV Shows', 'Album Covers', 'Abstract & Colour Gradients'];

const DIFFICULTY_RANK: Record<string, number> = {
  'easy': 1,
  'normal': 2,
  'hard': 3,
  'expert': 4
};

const App: React.FC = () => {
  const [showDiagnostics, setShowDiagnostics] = useState(false);
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
  const [uploadFiles, setUploadFiles] = useState<File[]>([]);
  const [uploadPreviews, setUploadPreviews] = useState<string[]>([]);
  const [uploadCategory, setUploadCategory] = useState(INITIAL_CATEGORIES[0]);
  const [aiCategory, setAiCategory] = useState(INITIAL_CATEGORIES[0]);
  const [uploadTitle, setUploadTitle] = useState('');
  const [isUploading, setIsUploading] = useState(false);
  const [savingAiImage, setSavingAiImage] = useState<GeneratedImage | null>(null);
  
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
  const [isNetworkOffline, setIsNetworkOffline] = useState(!navigator.onLine);
  const [userStats, setUserStats] = useState<UserStats>({ totalPoints: 0, bestTimes: { easy: null, normal: null, hard: null, expert: null } });
  const [isInitializing, setIsInitializing] = useState(true);
  const [timeLeft, setTimeLeft] = useState('');
  const [dailyTimeLeft, setDailyTimeLeft] = useState('');
  
  const initializationRef = useRef(false);

  useEffect(() => {
      const updateTimer = () => {
          const now = Date.now();

          if (userStats.weeklyResetTime) {
              const diff = userStats.weeklyResetTime - now;
              if (diff <= 0) {
                  setTimeLeft('Resetting soon...');
              } else {
                  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
                  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
                  const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
                  setTimeLeft(`${days}d ${hours}h ${mins}m`);
              }
          }

          if (userStats.dailyResetTime) {
              const diff = userStats.dailyResetTime - now;
              if (diff <= 0) {
                  setDailyTimeLeft('Resetting soon...');
              } else {
                  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
                  const mins = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
                  setDailyTimeLeft(`${hours}h ${mins}m`);
              }
          }
      };
      
      updateTimer();
      const interval = setInterval(updateTimer, 60000); // Update every minute
      return () => clearInterval(interval);
  }, [userStats.weeklyResetTime, userStats.dailyResetTime]);

  // Load User Stats
  useEffect(() => {
      const stats = loadUserStats();
      const initializedStats = initializeQuests(stats);
      setUserStats(initializedStats);
      
      // Load Categories (New Logic: Single Source of Truth)
      const savedAllCategories = localStorage.getItem('mosaic_all_categories');
      if (savedAllCategories) {
          try {
              setCategories(JSON.parse(savedAllCategories));
          } catch (e) {
              console.error("Failed to load all categories", e);
              setCategories(INITIAL_CATEGORIES);
          }
      } else {
          // Legacy Fallback: Load custom categories and merge
          const savedCustomCategories = localStorage.getItem('mosaic_custom_categories');
          let initialCats = [...INITIAL_CATEGORIES];
          
          if (savedCustomCategories) {
              try {
                  const parsed = JSON.parse(savedCustomCategories);
                  initialCats = [...initialCats, ...parsed];
              } catch (e) {
                  console.error("Failed to load custom categories", e);
              }
          }
          
          // Deduplicate and Save
          const uniqueCats = Array.from(new Set(initialCats));
          setCategories(uniqueCats);
          localStorage.setItem('mosaic_all_categories', JSON.stringify(uniqueCats));
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

  // Network Status Listener
  useEffect(() => {
      const handleOnline = () => setIsNetworkOffline(false);
      const handleOffline = () => {
          setIsNetworkOffline(true);
          setIsOfflineMode(true);
      };

      window.addEventListener('online', handleOnline);
      window.addEventListener('offline', handleOffline);

      // Initial check
      if (!navigator.onLine) {
          setIsNetworkOffline(true);
          setIsOfflineMode(true);
      }

      return () => {
          window.removeEventListener('online', handleOnline);
          window.removeEventListener('offline', handleOffline);
      };
  }, []);

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
                   
                   const result = await syncPuzzleImage(p, isOfflineMode);
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
  }, [galleryPuzzles, isOfflineMode]); // Changed dependency to full array to catch updates properly

  // Initialize Application
  useEffect(() => {
    if (initializationRef.current) return;
    initializationRef.current = true;

    const initializeApp = async () => {
        try {
            // 1. Load Generated Images
            const genImages = await loadSavedGeneratedPuzzles();
            setGeneratedImages(genImages);

            // 3. Load User Data & Puzzles
            checkForSavedGames();

            // Load Completed Puzzles
            try {
                const savedCompleted = localStorage.getItem('mosaic_completed_ids');
                if (savedCompleted) {
                    setCompletedPuzzleIds(new Set(JSON.parse(savedCompleted)));
                }
            } catch (e) {
                console.error("Failed to load completed puzzles", e);
            }

            // Streak Logic
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

            // Generate Daily Puzzle
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

            // Load Puzzles (Hidden, Discoveries, User Uploads)
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

           // Load User Uploads (Safe: Uses persistent IndexedDB metadata)
           const userUploads = await loadUserUploadedPuzzles();

           // Sync categories from uploads and generated images
           const uploadCategories = new Set([...userUploads, ...genImages].map(p => p.category).filter(Boolean) as string[]);
           setCategories(prev => {
               const newCats = new Set(prev);
               let changed = false;
               uploadCategories.forEach(c => {
                   if (!newCats.has(c)) {
                       newCats.add(c);
                       changed = true;
                   }
               });
               return changed ? Array.from(newCats) : prev;
           });

           const genPuzzlesAsConfig: PuzzleConfig[] = genImages.map(img => ({
               id: img.id,
               src: img.src,
               title: img.title,
               category: img.category || 'AI Generated',
               isAi: true
           }));

           let allPuzzles = [...INITIAL_PUZZLES, ...storedDiscoveries, ...userUploads, ...genPuzzlesAsConfig];
           
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

        } catch (e) {
            console.error("Initialization Failed", e);
            setError({ title: "Startup Error", message: "Failed to initialize application. Please refresh." });
        } finally {
            setIsInitializing(false);
        }
    };

    initializeApp();
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
            isAi: true,
            category: aiCategory
        };

        // Save to IndexedDB and get Object URL
        const objectUrl = await saveGeneratedPuzzle(newId, base64Image, metadata);
        
        const newPuzzle: GeneratedImage = {
          ...metadata,
          src: objectUrl, // Use blob URL for display
        };
        
        setGeneratedImages(prev => [newPuzzle, ...prev]);
        
        // Also add to gallery so it appears in the selected category
        const galleryPuzzle: PuzzleConfig = {
            id: newId,
            src: objectUrl,
            title: promptInput,
            category: aiCategory,
            isAi: true
        };
        setGalleryPuzzles(prev => [galleryPuzzle, ...prev]);
        
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
    if (e.target.files && e.target.files.length > 0) {
        const files = Array.from(e.target.files);
        const validFiles: File[] = [];

        // Validate type is image
        for (const file of files) {
            if (!file.type.startsWith("image/")) {
                alert(`File "${file.name}" is not a valid image format.`);
                continue;
            }
            validFiles.push(file);
        }

        if (validFiles.length === 0) return;
        
        setUploadFiles(validFiles);
        if (validFiles.length === 1) {
            setUploadTitle(validFiles[0].name.split('.')[0]); // Default title for single file
        } else {
            setUploadTitle(''); // Clear title for multiple files
        }
        
        // Create previews
        Promise.all(validFiles.map(file => {
            return new Promise<string>((resolve) => {
                const reader = new FileReader();
                reader.onload = (ev) => resolve(ev.target?.result as string);
                reader.readAsDataURL(file);
            });
        })).then(results => {
            setUploadPreviews(results);
        });
    }
  };

  const handleUploadSubmit = async () => {
      if (uploadFiles.length === 0 || !uploadCategory) return;
      setIsUploading(true);
      try {
          const newPuzzles: PuzzleConfig[] = [];
          
          for (const file of uploadFiles) {
              const title = uploadFiles.length === 1 && uploadTitle ? uploadTitle : file.name.split('.')[0];
              const newPuzzle = await saveUserUploadedPuzzle(file, title, uploadCategory);
              newPuzzles.push(newPuzzle);
          }

          setGalleryPuzzles(prev => [...newPuzzles, ...prev]);
          
          // Reset and Close
          setShowUploadModal(false);
          setUploadFiles([]);
          setUploadPreviews([]);
          setUploadTitle('');
          setUploadCategory(categories[0]);
          setActiveCategory(uploadCategory); // Switch to the category we just uploaded to
      } catch (e: any) {
          console.error("Upload failed", e);
          const errMessage = e?.message || "Could not save your image(s). Please try again.";
          setError({ title: "Upload Failed", message: errMessage });
      } finally {
          setIsUploading(false);
      }
  };

  const handleSaveAiImage = async () => {
      if (!savingAiImage || !aiCategory) return;
      
      try {
          // Update in DB
          await updatePuzzleMetadataInDB(savingAiImage.id, { category: aiCategory });
          
          // Update in generatedImages
          setGeneratedImages(prev => prev.map(img => 
              img.id === savingAiImage.id ? { ...img, category: aiCategory } : img
          ));
          
          // Update in galleryPuzzles
          setGalleryPuzzles(prev => prev.map(p => 
              p.id === savingAiImage.id ? { ...p, category: aiCategory } : p
          ));
          
          // Also update categories list if it's a new category
          if (!categories.includes(aiCategory)) {
              setCategories(prev => [...prev, aiCategory]);
          }
          
          setSavingAiImage(null);
      } catch (e) {
          console.error("Failed to save AI image to category", e);
          setError({ title: "Save Failed", message: "Could not save the image to the category." });
      }
  };

  const handleDeletePuzzle = async (puzzle: PuzzleConfig) => {
      if (!window.confirm("Are you sure you want to delete this puzzle? This action cannot be undone.")) {
          return;
      }

      try {
          if (puzzle.isUserUpload) {
              await deleteUserUploadedPuzzle(puzzle.id);
          } else if (puzzle.isAi) {
              await deleteGeneratedPuzzle(puzzle.id);
              setGeneratedImages(prev => prev.filter(img => img.id !== puzzle.id));
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
    
    const isLocal = localSrc.startsWith('blob:') || localSrc.startsWith('data:');
    if (isOfflineMode && !isLocal) {
         alert("This puzzle is not available offline. Please connect to the internet to play it.");
         return;
    }

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
      
      // Save all categories to storage
      localStorage.setItem('mosaic_all_categories', JSON.stringify(newCategories));
      
      // Legacy support
      const customOnly = newCategories.filter(c => !INITIAL_CATEGORIES.includes(c));
      localStorage.setItem('mosaic_custom_categories', JSON.stringify(customOnly));
      
      setNewCategoryName('');
      setShowCategoryModal(false);
      setActiveCategory(trimmed);
  };

  const handleDeleteCategory = (e: React.MouseEvent, categoryToDelete: string) => {
      e.stopPropagation();
      if (window.confirm(`Delete category "${categoryToDelete}"?`)) {
          const newCategories = categories.filter(c => c !== categoryToDelete);
          setCategories(newCategories);
          localStorage.setItem('mosaic_all_categories', JSON.stringify(newCategories));
          
          // Legacy support
          const customOnly = newCategories.filter(c => !INITIAL_CATEGORIES.includes(c));
          localStorage.setItem('mosaic_custom_categories', JSON.stringify(customOnly));

          if (activeCategory === categoryToDelete) {
              setActiveCategory('All');
          }
      }
  };

  const handleResetStats = () => {
      if (window.confirm("Are you sure you want to reset ALL your best times? This cannot be undone.")) {
          const newStats = resetBestTimes();
          setUserStats(newStats);
      }
  };

  const handleResetDifficultyStats = (difficulty: Difficulty) => {
      if (window.confirm(`Are you sure you want to reset your best time for ${difficulty}?`)) {
          const newStats = resetBestTimeForDifficulty(difficulty);
          setUserStats(newStats);
      }
  };

  const handleCheckDatabase = async () => {
      if (window.confirm("This will scan your entire database and rebuild your gallery. It may take a moment. Continue?")) {
          const report = await rebuildDatabase();
          alert(report);
          window.location.reload();
      }
  };

  const handlePuzzleComplete = () => {
     if (selectedPuzzle) {
        try {
            localStorage.removeItem(`mosaic_save_${selectedPuzzle.id}`);
            
            const newCompleted = new Set(completedPuzzleIds);
            newCompleted.add(selectedPuzzle.id);
            setCompletedPuzzleIds(newCompleted);
            localStorage.setItem('mosaic_completed_ids', JSON.stringify(Array.from(newCompleted)));
        } catch(e) {}
        
        // Reload stats
        setUserStats(loadUserStats());
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
                         multiple
                       />
                       <div className={`border-2 border-dashed rounded-2xl p-8 flex flex-col items-center justify-center text-center transition-colors ${uploadPreviews.length > 0 ? 'border-indigo-200 bg-indigo-50/30' : 'border-slate-200 hover:border-indigo-400 hover:bg-slate-50'}`}>
                           {uploadPreviews.length > 0 ? (
                               <div className="grid grid-cols-2 md:grid-cols-3 gap-2 w-full">
                                   {uploadPreviews.slice(0, 6).map((preview, idx) => (
                                       <div key={idx} className="relative w-full aspect-square rounded-lg overflow-hidden shadow-sm">
                                           <img src={preview} alt={`Preview ${idx}`} className="w-full h-full object-cover" />
                                       </div>
                                   ))}
                                   {uploadPreviews.length > 6 && (
                                       <div className="flex items-center justify-center text-xs text-slate-500 font-medium">
                                           +{uploadPreviews.length - 6} more
                                       </div>
                                   )}
                               </div>
                           ) : (
                               <>
                                   <div className="w-12 h-12 bg-indigo-50 text-indigo-500 rounded-full flex items-center justify-center mb-3">
                                       <Plus size={24} />
                                   </div>
                                   <p className="font-medium text-slate-700">Click to choose image(s)</p>
                                   <p className="text-sm text-slate-400 mt-1">JPEG, PNG, WebP (Max 5MB)</p>
                               </>
                           )}
                       </div>
                   </div>

                   {/* Title Input (Only for single file) */}
                   {uploadFiles.length <= 1 && (
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
                   )}
                   
                   {uploadFiles.length > 1 && (
                       <div className="text-sm text-slate-500 italic">
                           Uploading {uploadFiles.length} images. Filenames will be used as titles.
                       </div>
                   )}

                   {/* Category Dropdown */}
                   <div>
                       <label className="block text-sm font-bold text-slate-700 mb-2">Category</label>
                       <div className="relative">
                           <select 
                             value={uploadCategory}
                             onChange={(e) => setUploadCategory(e.target.value)}
                             className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-800 bg-slate-50 appearance-none cursor-pointer"
                           >
                               {categories.map(cat => (
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
                     disabled={uploadFiles.length === 0 || isUploading}
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
    <div className="flex flex-col h-[100dvh] w-full max-w-5xl mx-auto p-6 lg:p-12 pb-32 relative overflow-y-auto custom-scrollbar">
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

          {/* Diagnostics Button */}
          <button 
              onClick={() => setShowDiagnostics(true)}
              className="flex items-center gap-3 px-4 py-3 bg-white/90 backdrop-blur-md rounded-2xl shadow-sm border border-slate-200/60 transition-all hover:scale-105 select-none delay-100 animate-in fade-in slide-in-from-left-2 text-left"
          >
              <div className="bg-indigo-50 text-indigo-500 p-1 rounded-md">
                  <Activity size={14} />
              </div>
              <div className="flex flex-col">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider leading-none mb-0.5">System</span>
                  <span className="text-xs font-bold text-slate-700 leading-none">
                      Diagnostics
                  </span>
              </div>
          </button>
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
              <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                      <div className="bg-amber-100 p-2.5 rounded-xl text-amber-600">
                          <Activity size={24} />
                      </div>
                      <h2 className="text-2xl font-serif font-bold text-slate-800">Your Progress</h2>
                  </div>
                  <button 
                    onClick={handleResetStats}
                    className="text-slate-400 hover:text-rose-500 transition-colors p-2 rounded-full hover:bg-rose-50"
                    title="Reset Best Times"
                  >
                      <RotateCcw size={20} />
                  </button>
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
                          <div key={diff} className="bg-slate-50 rounded-2xl p-4 border border-slate-100 flex flex-col items-center relative group">
                              {userStats.bestTimes[diff] !== null && (
                                  <button 
                                    onClick={() => handleResetDifficultyStats(diff)}
                                    className="absolute top-2 right-2 text-slate-300 hover:text-rose-500 opacity-0 group-hover:opacity-100 transition-opacity p-1"
                                    title={`Reset ${diff} best time`}
                                  >
                                      <RotateCcw size={12} />
                                  </button>
                              )}
                              <span className="text-slate-400 text-[10px] font-bold uppercase tracking-widest mb-2">{diff}</span>
                              <span className={`font-mono font-bold text-lg ${userStats.bestTimes[diff] ? 'text-slate-700' : 'text-slate-300'}`}>
                                  {formatTime(userStats.bestTimes[diff])}
                              </span>
                          </div>
                      ))}
                  </div>
              </div>
          </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 pb-10 flex-shrink-0">
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

        <div className={`group bg-white p-8 md:p-10 rounded-[2.5rem] shadow-sm border border-slate-100 transition-all duration-300 relative overflow-hidden ${isOfflineMode ? 'opacity-50 grayscale cursor-not-allowed' : 'hover:shadow-xl hover:-translate-y-1 hover:border-emerald-100 cursor-pointer active:scale-[0.99]'}`}
             onClick={() => {
                 if (isOfflineMode) {
                     alert("AI Generation is not available in offline mode.");
                     return;
                 }
                 navigateToView('create');
             }}>
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
        
        <div className="group bg-white p-8 md:p-10 rounded-[2.5rem] shadow-sm border border-slate-100 transition-all duration-300 hover:shadow-xl hover:-translate-y-1 hover:border-amber-100 cursor-pointer relative overflow-hidden active:scale-[0.99] md:col-span-2 lg:col-span-1"
             onClick={() => navigateToView('quests')}>
          <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity transform group-hover:scale-110 duration-700">
              <Trophy size={140} />
          </div>
          
          <div className="h-16 w-16 bg-amber-50 text-amber-600 rounded-2xl flex items-center justify-center mb-6 shadow-inner group-hover:bg-amber-600 group-hover:text-white transition-colors duration-300">
            <Target size={32} />
          </div>
          <h2 className="text-3xl font-medium text-slate-800 mb-3">Quests & Challenges</h2>
          <p className="text-slate-500 leading-relaxed mb-8 text-lg">Complete daily challenges and long-term quests to earn extra points.</p>
          <div className="flex items-center text-amber-600 font-bold text-lg group-hover:translate-x-2 transition-transform">
              View Quests <ChevronRight size={20} />
          </div>
        </div>
      </div>
    </div>
  );
  };

  const handleResetCategory = async () => {
      if (!confirm(`Are you sure you want to reset all puzzles in the "${activeCategory}" category? This will clear your progress and reassign random difficulties.`)) return;

      const difficulties: ('easy' | 'normal' | 'hard' | 'expert')[] = ['easy', 'normal', 'hard', 'expert'];
      
      // Find puzzles in the active category
      const puzzlesToReset = galleryPuzzles.filter(p => {
          if (activeCategory === 'All') return true;
          if (activeCategory === 'Offline Ready') return p.isUserUpload || (p.src && p.src.startsWith('blob:')) || !!thumbnails[p.id];
          if (activeCategory === 'My Uploads') return p.isUserUpload;
          return p.category === activeCategory;
      });

      const idsToReset = new Set(puzzlesToReset.map(p => p.id));

      // 1. Remove from completed
      const newCompleted = new Set(completedPuzzleIds);
      idsToReset.forEach(id => newCompleted.delete(id));
      setCompletedPuzzleIds(newCompleted);
      localStorage.setItem('mosaic_completed_puzzles', JSON.stringify(Array.from(newCompleted)));

      // 2. Remove saved games
      idsToReset.forEach(id => {
          localStorage.removeItem(`mosaic_save_${id}`);
      });
      checkForSavedGames();

      // 3. Reassign random difficulty
      const updatedPuzzles = await Promise.all(galleryPuzzles.map(async p => {
          if (idsToReset.has(p.id)) {
              const randomDiff = difficulties[Math.floor(Math.random() * difficulties.length)];
              
              // Update in DB if it's a user upload or AI generated
              if (p.isUserUpload || p.isAi) {
                  try {
                      const { updatePuzzleDifficulty } = await import('./services/offlineStorage');
                      await updatePuzzleDifficulty(p.id, randomDiff);
                  } catch (e) {
                      console.error("Failed to update difficulty in DB", e);
                  }
              }
              
              return { ...p, difficulty: randomDiff };
          }
          return p;
      }));
      setGalleryPuzzles(updatedPuzzles);
  };

  const renderGallery = () => (
    <div className="flex flex-col h-[100dvh] bg-slate-50">
      <header className="flex-shrink-0 px-6 py-4 bg-white/80 backdrop-blur-md border-b border-slate-200 flex items-center justify-between sticky top-0 z-20">
        <div className="flex items-center gap-4">
          <button onClick={() => navigateToView('home')} className="p-2 hover:bg-slate-100 rounded-full text-slate-500 transition-colors">
            <ArrowLeft size={24} />
          </button>
          <h2 className="text-xl font-serif font-bold text-slate-800">Gallery</h2>
        </div>
        <div className="flex items-center gap-3">
             <button
                onClick={() => {
                    if (isNetworkOffline) {
                        alert("You are currently offline. Please check your internet connection.");
                        return;
                    }
                    setIsOfflineMode(!isOfflineMode);
                }}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl font-bold transition-colors text-sm border ${isNetworkOffline ? 'bg-rose-50 text-rose-600 border-rose-200 cursor-not-allowed' : (isOfflineMode ? 'bg-slate-800 text-white border-slate-800' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50')}`}
                title={isNetworkOffline ? "No Internet Connection" : (isOfflineMode ? "Disable Offline Mode" : "Enable Offline Mode")}
             >
                 {isNetworkOffline ? <WifiOff size={18} /> : (isOfflineMode ? <WifiOff size={18} /> : <Wifi size={18} />)}
                 <span className="hidden md:inline">{isNetworkOffline ? 'No Connection' : (isOfflineMode ? 'Offline Mode' : 'Online')}</span>
             </button>
             <button 
                onClick={handleResetCategory} 
                className="p-2 text-slate-400 hover:text-amber-600 transition-colors" 
                title={`Reset "${activeCategory}" Category Puzzles`}
             >
                 <RotateCcw size={18} />
             </button>
             <button 
                onClick={handleCheckDatabase} 
                className="p-2 text-slate-400 hover:text-indigo-600 transition-colors" 
                title="Repair Database & Recover Images"
             >
                 <Activity size={18} />
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
        <aside className="w-64 bg-white border-r border-slate-200 overflow-y-auto hidden md:block pb-32 custom-scrollbar">
           <div className="p-4 space-y-1">
               <button 
                 onClick={() => setActiveCategory('All')}
                 className={`w-full text-left px-4 py-3 rounded-xl font-medium transition-colors ${activeCategory === 'All' ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-50'}`}
               >
                   All Puzzles
               </button>
               <button 
                 onClick={() => setActiveCategory('Offline Ready')}
                 className={`w-full text-left px-4 py-3 rounded-xl font-medium transition-colors flex items-center gap-2 ${activeCategory === 'Offline Ready' ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-50'}`}
               >
                   <CloudDownload size={16} /> Offline Ready
               </button>
               <button 
                 onClick={() => setActiveCategory('My Uploads')}
                 className={`w-full text-left px-4 py-3 rounded-xl font-medium transition-colors flex items-center gap-2 ${activeCategory === 'My Uploads' ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-50'}`}
               >
                   <Upload size={16} /> My Uploads
               </button>
               
               <div className="my-2 border-t border-slate-100"></div>

               {categories.map(cat => (
                   <div key={cat} className="group relative">
                       <button 
                         onClick={() => setActiveCategory(cat)}
                         className={`w-full text-left px-4 py-3 rounded-xl font-medium transition-colors pr-10 ${activeCategory === cat ? 'bg-indigo-50 text-indigo-700' : 'text-slate-600 hover:bg-slate-50'}`}
                       >
                           {cat}
                       </button>
                       <button
                           onClick={(e) => handleDeleteCategory(e, cat)}
                           className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg opacity-0 group-hover:opacity-100 transition-all"
                           title="Delete Category"
                       >
                           <Trash2 size={14} />
                       </button>
                   </div>
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
                <button 
                    onClick={() => setActiveCategory('Offline Ready')}
                    className={`px-4 py-2 rounded-full text-sm font-bold border transition-colors flex items-center gap-1 ${activeCategory === 'Offline Ready' ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-600 border-slate-200'}`}
                >
                    <CloudDownload size={14} /> Offline
                </button>
                <button 
                    onClick={() => setActiveCategory('My Uploads')}
                    className={`px-4 py-2 rounded-full text-sm font-bold border transition-colors flex items-center gap-1 ${activeCategory === 'My Uploads' ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-600 border-slate-200'}`}
                >
                    <Upload size={14} /> Uploads
                </button>
                {categories.map(cat => (
                    <button 
                        key={cat}
                        onClick={() => setActiveCategory(cat)}
                        className={`px-4 py-2 rounded-full text-sm font-bold border transition-colors flex items-center gap-2 ${activeCategory === cat ? 'bg-indigo-600 text-white border-indigo-600' : 'bg-white text-slate-600 border-slate-200'}`}
                    >
                        {cat}
                        {activeCategory === cat && (
                            <span 
                                onClick={(e) => handleDeleteCategory(e, cat)}
                                className="p-1 bg-white/20 rounded-full hover:bg-white/40 transition-colors"
                                title="Delete Category"
                            >
                                <X size={12} />
                            </span>
                        )}
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
                    .filter(p => {
                        if (activeCategory === 'All') return true;
                        if (activeCategory === 'Offline Ready') return p.isUserUpload || (p.src && p.src.startsWith('blob:')) || !!thumbnails[p.id];
                        if (activeCategory === 'My Uploads') return p.isUserUpload;
                        return p.category === activeCategory;
                    })
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

                             {isAvailableLocally && !isCompleted && (
                                 <div className="absolute top-2 right-2 bg-white/90 text-indigo-600 p-1.5 rounded-full shadow-lg z-10" title="Available Offline">
                                     <CloudDownload size={12} strokeWidth={3} />
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

  const renderQuests = () => {
      const stats = userStats;
      const questProgress = stats.questProgress || {};
      const challengeProgress = stats.challengeProgress || {};

      const handleClaim = (id: string, isChallenge: boolean) => {
          const newStats = claimReward(id, isChallenge);
          setUserStats({ ...newStats });
      };

      const renderQuestItem = (def: import('./types').QuestDefinition, progress: import('./types').QuestProgress | undefined, isChallenge: boolean) => {
          const isCompleted = progress?.isCompleted || false;
          const isClaimed = progress?.isClaimed || false;
          const currentValue = progress?.currentValue || 0;
          const targetValue = def.targetValue;
          const percentage = Math.min(100, Math.max(0, (currentValue / targetValue) * 100));
          
          // Dynamic description for Category Explorer
          let description = def.description;
          if (def.id === 'q2' && stats.weeklyCategory) {
              description = `Complete ${targetValue} puzzles in the ${stats.weeklyCategory} category.`;
          } else if (def.id === 'c3' && stats.dailyCategory) {
              description = `Complete a puzzle in the ${stats.dailyCategory} category.`;
          }

          return (
              <div key={def.id} className={`bg-white rounded-2xl p-6 shadow-sm border ${isClaimed ? 'border-emerald-200 bg-emerald-50/30' : 'border-slate-100'} flex flex-col md:flex-row items-start md:items-center justify-between gap-4 transition-all hover:shadow-md`}>
                  <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                          <h3 className="text-lg font-bold text-slate-800">{def.title}</h3>
                          {isClaimed && <span className="bg-emerald-100 text-emerald-700 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider">Claimed</span>}
                      </div>
                      <p className="text-slate-500 text-sm mb-4">{description}</p>
                      
                      <div className="w-full bg-slate-100 rounded-full h-2.5 mb-1 overflow-hidden">
                          <div className={`h-2.5 rounded-full ${isCompleted ? 'bg-emerald-500' : 'bg-indigo-500'}`} style={{ width: `${percentage}%` }}></div>
                      </div>
                      <div className="flex justify-between text-xs font-medium text-slate-400">
                          <span>{currentValue} / {targetValue}</span>
                          <span>{Math.round(percentage)}%</span>
                      </div>
                  </div>
                  
                  <div className="flex items-center gap-4 w-full md:w-auto justify-between md:justify-end">
                      <div className="flex items-center gap-1 text-amber-500 font-bold bg-amber-50 px-3 py-1.5 rounded-lg">
                          <Gift size={16} />
                          <span>+{def.rewardPoints}</span>
                      </div>
                      
                      <button 
                          onClick={() => handleClaim(def.id, isChallenge)}
                          disabled={!isCompleted || isClaimed}
                          className={`px-6 py-2 rounded-xl font-bold transition-all ${isClaimed ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : isCompleted ? 'bg-emerald-500 text-white hover:bg-emerald-600 hover:shadow-lg hover:-translate-y-0.5' : 'bg-slate-100 text-slate-400 cursor-not-allowed'}`}
                      >
                          {isClaimed ? 'Claimed' : 'Claim'}
                      </button>
                  </div>
              </div>
          );
      };

      return (
        <div className="flex flex-col h-[100dvh] bg-slate-50">
          <header className="flex-shrink-0 px-6 py-4 bg-white/80 backdrop-blur-md border-b border-slate-200 flex items-center justify-between sticky top-0 z-20">
              <div className="flex items-center gap-4">
                <button onClick={() => navigateToView('home')} className="p-2 hover:bg-slate-100 rounded-full text-slate-500 transition-colors">
                  <ArrowLeft size={24} />
                </button>
                <h2 className="text-xl font-serif font-bold text-slate-800">Quests & Challenges</h2>
              </div>
              <div className="flex items-center gap-2 bg-indigo-50 px-4 py-2 rounded-xl text-indigo-700 font-bold">
                  <Trophy size={18} />
                  <span>{stats.totalPoints.toLocaleString()} pts</span>
              </div>
          </header>
          
          <main className="flex-1 overflow-y-auto p-4 md:p-8 pb-32 custom-scrollbar">
             <div className="max-w-4xl mx-auto space-y-12">
                 
                 <section>
                     <div className="flex items-center justify-between mb-6">
                         <div className="flex items-center gap-3">
                             <div className="bg-amber-100 text-amber-600 p-2 rounded-xl">
                                 <Flame size={24} />
                             </div>
                             <div>
                                 <h2 className="text-2xl font-bold text-slate-800">Daily Challenges</h2>
                                 <p className="text-slate-500 text-sm">Short-term goals to keep you sharp.</p>
                             </div>
                         </div>
                         {dailyTimeLeft && (
                             <div className="flex items-center gap-2 bg-slate-100 text-slate-600 px-3 py-1.5 rounded-lg text-sm font-medium">
                                 <Clock size={16} />
                                 <span>Resets in {dailyTimeLeft}</span>
                             </div>
                         )}
                     </div>
                     <div className="space-y-4">
                         {CHALLENGES.map(c => renderQuestItem(c, challengeProgress[c.id], true))}
                     </div>
                 </section>

                 <section>
                     <div className="flex items-center justify-between mb-6">
                         <div className="flex items-center gap-3">
                             <div className="bg-indigo-100 text-indigo-600 p-2 rounded-xl">
                                 <Target size={24} />
                             </div>
                             <div>
                                 <h2 className="text-2xl font-bold text-slate-800">Weekly Challenges</h2>
                                 <p className="text-slate-500 text-sm">Long-term achievements for dedicated puzzlers.</p>
                             </div>
                         </div>
                         {timeLeft && (
                             <div className="flex items-center gap-2 bg-slate-100 text-slate-600 px-3 py-1.5 rounded-lg text-sm font-medium">
                                 <Clock size={16} />
                                 <span>Resets in {timeLeft}</span>
                             </div>
                         )}
                     </div>
                     <div className="space-y-4">
                         {QUESTS.map(q => renderQuestItem(q, questProgress[q.id], false))}
                     </div>
                 </section>

             </div>
          </main>
        </div>
      );
  };

  const renderCreate = () => (
    <div className="flex flex-col h-[100dvh] bg-slate-50">
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
                                 
                                 <button
                                     onClick={(e) => { e.stopPropagation(); setSavingAiImage(img); setAiCategory(img.category || categories[0]); }}
                                     className="absolute top-2 left-2 bg-white/90 text-indigo-600 p-2 rounded-full shadow-sm opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-all hover:bg-indigo-50 z-10"
                                     title="Save to Category"
                                 >
                                     <Plus size={16} />
                                 </button>

                                 <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/80 to-transparent">
                                     <p className="text-white font-medium text-sm line-clamp-2">{img.title}</p>
                                     <div className="flex items-center gap-2 mt-2">
                                         <span className="text-[10px] bg-white/20 backdrop-blur-md text-white px-2 py-0.5 rounded-full">{img.category || 'AI Generated'}</span>
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

  if (isInitializing) {
      return (
          <div className="fixed inset-0 flex flex-col items-center justify-center bg-slate-50 z-50">
              <div className="animate-spin text-indigo-600 mb-4">
                  <RotateCw size={48} />
              </div>
              <h2 className="text-xl font-serif font-bold text-slate-800">Initializing Database...</h2>
              <p className="text-slate-500 mt-2">Checking for offline content</p>
          </div>
      );
  }

  return (
    <>
      {/* Background Ambience */}
      <div className="fixed inset-0 bg-slate-50 -z-20"></div>

      {currentView === 'home' && renderHome()}
      {currentView === 'gallery' && renderGallery()}
      {currentView === 'create' && renderCreate()}
      {currentView === 'quests' && renderQuests()}
      
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

      {/* Save AI Image Modal */}
      {savingAiImage && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in">
              <div className="bg-white rounded-3xl p-6 w-full max-w-md shadow-2xl">
                  <div className="flex justify-between items-center mb-6">
                      <h3 className="text-xl font-serif font-bold text-slate-800">Save to Category</h3>
                      <button onClick={() => setSavingAiImage(null)} className="p-2 hover:bg-slate-100 rounded-full text-slate-400">
                          <X size={20} />
                      </button>
                  </div>
                  
                  <div className="space-y-4">
                      <div>
                          <label className="block text-sm font-bold text-slate-500 uppercase tracking-wider mb-2">Select Category</label>
                          <select 
                              value={aiCategory}
                              onChange={(e) => setAiCategory(e.target.value)}
                              className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-slate-800 bg-slate-50 appearance-none cursor-pointer"
                          >
                              {categories.map(cat => (
                                  <option key={cat} value={cat}>{cat}</option>
                              ))}
                          </select>
                      </div>
                      
                      <button 
                          onClick={handleSaveAiImage}
                          className="w-full py-3 rounded-xl font-bold transition-colors bg-indigo-600 text-white hover:bg-indigo-700"
                      >
                          Save
                      </button>
                  </div>
              </div>
          </div>
      )}

      <DiagnosticsModal isOpen={showDiagnostics} onClose={() => setShowDiagnostics(false)} />

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