
import React, { useState, useMemo } from 'react';
import { Word } from '../../types';
import Button from '../ui/Button';

interface FlashcardExerciseProps {
  words: Word[];
  onExit: () => void;
}

const FlashcardExercise: React.FC<FlashcardExerciseProps> = ({ words, onExit }) => {
  const shuffledWords = useMemo(() => [...words].sort(() => Math.random() - 0.5), [words]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);

  const currentWord = shuffledWords[currentIndex];

  const handleNext = () => {
    setIsFlipped(false);
    setCurrentIndex((prev) => (prev + 1) % shuffledWords.length);
  };
  
  const handlePrev = () => {
    setIsFlipped(false);
    setCurrentIndex((prev) => (prev - 1 + shuffledWords.length) % shuffledWords.length);
  };

  return (
    <div className="flex flex-col items-center p-4">
      <div className="w-full max-w-2xl">
        <div className="flex justify-between items-center mb-4">
            <h2 className="text-2xl font-bold">Flashcards</h2>
            <Button onClick={onExit} variant="ghost">Exit</Button>
        </div>
        
        <div
          className="relative w-full h-80 bg-white rounded-xl shadow-lg cursor-pointer transition-transform duration-500"
          onClick={() => setIsFlipped(!isFlipped)}
          style={{ transformStyle: 'preserve-3d', transform: isFlipped ? 'rotateY(180deg)' : 'rotateY(0deg)' }}
        >
          {/* Front of card */}
          <div className="absolute w-full h-full flex items-center justify-center p-6 backface-hidden">
            <h3 className="text-4xl font-bold text-primary">{currentWord.word}</h3>
          </div>
          {/* Back of card */}
          <div className="absolute w-full h-full p-6 backface-hidden bg-primary text-white rounded-xl flex flex-col justify-center text-center" style={{ transform: 'rotateY(180deg)' }}>
            <p className="text-xl font-semibold">{currentWord.definition}</p>
            <p className="mt-4 text-base italic opacity-80">"{currentWord.example}"</p>
          </div>
        </div>
        
        <p className="text-center mt-4 text-gray-500">
          Card {currentIndex + 1} of {shuffledWords.length}
        </p>

        <div className="flex justify-between mt-4">
          <Button onClick={handlePrev}>Previous</Button>
          <Button onClick={handleNext}>Next</Button>
        </div>
      </div>
    </div>
  );
};

export default FlashcardExercise;
