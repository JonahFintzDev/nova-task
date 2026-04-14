import DOMPurify from 'dompurify';
import { marked } from 'marked';

marked.setOptions({
  gfm: true,
  breaks: true,
});

export function markdownToSafeHtml(src: string): string {
  const trimmed = src.trim();
  if (!trimmed) {
    return '';
  }
  const html = marked.parse(trimmed, { async: false }) as string;
  return DOMPurify.sanitize(html);
}
