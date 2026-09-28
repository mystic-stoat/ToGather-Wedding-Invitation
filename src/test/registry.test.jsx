import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { BrowserRouter, MemoryRouter, Route, Routes } from 'react-router-dom';
import Registry from '../pages/Registry.jsx';
import RSVP from '../pages/RSVP.jsx';
import {
  getInvitationByUser,
  saveInvitation,
  addRegistry,
  updateRegistry,
  deleteRegistry,
} from '@/lib/firestore';
import { getDoc } from 'firebase/firestore';

// ── Module mocks ──────────────────────────────────────────────────────────────
// Mock AuthContext — same pattern as login_page_components.test.jsx
vi.mock('@/contexts/AuthContext', () => ({
  useAuth: vi.fn(() => ({
    user: { uid: 'host-uid-1' },
    userProfile: null,
    logout: vi.fn(),
    loading: false,
  })),
}));

// Mock every Firestore helper the Registry page uses. Registries live inside
// the invitation document (invitation.registries) — there is no standalone
// collection, so helpers take (weddingId, ...) and return the updated array.
vi.mock('@/lib/firestore', () => ({
  getInvitationByUser: vi.fn(),
  saveInvitation: vi.fn(),
  addRegistry: vi.fn(),
  updateRegistry: vi.fn(),
  deleteRegistry: vi.fn(),
  submitRSVP: vi.fn(), // imported by RSVP.jsx
}));

// RSVP.jsx reads invitee/invitation docs through firebase/firestore directly —
// stub just the two functions it uses (db comes from @/lib/firebase below).
vi.mock('firebase/firestore', () => ({
  doc: vi.fn(() => ({ id: 'doc-ref' })),
  getDoc: vi.fn(),
}));
vi.mock('@/lib/firebase', () => ({ db: {} }));

// jsdom's window.alert is a stub that throws "not implemented" — replace it
// so tests that exercise alert paths don't crash.
beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(window, 'alert').mockImplementation(() => {});
});

// ── Fixtures ──────────────────────────────────────────────────────────────────
const REGISTRIES = [
  {
    id: 'reg-1',
    name: 'Amazon Wedding Registry',
    url: 'https://amazon.com/registry/sarah-michael',
    isVisible: true,
  },
  {
    id: 'reg-2',
    name: 'Honeymoon Fund',
    url: 'https://enroll.zellepay.com/honeymoon',
    isVisible: false,
  },
];

const INVITATION = {
  weddingId: 'wedding-1',
  registryMessage: 'Your presence at our wedding is the greatest gift.',
  registries: REGISTRIES,
};

const renderRegistry = () =>
  render(
    <BrowserRouter>
      <Registry />
    </BrowserRouter>
  );

// Default: logged-in host whose invitation doc carries the registries array
const mockLoad = (registries = REGISTRIES, extra = {}) => {
  getInvitationByUser.mockResolvedValue({ ...INVITATION, registries, ...extra });
};

// ── Registry page ─────────────────────────────────────────────────────────────
describe('Registry Page — rendering & loading', () => {
  it('renders heading, subtitle, and Add Registry button', async () => {
    mockLoad();
    renderRegistry();

    expect(await screen.findByRole('heading', { name: 'Registry' })).toBeInTheDocument();
    expect(screen.getByText('Manage your gift registries and links.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /add registry/i })).toBeInTheDocument();
  });

  it('loads registries and the message from the invitation document', async () => {
    mockLoad();
    renderRegistry();

    expect(await screen.findByText('Amazon Wedding Registry')).toBeInTheDocument();
    expect(screen.getByText('Honeymoon Fund')).toBeInTheDocument();
    expect(screen.getByText('https://amazon.com/registry/sarah-michael')).toBeInTheDocument();
    expect(
      screen.getByDisplayValue('Your presence at our wedding is the greatest gift.')
    ).toBeInTheDocument();
    expect(getInvitationByUser).toHaveBeenCalledWith('host-uid-1');
  });

  it('shows the empty state when the invitation has no registries', async () => {
    mockLoad([]);
    renderRegistry();

    expect(await screen.findByText('No registries yet')).toBeInTheDocument();
    expect(screen.getByText(/click "add registry" to link your first/i)).toBeInTheDocument();
  });

  it('shows an error state with retry when the invitation fails to load', async () => {
    getInvitationByUser.mockRejectedValue(new Error('permission denied'));
    renderRegistry();

    expect(await screen.findByText('Something went wrong')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();
  });
});

describe('Registry Page — add/edit modal', () => {
  it('opens the Add Registry modal with empty fields', async () => {
    mockLoad();
    renderRegistry();
    await screen.findByText('Amazon Wedding Registry');

    fireEvent.click(screen.getByRole('button', { name: /add registry/i }));

    expect(screen.getByPlaceholderText('e.g. Amazon Wedding Registry')).toHaveValue('');
    expect(screen.getByPlaceholderText(/https:\/\/www\.example\.com/i)).toHaveValue('');
    // New registries default to visible
    expect(screen.getByRole('switch', { name: 'Visible to guests' })).toHaveAttribute(
      'aria-checked', 'true'
    );
  });

  it('rejects empty required fields without calling Firestore', async () => {
    mockLoad();
    renderRegistry();
    await screen.findByText('Amazon Wedding Registry');

    fireEvent.click(screen.getByRole('button', { name: /add registry/i }));
    fireEvent.click(
      within(screen.getByRole('dialog', { name: 'Add Registry' }))
        .getByRole('button', { name: 'Add Registry' })
    );

    expect(await screen.findByText('Registry name is required.')).toBeInTheDocument();
    expect(screen.getByText('Registry URL is required.')).toBeInTheDocument();
    expect(addRegistry).not.toHaveBeenCalled();
  });

  it.each(['javascript:alert(1)', 'data:text/html,x', 'notaurl', 'ftp://files.example.com'])(
    'rejects invalid URL %s',
    async (badUrl) => {
      mockLoad();
      renderRegistry();
      await screen.findByText('Amazon Wedding Registry');

      fireEvent.click(screen.getByRole('button', { name: /add registry/i }));
      fireEvent.change(screen.getByPlaceholderText('e.g. Amazon Wedding Registry'), {
        target: { value: 'Bad Link' },
      });
      fireEvent.change(screen.getByPlaceholderText(/https:\/\/www\.example\.com/i), {
        target: { value: badUrl },
      });
      fireEvent.click(
        within(screen.getByRole('dialog', { name: 'Add Registry' }))
          .getByRole('button', { name: 'Add Registry' })
      );

      expect(
        await screen.findByText('Enter a valid http:// or https:// URL.')
      ).toBeInTheDocument();
      expect(addRegistry).not.toHaveBeenCalled();
    }
  );

  it('creates a registry with a valid name and https URL', async () => {
    mockLoad();
    // The helper returns the updated embedded array after the transaction
    addRegistry.mockResolvedValue([
      ...REGISTRIES,
      { id: 'reg-3', name: 'Crate & Barrel', url: 'https://crateandbarrel.com/registry/chen', isVisible: true },
    ]);
    renderRegistry();
    await screen.findByText('Amazon Wedding Registry');

    fireEvent.click(screen.getByRole('button', { name: /add registry/i }));
    fireEvent.change(screen.getByPlaceholderText('e.g. Amazon Wedding Registry'), {
      target: { value: 'Crate & Barrel' },
    });
    fireEvent.change(screen.getByPlaceholderText(/https:\/\/www\.example\.com/i), {
      target: { value: 'https://crateandbarrel.com/registry/chen' },
    });
    fireEvent.click(
      within(screen.getByRole('dialog', { name: 'Add Registry' }))
        .getByRole('button', { name: 'Add Registry' })
    );

    await waitFor(() => {
      expect(addRegistry).toHaveBeenCalledWith('wedding-1', {
        name: 'Crate & Barrel',
        url: 'https://crateandbarrel.com/registry/chen',
        isVisible: true,
      });
    });
    // Modal closes and the returned array renders — the new registry persists
    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
    expect(await screen.findByText('Crate & Barrel')).toBeInTheDocument();
  });

  it('keeps the modal open and preserves input when the save fails', async () => {
    mockLoad();
    addRegistry.mockRejectedValue(new Error('network'));
    renderRegistry();
    await screen.findByText('Amazon Wedding Registry');

    fireEvent.click(screen.getByRole('button', { name: /add registry/i }));
    fireEvent.change(screen.getByPlaceholderText('e.g. Amazon Wedding Registry'), {
      target: { value: 'Target Registry' },
    });
    fireEvent.change(screen.getByPlaceholderText(/https:\/\/www\.example\.com/i), {
      target: { value: 'https://target.com/registry' },
    });
    fireEvent.click(
      within(screen.getByRole('dialog', { name: 'Add Registry' }))
        .getByRole('button', { name: 'Add Registry' })
    );

    expect(await screen.findByText("Couldn't save this registry. Please try again."))
      .toBeInTheDocument();
    // Typed values are still there after the failure
    expect(screen.getByPlaceholderText('e.g. Amazon Wedding Registry')).toHaveValue('Target Registry');
  });

  it('opens the edit modal populated with the registry values', async () => {
    mockLoad();
    updateRegistry.mockResolvedValue([
      { ...REGISTRIES[0], name: 'Amazon Registry (updated)' },
      REGISTRIES[1],
    ]);
    renderRegistry();
    await screen.findByText('Amazon Wedding Registry');

    fireEvent.click(screen.getByRole('button', { name: 'Edit Amazon Wedding Registry' }));

    const nameInput = screen.getByPlaceholderText('e.g. Amazon Wedding Registry');
    const urlInput = screen.getByPlaceholderText(/https:\/\/www\.example\.com/i);
    expect(nameInput).toHaveValue('Amazon Wedding Registry');
    expect(urlInput).toHaveValue('https://amazon.com/registry/sarah-michael');
    expect(screen.getByRole('switch', { name: 'Visible to guests' })).toHaveAttribute(
      'aria-checked', 'true'
    );

    fireEvent.change(nameInput, { target: { value: 'Amazon Registry (updated)' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save Changes' }));

    await waitFor(() => {
      expect(updateRegistry).toHaveBeenCalledWith('wedding-1', 'reg-1', {
        name: 'Amazon Registry (updated)',
        url: 'https://amazon.com/registry/sarah-michael',
        isVisible: true,
      });
    });
    expect(addRegistry).not.toHaveBeenCalled();
    expect(await screen.findByText('Amazon Registry (updated)')).toBeInTheDocument();
  });
});

describe('Registry Page — visibility toggle', () => {
  it('toggles a visible registry to hidden via updateRegistry', async () => {
    mockLoad();
    updateRegistry.mockResolvedValue([{ ...REGISTRIES[0], isVisible: false }, REGISTRIES[1]]);
    renderRegistry();
    await screen.findByText('Amazon Wedding Registry');

    const toggle = screen.getByRole('switch', {
      name: 'Toggle visibility of Amazon Wedding Registry',
    });
    expect(toggle).toHaveAttribute('aria-checked', 'true');

    fireEvent.click(toggle);

    await waitFor(() => {
      expect(updateRegistry).toHaveBeenCalledWith('wedding-1', 'reg-1', { isVisible: false });
    });
  });
});

describe('Registry Page — delete flow', () => {
  it('shows a confirmation dialog naming the registry', async () => {
    mockLoad();
    renderRegistry();
    await screen.findByText('Amazon Wedding Registry');

    fireEvent.click(screen.getByRole('button', { name: 'Delete Amazon Wedding Registry' }));

    expect(screen.getByText('Delete “Amazon Wedding Registry”?')).toBeInTheDocument();
    expect(deleteRegistry).not.toHaveBeenCalled();
  });

  it('cancelling the delete leaves the registry unchanged', async () => {
    mockLoad();
    renderRegistry();
    await screen.findByText('Amazon Wedding Registry');

    fireEvent.click(screen.getByRole('button', { name: 'Delete Amazon Wedding Registry' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(screen.queryByText('Delete “Amazon Wedding Registry”?')).not.toBeInTheDocument();
    expect(screen.getByText('Amazon Wedding Registry')).toBeInTheDocument();
    expect(deleteRegistry).not.toHaveBeenCalled();
  });

  it('confirming the delete removes only that registry', async () => {
    mockLoad();
    deleteRegistry.mockResolvedValue([REGISTRIES[1]]);
    renderRegistry();
    await screen.findByText('Amazon Wedding Registry');

    fireEvent.click(screen.getByRole('button', { name: 'Delete Amazon Wedding Registry' }));
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));

    await waitFor(() => {
      expect(deleteRegistry).toHaveBeenCalledWith('wedding-1', 'reg-1');
    });
    await waitFor(() => {
      expect(screen.queryByText('Amazon Wedding Registry')).not.toBeInTheDocument();
    });
    // The other registry is untouched
    expect(screen.getByText('Honeymoon Fund')).toBeInTheDocument();
  });
});

describe('Registry Page — registry message', () => {
  it('saves the message to the invitation doc only', async () => {
    mockLoad();
    renderRegistry();
    await screen.findByText('Amazon Wedding Registry');

    const textarea = screen.getByLabelText('Registry message');
    fireEvent.change(textarea, { target: { value: 'Gifts optional, hugs preferred.' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save Message' }));

    await waitFor(() => {
      expect(saveInvitation).toHaveBeenCalledWith(
        'host-uid-1',
        { registryMessage: 'Gifts optional, hugs preferred.' },
        'wedding-1'
      );
    });
    expect(await screen.findByText('Saved')).toBeInTheDocument();
  });

  it('keeps the typed message when saving fails', async () => {
    mockLoad();
    saveInvitation.mockRejectedValue(new Error('offline'));
    renderRegistry();
    await screen.findByText('Amazon Wedding Registry');

    const textarea = screen.getByLabelText('Registry message');
    fireEvent.change(textarea, { target: { value: 'unsaved draft text' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save Message' }));

    expect(await screen.findByText("Couldn't save your message. Please try again."))
      .toBeInTheDocument();
    expect(textarea).toHaveValue('unsaved draft text');
  });
});

// ── Guest-facing RegistrySection (inside RSVP.jsx) ────────────────────────────
const renderRSVP = () =>
  render(
    <MemoryRouter initialEntries={['/rsvp/invitee-1/valid-token']}>
      <Routes>
        <Route path="/rsvp/:inviteeId/:token" element={<RSVP />} />
      </Routes>
    </MemoryRouter>
  );

const mockGuestDocs = (invitationData = {}) => {
  // First getDoc → invitee doc, second → invitation doc (which carries
  // registryMessage and the embedded registries array)
  getDoc
    .mockResolvedValueOnce({
      exists: () => true,
      id: 'invitee-1',
      data: () => ({ token: 'valid-token', tokenUsed: false, weddingId: 'wedding-1' }),
    })
    .mockResolvedValueOnce({
      exists: () => true,
      id: 'wedding-1',
      data: () => ({
        groomName: { first: 'Michael' },
        brideName: { first: 'Sarah' },
        ...invitationData,
      }),
    });
};

describe('Guest-facing registry section', () => {
  it('shows the registry message and only visible registries to guests', async () => {
    mockGuestDocs({
      registryMessage: 'See our wishlist below.',
      registries: [
        { id: 'reg-1', name: 'Amazon Wedding Registry', url: 'https://amazon.com/registry/x', isVisible: true },
        { id: 'reg-2', name: 'Secret Registry', url: 'https://secret.example.com', isVisible: false },
      ],
    });
    renderRSVP();

    expect(await screen.findByText('Gift Registry')).toBeInTheDocument();
    expect(screen.getByText('See our wishlist below.')).toBeInTheDocument();

    const link = screen.getByRole('link', { name: /amazon wedding registry/i });
    expect(link).toHaveAttribute('href', 'https://amazon.com/registry/x');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', expect.stringContaining('noopener'));

    // Hidden registry is filtered client-side — never rendered for guests
    expect(screen.queryByText('Secret Registry')).not.toBeInTheDocument();
    // No host controls on the public page
    expect(screen.queryByRole('switch')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /delete/i })).not.toBeInTheDocument();
  });

  it('renders nothing when there is no message and no visible registries', async () => {
    mockGuestDocs({
      registries: [
        { id: 'reg-9', name: 'Hidden Only', url: 'https://x.example.com', isVisible: false },
      ],
    });
    renderRSVP();

    await screen.findByRole('button', { name: /joyfully accepts/i });
    expect(screen.queryByText('Gift Registry')).not.toBeInTheDocument();
    expect(screen.queryByText('Hidden Only')).not.toBeInTheDocument();
  });
});
