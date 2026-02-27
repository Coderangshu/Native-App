import { GoogleGenAI } from "@google/genai";
import { readAsStringAsync } from 'expo-file-system';
import { Platform } from 'react-native';

// TODO: Move to secure storage / user settings
export class GeminiService {
    private client: GoogleGenAI;

    constructor(apiKey: string) {
        this.client = new GoogleGenAI({ apiKey });
    }

    async analyzeMeal(imageUri?: string, textDescription?: string, modelName: string = 'gemini-2.5-flash') {
        const usageParts: any[] = [];

        const systemPrompt = `
You are an expert nutritional analysis assistant. Analyze the provided text description, image, or both, to determine the nutritional content.

INPUT HANDLING & PORTION ESTIMATION:
1. Nutrition Labels/Charts: If the image is of a Nutrition Facts label or chart, DO NOT guess. Extract the exact values written on the label. If the user specifies a quantity, multiply the values accordingly.
2. Food Images: If an image of food is provided, actively look for reference objects (e.g., forks, hands, cups, or plate edges) to estimate the physical volume and weight.
3. Text Only / No Reference: If no reference objects are visible, or if only text is provided without specific weights, estimate the quantity based on typical standard serving sizes.

OUTPUT FORMAT:
Return ONLY a raw, valid JSON object. Do NOT use Markdown formatting or code blocks.
If the text or image is NOT food-related and NOT a nutrition label, return exactly: {"error": "Not food"}

Otherwise, return this exact structure (use 0 for unknowns):
{
  "name": "Short descriptive name",
  "portion_assumed": "The quantity/size you based your estimates on",
  "calories": 0,
  "macros": { "protein_g": 0, "carbs_g": 0, "fat_g": 0 },
  "minerals": { "sodium_mg": 0, "calcium_mg": 0, "iron_mg": 0, "potassium_mg": 0, "magnesium_mg": 0, "zinc_mg": 0, "phosphorus_mg": 0 },
  "vitamins": { "vitamin_a_mcg": 0, "vitamin_b12_mcg": 0, "vitamin_c_mg": 0, "vitamin_d_mcg": 0, "vitamin_e_mg": 0, "vitamin_k_mcg": 0 },
  "data_source": "State either 'Estimated from photo/text' or 'Extracted from nutrition label'",
  "confidence_score": 0
}`;

        usageParts.push({ text: systemPrompt });

        if (textDescription) {
            usageParts.push({ text: `User input: ${textDescription}` });
        }

        if (imageUri) {
            let base64;
            if (Platform.OS === 'web') {
                const response = await fetch(imageUri);
                const blob = await response.blob();
                base64 = await new Promise((resolve) => {
                    const reader = new FileReader();
                    reader.onloadend = () => resolve(reader.result?.toString().split(',')[1]);
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
                model: modelName,
                contents: [{ parts: usageParts }],
                config: {
                    responseMimeType: "application/json",
                    temperature: 0.1, // Low temperature means less hallucination, more consistent data extraction
                }
            });

            // Extract text from the new SDK structure
            let responseText = result.text || "";

            // Fallback for tricky SDK updates just in case
            if (!responseText && result.candidates?.[0]?.content?.parts?.[0]?.text) {
                responseText = result.candidates[0].content.parts[0].text;
            }

            if (!responseText) throw new Error("No response text from AI");

            // Even with responseMimeType, it's good to sanitize just in case
            const jsonStr = responseText.replace(/```json/g, '').replace(/```/g, '').trim();

            return JSON.parse(jsonStr);

        } catch (error: any) {
            console.error("Gemini Error:", error);

            // Check for Google's HTTP 429 Rate Limit / Quota Exceeded error
            if (error?.status === 429 || error?.message?.includes('429') || error?.message?.includes('ResourceExhausted') || error?.message?.includes('quota')) {
                const customError = new Error("QUOTA_EXCEEDED");
                customError.name = "QuotaExceededError";
                throw customError; // Throw this so the UI screen can catch it
            }

            // Throw generic errors normally
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
