'use client';

import { useTheme } from "next-themes";
import { useState, useEffect } from 'react';
import { useSession, signOut } from "next-auth/react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";

export function Header() {
  const { data: session, status } = useSession();
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const router = useRouter();
  const pathname = usePathname();

  // Prevent hydration mismatch
  useEffect(() => {
    setMounted(true);
  }, []);

  const handleLogin = () => {
    router.push('/login');
  };

  const handleLogout = async () => {
    await signOut({ redirect: false });
    router.push('/');
    router.refresh();
  };

  // Smart Logo click handler: 
  // - Deep pages (e.g., /articles/123) → navigate back to list (/)
  // - List page (/) → scroll to top
  const handleLogoClick = () => {
    const isDeepPage = pathname !== '/' && pathname.includes('/');

    if (isDeepPage) {
      router.push('/');
    } else {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const user = session?.user;
  const isLoggedIn = status === "authenticated";

  // Dashboard Header Style
  if (isLoggedIn) {
    return (
      <header className="h-16 glass-nav border-b border-black/[0.03] dark:border-white/[0.08] px-6 flex items-center justify-between z-10 sticky top-0 transition-colors">
        {/* Mobile Logo - smart navigation */}
        <div className="flex items-center gap-4 lg:hidden">
          <button
            onClick={handleLogoClick}
            className="flex items-center gap-3 cursor-pointer hover:opacity-80 transition-opacity"
            title={pathname === '/' ? '回到顶部' : '返回列表'}
          >
            <div className="w-8 h-8 bg-black dark:bg-white rounded-[7px] flex items-center justify-center shrink-0">
              <span className="material-symbols-outlined text-white dark:text-black text-[18px]">bolt</span>
            </div>
            <span className="font-semibold text-[19px] tracking-tight text-[#1d1d1f] dark:text-white">Wechat2doc</span>
          </button>
        </div>

        {/* Desktop Breadcrumb */}
        <div className="hidden lg:flex items-center gap-2">
          <span className="text-[14px] font-medium text-black/40 dark:text-white/40">知识库</span>
          <span className="material-symbols-outlined text-[16px] text-black/20 dark:text-white/20">chevron_right</span>
          <span className="text-[14px] font-semibold dark:text-white/90">所有文档</span>
        </div>

        {/* Right Actions */}
        <div className="flex items-center gap-6">
          <div className="relative hidden md:block">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-[18px] text-black/30 dark:text-white/30">search</span>
            <input
              className="bg-black/[0.03] dark:bg-white/5 border-none dark:border dark:border-white/5 rounded-full py-1.5 pl-10 pr-4 text-[13px] w-64 focus:ring-1 focus:ring-black/10 dark:focus:ring-white/20 transition-all placeholder:text-black/30 dark:placeholder:text-white/20 dark:text-white"
              placeholder="搜索文档..."
              type="text"
            />
          </div>

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

          <div className="relative">
            <button
              onClick={() => setShowMenu(!showMenu)}
              className="flex items-center gap-3"
            >
              <div className="w-8 h-8 rounded-full bg-apple-gray border border-black/5 overflow-hidden">
                {user?.image ? (
                  <img src={user.image} alt="Avatar" className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-black/5 text-black/40">
                    <span className="material-symbols-outlined text-[18px]">person</span>
                  </div>
                )}
              </div>
              <span className="text-[13px] font-semibold hidden sm:block">{user?.name || user?.email?.split('@')[0]}</span>
            </button>

            {showMenu && (
              <>
                <div className="absolute right-0 top-full mt-2 w-40 bg-white dark:bg-[#2C2C2E] rounded-xl shadow-lg border border-gray-100 dark:border-white/10 py-1 flex flex-col z-[60]">
                  <Link
                    href="/home"
                    className="w-full text-left px-4 py-2.5 text-[13px] text-black/70 dark:text-white/70 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors flex items-center gap-2"
                    onClick={() => setShowMenu(false)}
                  >
                    <span className="material-symbols-outlined text-[16px]">home</span>
                    查看首页
                  </Link>
                  <div className="h-[1px] bg-gray-100 dark:bg-white/10 mx-2 my-1"></div>
                  <button
                    onClick={handleLogout}
                    className="w-full text-left px-4 py-2.5 text-[13px] text-red-500 hover:bg-gray-50 dark:hover:bg-white/5 transition-colors flex items-center gap-2"
                  >
                    <span className="material-symbols-outlined text-[16px]">logout</span>
                    退出登录
                  </button>
                </div>
                <div className="fixed inset-0 z-50 cursor-default" onClick={() => setShowMenu(false)}></div>
              </>
            )}
          </div>
        </div>
      </header>
    );
  }

  // Public Header Style
  return (
    <header className="fixed top-0 w-full z-50 glass-nav border-b border-black/[0.03] dark:border-white/[0.08] transition-colors">
      <div className="max-w-[1200px] mx-auto flex items-center justify-between px-golden-sm h-16">
        <Link href="/" className="flex items-center gap-3 cursor-pointer hover:opacity-80 transition-opacity">
          <div className="w-8 h-8 bg-black dark:bg-white rounded-[7px] flex items-center justify-center">
            <span className="material-symbols-outlined text-white dark:text-black text-[18px]">bolt</span>
          </div>
          <span className="font-semibold text-[19px] tracking-tight text-[#1d1d1f] dark:text-white">Wechat2doc</span>
        </Link>
        <nav className="hidden md:flex items-center gap-8 text-[14px] font-medium text-black/60 dark:text-white/60">
          <Link className="hover:text-black dark:hover:text-white transition-colors" href="/">首页</Link>
          <Link className="hover:text-black dark:hover:text-white transition-colors" href="/changelog">迭代记录</Link>
        </nav>

        <div className="flex items-center gap-4">
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

          {/* Right Action Button - Context-aware */}
          {isLoggedIn ? (
            <button
              onClick={() => router.push('/')}
              className="px-5 py-1.5 rounded-full text-[13px] font-semibold transition-all flex items-center gap-2 tactile-button text-white"
            >
              <span className="material-symbols-outlined text-[16px]">dashboard</span>
              进入控制台
            </button>
          ) : (
            <button
              onClick={handleLogin}
              className="px-5 py-1.5 rounded-full border border-black/10 dark:border-white/10 text-[13px] font-semibold hover:bg-black hover:text-white dark:hover:bg-white dark:hover:text-black transition-all text-[#1d1d1f] dark:text-white bg-white dark:bg-white/5 shadow-sm"
            >
              登录 / 注册
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
