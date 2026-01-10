import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { ExternalLink } from 'lucide-react';
import { LinearHelpers } from '../../services/linearTeamIssuesService';

interface MarkdownRendererProps {
  content: string | null | undefined;
}

export function MarkdownRenderer({ content }: MarkdownRendererProps) {
  if (!content) {
    return (
      <p className="text-sm text-muted-foreground italic">
        No description provided
      </p>
    );
  }

  // CRITICAL: Strip portal metadata before rendering
  // Metadata is for backend tracking only, not user-facing display
  const cleanContent = LinearHelpers.stripMetadataFromDescription(content);

  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        h1: ({ children }) => (
          <h1 className="text-2xl mb-3 text-foreground">{children}</h1>
        ),
        h2: ({ children }) => (
          <h2 className="text-xl mb-2 text-foreground">{children}</h2>
        ),
        h3: ({ children }) => (
          <h3 className="text-lg mb-2 text-foreground">{children}</h3>
        ),
        h4: ({ children }) => (
          <h4 className="text-base mb-1 text-foreground">{children}</h4>
        ),
        h5: ({ children }) => (
          <h5 className="text-sm mb-1 text-foreground">{children}</h5>
        ),
        h6: ({ children }) => (
          <h6 className="text-xs mb-1 text-muted-foreground">{children}</h6>
        ),
        p: ({ children }) => (
          <p className="text-sm text-muted-foreground mb-3 leading-relaxed">{children}</p>
        ),
        ul: ({ children }) => (
          <ul className="list-disc list-inside space-y-1 mb-3 text-sm text-muted-foreground">
            {children}
          </ul>
        ),
        ol: ({ children }) => (
          <ol className="list-decimal list-inside space-y-1 mb-3 text-sm text-muted-foreground">
            {children}
          </ol>
        ),
        li: ({ children }) => (
          <li className="ml-2 text-sm leading-relaxed">{children}</li>
        ),
        a: ({ href, children }) => (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:underline inline-flex items-center gap-1 text-sm"
          >
            {children}
            <ExternalLink className="h-3 w-3" />
          </a>
        ),
        code: ({ className, children }) => {
          const isInline = !className;
          if (isInline) {
            return (
              <code className="bg-muted px-1.5 py-0.5 rounded text-xs font-mono text-foreground">
                {children}
              </code>
            );
          }
          return (
            <code className="block bg-muted p-3 rounded-md text-xs font-mono text-foreground overflow-x-auto whitespace-pre-wrap mb-3">
              {children}
            </code>
          );
        },
        pre: ({ children }) => (
          <pre className="mb-3">{children}</pre>
        ),
        blockquote: ({ children }) => (
          <blockquote className="border-l-4 border-primary/30 pl-4 italic text-sm text-muted-foreground mb-3">
            {children}
          </blockquote>
        ),
        strong: ({ children }) => (
          <strong className="font-medium text-foreground">{children}</strong>
        ),
        em: ({ children }) => (
          <em className="italic font-medium" style={{ letterSpacing: '0.015em' }}>{children}</em>
        ),
        img: ({ src, alt }) => (
          <img 
            src={src} 
            alt={alt || ''} 
            className="max-w-full max-h-[400px] w-auto h-auto object-contain rounded-lg border border-border my-3 cursor-pointer hover:border-primary transition-colors"
            loading="lazy"
            onClick={(e) => {
              const target = e.currentTarget;
              if (target.requestFullscreen) {
                target.requestFullscreen();
              }
            }}
          />
        ),
        hr: () => (
          <hr className="my-4 border-border" />
        ),
        table: ({ children }) => (
          <div className="overflow-x-auto mb-3">
            <table className="min-w-full border-collapse border border-border text-sm">
              {children}
            </table>
          </div>
        ),
        thead: ({ children }) => (
          <thead className="bg-muted">{children}</thead>
        ),
        tbody: ({ children }) => (
          <tbody>{children}</tbody>
        ),
        tr: ({ children }) => (
          <tr className="border-b border-border">{children}</tr>
        ),
        th: ({ children }) => (
          <th className="px-3 py-2 text-left font-medium text-foreground border border-border">
            {children}
          </th>
        ),
        td: ({ children }) => (
          <td className="px-3 py-2 text-muted-foreground border border-border">
            {children}
          </td>
        ),
      }}
    >
      {cleanContent}
    </ReactMarkdown>
  );
}