
import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { open } from '@tauri-apps/plugin-dialog';
import { readTextFile } from '@tauri-apps/plugin-fs';
import {
    Upload, FileText, Trash2,
    Download, Clipboard, RefreshCw, X
} from 'lucide-react';
import { useAppStore } from '../store/app';
import type { EmailAccount } from '../types';

export default function EmailManagement() {
    const { t } = useAppStore();

    // 状态
    const [emails, setEmails] = useState<EmailAccount[]>([]);
    const [loading, setLoading] = useState(false);
    const [selectedIds, setSelectedIds] = useState<number[]>([]);
    const [isDragging, setIsDragging] = useState(false);
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);

    // 导入/导出状态
    const [separator, setSeparator] = useState('----');
    const [searchQuery, setSearchQuery] = useState('');
    const [importResult, setImportResult] = useState<string | null>(null);

    // 粘贴导入模态框状态
    const [showPasteModal, setShowPasteModal] = useState(false);
    const [pasteContent, setPasteContent] = useState('');

    useEffect(() => {
        loadEmails();
    }, []);

    const loadEmails = async () => {
        setLoading(true);
        try {
            const list = await invoke<EmailAccount[]>('get_emails');
            setEmails(list);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const resolveDialogPath = (picked: unknown) => {
        if (typeof picked === 'string') {
            return picked;
        }

        if (picked && typeof picked === 'object' && 'path' in picked) {
            const pathValue = (picked as { path?: string }).path;
            if (typeof pathValue === 'string' && pathValue.length > 0) {
                return pathValue;
            }
        }

        return null;
    };

    const handleSelectFile = async () => {
        try {
            const selected = await open({
                multiple: false,
                filters: [{
                    name: 'Text',
                    extensions: ['txt']
                }]
            });

            if (!selected) {
                return;
            }

            const picked = Array.isArray(selected) ? selected[0] : selected;
            const filePath = resolveDialogPath(picked);

            if (!filePath) {
                alert('未获取到文件路径');
                return;
            }

            const content = await readTextFile(filePath);
            handleBatchImport(content);
        } catch (err) {
            console.error(err);
            alert('读取文件失败');
        }
    };

    const handleBatchImport = async (content: string) => {
        setLoading(true);
        setImportResult(null);
        try {
            const response: any = await invoke('import_emails', { input: content });
            if (response.failed_count === 0) {
                setImportResult(t.import.successMsg.replace('{count}', String(response.success_count)));
            } else {
                // 显示详细错误信息
                const failedDetails = response.failed_lines && response.failed_lines.length > 0
                    ? `\n失败详情:\n${response.failed_lines.join('\n')}`
                    : '';
                setImportResult(`成功: ${response.success_count}, 失败: ${response.failed_count}${failedDetails}`);
            }
            loadEmails();
        } catch (error) {
            setImportResult(`导入失败: ${error}`);
        } finally {
            setLoading(false);
        }
    };

    // 打开粘贴导入模态框
    const handlePasteImport = () => {
        setPasteContent('');
        setShowPasteModal(true);
    };

    // 提交粘贴导入
    const handlePasteSubmit = () => {
        if (pasteContent.trim()) {
            handleBatchImport(pasteContent);
            setShowPasteModal(false);
            setPasteContent('');
        }
    };

    // 关闭模态框
    const handleClosePasteModal = () => {
        setShowPasteModal(false);
        setPasteContent('');
    };

    const handleDelete = async (id: number) => {
        if (!confirm('确定删除此邮箱吗？')) return;
        try {
            await invoke('delete_email', { emailId: id });
            loadEmails();
        } catch (error) {
            alert(`删除失败: ${error}`);
        }
    };

    const handleBatchDelete = async () => {
        if (selectedIds.length === 0) return;
        if (!confirm(`确定删除选中的 ${selectedIds.length} 个邮箱吗？`)) return;

        // 目前后端好像没有批量删除接口，循环调用（后续可优化）
        for (const id of selectedIds) {
            await invoke('delete_email', { emailId: id }).catch(console.error);
        }
        setSelectedIds([]);
        loadEmails();
    };

    const handleSelectAll = (checked: boolean, ids: number[]) => {
        if (ids.length === 0) {
            return;
        }

        if (checked) {
            setSelectedIds((prev) => Array.from(new Set([...prev, ...ids])));
            return;
        }

        setSelectedIds((prev) => prev.filter((id) => !ids.includes(id)));
    };

    const toggleSelect = (id: number) => {
        if (selectedIds.includes(id)) {
            setSelectedIds(selectedIds.filter(i => i !== id));
        } else {
            setSelectedIds([...selectedIds, id]);
        }
    };

    const filteredEmails = emails.filter(e => e.email.toLowerCase().includes(searchQuery.toLowerCase()));
    const totalPages = Math.max(1, Math.ceil(filteredEmails.length / pageSize));
    const pageStart = (currentPage - 1) * pageSize;
    const paginatedEmails = filteredEmails.slice(pageStart, pageStart + pageSize);
    const pageEmailIds = paginatedEmails.map((email) => email.id);
    const allPageSelected = pageEmailIds.length > 0
        && pageEmailIds.every((id) => selectedIds.includes(id));

    const buildPageItems = (total: number, current: number): Array<number | 'ellipsis'> => {
        if (total <= 7) {
            return Array.from({ length: total }, (_, index) => index + 1);
        }

        if (current <= 3) {
            return [1, 2, 3, 4, 'ellipsis', total];
        }

        if (current >= total - 2) {
            return [1, 'ellipsis', total - 3, total - 2, total - 1, total];
        }

        return [1, 'ellipsis', current - 1, current, current + 1, 'ellipsis', total];
    };

    const pageItems = buildPageItems(totalPages, currentPage);

    useEffect(() => {
        setCurrentPage(1);
    }, [searchQuery, pageSize]);

    useEffect(() => {
        if (currentPage > totalPages) {
            setCurrentPage(totalPages);
        }
    }, [currentPage, totalPages]);

    return (
        <div className="management-content animate-in">
            {/* 顶部标题 */}
            <div className="page-header">
                <h1 className="page-title">邮箱管理</h1>
                <p className="page-subtitle">导入、管理和查看您的邮箱账号</p>
            </div>

            {/* 导入/导出管理卡片 */}
            <section className="management-section">
                <div className="section-title">
                    <FileText size={20} className="section-icon" />
                    <span>邮箱导入/导出管理</span>
                </div>

                <div className="management-content">
                    <div className="toolbar-row">
                        <div className="toolbar-left">
                            <div className="form-field w-small">
                                <label>分隔符</label>
                                <input
                                    type="text"
                                    value={separator}
                                    onChange={(e) => setSeparator(e.target.value)}
                                    className="separator-input"
                                />
                            </div>
                            <div className="form-field flex-grow">
                                <label>搜索邮箱</label>
                                <input
                                    type="text"
                                    placeholder="输入邮箱地址搜索"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="search-email-input"
                                />
                            </div>
                        </div>

                        <div className="actions-toolbar">
                            <button className="btn btn-secondary" onClick={handleSelectFile} type="button">
                                <Upload size={16} className="btn-icon-space" />
                                选择文件
                            </button>
                            <button className="btn btn-purple" type="button">
                                <Upload size={16} className="btn-icon-space" />
                                导入邮箱
                            </button>
                            <button className="btn btn-green" type="button">
                                <Download size={16} className="btn-icon-space" />
                                导出邮箱
                            </button>
                            <button
                                className="btn btn-orange"
                                onClick={handleBatchDelete}
                                disabled={selectedIds.length === 0}
                                type="button"
                            >
                                <Trash2 size={16} className="btn-icon-space" />
                                批量删除
                            </button>
                            <button className="btn btn-pink" type="button">
                                <Trash2 size={16} className="btn-icon-space" />
                                删除全部
                            </button>
                            <button className="btn btn-violet" onClick={handlePasteImport} type="button">
                                <Clipboard size={16} className="btn-icon-space" />
                                粘贴导入
                            </button>
                        </div>
                    </div>

                    <div
                        className={`upload-area transition-all duration-200 border-2 border-dashed rounded-lg p-8 flex flex-col items-center justify-center cursor-pointer gap-2 ${isDragging ? 'border-primary bg-primary/10 scale-[1.02]' : 'border-border hover:border-primary/50 hover:bg-accent/50'}`}
                        onClick={handleSelectFile}
                        onDragOver={(e) => {
                            e.preventDefault();
                            setIsDragging(true);
                        }}
                        onDragLeave={(e) => {
                            e.preventDefault();
                            setIsDragging(false);
                        }}
                        onDrop={async (e) => {
                            e.preventDefault();
                            setIsDragging(false);
                            const files = e.dataTransfer.files;
                            if (files.length === 0) {
                                return;
                            }

                            const file = files[0];
                            if (!file.name.toLowerCase().endsWith('.txt')) {
                                alert('请上传 .txt 文件');
                                return;
                            }

                            try {
                                const filePath = (file as { path?: string }).path;
                                if (filePath) {
                                    try {
                                        const text = await readTextFile(filePath);
                                        handleBatchImport(text);
                                        return;
                                    } catch (error) {
                                        console.error(error);
                                    }
                                }

                                const text = await file.text();
                                handleBatchImport(text);
                            } catch (error) {
                                console.error(error);
                                alert('读取拖拽文件失败');
                            }
                        }}
                    >
                        <Upload size={32} className={`transition-colors ${isDragging ? 'text-primary' : 'text-muted-foreground'}`} />
                        <div className="text-sm font-medium">点击选择文件 或 将TXT文件拖拽至此</div>
                        <div className="text-xs text-muted-foreground">格式: 邮箱----密码----client_id----refresh_token</div>
                    </div>

                    {importResult && (
                        <div className={`result-box ${importResult.includes('失败') ? 'error' : 'success'}`}>
                            {importResult}
                        </div>
                    )}
                </div>
            </section>

            {/* 邮箱账号列表卡片 */}
            <section className="management-section">
                <div className="section-title">
                    <RefreshCw size={20} className="section-icon" />
                    <span>邮箱账号列表</span>
                </div>

                <div className="data-table-container">
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th style={{ width: '40px' }}>
                                    <input
                                        type="checkbox"
                                        className="row-checkbox"
                                        checked={allPageSelected}
                                        onChange={(e) => handleSelectAll(e.target.checked, pageEmailIds)}
                                    />
                                </th>
                                <th style={{ width: '60px' }}>#</th>
                                <th>邮箱地址</th>
                                <th>密码</th>
                                <th>客户端ID</th>
                                <th>刷新令牌</th>
                                <th style={{ width: '100px' }}>操作</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr>
                                    <td colSpan={7} className="status-cell">加载中...</td>
                                </tr>
                            ) : filteredEmails.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="status-cell">
                                        <div className="empty-state">
                                            <div className="empty-icon-box">
                                                <FileText size={32} />
                                            </div>
                                            <span>暂无邮箱数据</span>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                paginatedEmails.map((email, index) => (
                                    <tr key={email.id}>
                                        <td>
                                            <input
                                                type="checkbox"
                                                className="row-checkbox"
                                                checked={selectedIds.includes(email.id)}
                                                onChange={() => toggleSelect(email.id)}
                                            />
                                        </td>
                                        <td>{pageStart + index + 1}</td>
                                        <td>{email.email}</td>
                                        <td className="mono">********</td>
                                        <td className="mono text-muted truncate" title={email.client_id}>
                                            {email.client_id}
                                        </td>
                                        <td className="mono text-muted truncate" title={email.refresh_token}>
                                            {email.refresh_token.substring(0, 20)}...
                                        </td>
                                        <td>
                                            <button
                                                className="btn-icon-action delete"
                                                onClick={() => handleDelete(email.id)}
                                                title="删除"
                                                type="button"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
                {filteredEmails.length > 0 && (
                    <div className="pagination-bar">
                        <div className="pagination-pages">
                            <button
                                className="pagination-btn wide"
                                type="button"
                                onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                                disabled={currentPage === 1}
                            >
                                上一页
                            </button>
                            {pageItems.map((item, index) => {
                                if (item === 'ellipsis') {
                                    return (
                                        <span className="pagination-ellipsis" key={`ellipsis-${index}`}>
                                            ...
                                        </span>
                                    );
                                }

                                return (
                                    <button
                                        className={`pagination-btn ${item === currentPage ? 'active' : ''}`}
                                        type="button"
                                        key={item}
                                        onClick={() => setCurrentPage(item)}
                                    >
                                        {item}
                                    </button>
                                );
                            })}
                            <button
                                className="pagination-btn wide"
                                type="button"
                                onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                                disabled={currentPage === totalPages}
                            >
                                下一页
                            </button>
                        </div>
                        <div className="pagination-size">
                            <select
                                className="pagination-select"
                                value={pageSize}
                                onChange={(e) => setPageSize(Number(e.target.value))}
                            >
                                {[10, 20, 50].map((size) => (
                                    <option key={size} value={size}>
                                        {size} 条/页
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>
                )}
            </section>

            {/* 粘贴导入模态框 */}
            {showPasteModal && (
                <div className="modal-overlay" onClick={handleClosePasteModal}>
                    <div className="modal-content paste-modal" onClick={(e) => e.stopPropagation()}>
                        <div className="modal-header">
                            <h3>粘贴导入邮箱</h3>
                            <button
                                className="modal-close-btn"
                                onClick={handleClosePasteModal}
                                type="button"
                            >
                                <X size={20} />
                            </button>
                        </div>
                        <div className="modal-body">
                            <p className="modal-hint">请在下方文本框中粘贴邮箱数据，每行一个邮箱</p>
                            <p className="modal-hint-format">格式: 邮箱----密码----client_id----refresh_token</p>
                            <textarea
                                className="paste-textarea"
                                placeholder="粘贴邮箱数据，每行一个..."
                                value={pasteContent}
                                onChange={(e) => setPasteContent(e.target.value)}
                                rows={12}
                            />
                        </div>
                        <div className="modal-footer">
                            <button
                                className="btn btn-secondary"
                                onClick={handleClosePasteModal}
                                type="button"
                            >
                                取消
                            </button>
                            <button
                                className="btn btn-primary"
                                onClick={handlePasteSubmit}
                                disabled={!pasteContent.trim()}
                                type="button"
                            >
                                导入
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
