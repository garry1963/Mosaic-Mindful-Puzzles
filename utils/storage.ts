import { PuzzleConfig, GeneratedImage } from '../types';

const DB_NAME = 'MosaicPuzzlesV2';
const DB_VERSION = 1;
const STORE_PUZZLES = 'puzzles'; // Metadata + Thumbnail
const STORE_IMAGES = 'images';   // Full Resolution Images

export interface PuzzleRecord {
  id: string;
  title: string;
  category: string;
  difficulty: string;
  isUserUpload: boolean;
  isAi: boolean;
  thumbBlob: Blob;
  timestamp: number;
  [key: string]: any;
}

export interface ImageRecord {
  id: string;
  fullBlob: Blob;
}

let dbPromise: Promise<IDBDatabase> | null = null;

export const initDB = (): Promise<IDBDatabase> => {
  if (dbPromise) return dbPromise;

  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = () => {
        dbPromise = null;
        reject(request.error);
    };
    request.onsuccess = () => resolve(request.result);
    
    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_PUZZLES)) {
        db.createObjectStore(STORE_PUZZLES, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORE_IMAGES)) {
        db.createObjectStore(STORE_IMAGES, { keyPath: 'id' });
      }
    };
  });
  return dbPromise;
};

export const savePuzzleToDB = async (
    id: string, 
    fullBlob: Blob, 
    thumbBlob: Blob, 
    metadata: Partial<PuzzleRecord>
): Promise<void> => {
    const db = await initDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction([STORE_PUZZLES, STORE_IMAGES], 'readwrite');
        
        const puzzleStore = tx.objectStore(STORE_PUZZLES);
        const imageStore = tx.objectStore(STORE_IMAGES);

        const puzzleRecord: PuzzleRecord = {
            id,
            title: metadata.title || 'Untitled',
            category: metadata.category || 'My Uploads',
            difficulty: metadata.difficulty || 'normal',
            isUserUpload: !!metadata.isUserUpload,
            isAi: !!metadata.isAi,
            thumbBlob,
            timestamp: Date.now(),
            ...metadata
        };

        const imageRecord: ImageRecord = {
            id,
            fullBlob
        };

        puzzleStore.put(puzzleRecord);
        imageStore.put(imageRecord);

        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
    });
};

export const loadAllPuzzlesFromDB = async (): Promise<PuzzleRecord[]> => {
    const db = await initDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_PUZZLES, 'readonly');
        const store = tx.objectStore(STORE_PUZZLES);
        const request = store.getAll();
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
};

export const updatePuzzleMetadataInDB = async (id: string, updates: Partial<PuzzleRecord>): Promise<void> => {
    const db = await initDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_PUZZLES, 'readwrite');
        const store = tx.objectStore(STORE_PUZZLES);
        const getRequest = store.get(id);
        
        getRequest.onsuccess = () => {
            const record = getRequest.result as PuzzleRecord;
            if (record) {
                const updatedRecord = { ...record, ...updates };
                const putRequest = store.put(updatedRecord);
                putRequest.onsuccess = () => resolve();
                putRequest.onerror = () => reject(putRequest.error);
            } else {
                resolve(); // Record not found, ignore
            }
        };
        getRequest.onerror = () => reject(getRequest.error);
    });
};

export const getFullImageFromDB = async (id: string): Promise<Blob | null> => {
    const db = await initDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_IMAGES, 'readonly');
        const store = tx.objectStore(STORE_IMAGES);
        const request = store.get(id);
        request.onsuccess = () => {
            const result = request.result as ImageRecord;
            resolve(result ? result.fullBlob : null);
        };
        request.onerror = () => reject(request.error);
    });
};

export const deletePuzzleFromDB = async (id: string): Promise<void> => {
    const db = await initDB();
    return new Promise((resolve, reject) => {
        const tx = db.transaction([STORE_PUZZLES, STORE_IMAGES], 'readwrite');
        tx.objectStore(STORE_PUZZLES).delete(id);
        tx.objectStore(STORE_IMAGES).delete(id);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
    });
};

// Migration from old DB (MosaicDB)
export const migrateLegacyData = async (): Promise<void> => {
    // Check if we already migrated
    if (localStorage.getItem('mosaic_db_migrated')) return;

    try {
        const request = indexedDB.open('MosaicDB');
        
        request.onerror = () => {
            // Old DB doesn't exist or error, skip
            localStorage.setItem('mosaic_db_migrated', 'true');
        };

        request.onsuccess = async () => {
            const oldDb = request.result;
            if (!oldDb.objectStoreNames.contains('images') || !oldDb.objectStoreNames.contains('metadata')) {
                oldDb.close();
                localStorage.setItem('mosaic_db_migrated', 'true');
                return;
            }

            const tx = oldDb.transaction(['images', 'metadata'], 'readonly');
            const imageStore = tx.objectStore('images');
            const metaStore = tx.objectStore('metadata');
            
            const getAllImagesRequest = imageStore.getAll();
            const getAllMetaRequest = metaStore.getAll();

            // Wait for both requests
            await new Promise((resolve, reject) => {
                let completed = 0;
                const check = () => {
                    completed++;
                    if (completed === 2) resolve(null);
                };
                getAllImagesRequest.onsuccess = check;
                getAllMetaRequest.onsuccess = check;
                getAllImagesRequest.onerror = () => resolve(null); // Continue even if error
                getAllMetaRequest.onerror = () => resolve(null);
            });

            const images = getAllImagesRequest.result || [];
            const meta = getAllMetaRequest.result || [];
            
            // Map metadata by ID
            const metaMap = new Map();
            meta.forEach((m: any) => metaMap.set(m.id, m));

            if (images.length > 0) {
                console.log(`Migrating ${images.length} records from legacy DB...`);
                for (const record of images) {
                    try {
                        const m = metaMap.get(record.id) || {};
                        const isUpload = record.id.startsWith('upload-');
                        const isAi = record.id.startsWith('gen-');
                        
                        if (isUpload || isAi) {
                            await savePuzzleToDB(
                                record.id,
                                record.fullBlob,
                                record.thumbBlob,
                                {
                                    title: m.title || (isAi ? 'Generated Image' : 'Untitled Upload'),
                                    category: m.category || (isAi ? 'AI Generated' : 'My Uploads'),
                                    difficulty: m.difficulty || 'normal',
                                    isUserUpload: isUpload,
                                    isAi: isAi,
                                    timestamp: record.timestamp || Date.now()
                                }
                            );
                        }
                    } catch (e) {
                        console.error("Failed to migrate record", record.id, e);
                    }
                }
            }
            
            oldDb.close();
            localStorage.setItem('mosaic_db_migrated', 'true');
        };
    } catch (e) {
        console.error("Migration failed", e);
        localStorage.setItem('mosaic_db_migrated', 'true'); // Prevent infinite retry
    }
};

const blobToBase64 = (blob: Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
};

export const exportDatabase = async (): Promise<string> => {
    const puzzles = await loadAllPuzzlesFromDB();
    const exportData: any[] = [];
    
    for (const puzzle of puzzles) {
        const fullBlob = await getFullImageFromDB(puzzle.id);
        if (!fullBlob) continue;
        
        const thumbBase64 = await blobToBase64(puzzle.thumbBlob);
        const fullBase64 = await blobToBase64(fullBlob);
        
        exportData.push({
            id: puzzle.id,
            title: puzzle.title,
            category: puzzle.category,
            difficulty: puzzle.difficulty,
            isUserUpload: puzzle.isUserUpload,
            isAi: puzzle.isAi,
            timestamp: puzzle.timestamp,
            thumbBase64,
            fullBase64
        });
    }
    
    return JSON.stringify(exportData);
};

export const importDatabase = async (jsonData: string): Promise<void> => {
    const data = JSON.parse(jsonData);
    if (!Array.isArray(data)) throw new Error("Invalid backup format");
    
    for (const item of data) {
        if (!item.id || !item.thumbBase64 || !item.fullBase64) continue;
        
        const thumbRes = await fetch(item.thumbBase64);
        const thumbBlob = await thumbRes.blob();
        
        const fullRes = await fetch(item.fullBase64);
        const fullBlob = await fullRes.blob();
        
        await savePuzzleToDB(item.id, fullBlob, thumbBlob, {
            title: item.title,
            category: item.category,
            difficulty: item.difficulty,
            isUserUpload: item.isUserUpload,
            isAi: item.isAi,
            timestamp: item.timestamp
        });
    }
};
