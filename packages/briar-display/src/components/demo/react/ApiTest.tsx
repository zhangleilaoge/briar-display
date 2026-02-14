import { useState } from "react"
import axios from "axios"
import { apiClient } from "@/api/request"

export default function ApiTest() {
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)

  const testApi = async (endpoint: string) => {
    setLoading(true)
    setError(null)
    setResult(null)

    try {
      const response = await apiClient.get(endpoint)
      setResult(response.data)
    } catch (err) {
      setError(axios.isAxiosError(err) ? err.message : "请求失败")
    } finally {
      setLoading(false)
    }
  }

  const createUser = async () => {
    setLoading(true)
    setError(null)
    setResult(null)

    try {
      const response = await apiClient.post("/users", {
        name: "New User",
        email: "newuser@example.com",
      })
      setResult(response.data)
    } catch (err) {
      setError(axios.isAxiosError(err) ? err.message : "请求失败")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={styles.container}>
      <h2 style={styles.title}>🧪 API 测试面板</h2>

      <div style={styles.buttonGroup}>
        <button
          onClick={() => testApi("/health")}
          disabled={loading}
          style={styles.button}
        >
          健康检查
        </button>

        <button
          onClick={() => testApi("/info")}
          disabled={loading}
          style={styles.button}
        >
          服务器信息
        </button>

        <button
          onClick={() => testApi("/generate-id")}
          disabled={loading}
          style={styles.button}
        >
          生成 ID
        </button>

        <button
          onClick={() => testApi("/users")}
          disabled={loading}
          style={styles.button}
        >
          获取用户列表
        </button>

        <button
          onClick={createUser}
          disabled={loading}
          style={{ ...styles.button, ...styles.createButton }}
        >
          创建用户 (POST)
        </button>
      </div>

      {loading && <div style={styles.loading}>🔄 加载中...</div>}

      {error && <div style={styles.error}>❌ 错误: {error}</div>}

      {result && (
        <div style={styles.result}>
          <h3 style={styles.resultTitle}>响应结果：</h3>
          <pre style={styles.pre}>{JSON.stringify(result, null, 2)}</pre>
        </div>
      )}
    </div>
  )
}

const styles = {
  container: {
    border: "2px solid #10b981",
    borderRadius: "8px",
    padding: "20px",
    margin: "20px 0",
    backgroundColor: "#f0fdf4",
  },
  title: {
    color: "#059669",
    marginTop: 0,
    marginBottom: "20px",
  },
  buttonGroup: {
    display: "flex",
    flexWrap: "wrap" as const,
    gap: "10px",
    marginBottom: "20px",
  },
  button: {
    padding: "10px 20px",
    backgroundColor: "#10b981",
    color: "white",
    border: "none",
    borderRadius: "6px",
    cursor: "pointer",
    fontSize: "14px",
    fontWeight: "500",
    transition: "all 0.2s",
  },
  createButton: {
    backgroundColor: "#3b82f6",
  },
  loading: {
    padding: "15px",
    backgroundColor: "#dbeafe",
    border: "1px solid #3b82f6",
    borderRadius: "6px",
    color: "#1e40af",
    fontSize: "16px",
  },
  error: {
    padding: "15px",
    backgroundColor: "#fee2e2",
    border: "1px solid #ef4444",
    borderRadius: "6px",
    color: "#991b1b",
  },
  result: {
    marginTop: "20px",
  },
  resultTitle: {
    color: "#059669",
    marginBottom: "10px",
  },
  pre: {
    backgroundColor: "#fff",
    padding: "15px",
    borderRadius: "6px",
    overflow: "auto",
    maxHeight: "400px",
    fontSize: "13px",
    lineHeight: "1.5",
  },
}
