import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useState, useEffect } from 'react';
import Home from './pages/Home';
import Auth from './pages/Auth';
import Dashboard from './pages/Dashboard';
import './index.css';

function App() {
  const [user, setUser] = useState(null);

  useEffect(() => {
    const savedUser = localStorage.getItem('nexus_user');
    if (savedUser) {
      setUser(JSON.parse(savedUser));
    }
  }, []);

  const handleLogin = (userData, token) => {
    localStorage.setItem('nexus_token', token);
    localStorage.setItem('nexus_user', JSON.stringify(userData));
    setUser(userData);
  };

  const handleLogout = () => {
    localStorage.removeItem('nexus_token');
    localStorage.removeItem('nexus_user');
    setUser(null);
    window.location.href = '/';
  };

  return (
    <Router>
      <Routes>
        <Route path="/" element={<Home user={user} onLogout={handleLogout} />} />
        <Route path="/login" element={!user ? <Auth onLogin={handleLogin} mode="login" /> : <Navigate to="/dashboard" />} />
        <Route path="/register" element={!user ? <Auth onLogin={handleLogin} mode="register" /> : <Navigate to="/dashboard" />} />
        <Route path="/auth" element={<Navigate to="/login" replace />} />
        <Route path="/dashboard/*" element={user ? <Dashboard user={user} onLogout={handleLogout} /> : <Navigate to="/login" />} />
      </Routes>
    </Router>
  );
}

export default App;
