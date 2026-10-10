// Registry tests.
// Registry used to be its own dashboard page (/gift-registry); it now lives in
// the Invitation Builder's Registry tab, with the same behavior and the same
// Firestore data (invitation.registries / invitation.registryMessage). The
// former page tests are kept below, now run against the builder tab, plus
// tests for the phone preview, the main Save button, the redirect and the
// sidebar. The guest-facing RSVP section tests are unchanged.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import CreateInvitation from '../pages/CreateInvitation.jsx';
import Registry from '../pages/Registry.jsx';
import RSVP from '../pages/RSVP.jsx';
import Sidebar from '../components/Sidebar.jsx';
import {
  getInvitationByUser,
  saveInvitation,
  addRegistry,
  updateRegistry,
  deleteRegistry,
} from '@/lib/firestore';
import { getDoc } from 'firebase/firestore';
import {
  isValidRegistryUrl, isRegistryVisible, getVisibleRegistries, hasRegistryContent,
  isRegistrySectionShown,
} from '@/lib/registry';

// ── Module mocks ──────────────────────────────────────────────────────────────
// Mock AuthContext — same pattern as login_page_components.test.jsx
const auth = vi.hoisted(() => ({
  user: { uid: 'host-uid-1' },
  userProfile: null,
  logout: () => {},
  loading: false,
}));
vi.mock('@/contexts/AuthContext', () => ({ useAuth: () => auth }));

// Mock every Firestore helper Registry uses. Registries live inside the
// invitation document (invitation.registries) — there is no standalone
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
vi.mock('@/lib/firebase', () => ({ db: {}, storage: {} }));

// The builder's other tabs (Story/photos, Wedding Party contacts) — not under
// test here, so they are stubbed out.
vi.mock('@/lib/storyStore', () => ({
  loadAllStoryEntries: vi.fn(async () => []),
  commitMediaChanges: vi.fn(async () => {}),
  updateMediaBookkeeping: vi.fn(async () => {}),
}));
vi.mock('@/lib/weddingPartyStore', () => ({
  loadPartyContacts: vi.fn(async () => ({})),
  savePartyContacts: vi.fn(async () => {}),
}));
vi.mock('@/lib/mediaStorage', () => ({
  uploadPhoto: vi.fn(), deletePhoto: vi.fn(async () => true),
  buildHeroPath: vi.fn(), buildStoryPath: vi.fn(), buildPartyPath: vi.fn(),
}));
vi.mock('@/components/GoogleMapEmbed', () => ({
  default: () => null, buildMapQuery: () => '', mapLinkUrl: () => '',
}));

beforeEach(() => {
  vi.clearAllMocks();
  saveInvitation.mockResolvedValue('wedding-1');
  // jsdom's alert is a "not implemented" stub — replace it.
  vi.stubGlobal('alert', vi.fn());
  vi.spyOn(console, 'error').mockImplementation(() => {});
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

// The builder, opened on the Registry tab
const renderRegistry = (path = '/create-invitation?section=registry') =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/create-invitation" element={<CreateInvitation />} />
        <Route path="/gift-registry" element={<Registry />} />
      </Routes>
    </MemoryRouter>
  );

// Default: logged-in host whose invitation doc carries the registries array
const mockLoad = (registries = REGISTRIES, extra = {}) => {
  getInvitationByUser.mockResolvedValue({ ...INVITATION, registries, ...extra });
};

const editor = () => screen.getByRole('main');
// The builder shows a loading screen first — wait for the editor area.
const findInEditor = async (text) => {
  await screen.findByRole('main');
  return within(editor()).findByText(text);
};
const preview = () => screen.getByTestId('invitation-preview');
const previewRegistry = () => within(preview()).queryByTestId('registry-section');
const openAddModal = () =>
  fireEvent.click(within(editor()).getByRole('button', { name: /add registry/i }));
const submitAddModal = () =>
  fireEvent.click(
    within(screen.getByRole('dialog', { name: 'Add Registry' }))
      .getByRole('button', { name: 'Add Registry' })
  );

// ── Builder Registry tab ─────────────────────────────────────────────────────
describe('Registry tab — rendering & loading', () => {
  it('renders the Registry tab with the immediate-save notice and Add Registry button', async () => {
    mockLoad();
    renderRegistry();

    expect(await screen.findByRole('heading', { name: 'Registry' })).toBeInTheDocument();
    expect(screen.getByTestId('registry-immediate-save-notice'))
      .toHaveTextContent(/Registry changes save immediately/);
    expect(screen.getByTestId('registry-immediate-save-notice'))
      .toHaveTextContent(/Save button at the top of the builder doesn't change your registry/);
    expect(within(editor()).getByRole('button', { name: /add registry/i })).toBeInTheDocument();
  });

  it('loads registries and the message from the invitation document', async () => {
    mockLoad();
    renderRegistry();

    expect(await findInEditor('Amazon Wedding Registry')).toBeInTheDocument();
    expect(within(editor()).getByText('Honeymoon Fund')).toBeInTheDocument();
    expect(within(editor()).getByText('https://amazon.com/registry/sarah-michael')).toBeInTheDocument();
    expect(
      screen.getByDisplayValue('Your presence at our wedding is the greatest gift.')
    ).toBeInTheDocument();
    // One read only — the builder's invitation load
    expect(getInvitationByUser).toHaveBeenCalledTimes(1);
    expect(getInvitationByUser).toHaveBeenCalledWith('host-uid-1');
  });

  it('shows the empty state when the invitation has no registries', async () => {
    mockLoad([]);
    renderRegistry();

    expect(await screen.findByText('No registries yet')).toBeInTheDocument();
    expect(screen.getByText(/click "add registry" to link your first/i)).toBeInTheDocument();
  });

  it('shows an error state when the invitation fails to load', async () => {
    getInvitationByUser.mockRejectedValue(new Error('permission denied'));
    renderRegistry();

    expect(await screen.findByText(/Something went wrong/)).toBeInTheDocument();
    expect(within(editor()).queryByRole('button', { name: /add registry/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Save Message' })).not.toBeInTheDocument();
  });

  it('asks for wedding details first when there is no invitation yet', async () => {
    getInvitationByUser.mockResolvedValue(null);
    renderRegistry();

    expect(await screen.findByText(/Fill in your wedding details first \(or click Save/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save Message' })).toBeDisabled();
    openAddModal();
    expect(globalThis.alert).toHaveBeenCalledWith('Please fill in your wedding details first.');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});

describe('Registry tab — add/edit modal', () => {
  it('opens the Add Registry modal with empty fields', async () => {
    mockLoad();
    renderRegistry();
    await findInEditor('Amazon Wedding Registry');

    openAddModal();

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
    await findInEditor('Amazon Wedding Registry');

    openAddModal();
    submitAddModal();

    expect(await screen.findByText('Registry name is required.')).toBeInTheDocument();
    expect(screen.getByText('Registry URL is required.')).toBeInTheDocument();
    expect(addRegistry).not.toHaveBeenCalled();
  });

  it.each(['javascript:alert(1)', 'data:text/html,x', 'notaurl', 'ftp://files.example.com'])(
    'rejects invalid URL %s',
    async (badUrl) => {
      mockLoad();
      renderRegistry();
      await findInEditor('Amazon Wedding Registry');

      openAddModal();
      fireEvent.change(screen.getByPlaceholderText('e.g. Amazon Wedding Registry'), {
        target: { value: 'Bad Link' },
      });
      fireEvent.change(screen.getByPlaceholderText(/https:\/\/www\.example\.com/i), {
        target: { value: badUrl },
      });
      submitAddModal();

      expect(
        await screen.findByText('Enter a valid http:// or https:// URL.')
      ).toBeInTheDocument();
      expect(addRegistry).not.toHaveBeenCalled();
    }
  );

  it('creates a registry immediately and shows it in the list and the preview', async () => {
    mockLoad();
    // The helper returns the updated embedded array after the transaction
    addRegistry.mockResolvedValue([
      ...REGISTRIES,
      { id: 'reg-3', name: 'Crate & Barrel', url: 'https://crateandbarrel.com/registry/chen', isVisible: true },
    ]);
    renderRegistry();
    await findInEditor('Amazon Wedding Registry');

    openAddModal();
    fireEvent.change(screen.getByPlaceholderText('e.g. Amazon Wedding Registry'), {
      target: { value: 'Crate & Barrel' },
    });
    fireEvent.change(screen.getByPlaceholderText(/https:\/\/www\.example\.com/i), {
      target: { value: 'https://crateandbarrel.com/registry/chen' },
    });
    submitAddModal();

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
    expect(await findInEditor('Crate & Barrel')).toBeInTheDocument();
    expect(within(previewRegistry()).getByRole('link', { name: /crate & barrel/i }))
      .toHaveAttribute('href', 'https://crateandbarrel.com/registry/chen');
    // Saved immediately — the builder's main Save was never involved
    expect(saveInvitation).not.toHaveBeenCalled();
  });

  it('keeps the modal open and preserves input when the save fails', async () => {
    mockLoad();
    addRegistry.mockRejectedValue(new Error('network'));
    renderRegistry();
    await findInEditor('Amazon Wedding Registry');

    openAddModal();
    fireEvent.change(screen.getByPlaceholderText('e.g. Amazon Wedding Registry'), {
      target: { value: 'Target Registry' },
    });
    fireEvent.change(screen.getByPlaceholderText(/https:\/\/www\.example\.com/i), {
      target: { value: 'https://target.com/registry' },
    });
    submitAddModal();

    expect(await screen.findByText("Couldn't save this registry. Please try again."))
      .toBeInTheDocument();
    // Typed values are still there after the failure
    expect(screen.getByPlaceholderText('e.g. Amazon Wedding Registry')).toHaveValue('Target Registry');
  });

  it('opens the edit modal populated with the registry values and saves changes', async () => {
    mockLoad();
    updateRegistry.mockResolvedValue([
      { ...REGISTRIES[0], name: 'Amazon Registry (updated)' },
      REGISTRIES[1],
    ]);
    renderRegistry();
    await findInEditor('Amazon Wedding Registry');

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
    expect(await findInEditor('Amazon Registry (updated)')).toBeInTheDocument();
    expect(within(previewRegistry()).getByText('Amazon Registry (updated)')).toBeInTheDocument();
  });

  it('a hidden link stays editable and opens with its switch off', async () => {
    mockLoad();
    renderRegistry();
    await findInEditor('Honeymoon Fund');
    expect(within(editor()).getByText('(hidden from guests)')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Edit Honeymoon Fund' }));
    expect(screen.getByPlaceholderText('e.g. Amazon Wedding Registry')).toHaveValue('Honeymoon Fund');
    expect(screen.getByRole('switch', { name: 'Visible to guests' })).toHaveAttribute(
      'aria-checked', 'false'
    );
  });
});

describe('Registry tab — visibility toggle', () => {
  it('toggles a visible registry to hidden via updateRegistry and drops it from the preview', async () => {
    mockLoad();
    updateRegistry.mockResolvedValue([{ ...REGISTRIES[0], isVisible: false }, REGISTRIES[1]]);
    renderRegistry();
    await findInEditor('Amazon Wedding Registry');
    expect(within(previewRegistry()).getByText('Amazon Wedding Registry')).toBeInTheDocument();

    const toggle = screen.getByRole('switch', {
      name: 'Toggle visibility of Amazon Wedding Registry',
    });
    expect(toggle).toHaveAttribute('aria-checked', 'true');

    fireEvent.click(toggle);

    await waitFor(() => {
      expect(updateRegistry).toHaveBeenCalledWith('wedding-1', 'reg-1', { isVisible: false });
    });
    await waitFor(() => {
      expect(within(preview()).queryByText('Amazon Wedding Registry')).not.toBeInTheDocument();
    });
    // Still listed (and editable) in the builder
    expect(within(editor()).getByText('Amazon Wedding Registry')).toBeInTheDocument();
  });

  it('toggles a hidden registry to visible and adds it to the preview', async () => {
    mockLoad();
    updateRegistry.mockResolvedValue([REGISTRIES[0], { ...REGISTRIES[1], isVisible: true }]);
    renderRegistry();
    await findInEditor('Honeymoon Fund');
    expect(within(preview()).queryByText('Honeymoon Fund')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('switch', { name: 'Toggle visibility of Honeymoon Fund' }));

    await waitFor(() => {
      expect(updateRegistry).toHaveBeenCalledWith('wedding-1', 'reg-2', { isVisible: true });
    });
    expect(await within(previewRegistry()).findByText('Honeymoon Fund')).toBeInTheDocument();
  });

  it('reverts the switch and alerts when the update fails', async () => {
    mockLoad();
    updateRegistry.mockRejectedValue(new Error('offline'));
    renderRegistry();
    await findInEditor('Amazon Wedding Registry');

    fireEvent.click(screen.getByRole('switch', { name: 'Toggle visibility of Amazon Wedding Registry' }));

    await waitFor(() => expect(globalThis.alert).toHaveBeenCalled());
    expect(await screen.findByRole('switch', { name: 'Toggle visibility of Amazon Wedding Registry' }))
      .toHaveAttribute('aria-checked', 'true');
  });
});

describe('Registry tab — delete flow', () => {
  it('shows a confirmation dialog naming the registry', async () => {
    mockLoad();
    renderRegistry();
    await findInEditor('Amazon Wedding Registry');

    fireEvent.click(screen.getByRole('button', { name: 'Delete Amazon Wedding Registry' }));

    expect(screen.getByText('Delete “Amazon Wedding Registry”?')).toBeInTheDocument();
    expect(deleteRegistry).not.toHaveBeenCalled();
  });

  it('cancelling the delete leaves the registry unchanged', async () => {
    mockLoad();
    renderRegistry();
    await findInEditor('Amazon Wedding Registry');

    fireEvent.click(screen.getByRole('button', { name: 'Delete Amazon Wedding Registry' }));
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(screen.queryByText('Delete “Amazon Wedding Registry”?')).not.toBeInTheDocument();
    expect(within(editor()).getByText('Amazon Wedding Registry')).toBeInTheDocument();
    expect(deleteRegistry).not.toHaveBeenCalled();
  });

  it('confirming the delete removes only that registry (list and preview)', async () => {
    mockLoad();
    deleteRegistry.mockResolvedValue([REGISTRIES[1]]);
    renderRegistry();
    await findInEditor('Amazon Wedding Registry');

    fireEvent.click(screen.getByRole('button', { name: 'Delete Amazon Wedding Registry' }));
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));

    await waitFor(() => {
      expect(deleteRegistry).toHaveBeenCalledWith('wedding-1', 'reg-1');
    });
    await waitFor(() => {
      expect(screen.queryByText('Amazon Wedding Registry')).not.toBeInTheDocument();
    });
    // The other registry is untouched
    expect(within(editor()).getByText('Honeymoon Fund')).toBeInTheDocument();
  });
});

describe('Registry tab — registry message', () => {
  it('previews the typed message immediately and saves it to the invitation doc only', async () => {
    mockLoad();
    renderRegistry();
    await findInEditor('Amazon Wedding Registry');

    const textarea = screen.getByLabelText('Registry message');
    fireEvent.change(textarea, { target: { value: 'Gifts optional, hugs preferred.' } });
    // Live preview + "not saved yet" before clicking Save Message
    expect(within(previewRegistry()).getByText('Gifts optional, hugs preferred.')).toBeInTheDocument();
    expect(screen.getByTestId('registry-message-unsaved')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Save Message' }));

    await waitFor(() => {
      expect(saveInvitation).toHaveBeenCalledWith(
        'host-uid-1',
        { registryMessage: 'Gifts optional, hugs preferred.' },
        'wedding-1'
      );
    });
    expect(await screen.findByText('Saved')).toBeInTheDocument();
    expect(screen.queryByTestId('registry-message-unsaved')).not.toBeInTheDocument();
  });

  it('keeps the typed message when saving fails', async () => {
    mockLoad();
    saveInvitation.mockRejectedValue(new Error('offline'));
    renderRegistry();
    await findInEditor('Amazon Wedding Registry');

    const textarea = screen.getByLabelText('Registry message');
    fireEvent.change(textarea, { target: { value: 'unsaved draft text' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save Message' }));

    expect(await screen.findByText("Couldn't save your message. Please try again."))
      .toBeInTheDocument();
    expect(textarea).toHaveValue('unsaved draft text');
  });
});

describe('Registry — phone preview', () => {
  it('shows the message and only visible links, using the guest section', async () => {
    mockLoad();
    renderRegistry();
    await findInEditor('Amazon Wedding Registry');

    const section = previewRegistry();
    expect(within(section).getByText('Gift Registry')).toBeInTheDocument();
    expect(within(section).getByText('Your presence at our wedding is the greatest gift.')).toBeInTheDocument();
    const link = within(section).getByRole('link', { name: /amazon wedding registry/i });
    expect(link).toHaveAttribute('href', 'https://amazon.com/registry/sarah-michael');
    expect(link).toHaveAttribute('rel', expect.stringContaining('noopener'));
    expect(within(section).queryByText('Honeymoon Fund')).not.toBeInTheDocument();
    // No host controls in the preview
    expect(within(section).queryByRole('switch')).not.toBeInTheDocument();
  });

  it('only treats isVisible === true as visible to guests', async () => {
    mockLoad([
      { id: 'a', name: 'Shown', url: 'https://a.example.com', isVisible: true },
      { id: 'b', name: 'No flag', url: 'https://b.example.com' },
      { id: 'c', name: 'Truthy string', url: 'https://c.example.com', isVisible: 'yes' },
    ], { registryMessage: '' });
    renderRegistry();
    await findInEditor('No flag');

    const section = previewRegistry();
    expect(within(section).getByText('Shown')).toBeInTheDocument();
    expect(within(section).queryByText('No flag')).not.toBeInTheDocument();
    expect(within(section).queryByText('Truthy string')).not.toBeInTheDocument();
    // The builder lists them as hidden, with their switch off
    expect(screen.getByRole('switch', { name: 'Toggle visibility of No flag' }))
      .toHaveAttribute('aria-checked', 'false');
  });

  it('shows nothing when there is no message and no visible link', async () => {
    mockLoad([REGISTRIES[1]], { registryMessage: '' });
    renderRegistry();
    await findInEditor('Honeymoon Fund');
    expect(previewRegistry()).toBeNull();
  });

  it('is shown in the preview from any tab, not only the Registry tab', async () => {
    mockLoad();
    renderRegistry('/create-invitation');
    await screen.findByText('Invitation Title'); // Greetings tab
    expect(within(previewRegistry()).getByText('Amazon Wedding Registry')).toBeInTheDocument();
  });
});

describe('Registry — Show Registry on Invitation', () => {
  const sectionSwitch = () => screen.getByRole('switch', { name: 'Show Registry on Invitation' });

  it('is on by default for invitations without the setting', async () => {
    mockLoad();
    renderRegistry();
    await findInEditor('Amazon Wedding Registry');
    expect(sectionSwitch()).toHaveAttribute('aria-checked', 'true');
    expect(screen.queryByTestId('registry-hidden-notice')).not.toBeInTheDocument();
    expect(previewRegistry()).not.toBeNull();
  });

  it('turning it off saves immediately and hides the whole section, keeping all data editable', async () => {
    mockLoad();
    renderRegistry();
    await findInEditor('Amazon Wedding Registry');

    fireEvent.click(sectionSwitch());

    await waitFor(() => {
      expect(saveInvitation).toHaveBeenCalledWith(
        'host-uid-1', { registryShowOnInvitation: false }, 'wedding-1'
      );
    });
    expect(sectionSwitch()).toHaveAttribute('aria-checked', 'false');
    // Message and links are gone from the preview…
    expect(previewRegistry()).toBeNull();
    expect(within(preview()).queryByText('Your presence at our wedding is the greatest gift.')).not.toBeInTheDocument();
    expect(screen.getByTestId('registry-hidden-notice')).toHaveTextContent(/message and links are kept/);
    // …but nothing was deleted and everything stays editable
    expect(deleteRegistry).not.toHaveBeenCalled();
    expect(updateRegistry).not.toHaveBeenCalled();
    expect(within(editor()).getByText('Amazon Wedding Registry')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Your presence at our wedding is the greatest gift.')).toBeInTheDocument();
    // Individual link switches still work
    expect(screen.getByRole('switch', { name: 'Toggle visibility of Amazon Wedding Registry' }))
      .toHaveAttribute('aria-checked', 'true');
    expect(screen.getByRole('switch', { name: 'Toggle visibility of Honeymoon Fund' }))
      .toHaveAttribute('aria-checked', 'false');
  });

  it('turning it back on shows the section again with only visible links', async () => {
    mockLoad(REGISTRIES, { registryShowOnInvitation: false });
    renderRegistry();
    await findInEditor('Amazon Wedding Registry');
    expect(sectionSwitch()).toHaveAttribute('aria-checked', 'false');
    expect(previewRegistry()).toBeNull();

    fireEvent.click(sectionSwitch());

    await waitFor(() => {
      expect(saveInvitation).toHaveBeenCalledWith(
        'host-uid-1', { registryShowOnInvitation: true }, 'wedding-1'
      );
    });
    const section = previewRegistry();
    expect(within(section).getByText('Amazon Wedding Registry')).toBeInTheDocument();
    expect(within(section).queryByText('Honeymoon Fund')).not.toBeInTheDocument();
  });

  it('switches back and shows an error when the save fails', async () => {
    mockLoad();
    saveInvitation.mockRejectedValue(new Error('offline'));
    renderRegistry();
    await findInEditor('Amazon Wedding Registry');

    fireEvent.click(sectionSwitch());

    expect(await screen.findByText("Couldn't update the Registry section. Please try again."))
      .toBeInTheDocument();
    expect(sectionSwitch()).toHaveAttribute('aria-checked', 'true');
    expect(previewRegistry()).not.toBeNull();
  });

  it('is disabled until an invitation exists', async () => {
    getInvitationByUser.mockResolvedValue(null);
    renderRegistry();
    await screen.findByText(/Fill in your wedding details first \(or click Save/);
    expect(sectionSwitch()).toBeDisabled();
  });
});

describe('Registry — builder main Save', () => {
  it('never writes registries or registryMessage', async () => {
    mockLoad();
    renderRegistry();
    await findInEditor('Amazon Wedding Registry');
    // Even with an unsaved message typed in the Registry tab
    fireEvent.change(screen.getByLabelText('Registry message'), { target: { value: 'draft' } });

    fireEvent.click(screen.getAllByText(/^Save$/)[0]);
    await waitFor(() => expect(saveInvitation).toHaveBeenCalled());
    const data = saveInvitation.mock.calls[0][1];
    expect(data).not.toHaveProperty('registries');
    expect(data).not.toHaveProperty('registryMessage');
    expect(data).not.toHaveProperty('registryShowOnInvitation');
    expect(addRegistry).not.toHaveBeenCalled();
    expect(updateRegistry).not.toHaveBeenCalled();
    expect(deleteRegistry).not.toHaveBeenCalled();
  });

  it('Publish does not touch registry data either', async () => {
    mockLoad();
    renderRegistry();
    await findInEditor('Amazon Wedding Registry');
    fireEvent.click(screen.getByText('Publish'));
    await waitFor(() => expect(saveInvitation).toHaveBeenCalled());
    expect(saveInvitation.mock.calls[0][1]).not.toHaveProperty('registries');
    expect(saveInvitation.mock.calls[0][1]).not.toHaveProperty('registryMessage');
  });
});

describe('Registry — persistence', () => {
  it('shows saved links and message again after reopening the builder', async () => {
    // First visit: add a link (saved immediately by the transaction helper)
    mockLoad([]);
    const added = [{ id: 'reg-9', name: 'Zola', url: 'https://zola.com/r/us', isVisible: true }];
    addRegistry.mockResolvedValue(added);
    const first = renderRegistry();
    await screen.findByText('No registries yet');
    openAddModal();
    fireEvent.change(screen.getByPlaceholderText('e.g. Amazon Wedding Registry'), { target: { value: 'Zola' } });
    fireEvent.change(screen.getByPlaceholderText(/https:\/\/www\.example\.com/i), { target: { value: 'https://zola.com/r/us' } });
    submitAddModal();
    await findInEditor('Zola');
    first.unmount();

    // "Refresh": the invitation doc now holds what the helper saved
    mockLoad(added, { registryMessage: 'Thank you!' });
    renderRegistry();
    expect(await findInEditor('Zola')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Thank you!')).toBeInTheDocument();
    expect(within(previewRegistry()).getByText('Zola')).toBeInTheDocument();
    expect(within(previewRegistry()).getByText('Thank you!')).toBeInTheDocument();
  });
});

describe('Registry — old dashboard page', () => {
  it('redirects /gift-registry to the builder Registry tab', async () => {
    mockLoad();
    renderRegistry('/gift-registry');
    expect(await screen.findByRole('heading', { name: 'Registry' })).toBeInTheDocument();
    expect(screen.getByTestId('registry-immediate-save-notice')).toBeInTheDocument();
    expect(within(editor()).getByText('Amazon Wedding Registry')).toBeInTheDocument();
  });

  it('is no longer listed in the dashboard sidebar', () => {
    render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <Sidebar invitation={null} onLogout={() => {}} />
      </MemoryRouter>
    );
    const links = screen.getAllByRole('link').map(a => a.textContent.trim());
    expect(links).not.toContain('Registry');
    expect(screen.queryByRole('link', { name: /registry/i })).not.toBeInTheDocument();
    expect(document.querySelector('a[href="/gift-registry"]')).toBeNull();
    // The rest of the sidebar is unchanged
    for (const label of ['Dashboard', 'Wedding Details', 'Guest List', 'Wedding Assistant', 'Mobile Invitation']) {
      expect(links).toContain(label);
    }
  });
});

// ── Shared helpers (src/lib/registry.js) ─────────────────────────────────────
describe('registry helpers', () => {
  it('accepts only http(s) URLs', () => {
    expect(isValidRegistryUrl(' https://zola.com/r/us ')).toBe(true);
    expect(isValidRegistryUrl('http://example.com')).toBe(true);
    for (const bad of ['javascript:alert(1)', 'data:text/html,x', 'notaurl', 'ftp://x.com', '', null]) {
      expect(isValidRegistryUrl(bad)).toBe(false);
    }
  });

  it('only isVisible === true is visible to guests', () => {
    expect(isRegistryVisible({ isVisible: true })).toBe(true);
    expect(isRegistryVisible({ isVisible: false })).toBe(false);
    expect(isRegistryVisible({})).toBe(false);
    expect(isRegistryVisible({ isVisible: 'true' })).toBe(false);
    expect(getVisibleRegistries(REGISTRIES).map(r => r.id)).toEqual(['reg-1']);
    expect(getVisibleRegistries(undefined)).toEqual([]);
  });

  it('shows the section unless it was explicitly turned off', () => {
    expect(isRegistrySectionShown({})).toBe(true);
    expect(isRegistrySectionShown(null)).toBe(true);
    expect(isRegistrySectionShown({ registryShowOnInvitation: true })).toBe(true);
    expect(isRegistrySectionShown({ registryShowOnInvitation: false })).toBe(false);
  });

  it('knows when the guest section has something to show', () => {
    expect(hasRegistryContent([], '')).toBe(false);
    expect(hasRegistryContent([REGISTRIES[1]], '  ')).toBe(false);
    expect(hasRegistryContent([REGISTRIES[1]], 'Hi')).toBe(true);
    expect(hasRegistryContent(REGISTRIES, '')).toBe(true);
  });
});

// ── Guest-facing RegistrySection (RSVP.jsx) — unchanged ──────────────────────
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

  it('hides the whole section from guests when Show Registry on Invitation is off', async () => {
    mockGuestDocs({
      registryShowOnInvitation: false,
      registryMessage: 'See our wishlist below.',
      registries: [
        { id: 'reg-1', name: 'Amazon Wedding Registry', url: 'https://amazon.com/registry/x', isVisible: true },
      ],
    });
    renderRSVP();

    await screen.findByRole('button', { name: /joyfully accepts/i });
    expect(screen.queryByText('Gift Registry')).not.toBeInTheDocument();
    expect(screen.queryByText('See our wishlist below.')).not.toBeInTheDocument();
    expect(screen.queryByText('Amazon Wedding Registry')).not.toBeInTheDocument();
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
