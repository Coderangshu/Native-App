# AI Meal Tracker

A React Native mobile application built with Expo that allows users to rapidly log their meals using voice dictation and images, which are then analyzed by the Gemini 1.5 Flash AI model to automatically extract nutritional macros (Calories, Protein, Carbs, Fat). 

The application works completely cross-platform (iOS, Android, and Web) and stores data locally.

## Architecture and File Navigation

This app uses **Expo Router** for file-based navigation and **Drizzle ORM** with **Expo SQLite** for local offline storage.

### 🧭 Navigation & Screens (`app/`)
* **`app/_layout.tsx`**: The main entry point. Bootstraps the Tamagui UI Theme Provider and sets up the root structural layout.
* **`app/(tabs)/_layout.tsx`**: Defines the Bottom Tab Navigator containing the Dashboard and Settings screens.
* **`app/(tabs)/index.tsx` (Dashboard)**: The main feed. Fetches and displays all past logged meals from the SQLite database. Includes a summary pie chart visualizing lifetime macros.
* **`app/(tabs)/settings.tsx`**: Secure UI where users input their Gemini API Key, which is encrypted and saved to the device using `expo-secure-store`.
* **`app/log.tsx` (Log Meal Screen)**: The primary data-entry flow. 
  * Handles multi-image selection via the Camera or Photo Library using bottom Action Sheets.
  * Captures real-time streaming voice dictation (`expo-speech-recognition`).
  * Triggers the Gemini AI inference.
  * Cleans up local image cache via `expo-file-system` to save device storage, before committing the extracted AI text data to the local SQLite database.

### 💾 Database Modeling (`db/`)
The app uses an offline, privacy-first embedded SQLite database using Drizzle ORM.
* **`db/client.ts`**: Safely initializes the connection to the `meals.db` SQLite file.
* **`db/schema.ts`**: Defines the rigid schema for the `meals` table (name, calories, protein, carbs, fat, transcription text).
* **`db/index.ts`**: Exports the live `db` connection.
* **`db/index.web.ts`**: A Web-only polyfill that intercepts Drizzle/SQLite commands and routes them to `localStorage` when running the app in a web browser, preventing Native module crashes.

### 🧠 External APIs & Inference (`services/`)
* **`services/gemini.ts`**: A wrapper around the `@google/generative-ai` SDK. It exposes the `analyzeMeal` function which dynamically merges base64 image data and the user's spoken transcription into a system prompt, strictly enforcing a JSON schema response containing the macro estimations.

### 🛠️ Custom Hooks & Utilities (`utils/`)
* **`utils/storage.ts`**: An isomorphic storage wrapper bridging `expo-secure-store` (for Native encryption of the API Key) and `localStorage` (for web testing).
* **`utils/speech.ts`**: A unified React hook (`useSpeechRecognition`) that wraps the host OS's native dictation engines (Apple Speech Framework & Google SpeechRecognizer) to provide ultra-low latency, real-time streaming transcription back to the Log Meal screen.

## Running the Application

1. Install dependencies:
   ```bash
   npm install
   ```

2. Run the development server (for iOS/Android via Expo Go, or Web):
   ```bash
   npx expo start
   ```

3. Configure your API Key:
   * Open the app.
   * Navigate to the **Settings** tab.
   * Paste your fresh Gemini API Key and tap "Save".
   * You can now successfully log meals with AI!
