import { PuzzleConfig, GeneratedImage } from "../types";
import { 
    savePuzzleToDB, 
    loadAllPuzzlesFromDB, 
    getFullImageFromDB, 
    deletePuzzleFromDB,
    migrateLegacyData,
    PuzzleRecord
} from "../utils/storage";

// Helper to generate a thumbnail blob from a source blob
export const generateThumbnail = (sourceBlob: Blob, size: number = 300): Promise<Blob> => {
    return new Promise((resolve) => {
        const img = new Image();
        const url = URL.createObjectURL(sourceBlob);
        
        img.onload = () => {
            URL.revokeObjectURL(url);
            const canvas = document.createElement('canvas');
            let w = img.width;
            let h = img.height;
            
            // Calculate aspect ratio fit
            const scale = size / Math.max(w, h);
            w = w * scale;
            h = h * scale;

            canvas.width = w;
            canvas.height = h;
            const ctx = canvas.getContext('2d');
            if (ctx) {
                ctx.drawImage(img, 0, 0, w, h);
                // Compress thumbnail to JPEG 70%
                canvas.toBlob((blob) => resolve(blob || sourceBlob), 'image/jpeg', 0.7);
            } else {
                resolve(sourceBlob);
            }
        };
        img.onerror = () => resolve(sourceBlob);
        img.src = url;
    });
};

// Batch check for existing images
export const checkImagesExistInDB = async (ids: string[]): Promise<Set<string>> => {
    const allPuzzles = await loadAllPuzzlesFromDB();
    const existingIds = new Set(allPuzzles.map(p => p.id));
    const result = new Set<string>();
    ids.forEach(id => {
        if (existingIds.has(id)) result.add(id);
    });
    return result;
};

// The "Scraper" Function
// Checks DB first, if missing, fetches from web, generates thumbnail, saves to DB.
export const syncPuzzleImage = async (puzzle: PuzzleConfig, forceOffline: boolean = false): Promise<{ thumbUrl: string; isLocal: boolean }> => {
    try {
        // 1. Check Local DB
        const localBlob = await getFullImageFromDB(puzzle.id);
        
        if (localBlob) {
             // We need a thumbnail. 
             const all = await loadAllPuzzlesFromDB();
             const record = all.find(p => p.id === puzzle.id);
             if (record && record.thumbBlob) {
                 return { 
                     thumbUrl: URL.createObjectURL(record.thumbBlob), 
                     isLocal: true 
                 };
             }
             // If we have fullBlob but no record (shouldn't happen), generate thumb
             const thumbBlob = await generateThumbnail(localBlob);
             return {
                 thumbUrl: URL.createObjectURL(thumbBlob),
                 isLocal: true
             };
        }

        // 2. Scrape (Fetch) from Web
        if (!navigator.onLine || forceOffline) {
             return { thumbUrl: puzzle.src, isLocal: false };
        }

        const response = await fetch(puzzle.src, { mode: 'cors' });
        if (!response.ok) throw new Error('Network response was not ok');
        
        const fetchedBlob = await response.blob();
        
        // 3. Generate Thumbnail
        const thumbBlob = await generateThumbnail(fetchedBlob);
        
        // 4. Store in Database
        await savePuzzleToDB(puzzle.id, fetchedBlob, thumbBlob, {
            title: puzzle.title,
            category: puzzle.category,
            difficulty: puzzle.difficulty,
            isUserUpload: false,
            isAi: false
        });
        
        return { 
            thumbUrl: URL.createObjectURL(thumbBlob), 
            isLocal: true 
        };

    } catch (error) {
        return { thumbUrl: puzzle.src, isLocal: false };
    }
};

export const getFullQualityImage = async (puzzleId: string, fallbackSrc: string): Promise<string> => {
    const blob = await getFullImageFromDB(puzzleId);
    if (blob) {
        return URL.createObjectURL(blob);
    }
    return fallbackSrc;
};

// --- Generated Puzzle Storage ---

export const saveGeneratedPuzzle = async (id: string, base64Data: string, metadata?: any): Promise<string> => {
    const response = await fetch(base64Data);
    const blob = await response.blob();
    // Save to IndexedDB (using same blob for full and thumb to ensure quality)
    await savePuzzleToDB(id, blob, blob, {
        ...metadata,
        isAi: true,
        title: metadata?.prompt || 'Generated Image'
    });
    return URL.createObjectURL(blob);
};

export const loadSavedGeneratedPuzzles = async (): Promise<GeneratedImage[]> => {
    try {
        const all = await loadAllPuzzlesFromDB();
        return all.filter(p => p.isAi).map(p => ({
            ...p,
            id: p.id,
            title: p.title,
            isAi: true,
            src: URL.createObjectURL(p.thumbBlob)
        } as GeneratedImage));
    } catch (error) {
        console.error("Failed to load generated puzzles", error);
        return [];
    }
};

export const deleteGeneratedPuzzle = async (id: string): Promise<void> => {
    await deletePuzzleFromDB(id);
};

export const persistGeneratedMetadata = (images: GeneratedImage[]) => {
    // No-op: Metadata is persisted in DB on save
};

// --- User Uploaded Puzzle Storage ---

export const saveUserUploadedPuzzle = async (file: File, title: string, category: string): Promise<PuzzleConfig> => {
    const id = `upload-${Date.now()}`;
    const thumbBlob = await generateThumbnail(file);
    
    const puzzleConfig: PuzzleConfig = {
        id,
        src: '', // Placeholder, will be replaced by blob URL on load
        title,
        category,
        difficulty: 'normal',
        isUserUpload: true
    };
    
    await savePuzzleToDB(id, file, thumbBlob, puzzleConfig);
    
    return {
        ...puzzleConfig,
        src: URL.createObjectURL(thumbBlob) // Return valid URL for immediate UI update
    };
};

export const loadUserUploadedPuzzles = async (): Promise<PuzzleConfig[]> => {
    try {
        // Trigger migration once
        await migrateLegacyData();

        const all = await loadAllPuzzlesFromDB();
        return all.filter(p => p.isUserUpload).map(p => ({
            ...p,
            id: p.id,
            title: p.title,
            category: p.category,
            difficulty: p.difficulty as any,
            isUserUpload: true,
            src: URL.createObjectURL(p.thumbBlob)
        } as PuzzleConfig));
    } catch (e) {
        console.error("Failed to load user uploads", e);
        return [];
    }
};

export const deleteUserUploadedPuzzle = async (id: string): Promise<void> => {
    await deletePuzzleFromDB(id);
};
