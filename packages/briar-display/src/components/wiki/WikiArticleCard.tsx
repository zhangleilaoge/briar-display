"use client"

import React from "react"
import { type WikiArticle } from "@/api/wiki"
import { formatDistanceToNow } from "date-fns"
import { zhCN } from "date-fns/locale"

interface WikiArticleCardProps {
  article: WikiArticle
  onClick: () => void
}

export default function WikiArticleCard({
  article,
  onClick,
}: WikiArticleCardProps) {
  const createdDate = new Date(article.createdAt)
  const timeAgo = formatDistanceToNow(createdDate, {
    locale: zhCN,
    addSuffix: true,
  })

  return (
    <div
      onClick={onClick}
      className="bg-white rounded-lg border border-gray-200 p-6 hover:shadow-lg hover:border-gray-300 transition-all cursor-pointer"
    >
      <div className="mb-4">
        <h3 className="text-xl font-semibold text-gray-900 mb-2 line-clamp-2">
          {article.title}
        </h3>
        <p className="text-gray-600 text-sm line-clamp-3">
          {article.summary || "No summary available"}
        </p>
      </div>

      <div className="flex items-center justify-between text-sm text-gray-500 pt-4 border-t border-gray-100">
        <div className="flex gap-4">
          <span className="flex items-center gap-1">
            👁️ {article.viewCount}
          </span>
        </div>
        <span>{timeAgo}</span>
      </div>
    </div>
  )
}
