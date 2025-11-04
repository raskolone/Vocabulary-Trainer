
export type Language = 'English' | 'Spanish' | 'French';
export type Difficulty = 'A1-A2' | 'B1-B2' | 'C1-C2';
export type RevisionFrequency = 'Daily' | 'Weekly' | 'Monthly';
export type ExerciseType = 'flashcards' | 'quiz' | 'fill-in-the-blank';

export interface User {
  username: string;
}

export interface Word {
  id: string;
  word: string;
  ipa: string;
  definition: string;
  example: string;
  language: Language;
  isDifficult: boolean;
}

export interface AISuggestion {
  paragraph: string;
  wordSuggestions: Array<{
    word: string;
    synonym: string;
    antonym: string;
  }>;
}
