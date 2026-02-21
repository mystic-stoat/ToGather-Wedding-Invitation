/**
 * Login Page Component (Placeholder)
 * Location: src/pages/LoginPage.jsx
 * 
 * This is a placeholder login page. You can expand this similar to RegisterPage.
 */

import { Link } from 'react-router-dom';
import './LoginPage.css';

const LoginPage = () => {
  return (
    <div className="login-container">
      <div className="login-card">
        <div className="login-header">
          <h1 className="login-title">ToGather</h1>
          <p className="login-subtitle">Welcome back</p>
        </div>

        <div className="placeholder-content">
          <p>Login page coming soon...</p>
        </div>

        <div className="login-footer">
          <p className="footer-text">
            Don't have an account?{' '}
            <Link to="/register" className="footer-link">
              Sign up
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
