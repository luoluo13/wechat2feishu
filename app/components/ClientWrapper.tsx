
'use client';

import { useState } from 'react';
import { useSession } from "next-auth/react";
import { Header } from './Header';
import { Footer } from './Footer';
import { FeishuConnectionCard } from './FeishuConnectionCard';
import { Hero } from './Hero';
import { HistoryList } from './HistoryList';
import { Sidebar } from './Sidebar';
import { SyncModal } from './SyncModal';
import { StatsPanel } from './StatsPanel';

export function ClientWrapper() {
    const { data: session, status } = useSession();
    const [refreshTrigger, setRefreshTrigger] = useState(0);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [viewLayout, setViewLayout] = useState<'grid' | 'list'>('grid');

    const handleSyncSuccess = () => {
        setRefreshTrigger(prev => prev + 1);
    };

    if (status === "loading") {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <span className="material-symbols-outlined text-[32px] text-black/20 animate-spin-slow">progress_activity</span>
            </div>
        );
    }

    const isLoggedIn = !!session?.user;

    // --- DASHBOARD LAYOUT ---
    if (isLoggedIn) {
        return (
            <div className="flex h-screen overflow-hidden transition-colors">
                {/* Sidebar */}
                <Sidebar refreshTrigger={refreshTrigger} />

                {/* Main Content Wrapper */}
                <div className="flex-1 flex flex-col min-w-0 lg:pl-64 transition-all duration-300">
                    <Header />

                    <main className="flex-1 overflow-y-auto p-golden-sm">
                        <div className="max-w-5xl mx-auto">
                            {/* Dashboard Header Section */}

                            <div className="flex items-end justify-between mb-8">
                                <div>
                                    <h2 className="text-3xl font-bold tracking-tight mb-2 text-[#1d1d1f] dark:text-white transition-colors">我的知识库</h2>
                                    <p className="text-black/40 dark:text-white/40 font-medium transition-colors">
                                        管理你的所有转存文档
                                    </p>
                                </div>
                                <div className="flex items-center gap-3">
                                    <div className="flex bg-black/[0.03] dark:bg-white/10 p-1 rounded-xl mr-2">
                                        <button
                                            onClick={() => setViewLayout('grid')}
                                            className={`p-1.5 rounded-lg transition-colors ${viewLayout === 'grid' ? 'bg-white shadow-sm text-black dark:bg-white/20 dark:text-white' : 'text-black/40 hover:text-black dark:text-white/40 dark:hover:text-white'}`}
                                            title="网格视图"
                                        >
                                            <span className="material-symbols-outlined text-[20px]">grid_view</span>
                                        </button>
                                        <button
                                            onClick={() => setViewLayout('list')}
                                            className={`p-1.5 rounded-lg transition-colors ${viewLayout === 'list' ? 'bg-white shadow-sm text-black dark:bg-white/20 dark:text-white' : 'text-black/40 hover:text-black dark:text-white/40 dark:hover:text-white'}`}
                                            title="列表视图"
                                        >
                                            <span className="material-symbols-outlined text-[20px]">format_list_bulleted</span>
                                        </button>
                                    </div>
                                    <button
                                        onClick={() => setIsModalOpen(true)}
                                        className="tactile-button h-10 px-6 rounded-xl text-white text-[14px] font-semibold flex items-center gap-2 hover:scale-[1.02] active:scale-[0.98] transition-transform"
                                    >
                                        <span className="material-symbols-outlined text-[18px]">add</span>
                                        新转存
                                    </button>
                                </div>
                            </div>

                            {/* Content */}
                            <FeishuConnectionCard />
                            <HistoryList refreshTrigger={refreshTrigger} isLoggedIn={true} layout={viewLayout} />
                        </div>
                    </main>
                </div>

                {/* Sync Modal */}
                <SyncModal
                    isOpen={isModalOpen}
                    onClose={() => setIsModalOpen(false)}
                    onSuccess={handleSyncSuccess}
                />
            </div>
        );
    }

    // --- PUBLIC LAYOUT ---
    return (
        <div className="min-h-screen flex flex-col font-sans transition-colors">
            <Header />
            <main className="flex-grow">
                <Hero isLoggedIn={false} onSyncSuccess={handleSyncSuccess} />
                <StatsPanel />
                <HistoryList refreshTrigger={refreshTrigger} isLoggedIn={false} layout="list" />
            </main>
            <Footer />
        </div>
    );
}
