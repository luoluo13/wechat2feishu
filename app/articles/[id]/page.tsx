
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/db';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import SyncButton from '@/components/SyncButton';
import { format } from 'date-fns';
import Link from 'next/link';
import { prepareArticleHtmlForRender } from '@/lib/article-html';

export default async function ArticlePage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;

    const article = await prisma.article.findUnique({
        where: { id },
    });

    if (!article || (!article.content && !article.contentHtml)) {
        notFound();
    }

    // Strip Frontmatter for display (Fix for legacy articles)
    const cleanContent = (article.content || '').replace(/^---\n[\s\S]*?\n---\n/, '');
    const renderedHtml = article.contentHtml ? prepareArticleHtmlForRender(article.contentHtml) : null;

    return (
        <div className="min-h-screen text-[#1d1d1f] dark:text-white antialiased pb-20 transition-colors">
            {/* Navbar / Header Placeholder */}
            <div className="sticky top-0 z-10 bg-white/80 dark:bg-[#121212]/80 backdrop-blur-md border-b border-black/5 dark:border-white/5 px-6 py-4 flex items-center justify-between">
                <Link href="/" className="font-bold tracking-wider text-sm p-2 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 transition-colors">
                    ← 返回列表
                </Link>
                <SyncButton
                    articleId={article.id}
                    initialStatus={article.status}
                    feishuUrl={article.feishuUrl}
                />
            </div>

            <main className="max-w-[1080px] mx-auto px-6 mt-10">
                {/* Article Header */}
                <header className="mb-12 text-center md:text-left">
                    <h1 className="text-[32px] md:text-[40px] leading-tight font-bold tracking-tight mb-6 text-black dark:text-white">
                        {article.title}
                    </h1>

                    <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-[15px] text-black/40 dark:text-white/40 font-medium">
                        {article.accountName && (
                            <span className="flex items-center gap-1.5 text-blue-600/80 bg-blue-50 dark:bg-blue-900/20 dark:text-blue-400 px-2 py-0.5 rounded-md">
                                {article.accountName}
                            </span>
                        )}
                        {article.author && <span>{article.author}</span>}
                        {article.publishDate && (
                            <span>{format(article.publishDate, 'yyyy年MM月dd日')}</span>
                        )}
                    </div>
                </header>

                {/* Content Container (Glass Box effect subtle) */}
                <article className="
             article-content
             prose prose-lg prose-slate max-w-none dark:prose-invert
             prose-headings:font-bold prose-headings:tracking-tight prose-headings:text-black dark:prose-headings:text-white
             prose-p:text-black/80 dark:prose-p:text-white/80 prose-p:leading-8
             prose-a:text-blue-600 dark:prose-a:text-blue-400 prose-a:no-underline hover:prose-a:underline
             prose-img:rounded-[20px] prose-img:shadow-lg prose-img:my-8
             prose-blockquote:border-l-4 prose-blockquote:border-black/10 dark:prose-blockquote:border-white/10 prose-blockquote:bg-black/[0.02] dark:prose-blockquote:bg-white/5 prose-blockquote:py-1 prose-blockquote:px-4 prose-blockquote:rounded-r-lg
             prose-code:text-[#d63384] prose-code:bg-black/[0.03] dark:prose-code:bg-white/10 prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded-md prose-code:before:content-none prose-code:after:content-none
             bg-white/50 dark:bg-white/5 backdrop-blur-sm rounded-[32px] p-8 md:p-12 shadow-[0_2px_40px_-12px_rgba(0,0,0,0.05)]
             border border-white/40 dark:border-white/5
        ">
                    {renderedHtml ? (
                        <div dangerouslySetInnerHTML={{ __html: renderedHtml }} />
                    ) : (
                        <ReactMarkdown
                            remarkPlugins={[remarkGfm]}
                            components={{
                                // Custom paragraph handler to support inline emoji images
                                p: ({ node, children, ...props }) => {
                                    const childArray = Array.isArray(children) ? children : [children];
                                    const hasOnlyEmoji = childArray.length === 1 &&
                                        typeof childArray[0] === 'object' &&
                                        childArray[0] !== null &&
                                        'props' in childArray[0] &&
                                        childArray[0].props?.['data-emoji'] === 'true';

                                    if (hasOnlyEmoji) {
                                        return <>{children}</>;
                                    }

                                    return <p {...props}>{children}</p>;
                                },
                                img: ({ node, ...props }) => {
                                    let src = String(props.src || '');
                                    const alt = String(props.alt || '');

                                    const emojiPatterns = [
                                        'wx_fed/wechat_emotion',
                                        '/emoji/',
                                        '/we-emoji/',
                                        '/emotion/',
                                        'expression',
                                        'mpres/htmledition/images/icon',
                                    ];

                                    const isEmoji = emojiPatterns.some(pattern => src.toLowerCase().includes(pattern.toLowerCase())) ||
                                        alt.includes('wx_emoji_') ||
                                        alt.toLowerCase().includes('emoji');

                                    if (src.includes('mmbiz.qpic.cn') || src.includes('mp.weixin.qq.com')) {
                                        const encodedUrl = encodeURIComponent(src);
                                        src = `/api/image-proxy/${encodedUrl}/image.jpg`;
                                    }

                                    if (isEmoji) {
                                        return (
                                            // eslint-disable-next-line @next/next/no-img-element
                                            <img
                                                {...props}
                                                src={src}
                                                data-emoji="true"
                                                className="inline w-[1.2em] h-[1.2em] mx-[0.1em] align-middle shadow-none rounded-none border-none !my-0 !p-0"
                                                style={{ display: 'inline', verticalAlign: 'middle', margin: '0 0.1em' }}
                                                loading="lazy"
                                                alt={props.alt || 'emoji'}
                                            />
                                        );
                                    }

                                    return (
                                        // eslint-disable-next-line @next/next/no-img-element
                                        <img
                                            {...props}
                                            src={src}
                                            className="rounded-[20px] shadow-lg my-8 w-full h-auto"
                                            loading="lazy"
                                            alt={props.alt || 'article image'}
                                        />
                                    );
                                }
                            }}
                        >
                            {cleanContent}
                        </ReactMarkdown>
                    )}
                </article>
            </main>
        </div>
    );
}
