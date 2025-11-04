
import React from 'react';
import { ExerciseType } from '../../types';
import FlashcardExercise from './FlashcardExercise';
import QuizExercise from './QuizExercise';
import FillInBlankExercise from './FillInBlankExercise';
import { useVocabulary } from '../../context/VocabularyContext';
import Button from '../ui/Button';

interface PracticeZoneProps {
  exerciseType: ExerciseType;
  onExit: () => void;
}

const PracticeZone: React.FC<PracticeZoneProps> = ({ exerciseType, onExit }) => {
  const { words } = useVocabulary();

  if (words.length < 4) {
    return (
      <div className="text-center p-8 bg-white rounded-lg shadow-md">
        <h2 className="text-xl font-bold mb-4">Not Enough Words</h2>
        <p className="mb-6">You need at least 4 words in your vocabulary list to start practicing. Please generate more words.</p>
        <Button onClick={onExit}>Back to Dashboard</Button>
      </div>
    );
  }

  const renderExercise = () => {
    switch (exerciseType) {
      case 'flashcards':
        return <FlashcardExercise words={words} onExit={onExit} />;
      case 'quiz':
        return <QuizExercise words={words} onExit={onExit} />;
      case 'fill-in-the-blank':
        return <FillInBlankExercise words={words} onExit={onExit} />;
      default:
        return <p>Select an exercise to begin.</p>;
    }
  };

  return (
    <div>
      {renderExercise()}
    </div>
  );
};

export default PracticeZone;
