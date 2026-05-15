import { useEffect, useState } from 'react';
import { EditorLayout } from './components/layout/EditorLayout';
import { api, clearTokens, setTokens } from './services/api';
import { useUIStore } from './state/uiStore';
import type { UserWithWorkspaces } from './types';

function LoginForm({ onLogin }: { onLogin: (user: UserWithWorkspaces) => void }) {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('alice@cloudcut.dev');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('password123');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const res = mode === 'login'
        ? await api.auth.login({ email, password })
        : await api.auth.register({ email, name: name.trim(), password });
      setTokens(res.accessToken, res.refreshToken);
      onLogin(res.user);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md p-8 space-y-6 bg-card rounded-lg border border-border">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-foreground">CloudCut</h1>
          <p className="text-muted-foreground mt-2">Collaborative Video Editor</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {mode === 'register' && (
            <div>
              <label htmlFor="name" className="text-sm text-muted-foreground">Name</label>
              <input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                minLength={2}
                required
                className="w-full mt-1 px-3 py-2 bg-input border border-border rounded-md text-foreground text-sm focus:outline-none focus:ring-1 focus:ring-ring"
              />
            </div>
          )}

          <div>
              <label htmlFor="email" className="text-sm text-muted-foreground">Email</label>
              <input
                id="email"
                type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full mt-1 px-3 py-2 bg-input border border-border rounded-md text-foreground text-sm focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>

          <div>
              <label htmlFor="password" className="text-sm text-muted-foreground">Password</label>
              <input
                id="password"
                type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full mt-1 px-3 py-2 bg-input border border-border rounded-md text-foreground text-sm focus:outline-none focus:ring-1 focus:ring-ring"
            />
          </div>

          {error && <p className="text-destructive text-sm">{error}</p>}

          <button
            type="submit"
            disabled={loading || (mode === 'register' && name.trim().length < 2)}
            className="w-full py-2 bg-primary text-primary-foreground rounded-md text-sm font-medium hover:opacity-90 disabled:opacity-50"
          >
            {loading ? 'Please wait...' : mode === 'login' ? 'Sign In' : 'Create Account'}
          </button>
        </form>

        <button
          type="button"
          onClick={() => {
            setMode(mode === 'login' ? 'register' : 'login');
            setError('');
          }}
          className="w-full text-sm text-muted-foreground hover:text-foreground"
        >
          {mode === 'login' ? 'Create a new account' : 'Use an existing account'}
        </button>

        <p className="text-xs text-muted-foreground text-center">
          Demo: alice@cloudcut.dev or bob@cloudcut.dev / password123
        </p>
      </div>
    </div>
  );
}

export default function App() {
  const [user, setUser] = useState<UserWithWorkspaces | null>(null);
  const [checking, setChecking] = useState(true);
  const theme = useUIStore((s) => s.theme);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.remove('light', 'dark');
    root.classList.add(theme);
  }, [theme]);

  useEffect(() => {
    const token = localStorage.getItem('accessToken');
    if (token) {
      api.auth.me()
        .then(setUser)
        .catch(() => clearTokens())
        .finally(() => setChecking(false));
    } else {
      setChecking(false);
    }
  }, []);

  if (checking) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-muted-foreground animate-pulse">Loading...</div>
      </div>
    );
  }

  if (!user) return <LoginForm onLogin={setUser} />;
  return <EditorLayout user={user} onLogout={() => { clearTokens(); setUser(null); }} />;
}
