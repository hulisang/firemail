import { X, Download } from 'lucide-react';
import { useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { save } from '@tauri-apps/plugin-dialog';
import { writeFile } from '@tauri-apps/plugin-fs';
import { useAppStore } from '../store/app';
import type { MailRecord, AttachmentInfo } from '../types';

interface MailDetailModalProps {
    isOpen: boolean;
    onClose: () => void;
    mail: MailRecord;
}

export default function MailDetailModal({ isOpen, onClose, mail }: MailDetailModalProps) {
    const { t } = useAppStore();
    const [attachments, setAttachments] = useState<AttachmentInfo[]>([]);
    const [loading, setLoading] = useState(false);

    if (!isOpen) return null;

    const loadAttachments = async () => {
        if (mail.has_attachments === 0) return;

        try {
            const atts = await invoke<AttachmentInfo[]>('get_attachments', { mailId: mail.id });
            setAttachments(atts);
        } catch (error) {
            console.error('Failed to load attachments:', error);
        }
    };

    const handleDownloadAttachment = async (attId: number, filename?: string) => {
        setLoading(true);
        try {
            const content = await invoke<{ id: number; filename?: string; content_type?: string; content_base64: string }>('get_attachment_content', { attachmentId: attId });

            const savePath = await save({
                defaultPath: filename || 'attachment',
                filters: [{
                    name: 'All Files',
                    extensions: ['*']
                }]
            });

            if (!savePath) {
                setLoading(false);
                return;
            }

            const binaryData = Uint8Array.from(atob(content.content_base64), c => c.charCodeAt(0));
            await writeFile(savePath, binaryData);

            alert(t.mail.checkSuccess);
        } catch (error) {
            console.error('Failed to download attachment:', error);
            alert(`${t.mail.checkFailed}: ${error}`);
        } finally {
            setLoading(false);
        }
    };

    // Load attachments when modal opens
    if (isOpen && attachments.length === 0 && mail.has_attachments > 0) {
        loadAttachments();
    }

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ minWidth: '700px', maxWidth: '900px' }}>
                <div className="modal-header">
                    <h2>{t.mail.detailTitle}</h2>
                    <button className="btn-icon" onClick={onClose}>
                        <X size={20} />
                    </button>
                </div>

                <div className="modal-body">
                    <div className="mail-detail-grid">
                        <div className="mail-field">
                            <label>{t.mail.from}</label>
                            <div className="mail-value">{mail.sender || '-'}</div>
                        </div>

                        <div className="mail-field">
                            <label>{t.mail.subject}</label>
                            <div className="mail-value">{mail.subject || '-'}</div>
                        </div>

                        <div className="mail-field">
                            <label>{t.mail.date}</label>
                            <div className="mail-value">{mail.received_time ? new Date(mail.received_time).toLocaleString() : '-'}</div>
                        </div>

                        <div className="mail-field mail-content-field">
                            <label>{t.mail.content}</label>
                            <div className="mail-content" dangerouslySetInnerHTML={{ __html: mail.content || '<p>-</p>' }} />
                        </div>

                        {mail.has_attachments > 0 && (
                            <div className="mail-field">
                                <label>{t.mail.attachments} ({attachments.length})</label>
                                {attachments.length === 0 ? (
                                    <div className="text-muted text-xs">{t.mail.downloading}</div>
                                ) : (
                                    <div className="attachment-list">
                                        {attachments.map((att) => (
                                            <div key={att.id} className="attachment-item">
                                                <div className="attachment-info">
                                                    <div className="attachment-name">{att.filename || 'Unnamed'}</div>
                                                    <div className="attachment-meta">
                                                        {att.content_type} • {((att.size || 0) / 1024).toFixed(2)} KB
                                                    </div>
                                                </div>
                                                <button
                                                    className="btn btn-secondary btn-sm"
                                                    onClick={() => handleDownloadAttachment(att.id, att.filename)}
                                                    disabled={loading}
                                                >
                                                    <Download size={14} style={{ marginRight: '0.25rem' }} />
                                                    {loading ? t.mail.downloading : t.actions.download}
                                                </button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                <div className="modal-footer">
                    <button className="btn btn-secondary" onClick={onClose}>
                        {t.actions.cancel}
                    </button>
                </div>
            </div>
        </div>
    );
}
