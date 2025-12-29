import { GoogleGenAI, Type, Schema } from "@google/genai";
import { UserSettings } from '../types';

/**
 * analyzes a chunk of text and returns a list of words/phrases to replace
 * with their English counterparts, maintaining grammatical context.
 */
export const analyzeTextForImmersion = async (
  text: string, 
  settings: UserSettings
): Promise<{ original: string; replacement: string }[]> => {
  if (!settings.apiKey) {
    throw new Error("API Key is missing");
  }

  const ai = new GoogleGenAI({ apiKey: settings.apiKey });

  // Schema definition for structured JSON output
  const replacementSchema: Schema = {
    type: Type.ARRAY,
    items: {
      type: Type.OBJECT,
      properties: {
        original: { type: Type.STRING, description: "The specific Chinese word or phrase found in the text." },
        replacement: { type: Type.STRING, description: "The English translation suitable for the context." },
      },
      required: ["original", "replacement"],
    },
  };

  const prompt = `
    You are an expert English language tutor assisting a Chinese speaker.
    Task: Analyze the provided text. Identify Chinese words or phrases that can be replaced with English equivalents suitable for a '${settings.difficulty}' level learner.
    
    Rules:
    1. The replacement MUST fit the grammatical context of the sentence (e.g. if the Chinese is a verb, the English should be the correct tense).
    2. Only select about ${settings.immersionRate}% of the key content words (nouns, verbs, adjectives). Do not replace everything.
    3. If 'customVocabulary' is provided: ${settings.customVocabulary.join(', ')}, prioritize using these words if they fit.
    4. Return ONLY a JSON array of objects.

    Text to analyze:
    "${text.substring(0, 2000)}" 
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-latest', // Fast model for real-time feel
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: replacementSchema,
        temperature: 0.3, // Low temperature for consistent translations
      }
    });

    if (response.text) {
      return JSON.parse(response.text);
    }
    return [];
  } catch (error) {
    console.error("Gemini API Error:", error);
    return [];
  }
};
