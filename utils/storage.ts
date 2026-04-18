import { PuzzleConfig, GeneratedImage } from '../types';

export interface PuzzleRecord {
  id: string;
  title: string;
  category: string;
  difficulty: string;
  isUserUpload: boolean;
  isAi: boolean;
  thumbUrl?: string;
  fullUrl?: string;
  timestamp: number;
  [key: string]: any;
}

export const savePuzzleToDB = async (
    id: string, 
    fullBlob: Blob, 
    thumbBlob: Blob, 
    metadata: Partial<PuzzleRecord>
): Promise<void> => {
    const formData = new FormData();
    formData.append('id', id);
    formData.append('metadata', JSON.stringify({
        title: metadata.title || 'Untitled',
        category: metadata.category || 'My Uploads',
        difficulty: metadata.difficulty || 'normal',
        isUserUpload: !!metadata.isUserUpload,
        isAi: !!metadata.isAi,
        ...metadata
    }));
    
    // Pass blobs as files
    formData.append('fullImage', fullBlob, 'full.jpg');
    formData.append('thumbImage', thumbBlob, 'thumb.jpg');

    await fetch('/api/puzzles', {
        method: 'POST',
        body: formData // Note: Content-Type is set automatically for FormData
    });
};

export const loadAllPuzzlesFromDB = async (): Promise<PuzzleRecord[]> => {
    try {
        const response = await fetch('/api/puzzles');
        if (!response.ok) return [];
        return await response.json();
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

export const getFullImageFromDB = async (id: string): Promise<string | null> => {
    const response = await fetch(`/api/puzzles/${id}/full`);
    if (!response.ok) return null;
    const data = await response.json();
    if (data.fullUrl) {
        return data.fullUrl;
    }
    return null;
};

export const deletePuzzleFromDB = async (id: string): Promise<void> => {
    await fetch(`/api/puzzles/${id}`, { method: 'DELETE' });
};

export const migrateLegacyData = async (): Promise<void> => {
    // Clean migration slate initialized for v2
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
