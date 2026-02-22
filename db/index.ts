import { drizzle } from 'drizzle-orm/expo-sqlite';
import { openDatabaseSync } from 'expo-sqlite';

const expoDb = openDatabaseSync('db.db');

export const db = drizzle(expoDb);

// Helper to ensure tables exist (Simple migration alternative for this demo)
export const initDb = () => {
    try {
        expoDb.execSync(`
        CREATE TABLE IF NOT EXISTS meals (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          calories INTEGER NOT NULL,
          protein INTEGER,
          carbs INTEGER,
          fat INTEGER,
          image_uri TEXT,
          transcription TEXT,
          created_at INTEGER NOT NULL DEFAULT (strftime('%s', 'now'))
        );
      `);
        console.log("Database initialized successfully");
    } catch (error) {
        console.error("Failed to init DB:", error);
    }
};

// Initialize immediately
initDb();
