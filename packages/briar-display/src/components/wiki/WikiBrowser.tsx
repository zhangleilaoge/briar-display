"use client"

import React, { useState, useEffect } from "react"
import { wikiApi, type WikiArticle } from "@/api/wiki"
import WikiArticleCard from "./WikiArticleCard"
import WikiArticleDetail from "./WikiArticleDetail"
import WikiEditor from "./WikiEditor"
import WikiHeader from "./WikiHeader"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

const ITEMS_PER_PAGE = 12

export default function WikiBrowser() {
  const [articles, setArticles] = useState<WikiArticle[]>([])
  const [selectedArticle, setSelectedArticle] = useState<WikiArticle | null>(
    null,
  )
  const [editingArticleId, setEditingArticleId] = useState<string | null>(null)
  const [isCreatingNew, setIsCreatingNew] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState("")
  const [currentPage, setCurrentPage] = useState(1)

  useEffect(() => {
    loadArticles()
    // Handle hash-based routing
    const handleHashChange = () => {
      const hash = window.location.hash.slice(1)
      if (hash.startsWith("article:")) {
        const articleId = hash.substring(8)
        const article = articles.find((a) => a.id === articleId)
        if (article) {
          setSelectedArticle(article)
          setEditingArticleId(null)
          setIsCreatingNew(false)
        }
      } else if (hash === "new") {
        setIsCreatingNew(true)
        setSelectedArticle(null)
        setEditingArticleId(null)
      } else if (hash.startsWith("edit:")) {
        const articleId = hash.substring(5)
        setEditingArticleId(articleId)
        setSelectedArticle(null)
        setIsCreatingNew(false)
      } else {
        setSelectedArticle(null)
        setEditingArticleId(null)
        setIsCreatingNew(false)
      }
    }

    window.addEventListener("hashchange", handleHashChange)
    handleHashChange() // Initial hash check
    return () => window.removeEventListener("hashchange", handleHashChange)
  }, [])

  const loadArticles = async () => {
    setLoading(true)
    setError(null)
    console.log("Loading articles...")
    try {
      const response = await wikiApi.list(1000, 0) // Load all articles
      if (response.success && response.data) {
        setArticles(response.data)
      } else {
        setError("Failed to load articles")
      }
    } catch (err) {
      setError("Error loading articles")
      console.error("Error:", err)
    } finally {
      setLoading(false)
    }
  }

  const filteredArticles = articles.filter(
    (article) =>
      article.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      article.summary?.toLowerCase().includes(searchTerm.toLowerCase()),
  )

  const totalPages = Math.ceil(filteredArticles.length / ITEMS_PER_PAGE)
  const startIdx = (currentPage - 1) * ITEMS_PER_PAGE
  const paginatedArticles = filteredArticles.slice(
    startIdx,
    startIdx + ITEMS_PER_PAGE,
  )

  // Handle editor success
  const handleEditorSuccess = (article: WikiArticle) => {
    // Update articles list
    if (isCreatingNew) {
      setArticles([article, ...articles])
    } else {
      setArticles(articles.map((a) => (a.id === article.id ? article : a)))
    }
    // Reset to main view and update hash
    window.location.hash = ""
    setIsCreatingNew(false)
    setEditingArticleId(null)
    setSelectedArticle(null)
  }

  // Handle new article creation
  const handleCreateNew = () => {
    const token =
      typeof window !== "undefined" ? localStorage.getItem("briar_token") : null
    if (!token) {
      alert("You need to sign in to create articles. Redirecting to login...")
      window.location.href = "/briar-display/login"
      return
    }
    window.location.hash = "new"
    setIsCreatingNew(true)
  }

  // Handle article editing
  const handleEdit = (articleId: string) => {
    const token =
      typeof window !== "undefined" ? localStorage.getItem("briar_token") : null
    if (!token) {
      alert("You need to sign in to edit articles. Redirecting to login...")
      window.location.href = "/briar-display/login"
      return
    }
    window.location.hash = `edit:${articleId}`
    setEditingArticleId(articleId)
  }

  // If editing or creating, show editor
  if (isCreatingNew || editingArticleId) {
    return (
      <WikiEditor
        articleId={editingArticleId || undefined}
        onSuccess={handleEditorSuccess}
        onCancel={() => {
          window.location.hash = ""
          setIsCreatingNew(false)
          setEditingArticleId(null)
        }}
      />
    )
  }

  // If viewing article detail, show detail view
  if (selectedArticle) {
    return (
      <WikiArticleDetail
        article={selectedArticle}
        onBack={() => {
          window.location.hash = ""
          setSelectedArticle(null)
        }}
        onEdit={() => handleEdit(selectedArticle.id)}
      />
    )
  }

  // Main article list view
  return (
    <div className="w-full max-w-6xl mx-auto p-4">
      <WikiHeader
        title="Wiki Articles"
        description="Browse and explore our community wiki articles"
        showAction={{
          label: "+ New Article",
          onClick: handleCreateNew,
        }}
      />

      {/* Search Bar */}
      <div className="mb-6">
        <Input
          type="text"
          placeholder="Search articles..."
          value={searchTerm}
          onChange={(e) => {
            setSearchTerm(e.target.value)
            setCurrentPage(1)
          }}
        />
      </div>

      {/* Error Message */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          {error}
        </div>
      )}

      {/* Loading State */}
      {loading && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[...Array(6)].map((_, i) => (
            <div
              key={i}
              className="h-64 bg-gray-200 rounded-lg animate-pulse"
            />
          ))}
        </div>
      )}

      {/* Articles Grid */}
      {!loading && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
            {paginatedArticles.length > 0 ? (
              paginatedArticles.map((article) => (
                <WikiArticleCard
                  key={article.id}
                  article={article}
                  onClick={() => {
                    window.location.hash = `article:${article.id}`
                    setSelectedArticle(article)
                  }}
                />
              ))
            ) : (
              <div className="col-span-full text-center py-12">
                <p className="text-gray-500 text-lg">
                  {searchTerm
                    ? "No articles found matching your search"
                    : "No articles available"}
                </p>
              </div>
            )}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex justify-center items-center gap-2">
              <Button
                onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                disabled={currentPage === 1}
                variant="outline"
              >
                Previous
              </Button>

              <div className="flex gap-1">
                {[...Array(totalPages)].map((_, i) => (
                  <Button
                    key={i + 1}
                    onClick={() => setCurrentPage(i + 1)}
                    variant={currentPage === i + 1 ? "default" : "outline"}
                  >
                    {i + 1}
                  </Button>
                ))}
              </div>

              <Button
                onClick={() =>
                  setCurrentPage(Math.min(totalPages, currentPage + 1))
                }
                disabled={currentPage === totalPages}
                variant="outline"
              >
                Next
              </Button>
            </div>
          )}

          {/* Stats */}
          <div className="mt-8 text-center text-gray-600">
            <p>
              Showing {paginatedArticles.length > 0 ? startIdx + 1 : 0}-
              {Math.min(startIdx + ITEMS_PER_PAGE, filteredArticles.length)} of{" "}
              {filteredArticles.length} articles
            </p>
          </div>
        </>
      )}
    </div>
  )
}
