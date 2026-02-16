import { useEffect, useState } from "react"
import { marked } from "marked"
import "./WikiEditor.css"

interface WikiEditorProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  disabled?: boolean
}

export default function WikiEditor({
  value,
  onChange,
  placeholder = "# 输入您的 Markdown 内容...",
  disabled = false,
}: WikiEditorProps) {
  const [Editor, setEditor] = useState<any>(null)

  useEffect(() => {
    // 客户端动态加载编辑器
    if (typeof window !== "undefined") {
      Promise.all([
        import("react-markdown-editor-lite"),
        import("react-markdown-editor-lite/lib/index.css"),
      ]).then(([module]) => {
        setEditor(() => module.default)
      })
    }
  }, [])

  const handleEditorChange = ({ text }: { text: string }) => {
    onChange(text)
  }

  const renderHTML = (text: string) => {
    return marked(text, { breaks: true, gfm: true }) as string
  }

  // 服务端或加载中返回简单文本域
  if (!Editor) {
    return (
      <div className="wiki-editor-loading">
        <textarea
          className="editor-textarea"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          disabled={disabled}
          style={{ width: "100%", minHeight: "400px", padding: "20px" }}
        />
      </div>
    )
  }

  return (
    <div className="wiki-editor">
      <Editor
        value={value}
        style={{ height: "500px" }}
        renderHTML={renderHTML}
        onChange={handleEditorChange}
        placeholder={placeholder}
        readOnly={disabled}
        config={{
          view: {
            menu: true,
            md: true,
            html: true,
          },
          canView: {
            menu: true,
            md: true,
            html: true,
            fullScreen: true,
            hideMenu: true,
          },
          markdownClass: "markdown-body",
        }}
      />
    </div>
  )
}
