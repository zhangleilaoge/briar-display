import { useState, type FormEvent } from "react"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { login, setAuthToken } from "@/api/auth"

export default function LoginPage() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setLoading(true)
    setError(null)

    try {
      const result = await login({ email, password })
      if (result.success && result.data) {
        setAuthToken(result.data.token)
        window.location.href = "/business"
        return
      }
      setError(result.message || "登录失败")
    } catch (err) {
      setError(err instanceof Error ? err.message : "登录失败")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_hsl(var(--secondary))_0%,_hsl(var(--background))_55%)]">
      <div className="container flex min-h-screen items-center justify-center">
        <div className="grid w-full gap-8 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="flex flex-col justify-center gap-6">
            <div className="space-y-3">
              <p className="text-sm uppercase tracking-[0.3em] text-muted-foreground">
                Briar Workspace
              </p>
              <h1 className="text-4xl font-semibold leading-tight">欢迎回来</h1>
              <p className="text-lg text-muted-foreground">
                登录后继续管理你的业务空间。支持多团队、权限与审计日志。
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-xl border border-border/60 bg-card/60 p-4">
                <p className="text-sm text-muted-foreground">最近活动</p>
                <p className="text-2xl font-semibold">128</p>
                <p className="text-xs text-muted-foreground">待处理任务</p>
              </div>
              <div className="rounded-xl border border-border/60 bg-card/60 p-4">
                <p className="text-sm text-muted-foreground">今日处理</p>
                <p className="text-2xl font-semibold">96%</p>
                <p className="text-xs text-muted-foreground">流程完成率</p>
              </div>
            </div>
          </div>

          <Card className="shadow-xl">
            <form onSubmit={handleSubmit}>
              <CardHeader>
                <CardTitle>账号登录</CardTitle>
                <CardDescription>使用你的工作邮箱登录 Briar</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">邮箱</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="name@company.com"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">密码</Label>
                  <Input
                    id="password"
                    type="password"
                    placeholder="请输入密码"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    required
                  />
                </div>
                <div className="flex items-center justify-between text-sm">
                  <label className="flex items-center gap-2 text-muted-foreground">
                    <input
                      type="checkbox"
                      className="h-4 w-4 rounded border-input"
                    />
                    记住我
                  </label>
                  <a
                    href="/forgot-password"
                    className="text-primary hover:underline"
                  >
                    忘记密码？
                  </a>
                </div>
                {error && (
                  <p className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                    {error}
                  </p>
                )}
              </CardContent>
              <CardFooter className="flex flex-col gap-3">
                <Button className="w-full" disabled={loading} type="submit">
                  {loading ? "登录中..." : "登录"}
                </Button>
                <Button variant="outline" className="w-full" type="button">
                  使用企业 SSO
                </Button>
                <p className="text-center text-xs text-muted-foreground">
                  测试账号：admin@briar.dev / admin123
                </p>
                <p className="text-center text-xs text-muted-foreground">
                  还没有账号？{" "}
                  <a href="/register" className="text-primary hover:underline">
                    创建账号
                  </a>
                </p>
              </CardFooter>
            </form>
          </Card>
        </div>
      </div>
    </div>
  )
}
