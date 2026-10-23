import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BrowserRouter, MemoryRouter, Routes, Route } from 'react-router-dom';
import userEvent from '@testing-library/user-event';
import {
  applyActionCode,
  connectAuthEmulator,
  createUserWithEmailAndPassword,
  sendEmailVerification,
  signOut,
} from 'firebase/auth';
import { connectFirestoreEmulator } from 'firebase/firestore';
import { firebaseAuth, db } from '@/lib/firebase';
import { AuthProvider } from '@/contexts/AuthContext'; // real provider, unmocked
import Login from '../pages/Login.jsx'
import Signup from '../pages/Signup.jsx'
import VerifyEmail from '../pages/VerifyEmail.jsx'
import { requireIsolatedEmulators } from './isolatedEmulators';

// Isolated test emulators only (npm run test:integration:auth). resetEmulatorState()
// deletes EVERY Auth user, so this throws before any test or hook runs unless the
// throwaway emulators from firebase.test.json are in use.
const EMULATORS = requireIsolatedEmulators(['auth', 'firestore']);
const EMULATOR_HOST = EMULATORS.auth.host;
const EMULATOR_PORT = EMULATORS.auth.port;
const PROJECT_ID = EMULATORS.projectId; // the Auth emulator files SDK users under its own project

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

// Renders the real routes involved in the verification flow so navigate()
// actually lands somewhere observable.
function renderRoutes(initial = '/login') {
  render(
    <MemoryRouter initialEntries={[initial]}>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/verify-email" element={<VerifyEmail />} />
          <Route path="/dashboard" element={<div>dashboard-home</div>} />
        </Routes>
      </AuthProvider>
    </MemoryRouter>
  );
}

async function resetEmulatorState() {
  await fetch(
    `http://${EMULATOR_HOST}:${EMULATOR_PORT}/emulator/v1/projects/${PROJECT_ID}/accounts`,
    { method: 'DELETE' }
  );
}

// Verification emails aren't really sent by the emulator, but the OOB code
// is recorded — this is the same code a real email's link would carry.
async function latestVerifyEmailCode(email) {
  const res = await fetch(
    `http://${EMULATOR_HOST}:${EMULATOR_PORT}/emulator/v1/projects/${PROJECT_ID}/oobCodes`
  );
  const { oobCodes } = await res.json();
  return oobCodes
    .filter((c) => c.email === email && c.requestType === 'VERIFY_EMAIL')
    .at(-1)?.oobCode;
}

// The Auth emulator creates users unverified. Walk them through the real
// verification flow (send → read the recorded OOB code → apply it) — the
// documented way to verify an emulator account, same as clicking the email.
async function markVerified(user) {
  await sendEmailVerification(user);
  const oobCode = await latestVerifyEmailCode(user.email);
  if (!oobCode) throw new Error(`No VERIFY_EMAIL oobCode recorded for ${user.email}`);
  await applyActionCode(firebaseAuth, oobCode);
}

beforeAll(() => {
  // Only connect once per test run — connectAuthEmulator throws if called twice
  connectAuthEmulator(firebaseAuth, `http://${EMULATOR_HOST}:${EMULATOR_PORT}`, {
    disableWarnings: true,
  });
  // AuthContext reads the signed-in user's profile from Firestore; keep that
  // read on the isolated emulator too (never the dev emulator or production).
  connectFirestoreEmulator(db, EMULATORS.firestore.host, EMULATORS.firestore.port);
});

beforeEach(async () => {
  await resetEmulatorState();
  const credential = await createUserWithEmailAndPassword(firebaseAuth, KNOWN_EMAIL, KNOWN_PASSWORD);
  // The fixture below stands in for a VERIFIED account — marking it verified
  // keeps "successful login" meaning "reaches the app".
  await markVerified(credential.user);
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

describe('Email verification flow — Firebase Auth Emulator', () => {
  const NEW_EMAIL = 'brand-new@example.com';
  const NEW_PASSWORD = 'new-password-123';

  it('lets a verified user reach the dashboard', async () => {
    renderRoutes('/login');

    await userEvent.type(screen.getByLabelText(/email/i), KNOWN_EMAIL);
    await userEvent.type(screen.getByLabelText('Password'), KNOWN_PASSWORD);
    await userEvent.click(screen.getByRole('button', { name: /log in/i }));

    expect(await screen.findByText('dashboard-home')).toBeInTheDocument();
  });

  it('sends a newly registered unverified account to the verification screen on login', async () => {
    // A just-created account: creationTime is "now" → verification is required.
    const credential = await createUserWithEmailAndPassword(firebaseAuth, NEW_EMAIL, NEW_PASSWORD);
    expect(credential.user.emailVerified).toBe(false);
    await signOut(firebaseAuth);

    renderRoutes('/login');
    await userEvent.type(screen.getByLabelText(/email/i), NEW_EMAIL);
    await userEvent.type(screen.getByLabelText('Password'), NEW_PASSWORD);
    await userEvent.click(screen.getByRole('button', { name: /log in/i }));

    expect(
      await screen.findByRole('heading', { name: /verify your email address/i })
    ).toBeInTheDocument();
    expect(screen.getByText(NEW_EMAIL)).toBeInTheDocument();
  });

  it('end to end: signup sends the email, applying its link verifies the account and unlocks the dashboard', async () => {
    renderRoutes('/signup');

    await userEvent.type(screen.getByLabelText('Full name'), 'New User');
    await userEvent.type(screen.getByLabelText(/email/i), NEW_EMAIL);
    await userEvent.type(screen.getByLabelText('Password'), NEW_PASSWORD);
    await userEvent.type(screen.getByLabelText(/confirm password/i), NEW_PASSWORD);
    await userEvent.click(screen.getByRole('button', { name: /create account/i }));

    // Lands on the verification screen — and the emulator recorded the
    // verification link it would have emailed.
    expect(
      await screen.findByRole('heading', { name: /verify your email address/i }, { timeout: 15_000 })
    ).toBeInTheDocument();
    const oobCode = await latestVerifyEmailCode(NEW_EMAIL);
    expect(oobCode).toBeTruthy();

    // Simulate clicking the emailed link, then confirm the app sees it.
    await applyActionCode(firebaseAuth, oobCode);
    await userEvent.click(screen.getByRole('button', { name: /i've verified my email/i }));

    expect(await screen.findByText('dashboard-home')).toBeInTheDocument();
  });
});
