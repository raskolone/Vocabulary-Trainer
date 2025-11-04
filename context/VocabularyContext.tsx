
import React, { createContext, useContext, useState, ReactNode } from 'react';
import { Word, RevisionFrequency } from '../types';
import useLocalStorage from '../hooks/useLocalStorage';

interface VocabularyContextType {
  words: Word[];
  addWords: (newWords: Omit<Word, 'id' | 'isDifficult'>[]) => void;
  toggleWordDifficulty: (wordId: string) => void;
  difficultWords: Word[];
  frequency: RevisionFrequency;
  setFrequency: (freq: RevisionFrequency) => void;
}

const VocabularyContext = createContext<VocabularyContextType | undefined>(undefined);

export const VocabularyProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [words, setWords] = useLocalStorage<Word[]>('vocab_words', []);
  const [frequency, setFrequency] = useLocalStorage<RevisionFrequency>('revision_frequency', 'Daily');

  const addWords = (newWords: Omit<Word, 'id' | 'isDifficult'>[]) => {
    const wordsToAdd = newWords.map(w => ({
      ...w,
      id: `${w.word}-${Date.now()}`,
      isDifficult: false,
    }));
    setWords(prev => [...wordsToAdd, ...prev]);
  };

  const toggleWordDifficulty = (wordId: string) => {
    setWords(prev =>
      prev.map(w =>
        w.id === wordId ? { ...w, isDifficult: !w.isDifficult } : w
      )
    );
  };
  
  const difficultWords = words.filter(w => w.isDifficult);

  return (
    <VocabularyContext.Provider value={{ words, addWords, toggleWordDifficulty, difficultWords, frequency, setFrequency }}>
      {children}
    </VocabularyContext.Provider>
  );
};

export const useVocabulary = (): VocabularyContextType => {
  const context = useContext(VocabularyContext);
  if (!context) {
    throw new Error('useVocabulary must be used within a VocabularyProvider');
  }
  return context;
};
