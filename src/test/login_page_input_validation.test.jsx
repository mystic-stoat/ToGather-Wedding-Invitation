import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import userEvent from '@testing-library/user-event';
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

// Input validation tests for login page
// ===================================== //
describe('Login Component - Input Validation Tests', () => {
  it('shows error when email is empty and user tries to submit', async () => {
    render(<BrowserRouter><Login /></BrowserRouter>);
    
    const loginButton = screen.getByRole('button', { name: /log in/i });
    
    // Try to submit with empty fields
    await userEvent.click(loginButton);
    
    // Check that validation errors appear
    expect(screen.getByText(/email is required/i)).toBeInTheDocument();
  });
  
  it('shows error when password is empty and user tries to submit', async () => {
    render(<BrowserRouter><Login /></BrowserRouter>);
    
    const loginButton = screen.getByRole('button', { name: /log in/i });
    
    // Try to submit with empty password
    await userEvent.click(loginButton);
    
    // Check that validation errors appear
    expect(screen.getByText(/password is required/i)).toBeInTheDocument();
  });
  
  it('shows error for invalid email format', async () => {
    render(<BrowserRouter><Login /></BrowserRouter>);
    
    const emailInput = screen.getByLabelText(/email/i);
    const loginButton = screen.getByRole('button', { name: /log in/i });
    
    // Enter invalid email
    await userEvent.type(emailInput, 'invalid-email');
    
    // Try to submit
    await userEvent.click(loginButton);
    
    // Check that validation errors appear
    expect(screen.getByText("Enter a valid email address")).toBeInTheDocument();
  });
});