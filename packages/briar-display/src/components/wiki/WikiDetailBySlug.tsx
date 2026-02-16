import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import WikiContent from "./WikiContent"
import { wikiApi, type WikiArticle } from "@/api/wiki"

interface WikiDetailBySlugProps {
  slug: string
}

export default function WikiDetailBySlug({ slug }: WikiDetailBySlugProps) {
  const [article, setArticle] = useState<WikiArticle | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isAuthor, setIsAuthor] = useState(false)

  useEffect(() => {
    loadArticle()
  }, [slug])

  const loadArticle = async () => {
    setLoading(true)
    setError(null)

    const result = await wikiApi.getBySlug(slug)
    if (result.success && result.data) {
      setArticle(result.data)
      // 更新文档标题
      document.title = `${result.data.title} | Briar Wiki`

      // 检查是否是作者
      const userStr = localStorage.getItem("briar_user")
      if (userStr) {
        try {
          const user = JSON.parse(userStr)
          if (user.id === result.data.authorId) {
            setIsAuthor(true)
          }
        } catch (e) {
          // 忽略
        }
      }
    } else {
      setError(result.message || "加载失败")
    }
    setLoading(false)
  }

  const handleDelete = async () => {
    if (!article) return

    const confirmed = window.confirm("确定要删除这篇文章吗？")
    if (!confirmed) return

    const result = await wikiApi.delete(article.id)
    if (result.success) {
      window.location.href = "/briar-display/wiki"
    } else {
      alert(`删除失败: ${result.message}`)
    }
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <div className="h-8 animate-pulse rounded bg-gray-200" />
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-4 animate-pulse rounded bg-gray-200" />
            ))}
          </div>
        </CardContent>
      </Card>
    )
  }

  if (error || !article) {
    return (
      <Card className="border-red-200 bg-red-50">
        <CardHeader>
          <h2 className="text-lg font-bold text-red-700">加载失败</h2>
        </CardHeader>
        <CardContent>
          <p className="text-red-600">{error}</p>
        </CardContent>
      </Card>
    )
  }

  const createdDate = new Date(article.createdAt).toLocaleDateString()
  const updatedDate = new Date(article.updatedAt).toLocaleDateString()

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="space-y-4">
            <div>
              <h1 className="text-3xl font-bold mb-2">{article.title}</h1>
              <div className="flex flex-wrap items-center gap-4 text-sm text-gray-600">
                <span>创建: {createdDate}</span>
                <span>更新: {updatedDate}</span>
                <span>浏览: {article.viewCount}</span>
                <span
                  className={`inline-block rounded px-2 py-1 text-xs font-medium ${
                    article.status === "published"
                      ? "bg-green-100 text-green-700"
                      : "bg-yellow-100 text-yellow-700"
                  }`}
                >
                  {article.status === "published" ? "已发布" : "草稿"}
                </span>
              </div>
            </div>

            {isAuthor && (
              <div className="flex gap-2 pt-4 border-t">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    window.location.href = `/briar-display/wiki/${article.id}/edit`
                  }}
                >
                  编辑
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="text-red-600 hover:bg-red-50"
                  onClick={handleDelete}
                >
                  删除
                </Button>
              </div>
            )}
          </div>
        </CardHeader>

        <CardContent>
          <div className="prose prose-sm max-w-none">
            <WikiContent content={article.content} />
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
