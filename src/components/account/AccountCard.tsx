/**
 * Account card shown in the simulation section: login/register when
 * logged out, account summary + per-provider API key management when
 * logged in. Never prefills, logs, or persists key/password values —
 * key inputs are cleared immediately after submit regardless of outcome.
 */

import { useState, type FormEvent } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useAuthStore } from '../../store/authStore';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import type { ApiKeyProvider, AuthUser } from '../../services/authApi';

const PROVIDER_LABELS: Record<ApiKeyProvider, string> = {
  anthropic: 'Anthropic',
  openai: 'OpenAI',
};

const PROVIDERS: ApiKeyProvider[] = ['anthropic', 'openai'];

export function AccountCard() {
  const { user, status, error, login, register, logout, putApiKey, deleteApiKey, clearError } =
    useAuthStore(
      useShallow((s) => ({
        user: s.user,
        status: s.status,
        error: s.error,
        login: s.login,
        register: s.register,
        logout: s.logout,
        putApiKey: s.putApiKey,
        deleteApiKey: s.deleteApiKey,
        clearError: s.clearError,
      }))
    );

  return (
    <div className="bg-surface border border-dark-border rounded-xl p-5 shadow-lg shadow-black/20 space-y-4">
      <h3 className="text-lg font-bold text-text-primary">Account</h3>

      {status === 'unknown' || status === 'loading' ? (
        <p className="text-sm text-text-muted">Checking account status...</p>
      ) : user ? (
        <LoggedInPanel
          user={user}
          error={error}
          onLogout={logout}
          onPutKey={putApiKey}
          onDeleteKey={deleteApiKey}
        />
      ) : (
        <AuthForm login={login} register={register} error={error} onClearError={clearError} />
      )}
    </div>
  );
}

interface AuthFormProps {
  login: (username: string, password: string) => Promise<boolean>;
  register: (username: string, password: string) => Promise<boolean>;
  error: string | null;
  onClearError: () => void;
}

function AuthForm({ login, register, error, onClearError }: AuthFormProps) {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const switchMode = (next: 'login' | 'register') => {
    setMode(next);
    onClearError();
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    if (mode === 'login') {
      await login(username, password);
    } else {
      await register(username, password);
    }
    setSubmitting(false);
    // Never keep the password around client-side once the attempt resolves.
    setPassword('');
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="flex gap-2 text-sm" role="tablist" aria-label="Account mode">
        <button
          type="button"
          role="tab"
          aria-selected={mode === 'login'}
          onClick={() => switchMode('login')}
          className={`flex-1 px-3 py-1.5 rounded-lg font-medium transition-colors ${
            mode === 'login'
              ? 'bg-accent text-gray-950'
              : 'bg-surface-raised text-text-muted border border-dark-border hover:text-text-primary'
          }`}
        >
          Log In
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mode === 'register'}
          onClick={() => switchMode('register')}
          className={`flex-1 px-3 py-1.5 rounded-lg font-medium transition-colors ${
            mode === 'register'
              ? 'bg-accent text-gray-950'
              : 'bg-surface-raised text-text-muted border border-dark-border hover:text-text-primary'
          }`}
        >
          Register
        </button>
      </div>

      <div>
        <label htmlFor="account-username" className="block text-xs text-text-muted mb-1">
          Username
        </label>
        <input
          id="account-username"
          name="username"
          autoComplete="username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          className="w-full px-3 py-2 text-sm border border-dark-border bg-surface-raised text-text-primary rounded-md focus:ring-2 focus:ring-accent"
        />
      </div>

      <div>
        <label htmlFor="account-password" className="block text-xs text-text-muted mb-1">
          Password
        </label>
        <input
          id="account-password"
          name="password"
          type="password"
          autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full px-3 py-2 text-sm border border-dark-border bg-surface-raised text-text-primary rounded-md focus:ring-2 focus:ring-accent"
        />
      </div>

      {error && (
        <p role="alert" className="text-xs text-danger">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={submitting || !username.trim() || !password}
        className="w-full px-4 py-2 bg-accent hover:bg-accent-strong text-gray-950 text-sm font-semibold rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {submitting
          ? mode === 'login'
            ? 'Logging in...'
            : 'Creating account...'
          : mode === 'login'
            ? 'Log In'
            : 'Create Account'}
      </button>

      <p className="text-[11px] text-text-muted">
        An account is optional — the simulator works fully without one. Sign in to use your own
        AI provider key with the strategy assistant.
      </p>
    </form>
  );
}

interface LoggedInPanelProps {
  user: AuthUser;
  error: string | null;
  onLogout: () => Promise<void>;
  onPutKey: (provider: ApiKeyProvider, apiKey: string) => Promise<boolean>;
  onDeleteKey: (provider: ApiKeyProvider) => Promise<boolean>;
}

function LoggedInPanel({ user, error, onLogout, onPutKey, onDeleteKey }: LoggedInPanelProps) {
  const [loggingOut, setLoggingOut] = useState(false);

  const handleLogout = async () => {
    setLoggingOut(true);
    await onLogout();
    setLoggingOut(false);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="text-xs text-text-muted">Signed in as</p>
          <p className="font-semibold text-text-primary">
            {user.username}
            {user.isAdmin && (
              <span className="ml-2 align-middle text-[10px] uppercase tracking-wide bg-amber-500/20 text-accent px-2 py-0.5 rounded-full">
                Admin
              </span>
            )}
          </p>
        </div>
        <button
          onClick={handleLogout}
          disabled={loggingOut}
          className="px-3 py-1.5 bg-surface-raised hover:bg-surface-elevated text-text-primary text-xs font-semibold rounded-md border border-dark-border disabled:opacity-50"
        >
          {loggingOut ? 'Signing out...' : 'Log Out'}
        </button>
      </div>

      <div className="space-y-2">
        <p className="text-xs uppercase tracking-wide text-text-muted">AI Provider Keys</p>
        {PROVIDERS.map((provider) => (
          <KeyRow
            key={provider}
            provider={provider}
            configured={user.keys[provider]}
            isAdminSiteKey={user.isAdmin && provider === 'anthropic'}
            onPutKey={onPutKey}
            onDeleteKey={onDeleteKey}
          />
        ))}
      </div>

      {error && (
        <p role="alert" className="text-xs text-danger">
          {error}
        </p>
      )}
    </div>
  );
}

interface KeyRowProps {
  provider: ApiKeyProvider;
  configured: boolean;
  isAdminSiteKey: boolean;
  onPutKey: (provider: ApiKeyProvider, apiKey: string) => Promise<boolean>;
  onDeleteKey: (provider: ApiKeyProvider) => Promise<boolean>;
}

function KeyRow({ provider, configured, isAdminSiteKey, onPutKey, onDeleteKey }: KeyRowProps) {
  const [editing, setEditing] = useState(false);
  const [keyValue, setKeyValue] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  if (isAdminSiteKey) {
    return (
      <div className="flex items-center justify-between rounded-lg border border-dark-border bg-surface-raised px-3 py-2">
        <span className="text-sm font-medium text-text-primary">{PROVIDER_LABELS[provider]}</span>
        <span className="text-xs font-semibold text-success">Site key active</span>
      </div>
    );
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const trimmed = keyValue.trim();
    if (!trimmed) return;
    setSubmitting(true);
    const ok = await onPutKey(provider, trimmed);
    setSubmitting(false);
    // Never retain the key value client-side, win or lose.
    setKeyValue('');
    if (ok) setEditing(false);
  };

  const handleDelete = async () => {
    setConfirmingDelete(false);
    await onDeleteKey(provider);
  };

  return (
    <div className="rounded-lg border border-dark-border bg-surface-raised px-3 py-2 space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-text-primary">{PROVIDER_LABELS[provider]}</span>
        <span className={`text-xs font-semibold ${configured ? 'text-success' : 'text-text-muted'}`}>
          {configured ? 'Configured' : 'Not set'}
        </span>
      </div>

      {editing ? (
        <form onSubmit={handleSubmit} className="flex gap-2">
          <input
            type="password"
            autoComplete="off"
            value={keyValue}
            onChange={(e) => setKeyValue(e.target.value)}
            placeholder={`${PROVIDER_LABELS[provider]} API key`}
            aria-label={`${PROVIDER_LABELS[provider]} API key`}
            className="flex-1 min-w-0 px-2 py-1.5 text-sm border border-dark-border bg-surface text-text-primary rounded-md focus:ring-2 focus:ring-accent"
          />
          <button
            type="submit"
            disabled={submitting || !keyValue.trim()}
            className="px-3 py-1.5 bg-accent text-gray-950 text-xs font-semibold rounded-md disabled:opacity-50 shrink-0"
          >
            {submitting ? 'Saving...' : 'Save'}
          </button>
          <button
            type="button"
            onClick={() => {
              setEditing(false);
              setKeyValue('');
            }}
            className="px-3 py-1.5 bg-surface-elevated text-text-primary text-xs rounded-md border border-dark-border shrink-0"
          >
            Cancel
          </button>
        </form>
      ) : (
        <div className="flex gap-3">
          <button
            onClick={() => setEditing(true)}
            className="text-xs text-accent hover:text-amber-300 font-medium"
          >
            {configured ? 'Replace key' : 'Add key'}
          </button>
          {configured && (
            <button
              onClick={() => setConfirmingDelete(true)}
              className="text-xs text-danger hover:text-red-300 font-medium"
            >
              Delete
            </button>
          )}
        </div>
      )}

      <ConfirmDialog
        open={confirmingDelete}
        title={`Delete ${PROVIDER_LABELS[provider]} key?`}
        message="This removes the stored key from your account. You can add a new one anytime."
        danger
        confirmLabel="Delete"
        onConfirm={handleDelete}
        onCancel={() => setConfirmingDelete(false)}
      />
    </div>
  );
}

export default AccountCard;
