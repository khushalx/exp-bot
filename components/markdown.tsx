"use client";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
export function Markdown({ content }: { content: string }) {
  return <ReactMarkdown remarkPlugins={[remarkGfm]} components={{
    a: ({ children, ...props }) => <a {...props} target="_blank" rel="noopener noreferrer">{children}</a>,
    table: ({ children, ...props }) => <div className="markdown-table"><table {...props}>{children}</table></div>,
    img: ({ alt }) => <span className="image-alt">[Image: {alt || "image"}]</span>,
  }}>{content}</ReactMarkdown>;
}
