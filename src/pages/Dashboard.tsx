import { useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { LayoutDashboard, Users, Mail } from 'lucide-react';
import EmailManagement from '../components/EmailManagement';
import { ModeToggle } from '../components/mode-toggle';
import type { EmailAccount } from '../types';

export default function Dashboard() {
    const [view, setView] = useState<'dashboard' | 'management'>('dashboard');
    const [accounts, setAccounts] = useState<EmailAccount[]>([]);

    useEffect(() => {
        // 初次进入时加载邮箱列表
        const loadAccounts = async () => {
            try {
                const list = await invoke<EmailAccount[]>('get_emails');
                setAccounts(list);
            } catch (error) {
                console.error('获取邮箱列表失败', error);
            }
        };

        loadAccounts();
    }, []);

    const accountCount = accounts.length;

    return (
        <div className="flex h-screen bg-background text-foreground overflow-hidden">
            {/* 顶部导航 */}
            <header className="absolute top-0 left-0 right-0 h-16 border-b bg-background/95 backdrop-blur z-50 flex items-center justify-between px-6">
                <div className="flex items-center gap-2 font-bold text-xl select-none">
                    <div className="p-2 rounded-lg bg-primary/10 text-primary">
                        <Mail size={20} />
                    </div>
                    FireMail
                </div>

                <nav className="flex items-center gap-2">
                    <button
                        className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${view === 'dashboard' ? 'bg-secondary text-secondary-foreground' : 'text-muted-foreground hover:bg-secondary/50'}`}
                        onClick={() => setView('dashboard')}
                        type="button"
                    >
                        <LayoutDashboard size={16} />
                        仪表盘
                    </button>
                    <button
                        className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${view === 'management' ? 'bg-secondary text-secondary-foreground' : 'text-muted-foreground hover:bg-secondary/50'}`}
                        onClick={() => setView('management')}
                        type="button"
                    >
                        <Users size={16} />
                        邮箱管理
                    </button>
                    <div className="ml-2 pl-2 border-l">
                        <ModeToggle />
                    </div>
                </nav>
            </header>

            {/* 主内容 */}
            <main className="flex-1 pt-16 h-full overflow-auto">
                {view === 'dashboard' ? (
                    <div className="container mx-auto p-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                        <h1 className="text-3xl font-bold tracking-tight mb-6">仪表盘</h1>

                        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                            <div className="p-6 rounded-xl border bg-card text-card-foreground shadow-sm">
                                <div className="flex flex-row items-center justify-between space-y-0 pb-2">
                                    <div className="text-sm font-medium">邮箱账号总数</div>
                                    <Users className="h-4 w-4 text-muted-foreground" />
                                </div>
                                <div className="text-2xl font-bold">{accountCount}</div>
                                <p className="text-xs text-muted-foreground mt-1">已导入系统的所有邮箱账号</p>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="h-full overflow-auto p-6">
                        <EmailManagement />
                    </div>
                )}
            </main>
        </div>
    );
}
