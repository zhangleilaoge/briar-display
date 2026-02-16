import DOMPurify from "dompurify"
import { marked } from "marked"
import "./WikiContent.css"

interface WikiContentProps {
  content: string
  className?: string
}

// 配置 marked
marked.setOptions({
  breaks: true,
  gfm: true,
})

export default function WikiContent({
  content,
  className = "",
}: WikiContentProps) {
  const html = marked(content)
  const sanitized = DOMPurify.sanitize(html as string)

  return (
    <div
      className={`wiki-content ${className}`}
      dangerouslySetInnerHTML={{ __html: sanitized }}
    />
  )
}
