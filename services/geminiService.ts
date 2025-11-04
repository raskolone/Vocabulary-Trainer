
import { GoogleGenAI, Type, Modality } from "@google/genai";
import { Language, Difficulty, Word, AISuggestion } from '../types';

if (!process.env.API_KEY) {
  throw new Error("API_KEY environment variable is not set");
}

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const vocabularySchema = {
  type: Type.ARRAY,
  items: {
    type: Type.OBJECT,
    properties: {
      word: { type: Type.STRING },
      ipa: { type: Type.STRING, description: "IPA transcription of the word" },
      definition: { type: Type.STRING, description: "A simple definition in English" },
      example: { type: Type.STRING, description: "An example sentence using the word" }
    },
    required: ['word', 'ipa', 'definition', 'example']
  }
};

const suggestionSchema = {
  type: Type.OBJECT,
  properties: {
    paragraph: {
      type: Type.STRING,
      description: "An engaging paragraph using at least 3 of the difficult words."
    },
    wordSuggestions: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          word: { type: Type.STRING },
          synonym: { type: Type.STRING },
          antonym: { type: Type.STRING }
        },
        required: ['word', 'synonym', 'antonym']
      }
    }
  },
  required: ['paragraph', 'wordSuggestions']
};


export const generateVocabulary = async (language: Language, difficulty: Difficulty): Promise<Omit<Word, 'id' | 'isDifficult' | 'language'>[]> => {
  const prompt = `Generate a list of 10 unique ${language} vocabulary words for the ${difficulty} CEFR level. For each word, provide: the word itself, its IPA transcription, a simple definition in English, and an example sentence. Do not repeat words.`;
  
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-pro",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: vocabularySchema,
      },
    });

    const jsonText = response.text.trim();
    const parsed = JSON.parse(jsonText);
    return parsed as Omit<Word, 'id' | 'isDifficult' | 'language'>[];
  } catch (error) {
    console.error("Error generating vocabulary:", error);
    throw new Error("Failed to generate vocabulary from AI.");
  }
};

export const getAudioPronunciation = async (text: string, voice: string): Promise<string> => {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: [{ parts: [{ text: `Say: ${text}` }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: voice },
          },
        },
      },
    });

    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (!base64Audio) {
      throw new Error("No audio data received from API.");
    }
    return base64Audio;
  } catch (error) {
    console.error("Error getting audio pronunciation:", error);
    throw new Error("Failed to get audio pronunciation.");
  }
};

export const getAISuggestions = async (difficultWords: Word[]): Promise<AISuggestion> => {
  const wordList = difficultWords.map(w => w.word).join(', ');
  const prompt = `I'm struggling with these vocabulary words: ${wordList}. 
  1. Write a short, engaging paragraph that correctly uses at least three of these words in a natural context.
  2. For each word in the list, provide one relevant synonym and one relevant antonym.
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: suggestionSchema
      },
    });

    const jsonText = response.text.trim();
    return JSON.parse(jsonText) as AISuggestion;
  } catch (error) {
    console.error("Error getting AI suggestions:", error);
    throw new Error("Failed to get AI suggestions.");
  }
};
