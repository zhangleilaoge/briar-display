import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import WikiList from "./WikiList"
import { wikiApi } from "@/api/wiki"

export default function WikiListPage() {
  const [articles, setArticles] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(0)
  const pageSize = 20

  useEffect(() => {
    loadArticles()
  }, [page])

  const loadArticles = async () => {
    setLoading(true)
    const result = await wikiApi.list(pageSize, page * pageSize)
    if (result.success && result.data) {
      setArticles(result.data)
    }
    setLoading(false)
  }

  const handleViewArticle = (article: any) => {
    window.location.href = `/briar-display/wiki/${article.slug}`
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">已发布的文章</h2>
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
        emptyMessage="暂无已发布的文章"
      />

      {articles.length >= pageSize && (
        <div className="flex items-center justify-center gap-2">
          <Button
            variant="outline"
            onClick={() => setPage(Math.max(0, page - 1))}
            disabled={page === 0}
          >
            上一页
          </Button>
          <span className="text-sm text-gray-600">第 {page + 1} 页</span>
          <Button
            variant="outline"
            onClick={() => setPage(page + 1)}
            disabled={articles.length < pageSize}
          >
            下一页
          </Button>
        </div>
      )}
    </div>
  )
}
