# AI Meal Tracker

A React Native mobile application built with Expo that allows users to rapidly log their meals using a chat-like interface. Users can send voice dictations and images, which are then analyzed by Gemini AI models (like Gemini 2.5 Flash) to automatically extract nutritional macros (Calories, Protein, Carbs, Fat) and identify the meal.

The application works completely cross-platform (iOS, Android, and Web) and stores data locally.

## Features & Highlights
- **Cross-Platform UI Framework:** Built purely with Tamagui for beautiful, responsive UI on Web, iOS, and Android.
- **Smart Model Selector:** Dynamically uses a floating `Popover` on Web and a native-feeling bottom `<Sheet>` on touch devices to let users choose between different Gemini models (Fast, Thinking, Pro).
- **Native Keyboard Handling:** Integrates `react-native-keyboard-controller` for smooth, 120fps synchronized keyboard transition animations without layout jumps.
- **Micro-Animations:** Fluid layout transitions including a morphing "Log Meal" tab button that transforms into a back arrow floating over the chat interface.
- **Real-Time Dictation:** Utilizes `expo-speech-recognition` for streaming on-device/cloud voice-to-text functionality.

## Architecture and File Navigation

This app uses **Expo Router** for file-based navigation and **Drizzle ORM** with **Expo SQLite** for local offline storage.

### 🧭 Navigation & Screens (`app/`)
* **`app/_layout.tsx`**: The main entry point. Bootstraps the Tamagui UI Theme Provider, React Query, and sets up the root structural layout wrapped in the `KeyboardProvider`.
* **`app/(tabs)/_layout.tsx`**: Defines the Bottom Tab Navigator containing the Dashboard and Chat/Log features. Uses a custom animated Pill Tab Bar.
* **`app/(tabs)/index.tsx` (Dashboard)**: The main feed. Fetches and displays all past logged meals from the SQLite database. Includes a summary pie chart visualizing lifetime macros.
* **`app/(tabs)/two.tsx` & `components/ChatInterface.tsx` (Log Meal Screen)**: The primary data-entry flow natively resembling the Gemini mobile app. 
  * Handles multi-image selection via the Camera or Photo Library using bottom Action Sheets.
  * Captures real-time streaming voice dictation.
  * Triggers the Gemini AI inference based on the user-selected model.
  * Cleans up local image caches before committing the extracted AI JSON data to the local SQLite database.
* **`app/settings.tsx`**: Secure UI where users input their Gemini API Key, saved locally.

### 💾 Database Modeling (`db/`)
The app uses an offline, privacy-first embedded SQLite database using Drizzle ORM.
* **`db/client.ts`**: Safely initializes the connection to the `meals.db` SQLite file.
* **`db/schema.ts`**: Defines the rigid schema for the `meals` table (name, calories, protein, carbs, fat, transcription text).
* **`db/index.ts` & `db/index.web.ts`**: Exports the live `db` connection, with Web-only polyfills to prevent native module crashes on browsers.

### 🧠 External APIs & Inference (`services/`)
* **`services/gemini.ts`**: A wrapper utilizing the official `@google/genai` SDK. It exposes the `analyzeMeal` function which dynamically merges base64 image data and the user's spoken transcription/text into a system prompt, strictly enforcing a `responseSchema` to guarantee structured macro extraction JSON responses.

### 🛠️ Custom Hooks & Utilities (`utils/`)
* **`utils/storage.ts`**: A storage wrapper to abstract away local persistent configurations (like API keys) across Web and Native.
* **`utils/speech.ts`**: A unified React hook (`useSpeechRecognition`) that wraps the host OS's native dictation engines (Apple Speech Framework & Google SpeechRecognizer) to provide ultra-low latency, real-time streaming transcription back to the Chat Interface.

## Running the Application

1. Install dependencies:
   ```bash
   npm install
   ```

2. Due to custom native modules (`react-native-keyboard-controller`), run a prebuild or an EAS build for native devices:
   ```bash
   npx expo prebuild
   npx expo run:ios
   # OR
   npx expo run:android
   ```
   *(For web testing, simply run `npx expo start` and press `w`)*

3. Configure your API Key:
   * Open the app.
   * Navigate to the **Settings** tab.
   * Paste your fresh Gemini API Key and tap "Save".
   * Select a model inside the Chat screen and log your first meal!
