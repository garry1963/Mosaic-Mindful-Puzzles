import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Activity, CheckCircle, AlertTriangle, Play, Trash2 } from 'lucide-react';
import { 
    saveUserUploadedPuzzle, 
    loadUserUploadedPuzzles, 
    deleteUserUploadedPuzzle, 
    getFullQualityImage 
} from '../services/offlineStorage';

interface LogEntry {
    time: string;
    message: string;
    type: 'info' | 'success' | 'error';
}

interface DiagnosticsModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export const DiagnosticsModal: React.FC<DiagnosticsModalProps> = ({ isOpen, onClose }) => {
    const [logs, setLogs] = useState<LogEntry[]>([]);
    const [isRunning, setIsRunning] = useState(false);
    const [progress, setProgress] = useState(0);

    const addLog = (message: string, type: 'info' | 'success' | 'error' = 'info') => {
        setLogs(prev => [...prev, {
            time: new Date().toLocaleTimeString(),
            message,
            type
        }]);
    };

    const runTest = async () => {
        setIsRunning(true);
        setLogs([]);
        setProgress(0);
        addLog("Starting Storage System Diagnostics...", 'info');

        try {
            // Step 1: Create Dummy Data
            addLog("Step 1: Creating 1MB Dummy File...", 'info');
            const size = 1024 * 1024; 
            const buffer = new Uint8Array(size);
            for(let i=0; i<size; i++) buffer[i] = i % 256;
            const file = new File([buffer], "test_image.png", { type: 'image/png' });
            setProgress(10);
            addLog("Dummy file created successfully.", 'success');

            // Step 2: Write Test
            addLog("Step 2: Writing 5 test records to IndexedDB...", 'info');
            const count = 5;
            const createdIds: string[] = [];
            const startWrite = performance.now();
            
            for(let i=0; i<count; i++) {
                const result = await saveUserUploadedPuzzle(file, `Test Puzzle ${i}`, 'diagnostics');
                createdIds.push(result.id);
                setProgress(10 + ((i+1)/count * 30)); // 10 -> 40
            }
            const endWrite = performance.now();
            addLog(`Write complete: 5 files in ${((endWrite - startWrite)/1000).toFixed(2)}s`, 'success');

            // Step 3: Read Metadata
            addLog("Step 3: Verifying metadata persistence...", 'info');
            const startRead = performance.now();
            const uploads = await loadUserUploadedPuzzles();
            const testUploads = uploads.filter(u => u.category === 'diagnostics');
            const endRead = performance.now();
            
            if (testUploads.length < count) {
                throw new Error(`Metadata mismatch! Expected at least ${count}, found ${testUploads.length}`);
            }
            setProgress(60);
            addLog(`Read complete: Found ${testUploads.length} records in ${((endRead - startRead)/1000).toFixed(2)}s`, 'success');

            // Step 4: Read Full Blob
            addLog("Step 4: Retrieving full-quality image blob...", 'info');
            const targetId = createdIds[0];
            const startBlob = performance.now();
            // Note: getFullQualityImage returns a URL string (blob:...)
            const blobUrl = await getFullQualityImage(targetId, '');
            
            if (!blobUrl) throw new Error("Failed to get blob URL");
            
            // Fetch the blob from the URL to check size
            const blobResp = await fetch(blobUrl);
            const retrievedBlob = await blobResp.blob();
            const endBlob = performance.now();

            if (retrievedBlob.size !== size) {
                throw new Error(`Blob corruption! Expected ${size} bytes, got ${retrievedBlob.size}`);
            }
            setProgress(80);
            addLog(`Blob retrieval successful: 1MB verified in ${((endBlob - startBlob)/1000).toFixed(2)}s`, 'success');

            // Step 5: Cleanup
            addLog("Step 5: Cleaning up test data...", 'info');
            for(const id of createdIds) {
                await deleteUserUploadedPuzzle(id);
            }
            setProgress(100);
            addLog("Cleanup complete. System is healthy.", 'success');

        } catch (error: any) {
            addLog(`TEST FAILED: ${error.message}`, 'error');
            console.error(error);
        } finally {
            setIsRunning(false);
        }
    };

    if (!isOpen) return null;

    return (
        <AnimatePresence>
            <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
            >
                <motion.div 
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[80vh]"
                >
                    <div className="p-6 border-b border-zinc-800 flex justify-between items-center bg-zinc-950">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-indigo-500/10 rounded-lg">
                                <Activity className="w-5 h-5 text-indigo-400" />
                            </div>
                            <div>
                                <h2 className="text-lg font-semibold text-white">System Diagnostics</h2>
                                <p className="text-xs text-zinc-400">Storage & Database Integrity Check</p>
                            </div>
                        </div>
                        <button onClick={onClose} className="p-2 hover:bg-zinc-800 rounded-full transition-colors">
                            <X className="w-5 h-5 text-zinc-400" />
                        </button>
                    </div>

                    <div className="flex-1 overflow-auto p-6 space-y-4 bg-zinc-900/50">
                        {logs.length === 0 && !isRunning && (
                            <div className="text-center py-12 text-zinc-500">
                                <Activity className="w-12 h-12 mx-auto mb-4 opacity-20" />
                                <p>Ready to run diagnostics.</p>
                                <p className="text-sm opacity-60">This will create, verify, and delete test data.</p>
                            </div>
                        )}

                        <div className="space-y-2 font-mono text-sm">
                            {logs.map((log, i) => (
                                <div key={i} className={`flex gap-3 ${
                                    log.type === 'error' ? 'text-red-400' : 
                                    log.type === 'success' ? 'text-emerald-400' : 'text-zinc-300'
                                }`}>
                                    <span className="text-zinc-600 shrink-0">[{log.time}]</span>
                                    <span>{log.message}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="p-6 border-t border-zinc-800 bg-zinc-950 flex justify-between items-center">
                        <div className="flex-1 mr-6">
                            {isRunning && (
                                <div className="h-2 bg-zinc-800 rounded-full overflow-hidden">
                                    <motion.div 
                                        className="h-full bg-indigo-500"
                                        initial={{ width: 0 }}
                                        animate={{ width: `${progress}%` }}
                                    />
                                </div>
                            )}
                        </div>
                        <button 
                            onClick={runTest}
                            disabled={isRunning}
                            className={`px-6 py-2 rounded-xl font-medium flex items-center gap-2 transition-all ${
                                isRunning 
                                ? 'bg-zinc-800 text-zinc-500 cursor-not-allowed' 
                                : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-lg shadow-indigo-500/20'
                            }`}
                        >
                            {isRunning ? (
                                <>
                                    <Activity className="w-4 h-4 animate-spin" />
                                    Running...
                                </>
                            ) : (
                                <>
                                    <Play className="w-4 h-4" />
                                    Run Test
                                </>
                            )}
                        </button>
                    </div>
                </motion.div>
            </motion.div>
        </AnimatePresence>
    );
};
