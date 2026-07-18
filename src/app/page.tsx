'use client';

import { useState } from 'react';
import LoginPage from './components/LoginPage';
import ChatPage, { Message } from './components/ChatPage';
import QuizPage from './components/QuizPage';

interface UserProfile { name: string; belt: string; club: string; }
type AppView = 'login' | 'chat' | 'quiz';

export default function App() {
  const [view, setView] = useState<AppView>('login');
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [savedMessages, setSavedMessages] = useState<Message[]>([]);

  const handleLogin = (p: UserProfile) => {
    setProfile(p);
    setView('chat');
  };

  const handleStartQuiz = (messages: Message[]) => {
    setSavedMessages(messages);
    setView('quiz');
  };

  const handleLogout = () => {
    setProfile(null);
    setView('login');
  };

  if (view === 'login' || !profile) {
    return <LoginPage onLogin={handleLogin} />;
  }

  if (view === 'quiz') {
    return (
      <QuizPage
        profile={profile}
        onBack={() => setView('chat')}
      />
    );
  }

  return (
    <ChatPage
      profile={profile}
      onStartQuiz={handleStartQuiz}
      onLogout={handleLogout}
    />
  );
}
