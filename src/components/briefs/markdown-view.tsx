'use client';

import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

export function MarkdownView({ content }: { content: string }) {
  return (
    <div className="prose-sm prose-invert max-w-none text-sm leading-relaxed">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ children }) => (
            <h1 className="text-xl font-semibold mt-4 mb-2 text-foreground">{children}</h1>
          ),
          h2: ({ children }) => (
            <h2 className="text-base font-semibold mt-4 mb-2 text-foreground">{children}</h2>
          ),
          h3: ({ children }) => (
            <h3 className="text-sm font-semibold mt-3 mb-1.5 text-foreground">{children}</h3>
          ),
          p: ({ children }) => <p className="my-2 text-foreground/85">{children}</p>,
          ul: ({ children }) => <ul className="my-2 list-disc list-inside space-y-1 text-foreground/85">{children}</ul>,
          ol: ({ children }) => <ol className="my-2 list-decimal list-inside space-y-1 text-foreground/85">{children}</ol>,
          li: ({ children }) => <li className="text-foreground/85">{children}</li>,
          code: ({ children, className }) => {
            const isBlock = className?.includes('language-');
            if (isBlock) {
              return (
                <code className="block bg-muted/50 border border-border rounded p-3 text-xs font-mono whitespace-pre overflow-x-auto my-2">
                  {children}
                </code>
              );
            }
            return (
              <code className="bg-muted/50 px-1.5 py-0.5 rounded text-xs font-mono text-foreground">
                {children}
              </code>
            );
          },
          pre: ({ children }) => <pre className="my-2 overflow-x-auto">{children}</pre>,
          table: ({ children }) => (
            <div className="my-3 overflow-x-auto">
              <table className="w-full text-xs border-collapse">{children}</table>
            </div>
          ),
          th: ({ children }) => (
            <th className="text-left px-3 py-2 border-b border-border font-medium text-muted-foreground uppercase tracking-wider text-[10px]">
              {children}
            </th>
          ),
          td: ({ children }) => <td className="px-3 py-2 border-b border-border/40">{children}</td>,
          blockquote: ({ children }) => (
            <blockquote className="border-l-2 border-border pl-3 my-2 text-muted-foreground italic">
              {children}
            </blockquote>
          ),
          hr: () => <hr className="my-4 border-border" />,
          a: ({ children, href }) => (
            <a href={href} target="_blank" rel="noopener" className="underline text-foreground hover:text-foreground/80">
              {children}
            </a>
          ),
          strong: ({ children }) => <strong className="font-semibold text-foreground">{children}</strong>,
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
