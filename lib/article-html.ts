import * as cheerio from 'cheerio';

const EMOJI_PATTERNS = [
  'wx_fed/wechat_emotion',
  '/emoji/',
  '/we-emoji/',
  '/emotion/',
  'expression',
  'mpres/htmledition/images/icon',
];

function isEmojiImage(src: string, alt: string, width?: string) {
  return (
    EMOJI_PATTERNS.some((pattern) => src.toLowerCase().includes(pattern.toLowerCase())) ||
    alt.includes('wx_emoji_') ||
    alt.toLowerCase().includes('emoji') ||
    (!!width && Number.parseInt(width, 10) <= 120)
  );
}

function toDisplayImageSrc(src: string) {
  if (!src) return src;
  if (src.startsWith('/')) return src;
  if (src.startsWith('data:')) return src;

  if (src.includes('mmbiz.qpic.cn') || src.includes('mp.weixin.qq.com')) {
    return `/api/image-proxy/${encodeURIComponent(src)}/image.jpg`;
  }

  return src;
}

export function prepareArticleHtmlForRender(html: string): string {
  const $ = cheerio.load(html, {}, false);

  $('script, style, iframe, form, input, button, textarea, select').remove();

  $('*').each((_, element) => {
    const $element = $(element);
    const attributes = { ...((element as { attribs?: Record<string, string> }).attribs || {}) };

    for (const [name, value] of Object.entries(attributes)) {
      const lowerName = name.toLowerCase();
      const stringValue = String(value || '');

      if (lowerName.startsWith('on')) {
        $element.removeAttr(name);
        continue;
      }

      if ((lowerName === 'href' || lowerName === 'src') && /^\s*javascript:/i.test(stringValue)) {
        $element.removeAttr(name);
      }
    }
  });

  $('a').each((_, element) => {
    const $link = $(element);
    const href = $link.attr('href');

    if (!href) {
      return;
    }

    if (/^https?:\/\//i.test(href)) {
      $link.attr('target', '_blank');
      $link.attr('rel', 'noreferrer noopener');
    }
  });

  $('img').each((_, element) => {
    const $img = $(element);
    const src = toDisplayImageSrc($img.attr('src') || '');
    const alt = $img.attr('alt') || 'article image';
    const width = $img.attr('data-w') || $img.attr('width');

    $img.attr('src', src);
    $img.attr('alt', alt);
    $img.attr('loading', 'lazy');

    if (isEmojiImage(src, alt, width)) {
      $img.attr('data-emoji', 'true');
      $img.addClass('article-emoji');
    } else {
      $img.addClass('article-image');
    }
  });

  $('table').each((_, element) => {
    const $table = $(element);

    $table.addClass('article-table');
    $table.find('th').addClass('article-th');
    $table.find('td').addClass('article-td');

    if (!$table.parent().hasClass('article-table-wrap')) {
      $table.wrap('<div class="article-table-wrap"></div>');
    }
  });

  return $.root().html() || '';
}
