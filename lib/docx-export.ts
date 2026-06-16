import fs from 'fs/promises';
import path from 'path';

import axios from 'axios';
import * as cheerio from 'cheerio';
import type { AnyNode, Element } from 'domhandler';
import sharp from 'sharp';
import {
  AlignmentType,
  BorderStyle,
  Document,
  ExternalHyperlink,
  HeadingLevel,
  ImageRun,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableLayoutType,
  TableRow,
  TextRun,
  WidthType,
  type FileChild,
  type ParagraphChild,
} from 'docx';

const MAX_IMAGE_WIDTH_PX = 1200;
const DOCX_CONTENT_WIDTH_DXA = 9000;
const BORDER_COLOR = 'D6D6DB';

type InlineStyle = {
  bold?: boolean;
  code?: boolean;
  color?: string;
  italics?: boolean;
  strike?: boolean;
  subScript?: boolean;
  superScript?: boolean;
  underline?: boolean;
};

type DocxExportOptions = {
  author?: string | null;
  description?: string | null;
  title: string;
};

type RenderContext = {
  listLevel?: number;
  listType?: 'bullet' | 'number';
};

type TableCellSlot = {
  colspan: number;
  element: Element;
  rowspan: number;
};

function normalizeText(value: string) {
  return value.replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim();
}

function parseColor(value?: string | null) {
  if (!value) {
    return undefined;
  }

  const normalized = value.trim();
  const hexMatch = normalized.match(/^#?([0-9a-fA-F]{6})$/);
  if (hexMatch) {
    return hexMatch[1].toUpperCase();
  }

  const rgbMatch = normalized.match(
    /^rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})/i
  );

  if (!rgbMatch) {
    return undefined;
  }

  return rgbMatch
    .slice(1, 4)
    .map((part) => Math.max(0, Math.min(255, Number(part))).toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase();
}

function mergeStyle(base: InlineStyle, next: InlineStyle): InlineStyle {
  return { ...base, ...next };
}

function getHeadingLevel(tagName: string) {
  switch (tagName) {
    case 'h1':
      return HeadingLevel.HEADING_1;
    case 'h2':
      return HeadingLevel.HEADING_2;
    case 'h3':
      return HeadingLevel.HEADING_3;
    case 'h4':
      return HeadingLevel.HEADING_4;
    case 'h5':
      return HeadingLevel.HEADING_5;
    default:
      return HeadingLevel.HEADING_6;
  }
}

function createBlankParagraph() {
  return new Paragraph({ text: '' });
}

function createTextRun(text: string, style: InlineStyle = {}) {
  return new TextRun({
    bold: style.bold,
    color: style.color,
    font: style.code ? 'Consolas' : undefined,
    italics: style.italics,
    shading: style.code
      ? {
          color: 'auto',
          fill: 'F4F4F5',
        }
      : undefined,
    strike: style.strike,
    subScript: style.subScript,
    superScript: style.superScript,
    text,
    underline: style.underline
      ? {
          type: 'single',
        }
      : undefined,
  });
}

async function readLocalImageBuffer(src: string) {
  if (src.startsWith('/uploads/')) {
    const absolutePath = path.join(process.cwd(), 'public', src);
    try {
      return await fs.readFile(absolutePath);
    } catch {
      return null;
    }
  }

  try {
    if (src.startsWith('http://') || src.startsWith('https://')) {
      const response = await axios.get<ArrayBuffer>(src, {
        responseType: 'arraybuffer',
        timeout: 15000,
      });
      return Buffer.from(response.data);
    }
  } catch {
    return null;
  }

  return null;
}

async function createImageRun(src: string, altText: string) {
  const imageBuffer = await readLocalImageBuffer(src);
  if (!imageBuffer) {
    return null;
  }

  const metadata = await sharp(imageBuffer, { animated: true }).metadata();
  const width = metadata.width || MAX_IMAGE_WIDTH_PX;
  const height = metadata.height || Math.round(width * 0.75);
  const ratio = Math.min(1, MAX_IMAGE_WIDTH_PX / width);
  const targetWidth = Math.max(120, Math.round(width * ratio));
  const targetHeight = Math.max(120, Math.round(height * ratio));
  const extension = (metadata.format || path.extname(src).slice(1) || 'png').toLowerCase();

  if (extension === 'svg') {
    const fallback = await sharp(imageBuffer)
      .png()
      .toBuffer();

    return new ImageRun({
      data: imageBuffer,
      fallback: {
        data: fallback,
        type: 'png',
      },
      transformation: {
        width: targetWidth,
        height: targetHeight,
      },
      type: 'svg',
      altText: {
        name: altText,
        title: altText,
        description: altText,
      },
    });
  }

  const imageType =
    extension === 'jpg' || extension === 'jpeg'
      ? 'jpg'
      : extension === 'gif'
        ? 'gif'
        : extension === 'bmp'
          ? 'bmp'
          : 'png';
  const imageData =
    imageType === 'png' && extension !== 'png'
      ? await sharp(imageBuffer, { animated: true }).png().toBuffer()
      : imageBuffer;

  return new ImageRun({
    data: imageData,
    transformation: {
      width: targetWidth,
      height: targetHeight,
    },
    type: imageType,
    altText: {
      name: altText,
      title: altText,
      description: altText,
    },
  });
}

async function renderInlineNodes(
  $: cheerio.CheerioAPI,
  nodes: AnyNode[],
  baseStyle: InlineStyle = {}
): Promise<ParagraphChild[]> {
  const children: ParagraphChild[] = [];

  for (const node of nodes) {
    if (node.type === 'text') {
      const text = (node.data || '').replace(/\u00a0/g, ' ').replace(/\s+/g, ' ');
      if (text.trim()) {
        children.push(createTextRun(text, baseStyle));
      }
      continue;
    }

    if (node.type !== 'tag') {
      continue;
    }

    const tagName = node.tagName.toLowerCase();
    const $node = $(node);
    const styleAttr = $node.attr('style') || '';
    const styleColorMatch = styleAttr.match(/color\s*:\s*([^;]+)/i);
    const mergedStyle = mergeStyle(baseStyle, {
      bold: baseStyle.bold || tagName === 'strong' || tagName === 'b',
      color: parseColor(styleColorMatch?.[1]) || baseStyle.color,
      code: baseStyle.code || tagName === 'code',
      italics: baseStyle.italics || tagName === 'em' || tagName === 'i',
      strike: baseStyle.strike || tagName === 's' || tagName === 'del' || tagName === 'strike',
      subScript: baseStyle.subScript || tagName === 'sub',
      superScript: baseStyle.superScript || tagName === 'sup',
      underline: baseStyle.underline || tagName === 'u',
    });

    if (tagName === 'br') {
      children.push(new TextRun({ break: 1 }));
      continue;
    }

    if (tagName === 'img') {
      const src = $node.attr('src') || '';
      const alt = $node.attr('alt') || 'image';
      const imageRun = await createImageRun(src, alt);

      if (imageRun) {
        children.push(imageRun);
      } else if (alt) {
        children.push(createTextRun(`[图片: ${alt}]`, { italics: true }));
      }
      continue;
    }

    if (tagName === 'a') {
      const href = $node.attr('href') || '';
      const linkChildren = await renderInlineNodes(
        $,
        $node.contents().toArray(),
        mergeStyle(mergedStyle, { underline: true })
      );

      if (href.startsWith('http://') || href.startsWith('https://')) {
        children.push(
          new ExternalHyperlink({
            link: href,
            children: linkChildren.length > 0 ? linkChildren : [createTextRun(href, { underline: true })],
          })
        );
      } else {
        children.push(...linkChildren);
      }
      continue;
    }

    children.push(
      ...(await renderInlineNodes($, $node.contents().toArray(), mergedStyle))
    );
  }

  return children;
}

async function renderParagraphFromElement(
  $: cheerio.CheerioAPI,
  element: Element,
  options: {
    heading?: (typeof HeadingLevel)[keyof typeof HeadingLevel];
    alignment?: (typeof AlignmentType)[keyof typeof AlignmentType];
    bullet?: { level: number };
    numbering?: { reference: string; level: number };
  } = {}
) {
  const children = await renderInlineNodes($, $(element).contents().toArray());

  return new Paragraph({
    alignment: options.alignment,
    bullet: options.bullet,
    children: children.length > 0 ? children : [createTextRun('')],
    heading: options.heading,
    numbering: options.numbering,
  });
}

async function renderBlockNode(
  $: cheerio.CheerioAPI,
  node: AnyNode,
  context: RenderContext = {}
): Promise<FileChild[]> {
  if (node.type === 'text') {
    const text = normalizeText(node.data || '');
    return text ? [new Paragraph({ children: [createTextRun(text)] })] : [];
  }

  if (node.type !== 'tag') {
    return [];
  }

  const tagName = node.tagName.toLowerCase();
  const $node = $(node);

  if (tagName === 'table') {
    return [await renderTable($, node)];
  }

  if (tagName === 'ul' || tagName === 'ol') {
    const result: FileChild[] = [];
    const level = context.listLevel ?? 0;
    const listType = tagName === 'ol' ? 'number' : 'bullet';

    const listItems = $node.children('li').toArray();
    for (const item of listItems) {
      result.push(...(await renderListItem($, item, { listLevel: level, listType })));
    }

    return result;
  }

  if (tagName === 'pre') {
    const codeText = $node.text().replace(/\r\n/g, '\n');
    return [
      new Paragraph({
        children: codeText.split('\n').flatMap((line, index, array) => {
          const runs: ParagraphChild[] = [
            createTextRun(line || ' ', {
              code: true,
            }),
          ];

          if (index < array.length - 1) {
            runs.push(new TextRun({ break: 1 }));
          }

          return runs;
        }),
      }),
    ];
  }

  if (tagName === 'blockquote') {
    const children = await renderContainerChildren($, node, context);
    return children.length > 0 ? children : [createBlankParagraph()];
  }

  if (tagName === 'hr') {
    return [new Paragraph({ text: '──────────' })];
  }

  if (tagName === 'figure') {
    return renderContainerChildren($, node, context);
  }

  if (/^h[1-6]$/.test(tagName)) {
    return [
      await renderParagraphFromElement($, node, {
        heading: getHeadingLevel(tagName),
      }),
    ];
  }

  if (tagName === 'p') {
    return [await renderParagraphFromElement($, node)];
  }

  if (tagName === 'img') {
    const imageRun = await createImageRun(
      $node.attr('src') || '',
      $node.attr('alt') || 'image'
    );

    if (!imageRun) {
      return [];
    }

    return [
      new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [imageRun],
      }),
    ];
  }

  if (tagName === 'div' || tagName === 'section' || tagName === 'article') {
    return renderContainerChildren($, node, context);
  }

  return [await renderParagraphFromElement($, node)];
}

async function renderContainerChildren(
  $: cheerio.CheerioAPI,
  element: Element,
  context: RenderContext = {}
) {
  const blocks: FileChild[] = [];

  for (const child of $(element).contents().toArray()) {
    blocks.push(...(await renderBlockNode($, child, context)));
  }

  return blocks;
}

async function renderListItem(
  $: cheerio.CheerioAPI,
  element: Element,
  context: Required<RenderContext>
): Promise<FileChild[]> {
  const $element = $(element);
  const nonNestedChildren = $element
    .contents()
    .toArray()
    .filter((node) => !(node.type === 'tag' && (node.tagName === 'ul' || node.tagName === 'ol')));

  const inlineChildren = await renderInlineNodes($, nonNestedChildren);
  const paragraphs: FileChild[] = [
    new Paragraph({
      bullet:
        context.listType === 'bullet'
          ? {
              level: Math.min(context.listLevel, 7),
            }
          : undefined,
      children: inlineChildren.length > 0 ? inlineChildren : [createTextRun('')],
      numbering:
        context.listType === 'number'
          ? {
              reference: 'html-numbered-list',
              level: Math.min(context.listLevel, 7),
            }
          : undefined,
    }),
  ];

  const nestedLists = $element.children('ul, ol').toArray();
  for (const nested of nestedLists) {
    paragraphs.push(
      ...(await renderBlockNode($, nested, {
        listLevel: context.listLevel + 1,
        listType: nested.tagName === 'ol' ? 'number' : 'bullet',
      }))
    );
  }

  return paragraphs;
}

function countColumnsInTableRow($: cheerio.CheerioAPI, row: Element) {
  let count = 0;

  $(row)
    .children('th, td')
    .each((_, cell) => {
      const colspan = Number.parseInt($(cell).attr('colspan') || '1', 10);
      count += Math.max(1, Number.isNaN(colspan) ? 1 : colspan);
    });

  return count;
}

function getTableRowsWithSlots($: cheerio.CheerioAPI, table: Element) {
  const htmlRows = $(table)
    .find('tr')
    .toArray()
    .filter((row) => $(row).children('th, td').length > 0);

  const pendingRowspans = new Map<number, number>();
  const rows: TableCellSlot[][] = [];
  let columnCount = 0;

  for (const row of htmlRows) {
    const slots: TableCellSlot[] = [];
    let columnIndex = 0;

    while ((pendingRowspans.get(columnIndex) || 0) > 0) {
      const remaining = (pendingRowspans.get(columnIndex) || 0) - 1;
      if (remaining <= 0) {
        pendingRowspans.delete(columnIndex);
      } else {
        pendingRowspans.set(columnIndex, remaining);
      }
      columnIndex += 1;
    }

    for (const cell of $(row).children('th, td').toArray()) {
      while ((pendingRowspans.get(columnIndex) || 0) > 0) {
        const remaining = (pendingRowspans.get(columnIndex) || 0) - 1;
        if (remaining <= 0) {
          pendingRowspans.delete(columnIndex);
        } else {
          pendingRowspans.set(columnIndex, remaining);
        }
        columnIndex += 1;
      }

      const colspan = Math.max(
        1,
        Number.parseInt($(cell).attr('colspan') || '1', 10) || 1
      );
      const rowspan = Math.max(
        1,
        Number.parseInt($(cell).attr('rowspan') || '1', 10) || 1
      );

      slots.push({
        element: cell,
        colspan,
        rowspan,
      });

      if (rowspan > 1) {
        for (let offset = 0; offset < colspan; offset += 1) {
          pendingRowspans.set(columnIndex + offset, rowspan - 1);
        }
      }

      columnIndex += colspan;
    }

    while ((pendingRowspans.get(columnIndex) || 0) > 0) {
      const remaining = (pendingRowspans.get(columnIndex) || 0) - 1;
      if (remaining <= 0) {
        pendingRowspans.delete(columnIndex);
      } else {
        pendingRowspans.set(columnIndex, remaining);
      }
      columnIndex += 1;
    }

    rows.push(slots);
    columnCount = Math.max(columnCount, columnIndex);
  }

  return {
    columnCount,
    rows,
  };
}

async function renderTableCellContent(
  $: cheerio.CheerioAPI,
  cell: Element
): Promise<(Paragraph | Table)[]> {
  const blocks = await renderContainerChildren($, cell);
  const normalizedBlocks = blocks.filter(
    (block): block is Paragraph | Table => block instanceof Paragraph || block instanceof Table
  );

  return normalizedBlocks.length > 0 ? normalizedBlocks : [createBlankParagraph()];
}

async function renderTable($: cheerio.CheerioAPI, table: Element) {
  const { rows: tableRows, columnCount } = getTableRowsWithSlots($, table);
  const explicitColumnCount = Math.max(1, columnCount);
  const columnWidth = Math.floor(DOCX_CONTENT_WIDTH_DXA / explicitColumnCount);

  const rows: TableRow[] = [];

  for (const rowSlots of tableRows) {
    const cells: TableCell[] = [];

    for (const slot of rowSlots) {
      const cellTagName = slot.element.tagName.toLowerCase();
      const isHeader = cellTagName === 'th';
      const content = await renderTableCellContent($, slot.element);

      cells.push(
        new TableCell({
          borders: {
            top: { style: BorderStyle.SINGLE, color: BORDER_COLOR, size: 2 },
            bottom: { style: BorderStyle.SINGLE, color: BORDER_COLOR, size: 2 },
            left: { style: BorderStyle.SINGLE, color: BORDER_COLOR, size: 2 },
            right: { style: BorderStyle.SINGLE, color: BORDER_COLOR, size: 2 },
          },
          children: content,
          columnSpan: slot.colspan > 1 ? slot.colspan : undefined,
          rowSpan: slot.rowspan > 1 ? slot.rowspan : undefined,
          shading: isHeader
            ? {
                color: 'auto',
                fill: 'F3F4F6',
              }
            : undefined,
          width: {
            size: columnWidth * slot.colspan,
            type: WidthType.DXA,
          },
        })
      );
    }

    rows.push(new TableRow({ children: cells }));
  }

  return new Table({
    alignment: AlignmentType.CENTER,
    columnWidths: Array.from({ length: explicitColumnCount }, () => columnWidth),
    layout: TableLayoutType.FIXED,
    rows,
    width: {
      size: 100,
      type: WidthType.PERCENTAGE,
    },
  });
}

export async function exportArticleHtmlToDocxBuffer(
  html: string,
  options: DocxExportOptions
) {
  const $ = cheerio.load(html, {}, false);
  const blocks: FileChild[] = [];
  const titleBlock = new Paragraph({
    alignment: AlignmentType.LEFT,
    children: [
      createTextRun(options.title, {
        bold: true,
      }),
    ],
    heading: HeadingLevel.HEADING_1,
  });
  const metaText = [options.author, options.description]
    .filter(Boolean)
    .join('  |  ');

  blocks.push(titleBlock);
  if (metaText) {
    blocks.push(
      new Paragraph({
        children: [
          createTextRun(metaText, {
            color: '6B7280',
          }),
        ],
      })
    );
  }
  blocks.push(createBlankParagraph());

  for (const node of $.root().contents().toArray()) {
    blocks.push(...(await renderBlockNode($, node)));
  }

  const document = new Document({
    creator: 'Wechat2doc',
    description: options.description || undefined,
    numbering: {
      config: [
        {
          reference: 'html-numbered-list',
          levels: Array.from({ length: 8 }, (_, level) => ({
            format: 'decimal',
            level,
            text: `%${level + 1}.`,
          })),
        },
      ],
    },
    sections: [
      {
        children: blocks.length > 0 ? blocks : [createBlankParagraph()],
      },
    ],
    title: options.title,
  });

  return Packer.toBuffer(document);
}
