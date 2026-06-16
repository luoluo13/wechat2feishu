import axios from 'axios';
import * as cheerio from 'cheerio';
import fs from 'fs/promises';
import path from 'path';
import sharp from 'sharp';

/**
 * Downloads an image from a URL, compresses it, and saves it to the user's upload directory
 * @returns The public URL path to the saved image
 */
import crypto from 'crypto';

function isRemoteAssetUrl(url: string) {
  return /^https?:\/\//i.test(url);
}

function collectRemoteImageUrlsFromMarkdown(markdown: string) {
  const imgRegex = /!\[(.*?)\]\((.*?)\)/g;
  const urls: string[] = [];
  let match;

  while ((match = imgRegex.exec(markdown)) !== null) {
    const originalUrl = match[2];
    if (isRemoteAssetUrl(originalUrl)) {
      urls.push(originalUrl);
    }
  }

  return urls;
}

function collectRemoteImageUrlsFromHtml(html: string) {
  const $ = cheerio.load(html, {}, false);
  const urls: string[] = [];

  $('img').each((_, element) => {
    const src = $(element).attr('src') || $(element).attr('data-src') || '';
    if (isRemoteAssetUrl(src)) {
      urls.push(src);
    }
  });

  return urls;
}

async function createAssetReplacementMap(urls: string[]) {
  const uniqueUrls = Array.from(new Set(urls));
  const replacements = await Promise.all(
    uniqueUrls.map(async (original) => ({
      original,
      local: await downloadImageCAS(original),
    }))
  );

  return new Map(
    replacements
      .filter((entry): entry is { original: string; local: string } => !!entry.local)
      .map((entry) => [entry.original, entry.local])
  );
}

function applyAssetReplacementsToMarkdown(markdown: string, replacements: Map<string, string>) {
  let localizedMarkdown = markdown;

  for (const [original, local] of Array.from(replacements.entries())) {
    localizedMarkdown = localizedMarkdown.split(original).join(local);
  }

  return localizedMarkdown;
}

function applyAssetReplacementsToHtml(html: string, replacements: Map<string, string>) {
  const $ = cheerio.load(html, {}, false);

  $('img').each((_, element) => {
    const $img = $(element);
    const src = $img.attr('src') || '';
    const dataSrc = $img.attr('data-src') || '';

    if (src && replacements.has(src)) {
      $img.attr('src', replacements.get(src)!);
    }

    if (dataSrc && replacements.has(dataSrc)) {
      const local = replacements.get(dataSrc)!;
      $img.attr('data-src', local);
      if (!src) {
        $img.attr('src', local);
      }
    }
  });

  return $.root().html() || '';
}

/**
 * Downloads an image from a URL, compresses it, and saves it using CAS (Content-Addressable Storage)
 * Path format: public/uploads/{YYYY}/{MM}/{hash}.{ext}
 * GIF files are preserved as-is to maintain animation, others are converted to WebP
 * @returns The public URL path to the saved image
 */
export async function downloadImageCAS(
  url: string
): Promise<string | null> {
  try {
    // 1. Download Buffer
    const response = await axios.get(url, {
      responseType: 'arraybuffer',
      timeout: 15000,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Referer': 'https://mp.weixin.qq.com/'
      }
    });
    const buffer = Buffer.from(response.data);

    // 2. Detect if it's a GIF (check magic bytes: GIF87a or GIF89a)
    const isGif = buffer.length > 6 &&
      buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46 && // "GIF"
      buffer[3] === 0x38 && (buffer[4] === 0x37 || buffer[4] === 0x39) && buffer[5] === 0x61; // "87a" or "89a"

    // 3. Calculate Hash (SHA-256)
    const hash = crypto.createHash('sha256').update(buffer).digest('hex').substring(0, 32);

    // 4. Determine Directory (YYYY/MM)
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');

    const publicBase = 'public';
    const uploadBase = 'uploads';
    const relativeDir = path.join(uploadBase, String(year), month);
    const fullUploadDir = path.join(process.cwd(), publicBase, relativeDir);

    await fs.mkdir(fullUploadDir, { recursive: true });

    // 5. Determine file extension based on format
    const ext = isGif ? 'gif' : 'webp';
    const filename = `${hash}.${ext}`;
    const fullPath = path.join(fullUploadDir, filename);
    const publicUrl = `/${uploadBase}/${year}/${month}/${filename}`;

    // 6. Check if exists (Deduplication)
    try {
      await fs.access(fullPath);
      // Exists! Return immediately
      return publicUrl;
    } catch {
      // Doesn't exist, proceed to save
    }

    // 7. Save the file
    if (isGif) {
      // Preserve GIF as-is to maintain animation
      await fs.writeFile(fullPath, buffer);
      console.log(`[Asset] Preserved GIF animation: ${filename}`);
    } else {
      // Convert other formats to WebP for optimization
      await sharp(buffer)
        .resize(1200, undefined, {
          withoutEnlargement: true,
          fit: 'inside'
        })
        .webp({ quality: 80, effort: 6 })
        .toFile(fullPath);
    }

    return publicUrl;

  } catch (error: any) {
    console.error(`\x1b[33m[Asset Warning]\x1b[0m Failed to download image ${url}:`, error.message);
    return null;
  }
}

// Deprecated: kept for backward compatibility if needed, but we should switch to CAS
export async function downloadImageOptimized(
  url: string,
  userId: string,
  articleId: string
): Promise<string | null> {
  return downloadImageCAS(url);
}

/**
 * Processes all image links in Markdown content
 */
export async function localizeAssets(
  markdown: string,
  userId: string,
  articleId: string
): Promise<string> {
  const replacements = await createAssetReplacementMap(collectRemoteImageUrlsFromMarkdown(markdown));
  return applyAssetReplacementsToMarkdown(markdown, replacements);
}

export async function localizeContentAssets(
  markdown: string,
  html: string,
  userId: string,
  articleId: string
) {
  const replacements = await createAssetReplacementMap([
    ...collectRemoteImageUrlsFromMarkdown(markdown),
    ...collectRemoteImageUrlsFromHtml(html),
  ]);

  return {
    markdown: applyAssetReplacementsToMarkdown(markdown, replacements),
    html: applyAssetReplacementsToHtml(html, replacements),
  };
}
