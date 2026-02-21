/**
 * Dashboard Page Component
 * Location: src/pages/DashboardPage.jsx
 * 
 * Main dashboard page shown after successful login/registration
 */

import { useState, useEffect } from 'react';
import { auth } from '../services/firebase';
import { useNavigate } from 'react-router-dom';
import { logoutUser } from '../services/firebase';
import './DashboardPage.css';

const DashboardPage = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Listen for auth state changes
    const unsubscribe = auth.onAuthStateChanged((currentUser) => {
      if (currentUser) {
        setUser(currentUser);
      } else {
        // Redirect to login if not authenticated
        navigate('/login');
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [navigate]);

  const handleLogout = async () => {
    try {
      await logoutUser();
      navigate('/login');
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  if (loading) {
    return (
      <div className="dashboard-container">
        <div className="loading-spinner"></div>
      </div>
    );
  }

  return (
    <div className="dashboard-container">
      <div className="dashboard-content">
        <header className="dashboard-header">
          <h1 className="dashboard-title">Welcome to ToGather</h1>
          <button onClick={handleLogout} className="logout-button">
            Logout
          </button>
        </header>

        <div className="welcome-card">
          <div className="welcome-icon">🎉</div>
          <h2 className="welcome-heading">Registration Successful!</h2>
          <p className="welcome-text">
            Hello, <strong>{user?.email}</strong>
          </p>
          <p className="welcome-subtext">
            Your ToGather account has been created successfully. 
            Start managing your wedding invitations and guest lists.
          </p>
        </div>

        <div className="dashboard-grid">
          <div className="dashboard-card">
            <div className="card-icon">💌</div>
            <h3 className="card-title">Invitations</h3>
            <p className="card-description">Create and send beautiful wedding invitations</p>
          </div>

          <div className="dashboard-card">
            <div className="card-icon">📋</div>
            <h3 className="card-title">Guest List</h3>
            <p className="card-description">Manage your wedding guests and RSVPs</p>
          </div>

          <div className="dashboard-card">
            <div className="card-icon">📊</div>
            <h3 className="card-title">Analytics</h3>
            <p className="card-description">Track invitation views and responses</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardPage;
