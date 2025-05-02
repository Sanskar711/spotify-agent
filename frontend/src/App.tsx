import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ChatProvider } from './context/ChatContext';
import Home from './app/page';
import Login from './app/login/page';
import Footer from './components/Footer';
import './index.css';

const App: React.FC = () => {
  return (
    <AuthProvider>
      <ChatProvider>
        <Router>
          <div className="min-h-screen flex flex-col">
            <Routes>
              <Route path="/" element={<Navigate to="/app" replace />} />
              <Route path="/app" element={<Home />} />
              <Route path="/login" element={<Login />} />
            </Routes>
            <Footer />
          </div>
        </Router>
      </ChatProvider>
    </AuthProvider>
  );
};

export default App;
