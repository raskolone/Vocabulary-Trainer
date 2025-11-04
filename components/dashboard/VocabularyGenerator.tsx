
import React, { useState } from 'react';
import Card from '../ui/Card';
import Select from '../ui/Select';
import Button from '../ui/Button';
import { Language, Difficulty } from '../../types';
import { LANGUAGES, DIFFICULTIES } from '../../constants';
import { useVocabulary } from '../../context/VocabularyContext';
import { generateVocabulary } from '../../services/geminiService';

const VocabularyGenerator: React.FC = () => {
  const [language, setLanguage] = useState<Language>('English');
  const [difficulty, setDifficulty] = useState<Difficulty>('A1-A2');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { addWords } = useVocabulary();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    try {
      const newWords = await generateVocabulary(language, difficulty);
      const wordsWithLanguage = newWords.map(word => ({ ...word, language }));
      addWords(wordsWithLanguage);
    } catch (err) {
      setError('Failed to generate vocabulary. Please try again.');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card>
      <h2 className="text-xl font-bold mb-4">Generate New Vocabulary</h2>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Select
            id="language"
            label="Language"
            options={LANGUAGES}
            value={language}
            onChange={(e) => setLanguage(e.target.value as Language)}
          />
          <Select
            id="difficulty"
            label="Difficulty"
            options={DIFFICULTIES}
            value={difficulty}
            onChange={(e) => setDifficulty(e.target.value as Difficulty)}
          />
        </div>
        {error && <p className="text-red-500 text-sm">{error}</p>}
        <Button type="submit" isLoading={isLoading} className="w-full">
          Generate 10 Words
        </Button>
      </form>
    </Card>
  );
};

export default VocabularyGenerator;
