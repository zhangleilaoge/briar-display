"use client"

import React, { useState, useEffect } from "react"
import { wikiApi, type WikiArticle } from "@/api/wiki"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import WikiHeader from "./WikiHeader"

interface WikiEditorProps {
  articleId?: string
  onSuccess?: (article: WikiArticle) => void
  onCancel?: () => void
}

export default function WikiEditor({
  articleId,
  onSuccess,
  onCancel,
}: WikiEditorProps) {
  const [title, setTitle] = useState("")
  const [content, setContent] = useState("")
  const [status, setStatus] = useState<"draft" | "published">("draft")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saveLoading, setSaveLoading] = useState(false)
  const [isNew] = useState(!articleId)

  useEffect(() => {
    if (articleId) {
      loadArticle()
    }
  }, [articleId])

  const loadArticle = async () => {
    if (!articleId) return
    setLoading(true)
    try {
      const response = await wikiApi.getById(articleId)
      if (response.success && response.data) {
        setTitle(response.data.title)
        setContent(response.data.content)
        setStatus(response.data.status)
      } else {
        setError("Failed to load article")
      }
    } catch (err) {
      setError("Error loading article")
      console.error("Error:", err)
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    if (!title.trim()) {
      setError("Title is required")
      return
    }
    if (!content.trim()) {
      setError("Content is required")
      return
    }

    setSaveLoading(true)
    setError(null)
    try {
      let response
      if (isNew) {
        response = await wikiApi.create({
          title,
          content,
          status,
        })
      } else {
        response = await wikiApi.update(articleId!, {
          title,
          content,
          status,
        })
      }

      if (response.success && response.data) {
        onSuccess?.(response.data)
      } else {
        // Handle specific error codes
        if (response.code === 401) {
          setError("You need to sign in to save articles. Please log in first.")
        } else {
          setError(response.message || "Failed to save article")
        }
      }
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Error saving article"
      // Check for 401 in error message
      if (
        errorMessage.includes("401") ||
        errorMessage.includes("Unauthorized")
      ) {
        setError("You need to sign in to save articles. Please log in first.")
      } else {
        setError(errorMessage)
      }
      console.error("Error:", err)
    } finally {
      setSaveLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center h-96">
        <p>Loading...</p>
      </div>
    )
  }

  return (
    <div className="w-full max-w-6xl mx-auto p-4">
      <WikiHeader
        title={isNew ? "Create New Article" : "Edit Article"}
        showAction={{
          label: "← Back",
          onClick: onCancel,
        }}
      />

      <div className="mb-6 flex gap-3 justify-end">
        <Select
          value={status}
          onValueChange={(value) => setStatus(value as "draft" | "published")}
        >
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="draft">Draft</SelectItem>
            <SelectItem value="published">Published</SelectItem>
          </SelectContent>
        </Select>
        <Button onClick={handleSave} disabled={saveLoading}>
          {saveLoading ? "Saving..." : "Save"}
        </Button>
      </div>

      {/* Error Message */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          {error}
        </div>
      )}

      {/* Editor Form */}
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="mb-6">
          <Label htmlFor="title">Article Title</Label>
          <Input
            id="title"
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Enter article title..."
            className="mt-2"
          />
        </div>

        <div className="mb-6">
          <Label htmlFor="content">Article Content (Markdown)</Label>
          <textarea
            id="content"
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Write your article in Markdown...&#10;&#10;# Heading 1&#10;## Heading 2&#10;...&#10;**Bold** *Italic*&#10;`code`&#10;```javascript&#10;// code block&#10;```"
            className="w-full h-96 p-4 border border-gray-300 rounded-lg font-mono text-sm resize-vertical focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="p-4 bg-gray-50 rounded-lg text-sm text-gray-600">
          <p>Character count: {content.length}</p>
          <p className="mt-2">
            💡 Tip: Use Markdown syntax for formatting. Headers, lists, code
            blocks, and more are supported!
          </p>
        </div>
      </div>
    </div>
  )
}
