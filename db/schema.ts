import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const meals = sqliteTable('meals', {
    id: integer('id').primaryKey({ autoIncrement: true }),
    name: text('name').notNull(),
    calories: integer('calories').notNull(),
    protein: integer('protein'),
    carbs: integer('carbs'),
    fat: integer('fat'),
    imageUri: text('image_uri'),
    transcription: text('transcription'),
    createdAt: integer('created_at', { mode: 'timestamp' }).notNull().$defaultFn(() => new Date()),
});
