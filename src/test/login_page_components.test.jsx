import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import Login from '../pages/Login.jsx';

// Mock the AuthContext module to avoid needing AuthProvider in tests
vi.mock('@/contexts/AuthContext', () => ({
  useAuth: vi.fn(() => ({
    user: null,
    userProfile: null,
    login: vi.fn(),
    signup: vi.fn(),
    logout: vi.fn(),
    resetPassword: vi.fn(),
    loading: false
  }))
}));

describe('Login Component - Basic Rendering Tests', () => {
  it('renders without crashing', () => {
    // This will throw if component doesn't render properly
    expect(() => {
      render(
        <BrowserRouter>
          <Login />
        </BrowserRouter>
      );
    }).not.toThrow();
  });

  it('displays email input field', () => {
    render(
      <BrowserRouter>
        <Login />
      </BrowserRouter>
    );
    
    const emailInput = screen.getByLabelText(/email/i);
    expect(emailInput).toBeInTheDocument();
  });

  it('displays password input field', () => {
    render(
      <BrowserRouter>
        <Login />
      </BrowserRouter>
    );
    
    const passwordInput = screen.getByLabelText("Password");
    expect(passwordInput).toBeInTheDocument();
  });

  it('displays login button', () => {
    render(
      <BrowserRouter>
        <Login />
      </BrowserRouter>
    );
    
    const loginButton = screen.getByRole('button', { name: /log in/i });
    expect(loginButton).toBeInTheDocument();
  });

  it('displays form title', () => {
    render(
      <BrowserRouter>
        <Login />
      </BrowserRouter>
    );
    
    // Look for common text that should be present
    const title = screen.getByText(/log in/i);
    expect(title).toBeInTheDocument();
  });
});