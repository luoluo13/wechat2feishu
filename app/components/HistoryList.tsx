
'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';

interface Article {
    id: string;
    title: string;
    originalUrl?: string;
    publishDate: string;
    status: string;
    feishuUrl?: string;
    createdAt?: string;
    count?: number; // For trending
    accountName?: string;
}

interface HistoryListProps {
    refreshTrigger: number;
    isLoggedIn?: boolean;
    layout?: 'list' | 'grid';
}

export function HistoryList({ refreshTrigger, isLoggedIn, layout = 'list' }: HistoryListProps) {
    const [articles, setArticles] = useState<Article[]>([]);
    // If not logged in, force trending mode. If logged in, default to 'personal'.
    const [viewMode, setViewMode] = useState<'personal' | 'trending'>(isLoggedIn ? 'personal' : 'trending');

    // Sync viewMode when login status changes
    useEffect(() => {
        if (!isLoggedIn) setViewMode('trending');
        else setViewMode('personal');
    }, [isLoggedIn]);

    useEffect(() => {
        // If layout is grid, we assume it's personal dashboard, so fetch personal history
        // If layout is list, use the viewMode toggle (Trending vs Personal) logic?
        // Actually, Dashboard will always be Personal.

        let url = '/api/history';
        if (layout === 'list' && viewMode === 'trending') {
            url = '/api/history?mode=trending';
        }

        fetch(url)
            .then((res) => res.json())
            .then((data) => {
                if (data.data) setArticles(data.data);
            })
            .catch(console.error);
    }, [refreshTrigger, isLoggedIn, viewMode, layout]);

    const handleDelete = async (id: string) => {
        if (!confirm('确定删除这条记录吗？')) return;
        try {
            await fetch(`/api/history?id=${id}`, { method: 'DELETE' });
            setArticles(prev => prev.filter(a => a.id !== id));
        } catch (e) {
            console.error('Delete failed', e);
        }
    };

    const formatTime = (dateStr?: string) => {
        if (!dateStr) return '';
        const date = new Date(dateStr);
        const now = new Date();
        const diffMs = now.getTime() - date.getTime();
        const diffMins = Math.floor(diffMs / 60000);

        if (diffMins < 1) return '刚刚';
        if (diffMins < 60) return `${diffMins}分钟前`;
        if (diffMins < 1440) return `${Math.floor(diffMins / 60)}小时前`;
        return date.toLocaleDateString();
    };

    // Empty State
    if (articles.length === 0 && viewMode === 'personal' && layout !== 'grid') { // Grid handles empty state in parent or just shows empty grid
        return (
            <section className="max-w-[1024px] mx-auto px-golden-sm pb-golden-xl">
                <div className="bg-white/40 dark:bg-white/5 backdrop-blur-md rounded-[24px] border border-black/[0.04] dark:border-white/5 overflow-hidden min-h-[400px] flex flex-col items-center justify-center py-20 px-8 text-center shadow-sm transition-colors">
                    <div className="w-24 h-24 mb-6 rounded-[28px] bg-black/[0.02] dark:bg-white/5 border border-black/[0.04] dark:border-white/5 flex items-center justify-center relative">
                        <span className="material-symbols-outlined text-[48px] text-black/[0.08] dark:text-white/10">history</span>
                        <div className="absolute -right-2 -bottom-2 w-10 h-10 rounded-full bg-white dark:bg-[#2C2C2E] shadow-sm border border-black/[0.05] dark:border-white/10 flex items-center justify-center">
                            <span className="material-symbols-outlined text-[20px] text-black/20 dark:text-white/20">search</span>
                        </div>
                    </div>
                    <h4 className="text-[19px] font-semibold text-black/60 dark:text-white/60 mb-2">暂无转存记录</h4>
                    <p className="text-[14px] text-black/30 dark:text-white/30 max-w-[280px] leading-relaxed mx-auto">
                        粘贴微信文章链接，开启你的第一个高保真知识库归档。
                    </p>
                </div>
            </section>
        );
    }

    // Grid Layout (Dashboard)
    if (layout === 'grid') {
        return (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {articles.map((article) => (
                    <div
                        key={article.id}
                        className="group bg-white dark:bg-apple-card rounded-2xl border border-black/[0.04] dark:border-white/5 p-5 shadow-[0_2px_8px_rgba(0,0,0,0.02)] dark:shadow-[0_4px_12px_rgba(0,0,0,0.2)] hover:shadow-[0_8px_24px_rgba(0,0,0,0.06)] dark:hover:shadow-[0_12px_24px_rgba(0,0,0,0.4)] hover:-translate-y-0.5 transition-all cursor-pointer relative"
                    >
                        <div className="flex justify-between items-start mb-4">
                            <div className="w-10 h-10 rounded-[10px] bg-vibrant-amber/10 flex items-center justify-center">
                                <span className="material-symbols-outlined text-vibrant-amber text-[22px]">article</span>
                            </div>
                            <span className="text-[11px] font-bold text-black/30 dark:text-white/30 bg-black/[0.03] dark:bg-white/5 px-2 py-1 rounded-md uppercase">微信文章</span>
                        </div>

                        <Link href={`/articles/${article.id}`} className="block">
                            <h3 className="text-[16px] font-bold leading-snug mb-3 text-[#1d1d1f] dark:text-white group-hover:text-black dark:group-hover:text-white transition-colors line-clamp-2 min-h-[44px]">
                                {article.title}
                            </h3>
                            <p className="text-[13px] text-black/45 dark:text-white/45 line-clamp-2 mb-4 leading-relaxed">
                                {article.accountName ? `公众号：${article.accountName}` : '微信公众号文章归档...'}
                            </p>
                        </Link>

                        <div className="flex items-center justify-between pt-4 border-t border-black/[0.03] dark:border-white/5">
                            <span className="text-[11px] font-medium text-black/30 dark:text-white/30 italic">
                                {formatTime(article.createdAt)}
                            </span>

                            <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                                {/* Download Button */}
                                {article.status === 'completed' && (
                                    <button
                                        className="action-icon w-8 h-8 rounded-full hover:bg-black/5 dark:hover:bg-white/10 dark:text-white/50 dark:hover:text-white"
                                        title="下载 Markdown"
                                        onClick={async (e) => {
                                            e.stopPropagation();
                                            try {
                                                const res = await fetch(`/api/articles/${article.id}/content`);
                                                const data = await res.json();
                                                if (data.content) {
                                                    const blob = new Blob([data.content], { type: 'text/markdown' });
                                                    const url = window.URL.createObjectURL(blob);
                                                    const a = document.createElement('a');
                                                    a.href = url;
                                                    a.download = `${data.title || 'article'}.md`;
                                                    a.click();
                                                    window.URL.revokeObjectURL(url);
                                                }
                                            } catch (e) {
                                                console.error('Download failed', e);
                                            }
                                        }}
                                    >
                                        <span className="material-symbols-outlined text-[18px]">download</span>
                                    </button>
                                )}
                                <button
                                    className="action-icon delete w-8 h-8 rounded-full hover:bg-red-50 dark:hover:bg-red-900/20 dark:text-white/50"
                                    title="删除"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        handleDelete(article.id);
                                    }}
                                >
                                    <span className="material-symbols-outlined text-[18px]">delete</span>
                                </button>
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        );
    }

    // Personal List Layout
    if (layout === 'list' && viewMode === 'personal') {
        return (
            <div className="bg-white dark:bg-apple-card rounded-3xl border border-black/[0.04] dark:border-white/5 shadow-[0_4px_20px_rgba(0,0,0,0.02)] dark:shadow-[0_4px_12px_rgba(0,0,0,0.2)] overflow-hidden transition-colors">
                <table className="w-full text-left">
                    <thead>
                        <tr className="border-b border-black/[0.03] dark:border-white/5">
                            <th className="pl-8 pr-2 py-5 w-12">
                                <input type="checkbox" className="appearance-none w-5 h-5 border border-black/10 dark:border-white/10 rounded-md checked:bg-black dark:checked:bg-white dark:checked:border-white checked:border-black transition-all cursor-pointer relative checked:after:content-['check'] checked:after:font-['Material_Symbols_Outlined'] checked:after:absolute checked:after:inset-0 checked:after:flex checked:after:items-center checked:after:justify-center checked:after:text-white dark:checked:after:text-black checked:after:text-[14px] checked:after:font-bold" />
                            </th>
                            <th className="px-6 py-5 text-[12px] font-bold text-black/30 dark:text-white/30 uppercase tracking-wider whitespace-nowrap">文章标题</th>
                            <th className="px-6 py-5 text-[12px] font-bold text-black/30 dark:text-white/30 uppercase tracking-wider whitespace-nowrap">来源</th>
                            <th className="px-6 py-5 text-[12px] font-bold text-black/30 dark:text-white/30 uppercase tracking-wider whitespace-nowrap">转存日期</th>
                            <th className="px-8 py-5 text-[12px] font-bold text-black/30 dark:text-white/30 uppercase tracking-wider text-right whitespace-nowrap">操作</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-black/[0.02] dark:divide-white/5">
                        {articles.map((article) => (
                            <tr key={article.id} className="group hover:bg-black/[0.01] dark:hover:bg-white/5 transition-colors">
                                <td className="pl-8 pr-2 py-6">
                                    <input type="checkbox" className="appearance-none w-5 h-5 border border-black/10 dark:border-white/10 rounded-md checked:bg-black dark:checked:bg-white dark:checked:border-white checked:border-black transition-all cursor-pointer relative checked:after:content-['check'] checked:after:font-['Material_Symbols_Outlined'] checked:after:absolute checked:after:inset-0 checked:after:flex checked:after:items-center checked:after:justify-center checked:after:text-white dark:checked:after:text-black checked:after:text-[14px] checked:after:font-bold" />
                                </td>
                                <td className="px-6 py-6 w-full">
                                    <div className="flex items-center gap-4">
                                        <div className="w-10 h-10 rounded-xl bg-vibrant-amber/10 flex items-center justify-center shrink-0">
                                            <span className="material-symbols-outlined text-vibrant-amber text-[20px]">article</span>
                                        </div>
                                        <Link href={`/articles/${article.id}`} className="text-[15px] font-bold text-[#1d1d1f] dark:text-white/90 line-clamp-1 hover:text-black dark:hover:text-white transition-colors block">
                                            {article.title}
                                        </Link>
                                    </div>
                                </td>
                                <td className="px-6 py-6 whitespace-nowrap">
                                    <div className="flex items-center gap-2">
                                        <div className="w-5 h-5 bg-[#07C160] rounded-sm flex items-center justify-center shrink-0">
                                            <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 24 24"><path d="M20.1 14.1c-.2-.1-.8-.4-.9-.5-.1-.1-.2-.1-.3 0-.1.1-.5.6-.6.7-.1.1-.2.1-.4 0-.3-.1-1.1-.4-2.1-1.3-.8-.7-1.3-1.5-1.5-1.8-.1-.2 0-.3.1-.4.1-.1.2-.2.3-.3.1-.1.1-.2.2-.3.1-.1.1-.2.2-.3.1-.1.1-.3 0-.4-.1-.1-.3-.7-.4-.9-.1-.3-.2-.3-.3-.3h-.3c-.1 0-.3.1-.5.3-.2.2-.7.7-.7 1.7 0 1 .7 2 1 2.2.1.1 2.8 4.3 6.8 6 1 .4 1.7.6 2.3.8 1 .3 1.9.3 2.6.2.8-.1 2.4-.9 2.7-1.7.3-.8.3-1.5.2-1.7-.1-.2-.3-.3-.5-.4zM12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.6 0 12 0z"></path></svg>
                                        </div>
                                        <span className="text-[13px] font-medium text-black/60 dark:text-white/60 truncate max-w-[120px]">{article.accountName || '未知公众号'}</span>
                                    </div>
                                </td>
                                <td className="px-6 py-6 text-[13px] text-black/40 dark:text-white/40 font-medium whitespace-nowrap">
                                    {formatTime(article.createdAt)}
                                </td>
                                <td className="px-8 py-6">
                                    <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <a href={article.originalUrl} target="_blank" className="p-2 hover:bg-black/5 dark:hover:bg-white/10 rounded-lg text-black/40 dark:text-white/40 hover:text-black dark:hover:text-white transition-all" title="查看原文">
                                            <span className="material-symbols-outlined text-[20px]">link</span>
                                        </a>
                                        <button
                                            onClick={() => handleDelete(article.id)}
                                            className="p-2 hover:bg-vibrant-red/10 rounded-lg text-black/40 dark:text-white/40 hover:text-vibrant-red transition-all"
                                            title="删除"
                                        >
                                            <span className="material-symbols-outlined text-[20px]">delete</span>
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        );
    }

    // List Layout (Public)
    return (
        <section className="max-w-[980px] mx-auto px-golden-sm pb-golden-xl">
            {/* Header / Tabs */}
            <div className="flex items-center justify-between mb-8 px-2">
                <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-[18px] text-vibrant-amber">trending_up</span>
                    <h3 className="text-[14px] font-semibold text-black/30 dark:text-white/30 tracking-[0.1em] uppercase">热门转存</h3>
                </div>
                <span className="text-[12px] font-medium text-black/25 dark:text-white/25 flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-vibrant-green animate-pulse"></span>
                    实时更新
                </span>
            </div>

            {/* List */}
            <div className="bg-white/40 dark:bg-white/5 backdrop-blur-md rounded-[24px] border border-black/[0.04] dark:border-white/5 overflow-hidden shadow-[0_4px_24px_-4px_rgba(0,0,0,0.02)] transition-colors">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="text-[12px] font-bold text-black/30 dark:text-white/30 uppercase tracking-wider">
                            <th className="px-8 py-5">文章标题</th>
                            <th className="px-8 py-5 text-right hidden md:table-cell">
                                {viewMode === 'trending' ? '转存次数' : '转存时间'}
                            </th>
                        </tr>
                    </thead>
                    <tbody>
                        {articles.map((article, index) => (
                            <React.Fragment key={article.id}>
                                <tr className="group hover:bg-black/[0.02] dark:hover:bg-white/5 transition-colors">
                                    <td className="px-8 py-6">
                                        <div className="flex items-center gap-4">
                                            {/* Rank Badge for Trending */}
                                            {viewMode === 'trending' && (
                                                <span className={`text-[13px] font-bold w-4 tabular-nums ${index < 3 ? 'text-black/20 dark:text-white/20' : 'text-black/10 dark:text-white/10 text-[11px]'
                                                    }`}>
                                                    {String(index + 1).padStart(2, '0')}
                                                </span>
                                            )}

                                            <div className="flex flex-col gap-1">
                                                {viewMode === 'personal' ? (
                                                    <Link
                                                        href={`/articles/${article.id}`}
                                                        className="text-[16px] font-semibold text-black/85 dark:text-white/90 leading-tight hover:text-black dark:hover:text-white transition-colors line-clamp-1 cursor-pointer"
                                                    >
                                                        {article.title || '正在处理...'}
                                                    </Link>
                                                ) : (
                                                    <a
                                                        href={article.originalUrl}
                                                        target="_blank"
                                                        rel="noreferrer"
                                                        className="text-[16px] font-semibold text-black/85 dark:text-white/90 leading-tight hover:text-black dark:hover:text-white transition-colors line-clamp-1 cursor-pointer"
                                                    >
                                                        {article.title || '正在处理...'}
                                                    </a>
                                                )}
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-8 py-6 text-right hidden md:table-cell">
                                        {viewMode === 'trending' ? (
                                            <span className="text-[14px] text-black/40 dark:text-white/40 font-semibold tabular-nums">{article.count?.toLocaleString()}</span>
                                        ) : (
                                            <span className="text-[14px] text-black/40 dark:text-white/40 font-medium">
                                                {formatTime(article.createdAt)}
                                            </span>
                                        )}
                                    </td>
                                </tr>
                                {index < articles.length - 1 && (
                                    <tr><td colSpan={2}><div className="h-[0.5px] bg-black/[0.08] dark:bg-white/5 mx-8"></div></td></tr>
                                )}
                            </React.Fragment>
                        ))}
                    </tbody>
                </table>
            </div>
        </section>
    );
}
