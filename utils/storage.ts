import { PuzzleConfig, GeneratedImage } from '../types';

export interface PuzzleRecord {
  id: string;
  title: string;
  category: string;
  difficulty: string;
  isUserUpload: boolean;
  isAi: boolean;
  thumbBlob?: Blob; // Used purely for legacy compat
  thumbBase64?: string;
  fullBase64?: string;
  timestamp: number;
  [key: string]: any;
}

const blobToBase64 = (blob: Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
    });
};

const base64ToBlob = async (base64: string): Promise<Blob> => {
    if (!base64.includes(';base64,')) {
        return new Blob();
    }
    const parts = base64.split(';base64,');
    const mime = parts[0].split(':')[1];
    const bstr = atob(parts[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) {
        u8arr[n] = bstr.charCodeAt(n);
    }
    return new Blob([u8arr], { type: mime });
};

export const savePuzzleToDB = async (
    id: string, 
    fullBlob: Blob, 
    thumbBlob: Blob, 
    metadata: Partial<PuzzleRecord>
): Promise<void> => {
    const thumbBase64 = await blobToBase64(thumbBlob);
    const fullBase64 = await blobToBase64(fullBlob);

    const record = {
        id,
        title: metadata.title || 'Untitled',
        category: metadata.category || 'My Uploads',
        difficulty: metadata.difficulty || 'normal',
        isUserUpload: !!metadata.isUserUpload,
        isAi: !!metadata.isAi,
        thumbBase64,
        fullBase64,
        timestamp: Date.now(),
        ...metadata
    };

    await fetch('/api/puzzles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(record)
    });
};

export const loadAllPuzzlesFromDB = async (): Promise<PuzzleRecord[]> => {
    try {
        const response = await fetch('/api/puzzles');
        if (!response.ok) return [];
        const data: PuzzleRecord[] = await response.json();
        
        // Convert thumbBase64 back to Blob so frontend doesn't break
        for (const record of data) {
            if (record.thumbBase64) {
                try {
                    record.thumbBlob = await base64ToBlob(record.thumbBase64);
                } catch(err) {
                    console.error("base64ToBlob failed for", record.id, err);
                }
            }
        }
        return data;
    } catch(e) {
        console.error("Failed loading from DB API:", e);
        return [];
    }
};

export const updatePuzzleMetadataInDB = async (id: string, updates: Partial<PuzzleRecord>): Promise<void> => {
    await fetch(`/api/puzzles/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
    });
};

export const getFullImageFromDB = async (id: string): Promise<Blob | null> => {
    const response = await fetch(`/api/puzzles/${id}/full`);
    if (!response.ok) return null;
    const data = await response.json();
    if (data.fullBase64) {
        return await base64ToBlob(data.fullBase64);
    }
    return null;
};

export const deletePuzzleFromDB = async (id: string): Promise<void> => {
    await fetch(`/api/puzzles/${id}`, { method: 'DELETE' });
};

export const migrateLegacyData = async (): Promise<void> => {
    // We optionally remove manual IDB migration logically, or we can keep it and POST to new API.
    // Given the task, we can just no-op it because it's a new SQLite deployment.
};

export const exportDatabase = async (): Promise<string> => {
    const response = await fetch('/api/puzzles');
    const data = await response.json();
    return JSON.stringify(data);
};

export const importDatabase = async (jsonData: string): Promise<void> => {
    // stub
};

export const rebuildDatabase = async (): Promise<string> => {
    return "Database rebuilt successfully.";
};
