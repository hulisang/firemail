import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { invoke } from '@tauri-apps/api/core';
import { useAuthStore } from '../store/auth';
import { User } from '../types';
import { Mail } from 'lucide-react';

export default function Login() {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const navigate = useNavigate();
    const setUser = useAuthStore((state) => state.setUser);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            const user = await invoke<User>('login', { username, password });
            setUser(user);
            navigate('/');
        } catch (err) {
            setError(err as string);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="container flex flex-col items-center justify-center min-h-screen gap-8">
            <div className="flex items-center gap-2">
                <div className="p-3 rounded-xl bg-primary/10 text-primary">
                    <Mail size={48} />
                </div>
                <h1 className="text-4xl font-bold tracking-tight">FireMail</h1>
            </div>

            <div className="w-full max-w-sm">
                <form onSubmit={handleLogin} className="flex flex-col gap-4">
                    <div className="space-y-2">
                        <input
                            type="text"
                            placeholder="Username"
                            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            required
                        />
                    </div>

                    <div className="space-y-2">
                        <input
                            type="password"
                            placeholder="Password"
                            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                        />
                    </div>

                    {error && <div className="text-destructive text-sm font-medium text-center">{error}</div>}

                    <button
                        type="submit"
                        className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2 w-full"
                        disabled={loading}
                    >
                        {loading ? 'Logging in...' : 'Login'}
                    </button>
                </form>

                <div className="mt-4 text-center text-sm text-muted-foreground">
                    Don't have an account? <Link to="/register" className="font-medium text-primary hover:underline">Register</Link>
                </div>
            </div>
        </div>
    );
}
