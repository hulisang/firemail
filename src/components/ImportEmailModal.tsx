import { X } from 'lucide-react';
import { useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useAppStore } from '../store/app';

interface ImportEmailModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
}

export default function ImportEmailModal({ isOpen, onClose, onSuccess }: ImportEmailModalProps) {
    const { t } = useAppStore();
    const [activeTab, setActiveTab] = useState<'single' | 'batch'>('single');
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<string | null>(null);

    // Single import fields
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [clientId, setClientId] = useState('');
    const [refreshToken, setRefreshToken] = useState('');

    // Batch import field
    const [batchInput, setBatchInput] = useState('');

    if (!isOpen) return null;

    const handleSingleImport = async () => {
        setLoading(true);
        setResult(null);
        try {
            await invoke('add_email', {
                email,
                password,
                clientId,
                refreshToken,
                mailType: null
            });
            setResult(t.import.successMsg.replace('{count}', '1'));
            setEmail('');
            setPassword('');
            setClientId('');
            setRefreshToken('');
            setTimeout(() => {
                onSuccess();
                onClose();
            }, 1500);
        } catch (error) {
            setResult(t.import.errorMsg.replace('{error}', String(error)));
        } finally {
            setLoading(false);
        }
    };

    const handleBatchImport = async () => {
        setLoading(true);
        setResult(null);
        try {
            const response: any = await invoke('import_emails', { input: batchInput });
            if (response.failed_count === 0) {
                setResult(t.import.successMsg.replace('{count}', String(response.success_count)));
            } else {
                setResult(
                    t.import.partialSuccessMsg
                        .replace('{success}', String(response.success_count))
                        .replace('{failed}', String(response.failed_count)) +
                    '\n' +
                    response.failed_lines.join('\n')
                );
            }
            setBatchInput('');
            setTimeout(() => {
                onSuccess();
            }, 2000);
        } catch (error) {
            setResult(t.import.errorMsg.replace('{error}', String(error)));
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = () => {
        if (activeTab === 'single') {
            handleSingleImport();
        } else {
            handleBatchImport();
        }
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                <div className="modal-header">
                    <h2>{t.import.title}</h2>
                    <button className="btn-icon" onClick={onClose}>
                        <X size={20} />
                    </button>
                </div>

                <div className="tab-bar">
                    <button
                        className={`tab-item ${activeTab === 'single' ? 'active' : ''}`}
                        onClick={() => setActiveTab('single')}
                    >
                        {t.import.singleTab}
                    </button>
                    <button
                        className={`tab-item ${activeTab === 'batch' ? 'active' : ''}`}
                        onClick={() => setActiveTab('batch')}
                    >
                        {t.import.batchTab}
                    </button>
                </div>

                <div className="modal-body">
                    {activeTab === 'single' ? (
                        <div className="form-grid">
                            <div className="form-field">
                                <label>{t.import.emailLabel}</label>
                                <input
                                    type="email"
                                    className="input-field"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    placeholder="example@email.com"
                                />
                            </div>
                            <div className="form-field">
                                <label>{t.import.passwordLabel}</label>
                                <input
                                    type="password"
                                    className="input-field"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                />
                            </div>
                            <div className="form-field">
                                <label>{t.import.clientIdLabel}</label>
                                <input
                                    type="text"
                                    className="input-field"
                                    value={clientId}
                                    onChange={(e) => setClientId(e.target.value)}
                                />
                            </div>
                            <div className="form-field">
                                <label>{t.import.refreshTokenLabel}</label>
                                <input
                                    type="text"
                                    className="input-field"
                                    value={refreshToken}
                                    onChange={(e) => setRefreshToken(e.target.value)}
                                />
                            </div>
                        </div>
                    ) : (
                        <div>
                            <p className="text-muted text-xs mb-4">{t.import.batchHint}</p>
                            <textarea
                                className="textarea-field"
                                rows={10}
                                value={batchInput}
                                onChange={(e) => setBatchInput(e.target.value)}
                                placeholder="user1@email.com----pass1----client1----token1
user2@email.com----pass2----client2----token2"
                            />
                        </div>
                    )}

                    {result && (
                        <div className={`result-box ${result.includes('失败') || result.includes('failed') ? 'error' : 'success'}`}>
                            <pre>{result}</pre>
                        </div>
                    )}
                </div>

                <div className="modal-footer">
                    <button className="btn btn-secondary" onClick={onClose} disabled={loading}>
                        {t.actions.cancel}
                    </button>
                    <button className="btn btn-brand" onClick={handleSubmit} disabled={loading}>
                        {loading ? '...' : t.actions.submit}
                    </button>
                </div>
            </div>
        </div>
    );
}
