/**
 * Main App Component
 * Location: src/App.jsx
 * 
 * Sets up routing for the ToGather wedding invitation platform
 */

import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import RegisterPage from './pages/RegisterPage';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import './App.css';

function App() {
  return (
    <Router>
      <Routes>
        {/* Default route - redirect to register */}
        <Route path="/" element={<Navigate to="/register" replace />} />
        
        {/* Authentication routes */}
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/login" element={<LoginPage />} />
        
        {/* Protected routes */}
        <Route path="/dashboard" element={<DashboardPage />} />
        
        {/* Catch all - redirect to register */}
        <Route path="*" element={<Navigate to="/register" replace />} />
      </Routes>
    </Router>
  );
}

export default App;
