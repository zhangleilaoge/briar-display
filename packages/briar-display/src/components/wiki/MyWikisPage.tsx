import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import WikiList from "./WikiList"
import { wikiApi } from "@/api/wiki"

export default function MyWikisPage() {
  const [articles, setArticles] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadMyArticles()
  }, [])

  const loadMyArticles = async () => {
    setLoading(true)
    setError(null)

    // 检查用户是否已登录
    const token = localStorage.getItem("briar_token")
    if (!token) {
      setError("请先登录")
      setLoading(false)
      return
    }

    const result = await wikiApi.getMyWikis()
    if (result.success && result.data) {
      setArticles(result.data)
    } else {
      setError(result.message || "加载失败")
    }
    setLoading(false)
  }

  const handleViewArticle = (article: any) => {
    window.location.href = `/briar-display/wiki/${article.slug}`
  }

  const handleEditArticle = (article: any) => {
    window.location.href = `/briar-display/wiki/${article.id}/edit`
  }

  const handleDeleteArticle = async (article: any) => {
    const result = await wikiApi.delete(article.id)
    if (result.success) {
      setArticles(articles.filter((a: any) => a.id !== article.id))
    } else {
      alert(`删除失败: ${result.message}`)
    }
  }

  if (error && !loading) {
    return (
      <Card className="border-red-200 bg-red-50">
        <CardHeader>
          <CardTitle className="text-red-700">加载失败</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-red-600 mb-4">{error}</p>
          {error === "请先登录" && (
            <Button
              onClick={() => (window.location.href = "/briar-display/login")}
            >
              前往登录
            </Button>
          )}
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">
          我的文章（共 {articles.length} 篇）
        </h2>
        <Button
          onClick={() => (window.location.href = "/briar-display/wiki/create")}
        >
          写新文章
        </Button>
      </div>

      <WikiList
        articles={articles}
        loading={loading}
        onView={handleViewArticle}
        showEdit={true}
        onEdit={handleEditArticle}
        onDelete={handleDeleteArticle}
        emptyMessage="您还没有发布任何文章，现在就开始写吧！"
      />
    </div>
  )
}
