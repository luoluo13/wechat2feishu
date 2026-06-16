'use client';

import { useState, useEffect } from 'react';
import { useSession } from "next-auth/react";
import { useRouter } from 'next/navigation';
import { useTheme } from "next-themes";
import Link from "next/link";
import { Footer } from '../components/Footer';
import { Hero } from '../components/Hero';
import { HistoryList } from '../components/HistoryList';
import { StatsPanel } from '../components/StatsPanel';

/**
 * Public Homepage - accessible to both logged-in and logged-out users
 * Shows the marketing/landing page with stats dashboard and trending articles
 * 
 * 100% Experience:
 * - Logged-in users can sync directly from here
 * - After sync success, redirects to dashboard to view the new article
 * - Logo navigates to dashboard (/) for logged-in, stays on /home for guests
 */
export default function HomePage() {
    const { data: session } = useSession();
    const router = useRouter();
    const { theme, setTheme } = useTheme();
    const [refreshTrigger, setRefreshTrigger] = useState(0);
    const [mounted, setMounted] = useState(false);

    // Prevent hydration mismatch for theme
    useEffect(() => {
        setMounted(true);
    }, []);

    const isLoggedIn = !!session?.user;

    // After successful sync, redirect to dashboard to see the new article
    const handleSyncSuccess = () => {
        if (isLoggedIn) {
            // Redirect to dashboard with a success indicator
            router.push('/?synced=true');
        } else {
            setRefreshTrigger(prev => prev + 1);
        }
    };

    // Smart Logo click: logged-in → dashboard, guest → scroll top
    const handleLogoClick = () => {
        if (isLoggedIn) {
            router.push('/');
        } else {
            window.scrollTo({ top: 0, behavior: 'smooth' });
        }
    };

    return (
        <div className="min-h-screen flex flex-col font-sans transition-colors">
            {/* Custom Header for /home page */}
            <header className="fixed top-0 w-full z-50 glass-nav border-b border-black/[0.03] dark:border-white/[0.08] transition-colors">
                <div className="max-w-[1200px] mx-auto flex items-center justify-between px-golden-sm h-16">
                    {/* Logo with smart navigation */}
                    <button
                        onClick={handleLogoClick}
                        className="flex items-center gap-3 cursor-pointer hover:opacity-80 transition-opacity"
                        title={isLoggedIn ? '返回控制台' : '回到顶部'}
                    >
                        <div className="w-8 h-8 bg-black dark:bg-white rounded-[7px] flex items-center justify-center">
                            <span className="material-symbols-outlined text-white dark:text-black text-[18px]">bolt</span>
                        </div>
                        <span className="font-semibold text-[19px] tracking-tight text-[#1d1d1f] dark:text-white">Wechat2doc</span>
                    </button>

                    <nav className="hidden md:flex items-center gap-8 text-[14px] font-medium text-black/60 dark:text-white/60">
                        <span className="text-black dark:text-white font-semibold cursor-default">首页</span>
                        <Link className="hover:text-black dark:hover:text-white transition-colors" href="/changelog">迭代记录</Link>
                    </nav>

                    <div className="flex items-center gap-4">
                        {/* Theme Toggle */}
                        {mounted && (
                            <div className="theme-toggle-segmented">
                                <button
                                    onClick={() => setTheme('light')}
                                    className={`theme-btn ${theme === 'light' ? 'active' : ''}`}
                                    title="浅色模式"
                                >
                                    <span className="material-symbols-outlined text-[18px]">light_mode</span>
                                </button>
                                <button
                                    onClick={() => setTheme('dark')}
                                    className={`theme-btn ${theme === 'dark' ? 'active' : ''}`}
                                    title="深色模式"
                                >
                                    <span className="material-symbols-outlined text-[18px]">dark_mode</span>
                                </button>
                            </div>
                        )}

                        {/* Action Button */}
                        {isLoggedIn ? (
                            <Link
                                href="/"
                                className="px-5 py-1.5 rounded-full text-[13px] font-semibold transition-all flex items-center gap-2 tactile-button text-white"
                            >
                                <span className="material-symbols-outlined text-[16px]">dashboard</span>
                                进入控制台
                            </Link>
                        ) : (
                            <Link
                                href="/login"
                                className="px-5 py-1.5 rounded-full border border-black/10 dark:border-white/10 text-[13px] font-semibold hover:bg-black hover:text-white dark:hover:bg-white dark:hover:text-black transition-all text-[#1d1d1f] dark:text-white bg-white dark:bg-white/5 shadow-sm"
                            >
                                登录 / 注册
                            </Link>
                        )}
                    </div>
                </div>
            </header>

            <main className="flex-grow">
                <Hero isLoggedIn={isLoggedIn} onSyncSuccess={handleSyncSuccess} />
                <StatsPanel />
                <HistoryList refreshTrigger={refreshTrigger} isLoggedIn={false} layout="list" />
            </main>
            <Footer />
        </div>
    );
}
