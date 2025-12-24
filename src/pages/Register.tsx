import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { invoke } from '@tauri-apps/api/core';
import { Mail } from 'lucide-react';

export default function Register() {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const navigate = useNavigate();

    const handleRegister = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        if (password !== confirmPassword) {
            setError("Passwords don't match");
            return;
        }

        setLoading(true);

        try {
            await invoke('register', { username, password });
            // Redirect to login after successful registration
            navigate('/login');
        } catch (err) {
            setError(err as string);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="container flex-center" style={{ flexDirection: 'column', gap: '2rem' }}>
            <div className="flex-center" style={{ gap: '0.5rem' }}>
                <Mail size={48} className="text-accent" />
                <h1 style={{ fontSize: '2rem', fontWeight: 700 }}>FireMail</h1>
            </div>

            <div style={{ width: '100%', maxWidth: '320px' }}>
                <h2 style={{ marginBottom: '1.5rem', textAlign: 'center' }}>Create Account</h2>

                <form onSubmit={handleRegister} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <div>
                        <input
                            type="text"
                            placeholder="Username"
                            className="input-field"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            required
                            minLength={3}
                        />
                    </div>

                    <div>
                        <input
                            type="password"
                            placeholder="Password"
                            className="input-field"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                            minLength={6}
                        />
                    </div>

                    <div>
                        <input
                            type="password"
                            placeholder="Confirm Password"
                            className="input-field"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            required
                        />
                    </div>

                    {error && <div style={{ color: 'var(--color-danger)', fontSize: '0.875rem' }}>{error}</div>}

                    <button type="submit" className="btn-primary" disabled={loading}>
                        {loading ? 'Creating Account...' : 'Register'}
                    </button>
                </form>

                <div style={{ marginTop: '1rem', textAlign: 'center', fontSize: '0.875rem', color: 'var(--color-text-secondary)' }}>
                    Already have an account? <Link to="/login" className="text-accent">Login</Link>
                </div>
            </div>
        </div>
    );
}
