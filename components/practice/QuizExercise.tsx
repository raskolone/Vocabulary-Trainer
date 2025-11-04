
import React, { useState, useMemo, useEffect } from 'react';
import { Word } from '../../types';
import Button from '../ui/Button';

interface QuizExerciseProps {
  words: Word[];
  onExit: () => void;
}

const QuizExercise: React.FC<QuizExerciseProps> = ({ words, onExit }) => {
  const shuffledWords = useMemo(() => [...words].sort(() => Math.random() - 0.5), [words]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [options, setOptions] = useState<string[]>([]);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);
  const [score, setScore] = useState(0);
  const [isFinished, setIsFinished] = useState(false);

  const currentWord = shuffledWords[currentIndex];

  useEffect(() => {
    if (!isFinished) {
      const correctOption = currentWord.word;
      const wrongOptions = words
        .filter(w => w.id !== currentWord.id)
        .sort(() => Math.random() - 0.5)
        .slice(0, 3)
        .map(w => w.word);
      
      setOptions([correctOption, ...wrongOptions].sort(() => Math.random() - 0.5));
      setSelectedAnswer(null);
      setIsCorrect(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentIndex, isFinished]);

  const handleAnswer = (option: string) => {
    if (selectedAnswer) return;

    setSelectedAnswer(option);
    if (option === currentWord.word) {
      setIsCorrect(true);
      setScore(s => s + 1);
    } else {
      setIsCorrect(false);
    }
  };

  const handleNext = () => {
    if (currentIndex < shuffledWords.length - 1) {
      setCurrentIndex(i => i + 1);
    } else {
      setIsFinished(true);
    }
  };

  const restart = () => {
    setCurrentIndex(0);
    setScore(0);
    setIsFinished(false);
  };
  
  if (isFinished) {
      return (
        <div className="text-center p-8 bg-white rounded-lg shadow-md max-w-md mx-auto">
            <h2 className="text-2xl font-bold mb-4">Quiz Complete!</h2>
            <p className="text-lg mb-6">Your score: <span className="font-bold text-primary">{score} / {shuffledWords.length}</span></p>
            <div className="flex gap-4 justify-center">
                <Button onClick={restart}>Try Again</Button>
                <Button onClick={onExit} variant="secondary">Exit</Button>
            </div>
        </div>
      )
  }

  return (
    <div className="p-4 max-w-2xl mx-auto">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-2xl font-bold">Quiz</h2>
        <p className="font-semibold">Score: {score}</p>
      </div>
      <div className="bg-white p-6 rounded-lg shadow-md">
        <p className="text-lg text-center mb-6">Which word means: "{currentWord.definition}"?</p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {options.map(option => {
            const isSelected = selectedAnswer === option;
            const isCorrectAnswer = option === currentWord.word;
            let buttonClass = 'bg-white hover:bg-gray-100 border-gray-300';
            if (isSelected) {
              buttonClass = isCorrect ? 'bg-green-500 text-white border-green-500' : 'bg-red-500 text-white border-red-500';
            } else if (selectedAnswer && isCorrectAnswer) {
              buttonClass = 'bg-green-500 text-white border-green-500';
            }

            return (
              <button
                key={option}
                onClick={() => handleAnswer(option)}
                disabled={!!selectedAnswer}
                className={`w-full p-4 rounded-lg border-2 text-center transition-colors duration-200 disabled:cursor-not-allowed ${buttonClass}`}
              >
                {option}
              </button>
            );
          })}
        </div>
        {selectedAnswer && (
          <div className="mt-6 text-center">
            <Button onClick={handleNext}>
              {currentIndex === shuffledWords.length - 1 ? 'Finish' : 'Next Question'}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};

export default QuizExercise;
