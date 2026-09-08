import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import userEvent from '@testing-library/user-event';
import {
  connectAuthEmulator,
  createUserWithEmailAndPassword,
  signOut,
} from 'firebase/auth';
import { firebaseAuth } from '@/lib/firebase';
import { AuthProvider } from '@/contexts/AuthContext'; // real provider, unmocked
import Login from '../pages/Login.jsx'

const EMULATOR_HOST = '127.0.0.1';
const EMULATOR_PORT = 9099;
const PROJECT_ID = 'togather-64b0b'; // match .firebaserc

const KNOWN_EMAIL = 'existing-user@example.com';
const KNOWN_PASSWORD = 'correct-horse-battery-staple';

function renderLogin() {
  render(
    <BrowserRouter>
      <AuthProvider>
        <Login />
      </AuthProvider>
    </BrowserRouter>
  );
}

async function resetEmulatorState() {
  await fetch(
    `http://${EMULATOR_HOST}:${EMULATOR_PORT}/emulator/v1/projects/${PROJECT_ID}/accounts`,
    { method: 'DELETE' }
  );
}

beforeAll(() => {
  // Only connect once per test run — connectAuthEmulator throws if called twice
  connectAuthEmulator(firebaseAuth, `http://${EMULATOR_HOST}:${EMULATOR_PORT}`, {
    disableWarnings: true,
  });
});

beforeEach(async () => {
  await resetEmulatorState();
  await createUserWithEmailAndPassword(firebaseAuth, KNOWN_EMAIL, KNOWN_PASSWORD);
  await signOut(firebaseAuth); // creating a user auto-signs them in; start each test logged out
});

afterAll(async () => {
  await resetEmulatorState();
});

describe('Login - Firebase Auth Emulator Integration', () => {
  it('logs in successfully with correct credentials', async () => {
    renderLogin();

    await userEvent.type(screen.getByLabelText(/email/i), KNOWN_EMAIL);
    await userEvent.type(screen.getByLabelText('Password'), KNOWN_PASSWORD);
    await userEvent.click(screen.getByRole('button', { name: /log in/i }));

    // Assert on real, observable post-login state — e.g. a redirect or
    // an authenticated-only element — not on auth.currentUser directly,
    // since the UI is what you're actually integrating.
    expect(await screen.findByText(/dashboard|welcome/i)).toBeInTheDocument();
  });

  it('shows an error with an incorrect password', async () => {
    renderLogin();

    await userEvent.type(screen.getByLabelText(/email/i), KNOWN_EMAIL);
    await userEvent.type(screen.getByLabelText('Password'), 'wrong-password');
    await userEvent.click(screen.getByRole('button', { name: /log in/i }));

    expect(
      await screen.findByText(/incorrect email or password/i)
    ).toBeInTheDocument();
  });

  it('shows an error for an email with no account', async () => {
    renderLogin();

    await userEvent.type(screen.getByLabelText(/email/i), 'nobody@example.com');
    await userEvent.type(screen.getByLabelText('Password'), 'irrelevant');
    await userEvent.click(screen.getByRole('button', { name: /log in/i }));

    expect(
      await screen.findByText(/incorrect email or password/i)
    ).toBeInTheDocument();
  });
});