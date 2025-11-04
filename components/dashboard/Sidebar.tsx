
import React, { useState } from 'react';
import { ExerciseType } from '../../types';

interface SidebarProps {
  currentView: string;
  onNavigate: (view: 'dashboard' | 'settings') => void;
  onStartPractice: (exercise: ExerciseType) => void;
}

const NavLink: React.FC<{
  onClick: () => void;
  isActive: boolean;
  children: React.ReactNode;
}> = ({ onClick, isActive, children }) => (
  <button
    onClick={onClick}
    className={`w-full flex items-center px-4 py-2.5 text-sm font-medium rounded-lg transition-colors ${
      isActive
        ? 'bg-primary text-white'
        : 'text-gray-600 hover:bg-gray-200 hover:text-gray-900'
    }`}
  >
    {children}
  </button>
);

const Sidebar: React.FC<SidebarProps> = ({ currentView, onNavigate, onStartPractice }) => {
  const [practiceOpen, setPracticeOpen] = useState(false);

  return (
    <aside className="w-64 bg-white p-4 flex-shrink-0 border-r border-base-200">
      <div className="flex items-center space-x-2 mb-8">
        <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v1.5M12 9.75v6.5M18.375 9a8.25 8.25 0 01-12.75 0" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 16.5a4.125 4.125 0 004.125-4.125h-8.25A4.125 4.125 0 0012 16.5z" />
        </svg>
        <span className="text-xl font-bold">VocabBoost AI</span>
      </div>
      <nav className="space-y-2">
        <NavLink onClick={() => onNavigate('dashboard')} isActive={currentView === 'dashboard'}>
            <span>Dashboard</span>
        </NavLink>
        <div>
          <button
            onClick={() => setPracticeOpen(!practiceOpen)}
            className="w-full flex items-center justify-between px-4 py-2.5 text-sm font-medium rounded-lg text-gray-600 hover:bg-gray-200"
          >
            <span>Practice</span>
            <svg className={`w-4 h-4 transition-transform ${practiceOpen ? 'rotate-90' : ''}`} fill="currentColor" viewBox="0 0 20 20"><path d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"></path></svg>
          </button>
          {practiceOpen && (
            <div className="mt-2 pl-4 space-y-2">
              <NavLink onClick={() => onStartPractice('flashcards')} isActive={false}><span>Flashcards</span></NavLink>
              <NavLink onClick={() => onStartPractice('quiz')} isActive={false}><span>Quiz</span></NavLink>
              <NavLink onClick={() => onStartPractice('fill-in-the-blank')} isActive={false}><span>Fill in the Blank</span></NavLink>
            </div>
          )}
        </div>
        <NavLink onClick={() => onNavigate('settings')} isActive={currentView === 'settings'}>
            <span>Settings</span>
        </NavLink>
      </nav>
    </aside>
  );
};

export default Sidebar;
