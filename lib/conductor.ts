import fs from 'fs';
import os from 'os';
import path from 'path';

import { localizeContentAssets } from './assets';
import { convertToMarkdown } from './converter';
import { prisma } from './db';
import { exportArticleHtmlToDocxBuffer } from './docx-export';
import { FeishuSyncError } from './feishu-errors';
import { FeishuClient } from './feishu';
import { extractContent, extractMetadata } from './parser';
import { scrapeWeChatArticle } from './scraper';
import { getValidUserAccessToken } from './user-token';

/**
 * PHASE 1: Server-First Processing
 * Scrapes, downloads assets to CAS (public/uploads), saves to DB.
 * No longer saves to 'output/' folder.
 */
export async function processArticle(url: string, userId?: string) {
  const existingArticle = await prisma.article.findFirst({
    where: {
      originalUrl: url,
      status: 'stored',
      content: { not: null },
      contentHtml: { not: null },
    },
    orderBy: { updatedAt: 'desc' },
  });

  if (existingArticle) {
    console.log(`[SmartCache] Hit! Found existing article: ${existingArticle.id}`);

    if (userId) {
      const userArticle = await prisma.article.findFirst({
        where: {
          originalUrl: url,
          userId,
        },
      });

      if (userArticle) {
        console.log(
          `[SmartCache] User ${userId} already owns this article. Updating timestamp.`
        );
        await prisma.article.update({
          where: { id: userArticle.id },
          data: { updatedAt: new Date() },
        });
        return { success: true, articleId: userArticle.id, status: 'stored' };
      }

      console.log(`[SmartCache] Cloning article for user ${userId}...`);
      const newArticle = await prisma.article.create({
        data: {
          title: existingArticle.title,
          author: existingArticle.author,
          accountName: existingArticle.accountName,
          publishDate: existingArticle.publishDate,
          originalUrl: url,
          localPath: existingArticle.localPath,
          thumbnailPath: existingArticle.thumbnailPath,
          content: existingArticle.content,
          contentHtml: existingArticle.contentHtml,
          status: 'stored',
          userId,
        },
      });

      return { success: true, articleId: newArticle.id, status: 'stored' };
    }
  }

  let article;

  if (userId) {
    const userArticle = await prisma.article.findFirst({
      where: { originalUrl: url, userId },
    });

    if (userArticle) {
      article = await prisma.article.update({
        where: { id: userArticle.id },
        data: { status: 'crawling', updatedAt: new Date() },
      });
    } else {
      article = await prisma.article.create({
        data: {
          title: 'Processing...',
          originalUrl: url,
          status: 'crawling',
          userId,
        },
      });
    }
  } else {
    article = await prisma.article.create({
      data: {
        title: 'Processing...',
        originalUrl: url,
        status: 'crawling',
        userId: null,
      },
    });
  }

  try {
    console.log(`[Scrape] Starting: ${url}`);
    const { html } = await scrapeWeChatArticle(url);
    const metadata = extractMetadata(html);
    const contentHtml = extractContent(html);

    article = await prisma.article.update({
      where: { id: article.id },
      data: {
        title: metadata.title,
        author: metadata.author,
        accountName: metadata.accountName,
        publishDate: metadata.publishDate ? new Date(metadata.publishDate) : null,
      },
    });

    const initialMarkdown = convertToMarkdown(contentHtml, { ...metadata, url });

    console.log('[Localize] Downloading assets to CAS storage...');
    const localizedContent = await localizeContentAssets(
      initialMarkdown,
      contentHtml,
      userId || 'anonymous',
      article.id
    );

    article = await prisma.article.update({
      where: { id: article.id },
      data: {
        localPath: null,
        content: localizedContent.markdown,
        contentHtml: localizedContent.html,
        status: 'stored',
      },
    });

    console.log(`[Process] Article stored in DB: ${article.id}`);
    return { success: true, articleId: article.id, status: 'stored' };
  } catch (error) {
    console.error('[Conductor] Process Error:', error);
    await prisma.article.update({
      where: { id: article.id },
      data: { status: 'error' },
    });
    throw error;
  }
}

/**
 * PHASE 2: Optional Sync
 * Takes a DB-stored article and pushes it to Feishu.
 */
export async function syncArticleToFeishu(articleId: string) {
  const article = await prisma.article.findUnique({ where: { id: articleId } });

  if (!article || (!article.content && !article.contentHtml)) {
    throw new Error('Article not found or has no content');
  }

  if (!article.userId) {
    throw new FeishuSyncError(
      'FEISHU_BIND_REQUIRED',
      'Only logged-in users with a connected Feishu account can sync articles.'
    );
  }

  await prisma.article.update({
    where: { id: articleId },
    data: { status: 'syncing' },
  });

  let tempExportPath: string | null = null;
  let tempDirPath: string | null = null;

  try {
    const client = new FeishuClient();
    const token = await getValidUserAccessToken(article.userId);
    const rootToken = await client.getRootFolderToken(token);
    const importSourceFolderToken = await client.ensureFolder(
      rootToken,
      'Wechat2doc Imports',
      token
    );
    const safeTitle =
      (article.title || 'wechat-article')
        .replace(/[\\/:*?"<>|]/g, '_')
        .trim()
        .substring(0, 50) || 'wechat-article';

    tempDirPath = fs.mkdtempSync(path.join(os.tmpdir(), 'feishu-sync-'));
    tempExportPath = path.join(tempDirPath, `${safeTitle}.docx`);

    const docxBuffer = await exportArticleHtmlToDocxBuffer(
      article.contentHtml || article.content || '',
      {
        author: article.author,
        description: article.accountName || article.originalUrl,
        title: article.title || 'wechat-article',
      }
    );
    fs.writeFileSync(tempExportPath, docxBuffer);

    const importFileToken = await client.uploadFile(
      tempExportPath,
      importSourceFolderToken,
      'explorer',
      token
    );
    const ticket = await client.createImportTask(
      importFileToken,
      'docx',
      rootToken,
      token
    );

    let feishuUrl = '';
    for (let i = 0; i < 30; i += 1) {
      await new Promise((resolve) => setTimeout(resolve, 2000));
      const status = await client.getImportResult(ticket, token);

      if (status.job_status === 0) {
        feishuUrl = status.url;
        break;
      }

      if (status.job_status > 2) {
        throw new Error(`Feishu Import Failed: ${status.job_error_msg}`);
      }
    }

    if (!feishuUrl) {
      throw new Error('Feishu import timed out before returning a document URL.');
    }

    await prisma.article.update({
      where: { id: articleId },
      data: {
        status: 'synced',
        feishuUrl,
      },
    });

    return { success: true, feishuUrl };
  } catch (error) {
    await prisma.article.update({
      where: { id: articleId },
      data: { status: 'stored' },
    });
    throw error;
  } finally {
    if (tempExportPath && fs.existsSync(tempExportPath)) {
      fs.unlinkSync(tempExportPath);
    }

    if (tempDirPath && fs.existsSync(tempDirPath)) {
      fs.rmdirSync(tempDirPath);
    }
  }
}

export async function conductorProcess(url: string, userId?: string) {
  const result = await processArticle(url, userId);
  console.log('[Conductor] Auto-syncing for migration compatibility...');
  return syncArticleToFeishu(result.articleId);
}
