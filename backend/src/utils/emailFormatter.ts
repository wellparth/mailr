/**
 * Converts raw email text or markdown into clean, modern, responsive email HTML.
 * Ensures consistent typography, paragraph spacing, and line break formatting across
 * Gmail, Outlook Web, Apple Mail, and Mailr reading panes.
 */
export function formatEmailHtml(rawText: string): string {
  if (!rawText) return '<p style="font-family: -apple-system, BlinkMacSystemFont, \'Segoe UI\', Roboto, Helvetica, Arial, sans-serif; font-size: 15px; line-height: 1.6; margin: 0 0 16px 0;"></p>';

  // If text is already a complete HTML document, return as is
  if (/<!DOCTYPE\s+html/i.test(rawText) || /<html[\s>]/i.test(rawText)) {
    return rawText;
  }

  // Escape HTML characters before converting markdown syntax
  const escaped = rawText
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  // Split into paragraphs by double newlines
  const blocks = escaped.split(/\n\s*\n/);
  const htmlBlocks: string[] = [];

  for (let block of blocks) {
    block = block.trim();
    if (!block) continue;

    // Check for unordered lists
    if (block.split('\n').every((line) => /^[-*•]\s+/.test(line.trim()))) {
      const items = block.split('\n').map((line) => {
        const itemText = formatInlineMarkdown(line.replace(/^[-*•]\s+/, '').trim());
        return `<li style="margin-bottom: 6px; line-height: 1.6;">${itemText}</li>`;
      });
      htmlBlocks.push(
        `<ul style="margin: 0 0 16px 0; padding-left: 24px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 15px; line-height: 1.6;">\n${items.join('\n')}\n</ul>`
      );
      continue;
    }

    // Check for ordered lists
    if (block.split('\n').every((line) => /^\d+\.\s+/.test(line.trim()))) {
      const items = block.split('\n').map((line) => {
        const itemText = formatInlineMarkdown(line.replace(/^\d+\.\s+/, '').trim());
        return `<li style="margin-bottom: 6px; line-height: 1.6;">${itemText}</li>`;
      });
      htmlBlocks.push(
        `<ol style="margin: 0 0 16px 0; padding-left: 24px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 15px; line-height: 1.6;">\n${items.join('\n')}\n</ol>`
      );
      continue;
    }

    // Check for blockquote
    if (block.startsWith('&gt;') || block.startsWith('>')) {
      const quoteText = formatInlineMarkdown(
        block.split('\n').map((l) => l.replace(/^(&gt;|>)\s?/, '')).join('<br />')
      );
      htmlBlocks.push(
        `<blockquote style="margin: 0 0 16px 0; padding: 8px 16px; border-left: 3px solid #38bdf8; background-color: rgba(56, 189, 248, 0.08); font-style: italic; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 14px; line-height: 1.6;">${quoteText}</blockquote>`
      );
      continue;
    }

    // Check for headings
    if (/^#{1,3}\s+/.test(block)) {
      const match = block.match(/^#{1,3}/);
      const level = match ? match[0].length : 2;
      const headingText = formatInlineMarkdown(block.replace(/^#{1,3}\s+/, '').trim());
      const fontSize = level === 1 ? '20px' : level === 2 ? '17px' : '15px';
      htmlBlocks.push(
        `<h${level} style="margin: 20px 0 10px 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: ${fontSize}; font-weight: 700; line-height: 1.3;">${headingText}</h${level}>`
      );
      continue;
    }

    // Standard paragraph: convert single line breaks inside paragraph to <br />
    const formattedParagraph = formatInlineMarkdown(block).replace(/\n/g, '<br />');
    htmlBlocks.push(
      `<p style="margin: 0 0 16px 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; font-size: 15px; line-height: 1.6;">${formattedParagraph}</p>`
    );
  }

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body {
      margin: 0;
      padding: 0;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      font-size: 15px;
      line-height: 1.6;
      color: #1e293b;
      background-color: #ffffff;
    }
    p { margin: 0 0 16px 0; }
    ul, ol { margin: 0 0 16px 0; padding-left: 24px; }
    li { margin-bottom: 6px; }
    a { color: #2563eb; text-decoration: underline; }
    blockquote {
      margin: 0 0 16px 0;
      padding: 8px 16px;
      border-left: 3px solid #cbd5e1;
      background-color: #f8fafc;
      color: #475569;
      font-style: italic;
    }
    @media (prefers-color-scheme: dark) {
      body {
        color: #f1f5f9;
        background-color: #0b0f19;
      }
      a { color: #38bdf8; }
      blockquote {
        border-left-color: #38bdf8;
        background-color: rgba(56, 189, 248, 0.1);
        color: #cbd5e1;
      }
    }
  </style>
</head>
<body>
  <div style="max-width: 650px; margin: 0 auto; padding: 16px 0;">
    ${htmlBlocks.join('\n')}
  </div>
</body>
</html>`;
}

function formatInlineMarkdown(text: string): string {
  return text
    // Bold
    .replace(/\*\*(.+?)\*\*/g, '<strong style="font-weight: 600;">$1</strong>')
    // Italic
    .replace(/\*([^*]+?)\*/g, '<em style="font-style: italic;">$1</em>')
    // Inline code
    .replace(/`([^`]+?)`/g, '<code style="font-family: monospace; font-size: 13px; background-color: rgba(148, 163, 184, 0.15); padding: 2px 6px; border-radius: 4px;">$1</code>')
    // Links [text](url)
    .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer" style="color: #38bdf8; text-decoration: underline;">$1</a>');
}
