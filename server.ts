import "reflect-metadata";
import express from "express";
import { DataSource, Entity, PrimaryColumn, Column } from "typeorm";
import { createServer as createViteServer } from "vite";
import path from "path";
import fs from "fs";

// -----------------------------------------------------
// 1. Define TypeORM Entities (Similar to Room @Entity)
// -----------------------------------------------------
@Entity()
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

    @Column("text")
    thumbBase64!: string;
    
    @Column("text")
    fullBase64!: string;

    @Column("integer")
    timestamp!: number;
}

// -----------------------------------------------------
// 2. Initialize DataSource (Similar to Room Database)
// -----------------------------------------------------
const AppDataSource = new DataSource({
    type: "sqlite",
    database: "database.sqlite",
    synchronize: true,
    logging: false,
    entities: [PuzzleRecord],
});

async function startServer() {
    await AppDataSource.initialize();
    
    // We simulate a DAO layer here
    const puzzleDao = AppDataSource.getRepository(PuzzleRecord);

    const app = express();
    app.use(express.json({ limit: "50mb" }));
    app.use(express.urlencoded({ limit: "50mb", extended: true }));

    const PORT = 3000;

    // --- API Routes ---
    
    app.get("/api/puzzles", async (req, res) => {
        // Return without fullBase64 to save bandwidth when listing
        const puzzles = await puzzleDao.find({
            select: ["id", "title", "category", "difficulty", "isUserUpload", "isAi", "thumbBase64", "timestamp"]
        });
        res.json(puzzles);
    });

    app.get("/api/puzzles/:id/full", async (req, res) => {
        const puzzle = await puzzleDao.findOne({
            where: { id: req.params.id },
            select: ["fullBase64"]
        });
        if (puzzle) {
            res.json({ fullBase64: puzzle.fullBase64 });
        } else {
            res.status(404).json({ error: "Not found" });
        }
    });

    app.post("/api/puzzles", async (req, res) => {
        try {
            const data = req.body;
            const puzzle = puzzleDao.create(data);
            await puzzleDao.save(puzzle);
            res.json({ success: true, puzzle });
        } catch (e: any) {
            console.error(e);
            res.status(500).json({ error: e.message });
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
        await puzzleDao.delete(req.params.id);
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
