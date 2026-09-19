import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import WeddingDetailsEdit from '../pages/WeddingDetailsEdit.jsx';

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: vi.fn(() => ({
    user: { uid: 'test-uid' },
    userProfile: { name: 'Test Host' },
  })),
}));

const mockGetInvitationByUser = vi.fn();
const mockSaveInvitation = vi.fn();
vi.mock('@/lib/firestore', () => ({
  getInvitationByUser: (...args) => mockGetInvitationByUser(...args),
  saveInvitation: (...args) => mockSaveInvitation(...args),
}));

const EXISTING_INVITATION = {
  weddingId: 'wedding-1',
  groomName: { first: 'Michael', middle: 'A', last: 'Chen' },
  brideName: { first: 'Sarah', middle: '', last: 'Johnson' },
  eventTitle: 'Sarah & Michael',
  weddingDate: '2028-05-28',
  weddingDateUndecided: false,
  ceremonyTime: '16:30',
  timeZone: 'America/Chicago',
  ceremonyVenueName: 'Rosewood Garden Chapel',
  receptionVenueName: 'Rosewood Garden Chapel',
  city: 'Napa Valley',
  state: 'CA',
  // Fields this form does NOT own/edit — must survive a save untouched.
  dressCode: 'Black Tie Optional',
  weddingWebsite: 'https://sarahandmichael2025.com',
  personalMessage: 'So excited to celebrate with you!',
  inviteDeadline: '2028-04-01',
  colorPalette1: '#7a9e7e',
  font1: 'Playfair Display',
};

describe('WeddingDetailsEdit form', () => {
  beforeEach(() => {
    mockGetInvitationByUser.mockReset();
    mockSaveInvitation.mockReset();
  });

  it('renders all fields from the Figma edit reference with accessible labels', async () => {
    mockGetInvitationByUser.mockResolvedValue(null);
    render(<BrowserRouter><WeddingDetailsEdit /></BrowserRouter>);

    await waitFor(() => {
      expect(screen.getByLabelText('Event Display Title')).toBeInTheDocument();
    });

    expect(screen.getByLabelText('Partner one first name')).toBeInTheDocument();
    expect(screen.getByLabelText('Partner one middle name')).toBeInTheDocument();
    expect(screen.getByLabelText('Partner one last name')).toBeInTheDocument();
    expect(screen.getByLabelText('Partner two first name')).toBeInTheDocument();
    expect(screen.getByLabelText('Date')).toBeInTheDocument();
    expect(screen.getByLabelText(/we're still deciding/i)).toBeInTheDocument();
    expect(screen.getByLabelText('Ceremony Time')).toBeInTheDocument();
    expect(screen.getByLabelText('Time Zone')).toBeInTheDocument();
    expect(screen.getByLabelText('Event Venue')).toBeInTheDocument();
    expect(screen.getByLabelText('Reception Venue')).toBeInTheDocument();
    expect(screen.getByLabelText('City')).toBeInTheDocument();
    expect(screen.getByLabelText('State')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /save/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
  });

  it('prefills existing wedding data', async () => {
    mockGetInvitationByUser.mockResolvedValue(EXISTING_INVITATION);
    render(<BrowserRouter><WeddingDetailsEdit /></BrowserRouter>);

    await waitFor(() => {
      expect(screen.getByLabelText('Partner one first name')).toHaveValue('Michael');
    });
    expect(screen.getByLabelText('Partner one middle name')).toHaveValue('A');
    expect(screen.getByLabelText('Partner two first name')).toHaveValue('Sarah');
    expect(screen.getByLabelText('Date')).toHaveValue('2028-05-28');
    expect(screen.getByLabelText('Ceremony Time')).toHaveValue('16:30');
    expect(screen.getByLabelText('Event Venue')).toHaveValue('Rosewood Garden Chapel');
    expect(screen.getByLabelText('City')).toHaveValue('Napa Valley');
    expect(screen.getByLabelText('State')).toHaveValue('CA');
  });

  it('shows validation errors and does not save when required fields are missing', async () => {
    mockGetInvitationByUser.mockResolvedValue(null);
    render(<BrowserRouter><WeddingDetailsEdit /></BrowserRouter>);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /save/i })).toBeInTheDocument();
    });

    await userEvent.click(screen.getByRole('button', { name: /save/i }));

    expect(await screen.findByText(/please complete the required fields/i)).toBeInTheDocument();
    expect(mockSaveInvitation).not.toHaveBeenCalled();
  });

  it('lets "We\'re still deciding" stand in for a required date', async () => {
    mockGetInvitationByUser.mockResolvedValue(null);
    mockSaveInvitation.mockResolvedValue('new-wedding-id');
    render(<BrowserRouter><WeddingDetailsEdit /></BrowserRouter>);

    await waitFor(() => {
      expect(screen.getByLabelText('Partner one first name')).toBeInTheDocument();
    });

    await userEvent.type(screen.getByLabelText('Partner one first name'), 'Michael');
    await userEvent.type(screen.getByLabelText('Partner two first name'), 'Sarah');
    await userEvent.click(screen.getByLabelText(/we're still deciding/i));
    await userEvent.type(screen.getByLabelText('Ceremony Time'), '16:30');
    await userEvent.type(screen.getByLabelText('Event Venue'), 'Rosewood Garden Chapel');

    await userEvent.click(screen.getByRole('button', { name: /save/i }));

    await waitFor(() => expect(mockSaveInvitation).toHaveBeenCalledTimes(1));
    const [, savedData] = mockSaveInvitation.mock.calls[0];
    expect(savedData.weddingDateUndecided).toBe(true);
    expect(savedData.weddingDate).toBe("");
  });

  it('saves only the fields this form owns, leaving unrelated stored fields untouched', async () => {
    // This is the key regression guard for "saving without losing unrelated
    // fields": dressCode/weddingWebsite/personalMessage/inviteDeadline/
    // colorPalette1/font1 must never appear in the update payload, so
    // Firestore's partial updateDoc merge can't wipe them out.
    mockGetInvitationByUser.mockResolvedValue(EXISTING_INVITATION);
    mockSaveInvitation.mockResolvedValue('wedding-1');
    render(<BrowserRouter><WeddingDetailsEdit /></BrowserRouter>);

    await waitFor(() => {
      expect(screen.getByLabelText('Partner one first name')).toHaveValue('Michael');
    });

    await userEvent.click(screen.getByRole('button', { name: /save/i }));

    await waitFor(() => expect(mockSaveInvitation).toHaveBeenCalledTimes(1));
    const [uid, savedData, weddingId] = mockSaveInvitation.mock.calls[0];

    expect(uid).toBe('test-uid');
    expect(weddingId).toBe('wedding-1');

    // Owned fields are present:
    expect(savedData).toMatchObject({
      groomName: { first: 'Michael', middle: 'A', last: 'Chen' },
      brideName: { first: 'Sarah', middle: '', last: 'Johnson' },
      weddingDate: '2028-05-28',
      ceremonyTime: '16:30',
      ceremonyVenueName: 'Rosewood Garden Chapel',
    });

    // Fields NOT owned by this form must be absent from the payload:
    expect(savedData).not.toHaveProperty('dressCode');
    expect(savedData).not.toHaveProperty('weddingWebsite');
    expect(savedData).not.toHaveProperty('personalMessage');
    expect(savedData).not.toHaveProperty('inviteDeadline');
    expect(savedData).not.toHaveProperty('colorPalette1');
    expect(savedData).not.toHaveProperty('font1');
  });

  it('keeps the entered values on screen if saving fails, so the host can retry', async () => {
    mockGetInvitationByUser.mockResolvedValue(EXISTING_INVITATION);
    mockSaveInvitation.mockRejectedValue(new Error('offline'));
    render(<BrowserRouter><WeddingDetailsEdit /></BrowserRouter>);

    await waitFor(() => {
      expect(screen.getByLabelText('Partner one first name')).toHaveValue('Michael');
    });

    await userEvent.click(screen.getByRole('button', { name: /save/i }));

    expect(await screen.findByText(/failed to save/i)).toBeInTheDocument();
    // Entered values must still be there for a retry — not wiped on failure
    expect(screen.getByLabelText('Partner one first name')).toHaveValue('Michael');
    expect(screen.getByLabelText('Event Venue')).toHaveValue('Rosewood Garden Chapel');
  });

  it('Cancel does not save and leaves persisted values unchanged', async () => {
    mockGetInvitationByUser.mockResolvedValue(EXISTING_INVITATION);
    render(<BrowserRouter><WeddingDetailsEdit /></BrowserRouter>);

    await waitFor(() => {
      expect(screen.getByLabelText('Partner one first name')).toHaveValue('Michael');
    });

    await userEvent.click(screen.getByRole('button', { name: /cancel/i }));

    expect(mockSaveInvitation).not.toHaveBeenCalled();
  });
});
