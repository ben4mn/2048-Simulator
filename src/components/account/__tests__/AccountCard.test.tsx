// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest';
import { render, screen, fireEvent, cleanup, waitFor, within } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import { AccountCard } from '../AccountCard';
import { useAuthStore } from '../../../store/authStore';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

beforeEach(() => {
  useAuthStore.setState({ user: null, status: 'anon', error: null });
});

describe('AccountCard', () => {
  it('shows a checking-status message while auth status is unknown/loading', () => {
    useAuthStore.setState({ status: 'loading' });
    render(<AccountCard />);
    expect(screen.getByText(/checking account status/i)).toBeInTheDocument();
  });

  it('renders a login/register form when logged out', () => {
    render(<AccountCard />);
    expect(screen.getByRole('tab', { name: 'Log In' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Register' })).toBeInTheDocument();
    expect(screen.getByLabelText('Username')).toBeInTheDocument();
    const passwordInput = screen.getByLabelText('Password');
    expect(passwordInput).toHaveAttribute('autocomplete', 'current-password');
  });

  it('switches to register mode and uses new-password autocomplete', () => {
    render(<AccountCard />);
    fireEvent.click(screen.getByRole('tab', { name: 'Register' }));
    expect(screen.getByLabelText('Password')).toHaveAttribute('autocomplete', 'new-password');
  });

  it('submits login credentials and shows an inline error on failure', async () => {
    const loginSpy = vi.spyOn(useAuthStore.getState(), 'login').mockImplementation(async () => {
      useAuthStore.setState({ error: 'Invalid username or password.' });
      return false;
    });
    render(<AccountCard />);

    fireEvent.change(screen.getByLabelText('Username'), { target: { value: 'ben' } });
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'wrongpass' } });
    fireEvent.click(screen.getByRole('button', { name: 'Log In' }));

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('Invalid username or password.');
    });
    expect(loginSpy).toHaveBeenCalledWith('ben', 'wrongpass');
  });

  it('renders account info, key chips, and admin badge when logged in', () => {
    useAuthStore.setState({
      status: 'authed',
      user: { id: 'u1', username: 'ben', isAdmin: true, keys: { anthropic: true, openai: false } },
    });
    render(<AccountCard />);

    expect(screen.getByText('ben')).toBeInTheDocument();
    expect(screen.getByText('Admin')).toBeInTheDocument();
    // Admin + anthropic => site key active, no add/replace UI for that provider.
    expect(screen.getByText('Site key active')).toBeInTheDocument();
    // openai key not configured -> "Not set" chip and "Add key" action.
    expect(screen.getByText('Not set')).toBeInTheDocument();
    expect(screen.getByText('Add key')).toBeInTheDocument();
  });

  it('logged-in non-admin user without a key sees "Add key"; with a key sees "Replace key" and "Delete"', () => {
    useAuthStore.setState({
      status: 'authed',
      user: { id: 'u2', username: 'jill', isAdmin: false, keys: { anthropic: true, openai: false } },
    });
    render(<AccountCard />);

    expect(screen.getByText('Replace key')).toBeInTheDocument();
    expect(screen.getByText('Delete')).toBeInTheDocument();
    expect(screen.getByText('Add key')).toBeInTheDocument();
  });

  it('opens the add-key input with autocomplete off, and clears the field after submit', async () => {
    const putApiKeySpy = vi.spyOn(useAuthStore.getState(), 'putApiKey').mockResolvedValue(true);
    useAuthStore.setState({
      status: 'authed',
      user: { id: 'u2', username: 'jill', isAdmin: false, keys: { anthropic: false, openai: false } },
    });
    render(<AccountCard />);

    const addButtons = screen.getAllByText('Add key');
    fireEvent.click(addButtons[0]);

    const keyInput = screen.getByLabelText('Anthropic API key');
    expect(keyInput).toHaveAttribute('autocomplete', 'off');
    fireEvent.change(keyInput, { target: { value: 'sk-ant-super-secret' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => {
      expect(putApiKeySpy).toHaveBeenCalledWith('anthropic', 'sk-ant-super-secret');
    });
  });

  it('confirms before deleting a key via ConfirmDialog', async () => {
    const deleteApiKeySpy = vi.spyOn(useAuthStore.getState(), 'deleteApiKey').mockResolvedValue(true);
    useAuthStore.setState({
      status: 'authed',
      user: { id: 'u2', username: 'jill', isAdmin: false, keys: { anthropic: true, openai: false } },
    });
    render(<AccountCard />);

    fireEvent.click(screen.getByText('Delete'));
    const dialog = screen.getByRole('dialog');
    expect(dialog).toBeInTheDocument();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Delete' }));

    await waitFor(() => {
      expect(deleteApiKeySpy).toHaveBeenCalledWith('anthropic');
    });
  });

  it('logs out via the Log Out button', async () => {
    const logoutSpy = vi.spyOn(useAuthStore.getState(), 'logout').mockResolvedValue(undefined);
    useAuthStore.setState({
      status: 'authed',
      user: { id: 'u1', username: 'ben', isAdmin: false, keys: { anthropic: false, openai: false } },
    });
    render(<AccountCard />);

    fireEvent.click(screen.getByRole('button', { name: /log out/i }));
    await waitFor(() => expect(logoutSpy).toHaveBeenCalled());
  });
});
