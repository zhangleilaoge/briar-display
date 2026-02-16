import { useState, type FormEvent } from "react"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import WikiEditor from "./WikiEditor"
import { wikiApi } from "@/api/wiki"

interface CreateWikiPageProps {
  onSuccess?: (slug: string) => void
}

export default function CreateWikiPage({ onSuccess }: CreateWikiPageProps) {
  const [title, setTitle] = useState("")
  const [content, setContent] = useState("")
  const [status, setStatus] = useState<"draft" | "published">("draft")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setLoading(true)
    setError(null)

    if (!title.trim()) {
      setError("请输入文章标题")
      setLoading(false)
      return
    }

    if (!content.trim()) {
      setError("请输入文章内容")
      setLoading(false)
      return
    }

    try {
      const result = await wikiApi.create({
        title,
        content,
        status,
      })

      if (result.success && result.data) {
        setSuccess(true)
        setTitle("")
        setContent("")
        setTimeout(() => {
          if (result.data) {
            onSuccess?.(result.data.slug)
          }
        }, 1500)
      } else {
        setError(result.message || "创建失败")
      }
    } catch (err) {
      setError("创建失败，请重试")
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <Card className="border-green-200 bg-green-50">
        <CardHeader>
          <CardTitle className="text-green-700">创建成功！</CardTitle>
          <CardDescription>文章已保存，正在跳转到详情页...</CardDescription>
        </CardHeader>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>创建新文章</CardTitle>
        <CardDescription>使用 Markdown 格式编写您的文章</CardDescription>
      </CardHeader>

      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {error}
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="title">文章标题</Label>
            <Input
              id="title"
              type="text"
              placeholder="输入文章标题"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              disabled={loading}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="content">文章内容</Label>
            <WikiEditor
              value={content}
              onChange={setContent}
              disabled={loading}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="status">发布状态</Label>
            <div className="flex gap-4">
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="status"
                  value="draft"
                  checked={status === "draft"}
                  onChange={(e) =>
                    setStatus(e.target.value as "draft" | "published")
                  }
                  disabled={loading}
                />
                <span>保存为草稿</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="status"
                  value="published"
                  checked={status === "published"}
                  onChange={(e) =>
                    setStatus(e.target.value as "draft" | "published")
                  }
                  disabled={loading}
                />
                <span>直接发布</span>
              </label>
            </div>
          </div>

          <div className="flex gap-2">
            <Button type="submit" disabled={loading}>
              {loading ? "创建中..." : "创建文章"}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setTitle("")
                setContent("")
              }}
              disabled={loading}
            >
              清除
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
