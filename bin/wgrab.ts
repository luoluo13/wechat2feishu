#!/usr/bin/env node
import { Command } from 'commander';
import fs from 'fs/promises';
import path from 'path';
import { scrapeWeChatArticle } from '../lib/scraper';
import { extractMetadata, extractContent } from '../lib/parser';
import { convertToMarkdown } from '../lib/converter';
import { localizeAssets } from '../lib/assets';
import chalk from 'picocolors';

const program = new Command();

function slugify(input: string): string {
  return input
    .replace(/[\\/:*?"<>|]/g, ' ')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase()
    .slice(0, 80) || 'article';
}

async function getUniqueArticleDir(title: string, outputDir: string): Promise<string> {
  const baseDir = path.resolve(process.cwd(), outputDir);
  await fs.mkdir(baseDir, { recursive: true });

  const baseName = slugify(title);
  let candidate = path.join(baseDir, baseName);
  let counter = 2;

  // Keep CLI output deterministic without overwriting an existing export.
  while (true) {
    try {
      await fs.access(candidate);
      candidate = path.join(baseDir, `${baseName}-${counter}`);
      counter += 1;
    } catch {
      await fs.mkdir(candidate, { recursive: true });
      return candidate;
    }
  }
}

async function saveMarkdown(markdown: string, articleDir: string): Promise<string> {
  const filePath = path.join(articleDir, 'article.md');
  await fs.writeFile(filePath, markdown, 'utf8');
  return filePath;
}

program
  .name('wgrab')
  .description('Grab WeChat articles and convert to local Markdown')
  .version('1.0.0')
  .argument('<url>', 'WeChat article URL')
  .option('-o, --output <dir>', 'Output base directory', 'output')
  .action(async (url, options) => {
    console.log(chalk.blue(`\n📦 Initializing wgrab for: ${url}\n`));

    try {
      // 1. Scraping
      console.log(`${chalk.blue('🚚')} Scraping article content...`);
      const { html } = await scrapeWeChatArticle(url);

      // 2. Parsing
      console.log(`${chalk.blue('🔍')} Extracting metadata and cleaning content...`);
      const metadata = extractMetadata(html);
      const contentHtml = extractContent(html);

      // 3. Setup Directory
      const articleDir = await getUniqueArticleDir(metadata.title, options.output);
      console.log(`${chalk.blue('📂')} Created article folder: ${chalk.cyan(articleDir)}`);

      // 4. Initial Conversion
      const initialMarkdown = convertToMarkdown(contentHtml, { ...metadata, url });

            // 5. Asset Localization
            console.log(`${chalk.blue('🖼️')} Downloading images and localizing links...`);
            // Use 'cli' as userId and a hash of the title or just 'cli-article' for the articleId
            const finalMarkdown = await localizeAssets(initialMarkdown, 'cli-user', 'manual-grab');
            
      // 6. Final Save
      const filePath = await saveMarkdown(finalMarkdown, articleDir);
      
      console.log(`\n${chalk.green('✅')} ${chalk.bold('Success!')}`);
      console.log(`${chalk.green('📄')} Article saved to: ${chalk.underline(filePath)}\n`);

    } catch (error: any) {
      console.error(`\n${chalk.red('❌')} ${chalk.bold('Error:')} ${error.message}\n`);
      process.exit(1);
    }
  });

program.parse();
