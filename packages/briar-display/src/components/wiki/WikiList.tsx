import type { WikiArticle } from "@/api/wiki"
import WikiCard from "./WikiCard"

interface WikiListProps {
  articles: WikiArticle[]
  loading?: boolean
  onView?: (article: WikiArticle) => void
  showEdit?: boolean
  onEdit?: (article: WikiArticle) => void
  onDelete?: (article: WikiArticle) => void
  emptyMessage?: string
}

export default function WikiList({
  articles,
  loading = false,
  onView,
  showEdit = false,
  onEdit,
  onDelete,
  emptyMessage = "暂无文章",
}: WikiListProps) {
  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-40 animate-pulse rounded-lg bg-gray-200" />
        ))}
      </div>
    )
  }

  if (articles.length === 0) {
    return (
      <div className="flex items-center justify-center rounded-lg border-2 border-dashed border-gray-300 py-12">
        <p className="text-center text-gray-500">{emptyMessage}</p>
      </div>
    )
  }

  return (
    <div className="grid gap-4">
      {articles.map((article) => (
        <WikiCard
          key={article.id}
          article={article}
          onView={onView}
          showEdit={showEdit}
          onEdit={onEdit}
          onDelete={onDelete}
        />
      ))}
    </div>
  )
}
