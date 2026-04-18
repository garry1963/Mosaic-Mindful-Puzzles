import "reflect-metadata";
import express from "express";
import { DataSource, Entity, PrimaryColumn, Column } from "typeorm";
import { createServer as createViteServer } from "vite";
import path from "path";
import fs from "fs";
import multer from "multer";

// Setup uploads directory for files
const UPLOADS_DIR = path.join(process.cwd(), "uploads");
if (!fs.existsSync(UPLOADS_DIR)) {
    fs.mkdirSync(UPLOADS_DIR, { recursive: true });
}

// Multer storage configuration
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, UPLOADS_DIR),
    filename: (req, file, cb) => {
        // Append a timestamp and random suffix to the file
        const ext = path.extname(file.originalname) || '';
        cb(null, `${Date.now()}-${Math.round(Math.random() * 1E9)}${ext}`);
    }
});
const upload = multer({ storage });

// -----------------------------------------------------
// 1. Updated TypeORM Entity (No Base64!)
// -----------------------------------------------------
@Entity("puzzle_records_v2") // Using new table to bypass old corrupt schema
export class PuzzleRecord {
    @PrimaryColumn("text")
    id!: string;

    @Column("text")
    title!: string;

    @Column("text", { nullable: true })
    category!: string;

    @Column("text")
    difficulty!: string;

    @Column("boolean")
    isUserUpload!: boolean;

    @Column("boolean")
    isAi!: boolean;

    @Column("text", { nullable: true })
    thumbFilename!: string | null;
    
    @Column("text", { nullable: true })
    fullFilename!: string | null;

    @Column("integer")
    timestamp!: number;
}

// -----------------------------------------------------
// 2. Initialize DataSource
// -----------------------------------------------------
const AppDataSource = new DataSource({
    type: "sqlite",
    database: "database.sqlite",
    synchronize: true, // Auto schema sync
    logging: false,
    entities: [PuzzleRecord],
});

async function startServer() {
    await AppDataSource.initialize();
    const puzzleDao = AppDataSource.getRepository(PuzzleRecord);

    const app = express();
    app.use(express.json({ limit: "50mb" }));
    app.use(express.urlencoded({ limit: "50mb", extended: true }));

    // Serve uploaded images directly as static files
    app.use("/uploads", express.static(UPLOADS_DIR));

    const PORT = 3000;

    // --- API Routes ---
    
    app.get("/api/puzzles", async (req, res) => {
        const puzzles = await puzzleDao.find({
            select: ["id", "title", "category", "difficulty", "isUserUpload", "isAi", "thumbFilename", "timestamp"],
            order: { timestamp: "DESC" }
        });
        
        // Map filename to full URL for frontend use
        const mapped = puzzles.map(p => ({
            ...p,
            thumbUrl: p.thumbFilename ? `/uploads/${p.thumbFilename}` : undefined
        }));
        res.json(mapped);
    });

    app.get("/api/puzzles/:id/full", async (req, res) => {
        const puzzle = await puzzleDao.findOne({
            where: { id: req.params.id },
            select: ["fullFilename"]
        });
        if (puzzle && puzzle.fullFilename) {
            res.json({ fullUrl: `/uploads/${puzzle.fullFilename}` });
        } else {
            res.status(404).json({ error: "Not found" });
        }
    });

    // Accept multipart form data uploads
    app.post("/api/puzzles", upload.fields([{ name: 'fullImage' }, { name: 'thumbImage' }]), async (req, res) => {
        try {
            console.log("POST /api/puzzles - Received request");
            console.log("Body:", req.body);
            console.log("Files keys:", Object.keys(req.files || {}));
            
            const metadata = JSON.parse(req.body.metadata || '{}');
            const files = (req.files || {}) as { [fieldname: string]: Express.Multer.File[] };
            
            const thumbFile = files['thumbImage']?.[0];
            const fullFile = files['fullImage']?.[0];

            let puzzle = await puzzleDao.findOne({ where: { id: req.body.id } });
            
            if (!puzzle) {
                console.log("Creating new puzzle record for ID:", req.body.id);
                puzzle = puzzleDao.create({
                    id: req.body.id,
                    title: metadata.title || 'Untitled',
                    category: metadata.category || 'My Uploads',
                    difficulty: metadata.difficulty || 'normal',
                    isUserUpload: !!metadata.isUserUpload,
                    isAi: !!metadata.isAi,
                    thumbFilename: thumbFile ? thumbFile.filename : null,
                    fullFilename: fullFile ? fullFile.filename : null,
                    timestamp: Date.now(),
                    ...metadata
                });
            } else {
                console.log("Updating existing puzzle record for ID:", req.body.id);
                // Update existing record
                puzzleDao.merge(puzzle, metadata);
                if (thumbFile) puzzle.thumbFilename = thumbFile.filename;
                if (fullFile) puzzle.fullFilename = fullFile.filename;
                puzzle.timestamp = Date.now();
            }

            await puzzleDao.save(puzzle);
            console.log("Saved successfully!");
            res.json({ success: true, puzzle });
        } catch (e: any) {
            console.error("ERROR IN POST /api/puzzles:", e);
            res.status(500).json({ error: e.message, stack: e.stack });
        }
    });

    app.patch("/api/puzzles/:id", async (req, res) => {
        try {
            const data = req.body;
            await puzzleDao.update(req.params.id, data);
            res.json({ success: true });
        } catch(e: any) {
            res.status(500).json({ error: e.message });
        }
    });

    app.delete("/api/puzzles/:id", async (req, res) => {
        const puzzle = await puzzleDao.findOne({ where: { id: req.params.id } });
        if (puzzle) {
            // Delete files physically to free up disk space
            if (puzzle.thumbFilename) fs.unlink(path.join(UPLOADS_DIR, puzzle.thumbFilename), () => {});
            if (puzzle.fullFilename) fs.unlink(path.join(UPLOADS_DIR, puzzle.fullFilename), () => {});
            await puzzleDao.delete(req.params.id);
        }
        res.json({ success: true });
    });

    // --- Vite Middleware ---
    if (process.env.NODE_ENV !== "production") {
        const vite = await createViteServer({
            server: { middlewareMode: true },
            appType: "spa",
        });
        app.use(vite.middlewares);
    } else {
        const distPath = path.join(process.cwd(), 'dist');
        app.use(express.static(distPath));
        app.get('*', (req, res) => {
            res.sendFile(path.join(distPath, 'index.html'));
        });
    }

    app.listen(PORT, "0.0.0.0", () => {
        console.log(`Server running on http://localhost:${PORT}`);
    });
}

startServer().catch(console.error);
