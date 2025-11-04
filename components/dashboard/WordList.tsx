
import React from 'react';
import { useVocabulary } from '../../context/VocabularyContext';
import WordCard from './WordCard';
import Card from '../ui/Card';

const WordList: React.FC = () => {
  const { words } = useVocabulary();

  return (
    <Card>
      <h2 className="text-xl font-bold mb-4">My Vocabulary</h2>
      {words.length > 0 ? (
        <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-2">
          {words.map((word) => (
            <WordCard key={word.id} word={word} />
          ))}
        </div>
      ) : (
        <p className="text-gray-500 text-center py-8">
          Your vocabulary list is empty. Generate some new words to get started!
        </p>
      )}
    </Card>
  );
};

export default WordList;
