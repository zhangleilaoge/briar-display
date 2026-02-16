import { useState, useEffect, type FormEvent } from "react"
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
import { wikiApi, type WikiArticle } from "@/api/wiki"

interface EditWikiPageProps {
  articleId: string
  onSuccess?: () => void
}

export default function EditWikiPage({
  articleId,
  onSuccess,
}: EditWikiPageProps) {
  const [title, setTitle] = useState("")
  const [content, setContent] = useState("")
  const [status, setStatus] = useState<"draft" | "published">("draft")
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [article, setArticle] = useState<WikiArticle | null>(null)

  // 加载文章内容
  useEffect(() => {
    const loadArticle = async () => {
      setLoading(true)
      setError(null)

      const result = await wikiApi.getById(articleId)
      if (result.success && result.data) {
        setArticle(result.data)
        setTitle(result.data.title)
        setContent(result.data.content)
        setStatus(result.data.status)
      } else {
        setError(result.message || "加载失败")
      }
      setLoading(false)
    }

    loadArticle()
  }, [articleId])

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setSaving(true)
    setError(null)

    if (!title.trim()) {
      setError("请输入文章标题")
      setSaving(false)
      return
    }

    if (!content.trim()) {
      setError("请输入文章内容")
      setSaving(false)
      return
    }

    try {
      const result = await wikiApi.update(articleId, {
        title,
        content,
        status,
      })

      if (result.success) {
        setSuccess(true)
        setTimeout(() => {
          onSuccess?.()
        }, 1500)
      } else {
        setError(result.message || "更新失败")
      }
    } catch (err) {
      setError("更新失败，请重试")
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>加载中...</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-8 animate-pulse rounded bg-gray-200" />
            ))}
          </div>
        </CardContent>
      </Card>
    )
  }

  if (error && !article) {
    return (
      <Card className="border-red-200 bg-red-50">
        <CardHeader>
          <CardTitle className="text-red-700">加载失败</CardTitle>
          <CardDescription>{error}</CardDescription>
        </CardHeader>
      </Card>
    )
  }

  if (success) {
    return (
      <Card className="border-green-200 bg-green-50">
        <CardHeader>
          <CardTitle className="text-green-700">保存成功！</CardTitle>
          <CardDescription>文章已更新，正在跳转...</CardDescription>
        </CardHeader>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>编辑文章</CardTitle>
        <CardDescription>修改文章内容并保存</CardDescription>
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
              disabled={saving}
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="content">文章内容</Label>
            <WikiEditor
              value={content}
              onChange={setContent}
              disabled={saving}
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
                  disabled={saving}
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
                  disabled={saving}
                />
                <span>已发布</span>
              </label>
            </div>
          </div>

          <div className="flex gap-2">
            <Button type="submit" disabled={saving}>
              {saving ? "保存中..." : "保存文章"}
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
