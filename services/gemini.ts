import { GoogleGenAI } from "@google/genai";
import { readAsStringAsync } from 'expo-file-system';
import { Platform } from 'react-native';

// TODO: Move to secure storage / user settings
export class GeminiService {
    private client: GoogleGenAI;

    constructor(apiKey: string) {
        this.client = new GoogleGenAI({ apiKey });
    }

    async analyzeMeal(imageUri?: string, textDescription?: string) {
        const usageParts: any[] = [];

        // Prompt structure for new SDK
        usageParts.push({
            text: `
      Analyze this meal. Return a JSON object with the following fields:
      - name: Short descriptive name of the meal
      - calories: Total estimated calories (integer)
      - protein: Protein in grams (integer)
      - carbs: Carbs in grams (integer)
      - fat: Fat in grams (integer)
      - macros: breakdown of micronutrients if possible
      
      If the image or text is not food related, return { "error": "Not food" }.
      Do not use Markdown code blocks in the response. Just the raw JSON string.
    `});

        if (textDescription) {
            usageParts.push({ text: `User description: ${textDescription}` });
        }

        if (imageUri) {
            let base64;
            if (Platform.OS === 'web') {
                const response = await fetch(imageUri);
                const blob = await response.blob();
                base64 = await new Promise((resolve) => {
                    const reader = new FileReader();
                    reader.onloadend = () => resolve(reader.result?.toString().split(',')[1]); // remove data:image/jpeg;base64,
                    reader.readAsDataURL(blob);
                });
            } else {
                base64 = await readAsStringAsync(imageUri, { encoding: 'base64' });
            }

            usageParts.push({
                inlineData: {
                    data: base64 as string,
                    mimeType: "image/jpeg",
                },
            });
        }

        try {
            const result = await this.client.models.generateContent({
                // model: 'gemini-2.5-flash',
                // model: 'gemini-3-flash-preview',
                model: 'gemini-2.5-flash-lite',
                contents: [{ parts: usageParts }]
            });

            console.log("Gemini Result:", JSON.stringify(result, null, 2));
            // Try different ways to access text based on SDK version
            let responseText = null;
            if (typeof result.text === 'function') {
                responseText = (result as any).text();
            } else if (result.candidates && result.candidates.length > 0 && result.candidates[0].content?.parts && result.candidates[0].content.parts.length > 0) {
                // @ts-ignore
                responseText = result.candidates[0].content.parts[0].text;
            }

            if (!responseText) throw new Error("No response text from AI");

            // Clean up markdown if present
            const jsonStr = responseText.replace(/```json/g, '').replace(/```/g, '').trim();
            return JSON.parse(jsonStr);
        } catch (error) {
            console.error("Gemini Error:", error);
            throw error;
        }
    }

    async transcribeAudio(audioUri: string): Promise<string> {
        const usageParts: any[] = [];
        usageParts.push({ text: "Transcribe this audio exactly. Return only the text description of the meal." });

        let base64;
        // Default mimeType for Expo AV High Quality used in log.tsx
        let mimeType = 'audio/m4a';

        if (Platform.OS === 'web') {
            const response = await fetch(audioUri);
            const blob = await response.blob();
            // Try to detect mime type from blob, fallback to m4a/mp4
            mimeType = blob.type || mimeType;
            if (mimeType === 'audio/mp4' || mimeType === 'video/mp4') {
                // Common confusion for m4a files on web
                mimeType = 'audio/mp4';
            }

            base64 = await new Promise((resolve) => {
                const reader = new FileReader();
                reader.onloadend = () => resolve(reader.result?.toString().split(',')[1]);
                reader.readAsDataURL(blob);
            });
        } else {
            const extension = audioUri.split('.').pop()?.toLowerCase();
            if (extension === 'wav') mimeType = 'audio/wav';
            else if (extension === 'mp3') mimeType = 'audio/mp3';

            base64 = await readAsStringAsync(audioUri, { encoding: 'base64' });
        }

        usageParts.push({
            inlineData: {
                data: base64 as string,
                mimeType: mimeType,
            },
        });

        try {
            const result = await this.client.models.generateContent({
                model: 'gemini-2.5-flash',
                contents: [{ parts: usageParts }]
            });

            console.log("Transcription Result:", JSON.stringify(result, null, 2));

            let responseText = null;

            try {
                // @ts-ignore
                if (typeof result.text === 'function') {
                    // @ts-ignore
                    responseText = result.text();
                } else if (result.text) {
                    responseText = result.text;
                }
            } catch (e) {
                console.error("Error accessing result.text:", e);
            }

            if (!responseText && result.candidates && result.candidates.length > 0) {
                const candidate = result.candidates[0];
                if (candidate.content && candidate.content.parts && candidate.content.parts.length > 0) {
                    responseText = candidate.content.parts[0].text;
                }
            }

            return responseText || "";
        } catch (error) {
            console.error("Transcription Error:", error);
            throw error;
        }
    }
}
