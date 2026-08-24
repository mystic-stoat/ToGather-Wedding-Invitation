import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import Signup from '../pages/Signup.jsx';

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

describe('Signup Component - Basic Rendering Tests', () => {
    it('renders without crashing', () => {
        expect(() => {
            render(<BrowserRouter><Signup /> </BrowserRouter>);
        }).not.toThrow();
    });
    it('displays name input field', () => {
        render(<BrowserRouter><Signup /> </BrowserRouter>);
        const nameInput = screen.getByLabelText("Full name");
        expect(nameInput).toBeInTheDocument();
    });
    it('displays email input field', () => {
        render(<BrowserRouter><Signup /> </BrowserRouter>);
        const emailInput = screen.getByLabelText("Email Address");
        expect(emailInput).toBeInTheDocument();
    });
    it('displays password input field', () => {
        render(<BrowserRouter><Signup /> </BrowserRouter>);
        const passwordInput = screen.getByLabelText("Password");
        expect(passwordInput).toBeInTheDocument();
    });
    it('displays confirm input field', () => {
        render(<BrowserRouter><Signup /> </BrowserRouter>);
        const confirmInput = screen.getByLabelText("Confirm Password");
        expect(confirmInput).toBeInTheDocument();
    });
    it('displays create account button', () => {
        render(<BrowserRouter><Signup /> </BrowserRouter>);
        const createAccountButton = screen.getByRole("button", {name: "Create Account"});
        expect(createAccountButton).toBeInTheDocument();
    });

})