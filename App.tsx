
import React from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { VocabularyProvider } from './context/VocabularyContext';
import AuthScreen from './components/auth/AuthScreen';
import Dashboard from './components/dashboard/Dashboard';

const App: React.FC = () => {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
};

const AppContent: React.FC = () => {
  const { user } = useAuth();

  return (
    <div className="min-h-screen">
      {user ? (
        <VocabularyProvider>
          <Dashboard />
        </VocabularyProvider>
      ) : (
        <AuthScreen />
      )}
    </div>
  );
};

export default App;
