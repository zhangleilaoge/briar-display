import type { WikiArticle } from "@/api/wiki"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

interface WikiCardProps {
  article: WikiArticle
  onView?: (article: WikiArticle) => void
  showEdit?: boolean
  onEdit?: (article: WikiArticle) => void
  onDelete?: (article: WikiArticle) => void
}

export default function WikiCard({
  article,
  onView,
  showEdit = false,
  onEdit,
  onDelete,
}: WikiCardProps) {
  const createdDate = new Date(article.createdAt).toLocaleDateString()
  const updatedDate = new Date(article.updatedAt).toLocaleDateString()

  return (
    <Card className="overflow-hidden transition-all hover:shadow-lg">
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <CardTitle className="line-clamp-2 text-lg hover:text-blue-600">
              {article.title}
            </CardTitle>
            <CardDescription className="mt-2 text-sm">
              {article.summary || "暂无摘要"}
            </CardDescription>
          </div>
          <div className="flex-shrink-0">
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
      </CardHeader>

      <CardContent>
        <div className="space-y-3 text-sm text-gray-600">
          <div className="flex items-center justify-between">
            <span>创建: {createdDate}</span>
            <span>更新: {updatedDate}</span>
          </div>
          <div className="flex items-center justify-between">
            <span>浏览: {article.viewCount}</span>
          </div>
        </div>

        {(onView || showEdit) && (
          <div className="mt-4 flex gap-2">
            {onView && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => onView(article)}
              >
                查看
              </Button>
            )}
            {showEdit && onEdit && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => onEdit(article)}
              >
                编辑
              </Button>
            )}
            {showEdit && onDelete && (
              <Button
                variant="outline"
                size="sm"
                className="text-red-600 hover:bg-red-50"
                onClick={() => {
                  if (confirm("确定删除这篇文章吗？")) {
                    onDelete(article)
                  }
                }}
              >
                删除
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
