// Web Persistence Adapter using LocalStorage
// This mocks the Drizzle ORM interface to allow saving/loading meals on web.

const STORAGE_KEY = 'meals_data';

const getMeals = () => {
    if (typeof localStorage === 'undefined') return [];
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        // Parse dates back to Date objects if needed, but for display strings usually work.
        // Drizzle schema expects Date for createdAt.
        const parsed = stored ? JSON.parse(stored) : [];
        return parsed.map((m: any) => ({
            ...m,
            createdAt: new Date(m.createdAt)
        }));
    } catch (e) {
        console.error("Failed to load meals", e);
        return [];
    }
};

const saveMeal = (mealData: any) => {
    if (typeof localStorage === 'undefined') return;
    try {
        const meals = getMeals();
        const newMeal = {
            ...mealData,
            id: Date.now(), // Simple ID generation
            createdAt: new Date(), // Current time
        };
        // Add to beginning
        meals.unshift(newMeal);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(meals));
        console.log("Saved meal to LocalStorage:", newMeal);
    } catch (e) {
        console.error("Failed to save meal", e);
    }
};

export const db = {
    select: () => ({
        from: (table: any) => ({
            orderBy: (order: any) => ({
                limit: (limit: number) => {
                    const allMeals = getMeals();
                    return Promise.resolve(allMeals.slice(0, limit));
                }
            })
        })
    }),
    insert: (table: any) => ({
        values: (data: any) => {
            saveMeal(data);
            return Promise.resolve();
        }
    })
} as any;
