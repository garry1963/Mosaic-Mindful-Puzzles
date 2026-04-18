import { DataSource } from 'typeorm';
import { PuzzleRecord } from './server.ts';

const AppDataSource = new DataSource({
    type: "sqlite",
    database: "database.sqlite",
    entities: [PuzzleRecord],
});

async function run() {
    await AppDataSource.initialize();
    const puzzleDao = AppDataSource.getRepository(PuzzleRecord);
    const count = await puzzleDao.count();
    console.log("Total records:", count);
    const all = await puzzleDao.find();
    console.log("Records:", all);
}
run();
