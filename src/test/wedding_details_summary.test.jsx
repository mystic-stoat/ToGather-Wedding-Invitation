import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import WeddingDetails from '../pages/WeddingDetails.jsx';

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: vi.fn(() => ({
    user: { uid: 'test-uid' },
    userProfile: { name: 'Test Host' },
    logout: vi.fn(),
  })),
}));

const mockGetInvitationByUser = vi.fn();
vi.mock('@/lib/firestore', () => ({
  getInvitationByUser: (...args) => mockGetInvitationByUser(...args),
}));

const FULL_INVITATION = {
  weddingId: 'wedding-1',
  groomName: { first: 'Michael', middle: '', last: 'Chen' },
  brideName: { first: 'Sarah', middle: '', last: 'Johnson' },
  eventTitle: 'Sarah & Michael',
  weddingDate: '2028-05-28',
  weddingDateUndecided: false,
  ceremonyTime: '16:30',
  timeZone: 'America/Chicago',
  ceremonyVenueName: 'Rosewood Garden Chapel',
  ceremonyVenueAddress: '245 Garden Lane, Napa Valley, CA',
  receptionVenueName: 'Rosewood Garden Chapel',
  receptionVenueAddress: '245 Garden Lane, Napa Valley, CA',
  dressCode: 'Black Tie Optional',
  weddingWebsite: 'https://sarahandmichael2025.com',
  personalMessage: 'We are so excited to celebrate this special day with you.',
};

describe('WeddingDetails summary screen', () => {
  beforeEach(() => {
    mockGetInvitationByUser.mockReset();
  });

  it('renders without crashing while loading', () => {
    mockGetInvitationByUser.mockReturnValue(new Promise(() => {})); // never resolves
    expect(() => {
      render(<BrowserRouter><WeddingDetails /></BrowserRouter>);
    }).not.toThrow();
    expect(screen.getByText(/loading your wedding details/i)).toBeInTheDocument();
  });

  it('shows an empty state with a call-to-action when there is no invitation yet', async () => {
    mockGetInvitationByUser.mockResolvedValue(null);
    render(<BrowserRouter><WeddingDetails /></BrowserRouter>);

    await waitFor(() => {
      expect(screen.getByText(/no wedding details yet/i)).toBeInTheDocument();
    });
    expect(screen.getByRole('link', { name: /add wedding details/i })).toBeInTheDocument();
  });

  it('renders partner names, date, time, and venues from real invitation data', async () => {
    mockGetInvitationByUser.mockResolvedValue(FULL_INVITATION);
    render(<BrowserRouter><WeddingDetails /></BrowserRouter>);

    await waitFor(() => {
      expect(screen.getByText('Michael Chen')).toBeInTheDocument();
    });
    expect(screen.getByText('Sarah Johnson')).toBeInTheDocument();
    // "May 28, 2028" legitimately appears twice: once in the sidebar's
    // couple-info card and once in the main "Wedding Date" field — both
    // read from the same invitation.weddingDate, so this also guards
    // against the two sample dates being inconsistent (unlike the Figma
    // reference, which showed mismatched sample dates).
    expect(screen.getAllByText('May 28, 2028').length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText('4:30 PM')).toBeInTheDocument();
    expect(screen.getAllByText('Rosewood Garden Chapel').length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText('Black Tie Optional')).toBeInTheDocument();
    expect(screen.getByText(/sarahandmichael2025\.com/)).toBeInTheDocument();
  });

  it('shows "We\'re still deciding" instead of a date/calendar when the date is undecided', async () => {
    mockGetInvitationByUser.mockResolvedValue({
      ...FULL_INVITATION,
      weddingDate: '',
      weddingDateUndecided: true,
    });
    render(<BrowserRouter><WeddingDetails /></BrowserRouter>);

    await waitFor(() => {
      expect(screen.getByText(/we're still deciding/i)).toBeInTheDocument();
    });
    expect(screen.getByText(/add your wedding date to start the countdown/i)).toBeInTheDocument();
    // Must not fabricate/guess a date or day count when undecided
    expect(screen.queryByText(/our forever begins in/i)).not.toBeInTheDocument();
  });

  it('shows graceful "not added yet" placeholders for fields with no stored value', async () => {
    mockGetInvitationByUser.mockResolvedValue({
      groomName: { first: 'Alex', middle: '', last: '' },
      brideName: { first: 'Jordan', middle: '', last: '' },
      weddingDate: '',
      weddingDateUndecided: false,
    });
    render(<BrowserRouter><WeddingDetails /></BrowserRouter>);

    await waitFor(() => {
      expect(screen.getByText('Alex')).toBeInTheDocument();
    });
    // Dress code / website / personal message have no stored value here
    const placeholders = screen.getAllByText(/not added yet/i);
    expect(placeholders.length).toBeGreaterThan(0);
  });

  it('shows a load-error message if the fetch fails, without crashing', async () => {
    mockGetInvitationByUser.mockRejectedValue(new Error('network down'));
    render(<BrowserRouter><WeddingDetails /></BrowserRouter>);

    await waitFor(() => {
      expect(screen.getByText(/couldn't load your wedding details/i)).toBeInTheDocument();
    });
  });
});
