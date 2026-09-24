import type { BlogBlock } from '@/data/blog';

/*
 * Posts are stored as structured blocks, but edited as simple text:
 *   ## Heading        > Quote        - List item        ```lang ... ```  code
 * Anything else is a paragraph. Blank lines separate blocks.
 */

export function blocksToText(blocks: BlogBlock[]) {
  return blocks
    .map((b) => {
      switch (b.type) {
        case 'h2': return `## ${b.text}`;
        case 'quote': return b.text.split('\n').map((l) => `> ${l}`).join('\n');
        case 'list': return b.items.map((i) => `- ${i}`).join('\n');
        case 'code': return `\`\`\`${b.lang}\n${b.text}\n\`\`\``;
        default: return b.text;
      }
    })
    .join('\n\n');
}

export function textToBlocks(text: string): BlogBlock[] {
  const blocks: BlogBlock[] = [];
  const lines = text.replace(/\r\n/g, '\n').split('\n');
  let buf: string[] = [];

  const flush = () => {
    const chunk = buf.map((l) => l.trimEnd()).filter((l) => l.trim() !== '');
    buf = [];
    if (!chunk.length) return;
    if (chunk.length === 1 && chunk[0].startsWith('## ')) {
      blocks.push({ type: 'h2', text: chunk[0].slice(3).trim() });
    } else if (chunk.every((l) => l.startsWith('>'))) {
      blocks.push({ type: 'quote', text: chunk.map((l) => l.replace(/^>\s?/, '')).join('\n') });
    } else if (chunk.every((l) => /^[-*]\s/.test(l))) {
      blocks.push({ type: 'list', items: chunk.map((l) => l.replace(/^[-*]\s+/, '')) });
    } else {
      // A heading line followed by text in the same chunk: split them.
      if (chunk[0].startsWith('## ')) {
        blocks.push({ type: 'h2', text: chunk.shift()!.slice(3).trim() });
      }
      blocks.push({ type: 'p', text: chunk.join(' ') });
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const fence = line.match(/^```(\w*)\s*$/);
    if (fence) {
      flush();
      const code: string[] = [];
      i++;
      while (i < lines.length && !/^```\s*$/.test(lines[i])) code.push(lines[i++]);
      blocks.push({ type: 'code', lang: fence[1] || 'text', text: code.join('\n') });
      continue;
    }
    if (line.trim() === '') flush();
    else buf.push(line);
  }
  flush();
  return blocks;
}

export function slugify(title: string) {
  return title
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^\w\s-]/g, '')
    .trim()
    .replace(/[\s_]+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 80);
}

export function wordCount(text: string) {
  const t = text.trim();
  return t ? t.split(/\s+/).length : 0;
}
