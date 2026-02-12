import { PuzzleConfig, GeneratedImage } from "../types";
import { getImageFromDB, saveImageToDB } from "../utils/db";

// Helper to generate a thumbnail blob from a source blob
const generateThumbnail = (sourceBlob: Blob, size: number = 300): Promise<Blob> => {
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

// The "Scraper" Function
// Checks DB first, if missing, fetches from web, generates thumbnail, saves to DB.
export const syncPuzzleImage = async (puzzle: PuzzleConfig): Promise<{ thumbUrl: string; isLocal: boolean }> => {
    try {
        // 1. Check Local DB
        const record = await getImageFromDB(puzzle.id);
        if (record) {
            return { 
                thumbUrl: URL.createObjectURL(record.thumbBlob), 
                isLocal: true 
            };
        }

        // 2. Scrape (Fetch) from Web
        // Note: This relies on the image source allowing CORS. 
        // Picsum and LoremFlickr generally allow this.
        const response = await fetch(puzzle.src, { mode: 'cors' });
        if (!response.ok) throw new Error('Network response was not ok');
        
        const fullBlob = await response.blob();
        
        // 3. Generate Thumbnail
        const thumbBlob = await generateThumbnail(fullBlob);
        
        // 4. Store in Database
        await saveImageToDB(puzzle.id, fullBlob, thumbBlob);
        
        return { 
            thumbUrl: URL.createObjectURL(thumbBlob), 
            isLocal: true 
        };

    } catch (error) {
        // console.warn(`Could not sync image for ${puzzle.id}`, error);
        // Fallback to original URL if scraping fails (e.g. offline and not cached)
        return { thumbUrl: puzzle.src, isLocal: false };
    }
};

export const getFullQualityImage = async (puzzleId: string, fallbackSrc: string): Promise<string> => {
    const record = await getImageFromDB(puzzleId);
    if (record) {
        return URL.createObjectURL(record.fullBlob);
    }
    return fallbackSrc;
};

// --- Generated Puzzle Storage ---

export const saveGeneratedPuzzle = async (id: string, base64Data: string): Promise<string> => {
    const response = await fetch(base64Data);
    const blob = await response.blob();
    // Save to IndexedDB (using same blob for full and thumb to ensure quality)
    await saveImageToDB(id, blob, blob);
    return URL.createObjectURL(blob);
};

export const loadSavedGeneratedPuzzles = async (): Promise<GeneratedImage[]> => {
    try {
        // 1. Check for Legacy Data (Base64 in LocalStorage) to migrate
        const legacyData = localStorage.getItem('mosaic_generated_images');
        if (legacyData) {
            try {
                const legacyImages: GeneratedImage[] = JSON.parse(legacyData);
                const migratedImages: GeneratedImage[] = [];

                // Migrate each image to IndexedDB
                for (const img of legacyImages) {
                    // Only migrate if it looks like a base64 string
                    if (img.src && img.src.startsWith('data:')) {
                        const objectUrl = await saveGeneratedPuzzle(img.id, img.src);
                        migratedImages.push({ ...img, src: objectUrl });
                    }
                }
                
                // Save clean metadata
                const metadata = migratedImages.map(({ src, ...rest }) => rest);
                localStorage.setItem('mosaic_generated_metadata', JSON.stringify(metadata));
                
                // Remove legacy key
                localStorage.removeItem('mosaic_generated_images');
                
                return migratedImages;
            } catch (e) {
                console.error("Migration failed, clearing legacy data", e);
                localStorage.removeItem('mosaic_generated_images');
            }
        }

        // 2. Normal Load (Metadata + IndexedDB)
        const metaStr = localStorage.getItem('mosaic_generated_metadata');
        if (!metaStr) return [];

        const metadata: Omit<GeneratedImage, 'src'>[] = JSON.parse(metaStr);
        const results: GeneratedImage[] = [];

        for (const m of metadata) {
             const record = await getImageFromDB(m.id);
             if (record) {
                 results.push({ ...m, src: URL.createObjectURL(record.fullBlob) });
             }
        }
        
        return results;

    } catch (error) {
        console.error("Failed to load generated puzzles", error);
        return [];
    }
};

export const persistGeneratedMetadata = (images: GeneratedImage[]) => {
    try {
        // Only save metadata, not the Object URL src
        const metadata = images.map(({ src, ...rest }) => rest);
        localStorage.setItem('mosaic_generated_metadata', JSON.stringify(metadata));
    } catch (e) {
        console.error("Failed to save metadata", e);
    }
};