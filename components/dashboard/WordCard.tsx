
import React, { useState } from 'react';
import { Word } from '../../types';
import { useVocabulary } from '../../context/VocabularyContext';
import { getAudioPronunciation } from '../../services/geminiService';
import { playAudio } from '../../utils/audioUtils';
import { VOICE_CONFIG } from '../../constants';

interface WordCardProps {
  word: Word;
}

const WordCard: React.FC<WordCardProps> = ({ word }) => {
  const { toggleWordDifficulty } = useVocabulary();
  const [isPlaying, setIsPlaying] = useState<string | null>(null);

  const handlePlayAudio = async (variant: string) => {
    if (isPlaying) return;
    setIsPlaying(variant);
    try {
      let voice: string;
      if (word.language === 'English') {
        voice = VOICE_CONFIG.English[variant as 'American' | 'British'];
      } else {
        voice = VOICE_CONFIG[word.language];
      }
      const audio = await getAudioPronunciation(word.word, voice);
      await playAudio(audio);
    } catch (error) {
      console.error(`Failed to play ${variant} audio`, error);
    } finally {
      setIsPlaying(null);
    }
  };

  return (
    <div className="p-4 bg-base-100 rounded-lg border border-base-200">
      <div className="flex justify-between items-start">
        <div>
          <h3 className="text-lg font-bold text-primary">{word.word}</h3>
          <p className="text-sm text-gray-500 font-mono">/{word.ipa}/</p>
        </div>
        <div className="flex items-center space-x-2">
          <button
            onClick={() => toggleWordDifficulty(word.id)}
            title={word.isDifficult ? 'Mark as easy' : 'Mark as difficult'}
            className={`p-1.5 rounded-full transition-colors ${
              word.isDifficult ? 'text-yellow-500 bg-yellow-100' : 'text-gray-400 hover:bg-gray-200'
            }`}
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
            </svg>
          </button>
          {word.language === 'English' && (
            <>
              <AudioButton
                label="US"
                onClick={() => handlePlayAudio('American')}
                isLoading={isPlaying === 'American'}
              />
              <AudioButton
                label="UK"
                onClick={() => handlePlayAudio('British')}
                isLoading={isPlaying === 'British'}
              />
            </>
          )}
          {(word.language === 'Spanish' || word.language === 'French') && (
            <AudioButton
              label={word.language === 'Spanish' ? 'ES' : 'FR'}
              onClick={() => handlePlayAudio(word.language)}
              isLoading={isPlaying === word.language}
            />
          )}
        </div>
      </div>
      <p className="mt-2 text-gray-700">{word.definition}</p>
      <p className="mt-1 text-sm text-gray-500 italic">"{word.example}"</p>
    </div>
  );
};

const AudioButton: React.FC<{ label: string; onClick: () => void; isLoading: boolean }> = ({ label, onClick, isLoading }) => (
    <button
        onClick={onClick}
        disabled={isLoading}
        className="w-8 h-8 flex items-center justify-center rounded-full bg-primary/10 text-primary hover:bg-primary/20 transition-colors text-xs font-bold disabled:opacity-50"
    >
        {isLoading ? (
            <svg className="animate-spin h-4 w-4 text-primary" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
            </svg>
        ) : label}
    </button>
);


export default WordCard;
