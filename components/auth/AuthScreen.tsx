
import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import Button from '../ui/Button';
import Card from '../ui/Card';

const AuthScreen: React.FC = () => {
  const [username, setUsername] = useState('');
  const { login } = useAuth();

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (username.trim()) {
      login(username.trim());
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-primary to-secondary">
      <Card className="w-full max-w-sm">
        <div className="text-center">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 mx-auto text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.253v1.5M12 9.75v6.5M18.375 9a8.25 8.25 0 01-12.75 0" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 16.5a4.125 4.125 0 004.125-4.125h-8.25A4.125 4.125 0 0012 16.5z" />
            </svg>
          <h1 className="text-2xl font-bold mt-4">Welcome to VocabBoost AI</h1>
          <p className="text-gray-500 mt-2">Sign in to start your learning journey.</p>
        </div>
        <form onSubmit={handleSubmit} className="mt-8 space-y-6">
          <div>
            <label htmlFor="username" className="block text-sm font-medium text-gray-700">
              Username
            </label>
            <input
              id="username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-primary focus:border-primary sm:text-sm"
              placeholder="Enter your name"
            />
          </div>
          <Button type="submit" className="w-full" disabled={!username.trim()}>
            Login / Register
          </Button>
        </form>
      </Card>
    </div>
  );
};

export default AuthScreen;
