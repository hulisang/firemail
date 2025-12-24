import { Mail, RefreshCw, Paperclip } from 'lucide-react';
import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useAppStore } from '../store/app';
import type { EmailAccount, MailRecord, CheckResult } from '../types';
import MailDetailModal from './MailDetailModal';

export default function MailList() {
    const { t } = useAppStore();
    const [emails, setEmails] = useState<EmailAccount[]>([]);
    const [selectedEmailId, setSelectedEmailId] = useState<number | null>(null);
    const [mailRecords, setMailRecords] = useState<MailRecord[]>([]);
    const [loading, setLoading] = useState(false);
    const [selectedMail, setSelectedMail] = useState<MailRecord | null>(null);
    const [isDetailOpen, setIsDetailOpen] = useState(false);

    useEffect(() => {
        loadEmails();
    }, []);

    const loadEmails = async () => {
        try {
            const emailList = await invoke<EmailAccount[]>('get_emails');
            setEmails(emailList);
            if (emailList.length > 0 && !selectedEmailId) {
                setSelectedEmailId(emailList[0].id);
                loadMailRecords(emailList[0].id);
            }
        } catch (error) {
            console.error('Failed to load emails:', error);
        }
    };

    const loadMailRecords = async (emailId: number) => {
        setLoading(true);
        try {
            const records = await invoke<MailRecord[]>('get_mail_records', { emailId });
            setMailRecords(records);
        } catch (error) {
            console.error('Failed to load mail records:', error);
            setMailRecords([]);
        } finally {
            setLoading(false);
        }
    };

    const handleSelectEmail = (emailId: number) => {
        setSelectedEmailId(emailId);
        loadMailRecords(emailId);
    };

    const handleCheckMail = async (emailId: number) => {
        setLoading(true);
        try {
            const result = await invoke<CheckResult>('check_outlook_email', { emailId });
            alert(`${t.mail.checkSuccess}: ${result.message}`);
            loadMailRecords(emailId);
        } catch (error) {
            alert(`${t.mail.checkFailed}: ${error}`);
        } finally {
            setLoading(false);
        }
    };

    const handleBatchCheck = async () => {
        setLoading(true);
        try {
            const emailIds = emails.map((e) => e.id);
            const result = await invoke<{ success_count: number; failed_count: number }>('batch_check_outlook_emails', { emailIds });
            alert(`${t.mail.checkSuccess}: ${result.success_count} 成功, ${result.failed_count} 失败`);
            if (selectedEmailId) {
                loadMailRecords(selectedEmailId);
            }
        } catch (error) {
            alert(`${t.mail.checkFailed}: ${error}`);
        } finally {
            setLoading(false);
        }
    };

    const handleViewDetail = (mail: MailRecord) => {
        setSelectedMail(mail);
        setIsDetailOpen(true);
    };

    return (
        <>
            <div className="mail-list-container">
                {/* Email Accounts Sidebar */}
                <div className="email-accounts-sidebar">
                    <div className="accounts-header">
                        <h3 className="text-sm font-semibold">{t.menu.inbox}</h3>
                        <button className="btn btn-brand btn-sm" onClick={handleBatchCheck} disabled={loading || emails.length === 0}>
                            <RefreshCw size={14} className={loading ? 'spinning' : ''} style={{ marginRight: '0.25rem' }} />
                            {t.actions.batchCheck}
                        </button>
                    </div>
                    <div className="accounts-list">
                        {emails.map((email) => (
                            <div
                                key={email.id}
                                className={`account-item ${selectedEmailId === email.id ? 'active' : ''}`}
                                onClick={() => handleSelectEmail(email.id)}
                            >
                                <div className="account-info">
                                    <div className="account-email">{email.email}</div>
                                    <div className="account-meta">{email.mail_type}</div>
                                </div>
                                <button
                                    className="btn-icon btn-sm"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        handleCheckMail(email.id);
                                    }}
                                    disabled={loading}
                                    title={t.actions.checkMail}
                                >
                                    <RefreshCw size={14} className={loading ? 'spinning' : ''} />
                                </button>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Mail Records List */}
                <div className="mail-records-area">
                    {loading ? (
                        <div className="loading-state">
                            <RefreshCw size={32} className="spinning text-muted-foreground" />
                            <p className="text-muted">{t.mail.downloading}</p>
                        </div>
                    ) : mailRecords.length === 0 ? (
                        <div className="empty-state">
                            <Mail size={32} className="text-muted-foreground" />
                            <p className="text-muted">{t.empty.desc}</p>
                        </div>
                    ) : (
                        <div className="mail-records-list">
                            {mailRecords.map((mail) => (
                                <div
                                    key={mail.id}
                                    className="mail-record-item"
                                    onClick={() => handleViewDetail(mail)}
                                >
                                    <div className="mail-record-header">
                                        <span className="mail-sender">{mail.sender || 'Unknown'}</span>
                                        <span className="mail-date">
                                            {mail.received_time ? new Date(mail.received_time).toLocaleDateString() : '-'}
                                        </span>
                                    </div>
                                    <div className="mail-subject">
                                        {mail.subject || '(No Subject)'}
                                        {mail.has_attachments > 0 && <Paperclip size={14} className="ml-2" />}
                                    </div>
                                    <div className="mail-preview">
                                        {mail.content?.substring(0, 100) || '-'}...
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {selectedMail && (
                <MailDetailModal
                    isOpen={isDetailOpen}
                    onClose={() => setIsDetailOpen(false)}
                    mail={selectedMail}
                />
            )}
        </>
    );
}
