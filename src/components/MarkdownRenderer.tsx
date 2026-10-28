import React, { useMemo, useState } from 'react';
import { Marked } from 'marked';
import markedKatex from 'marked-katex-extension';
import DOMPurify from 'dompurify';
import hljs from 'highlight.js';

import {
  Copy,
  Check,
  Code2,
  ExternalLink,
} from 'lucide-react';

import 'katex/dist/katex.min.css';
import 'highlight.js/styles/github-dark.css';

interface MarkdownRendererProps {
  content: string;

  onOpenArtifact?: (
    code: string,
    language: string,
    title?: string
  ) => void;

  className?: string;
}

const escapeHtml = (value: string): string =>
  value.replace(/[&<>"']/g, (character) => {
    const entities: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    };

    return entities[character];
  });

const markdown = new Marked(
  {
    gfm: true,
    breaks: false,
    pedantic: false,
  },
  markedKatex({
    throwOnError: false,
  })
);

markdown.use({
  renderer: {
    code({ text, lang }) {
      const language = (lang || 'text')
        .trim()
        .split(/\s+/)[0]
        .toLowerCase();

      let highlighted = '';

      try {
        if (
          language &&
          language !== 'text' &&
          language !== 'plaintext' &&
          hljs.getLanguage(language)
        ) {
          highlighted = hljs.highlight(text, {
            language,
            ignoreIllegals: true,
          }).value;
        } else {
          highlighted = escapeHtml(text);
        }
      } catch {
        highlighted = escapeHtml(text);
      }

      return `
        <section class="martins-code-block">
          <header class="martins-code-header">
            <span class="martins-code-language">
              ${escapeHtml(language)}
            </span>

            <div class="martins-code-actions">
              <button
                type="button"
                class="martins-code-button"
                data-action="workspace"
                data-language="${escapeHtml(language)}"
              >
                <span>Workspace</span>
              </button>

              <button
                type="button"
                class="martins-code-button"
                data-action="copy"
              >
                <span>Copy</span>
              </button>
            </div>
          </header>

          <pre class="martins-code-pre"><code class="hljs language-${escapeHtml(language)}">${highlighted}</code></pre>
        </section>
      `;
    },

    link({ href, title, tokens }) {
      const label = this.parser.parseInline(tokens);

      const safeHref = href || '';

      if (!/^(https?:|mailto:|\/|#)/i.test(safeHref)) {
        return label;
      }

      const titleAttribute = title
        ? ` title="${escapeHtml(title)}"`
        : '';

      const external = /^https?:/i.test(safeHref);

      return `
        <a
          href="${escapeHtml(safeHref)}"
          ${external ? 'target="_blank" rel="noopener noreferrer"' : ''}
          ${titleAttribute}
        >${label}</a>
      `;
    },
  },
});

export const MarkdownRenderer: React.FC<
  MarkdownRendererProps
> = ({
  content,
  onOpenArtifact,
  className = '',
}) => {
  const [copiedCode, setCopiedCode] = useState<string | null>(
    null
  );

  const html = useMemo(() => {
    try {
      const parsed = markdown.parse(content || '');

      if (typeof parsed !== 'string') {
        return escapeHtml(content || '');
      }

      return DOMPurify.sanitize(parsed, {
        USE_PROFILES: {
          html: true,
        },

        ADD_ATTR: [
          'target',
          'rel',
          'class',
          'data-action',
          'data-language',
        ],
      });
    } catch (error) {
      console.error('Martins AI Markdown error:', error);

      return escapeHtml(content || '').replace(/\n/g, '<br>');
    }
  }, [content]);

  const handleMarkdownClick = async (
    event: React.MouseEvent<HTMLDivElement>
  ) => {
    const target = event.target as HTMLElement;

    const button = target.closest<HTMLButtonElement>(
      'button[data-action]'
    );

    if (!button) return;

    const action = button.dataset.action;

    const codeBlock = button.closest('.martins-code-block');

    const code = codeBlock?.querySelector('pre code')
      ?.textContent ?? '';

    const language =
      button.dataset.language ||
      codeBlock?.querySelector('.martins-code-language')
        ?.textContent ||
      'text';

    if (action === 'copy') {
      try {
        await navigator.clipboard.writeText(code);

        setCopiedCode(code);

        button.querySelector('span')!.textContent = 'Copied!';

        window.setTimeout(() => {
          setCopiedCode((previous) =>
            previous === code ? null : previous
          );

          if (button.isConnected) {
            const label = button.querySelector('span');

            if (label) label.textContent = 'Copy';
          }
        }, 1800);
      } catch (error) {
        console.error('Unable to copy code:', error);
      }
    }

    if (action === 'workspace' && onOpenArtifact) {
      onOpenArtifact(
        code,
        language,
        `${language.toUpperCase()} Snippet`
      );
    }
  };

  return (
    <div
      className={`markdown-body martins-markdown space-y-3.5 leading-relaxed break-words ${className}`}
      onClick={handleMarkdownClick}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
};

export default MarkdownRenderer;