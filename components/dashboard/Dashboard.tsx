
import React, { useState } from 'react';
import Sidebar from './Sidebar';
import VocabularyGenerator from './VocabularyGenerator';
import WordList from './WordList';
import AISuggestions from './AISuggestions';
import PracticeZone from '../practice/PracticeZone';
import SettingsScreen from '../settings/SettingsScreen';
import { useAuth } from '../../context/AuthContext';
import { ExerciseType } from '../../types';

type View = 'dashboard' | 'practice' | 'settings';
type PracticeView = { type: 'exercise'; exercise: ExerciseType } | null;

const Dashboard: React.FC = () => {
  const { user, logout } = useAuth();
  const [view, setView] = useState<View>('dashboard');
  const [practiceView, setPracticeView] = useState<PracticeView>(null);

  const startPractice = (exercise: ExerciseType) => {
    setView('practice');
    setPracticeView({ type: 'exercise', exercise });
  };

  const renderContent = () => {
    if (view === 'practice' && practiceView) {
      return <PracticeZone exerciseType={practiceView.exercise} onExit={() => setView('dashboard')} />;
    }
    if (view === 'settings') {
      return <SettingsScreen />;
    }
    // Default to dashboard view
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <VocabularyGenerator />
            <WordList />
          </div>
          <div className="space-y-6">
            <AISuggestions />
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="flex h-screen bg-base-100">
      <Sidebar 
        currentView={view} 
        onNavigate={(newView) => {
          setView(newView)
          setPracticeView(null)
        }} 
        onStartPractice={startPractice}
      />
      <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-y-auto">
        <header className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold">
            Welcome, {user?.username}!
          </h1>
          <button
            onClick={logout}
            className="text-sm font-medium text-gray-600 hover:text-primary"
          >
            Logout
          </button>
        </header>
        {renderContent()}
      </main>
    </div>
  );
};

export default Dashboard;
