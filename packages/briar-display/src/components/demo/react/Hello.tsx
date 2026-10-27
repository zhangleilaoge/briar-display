import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export default function Hello() {
	return (
		<Card className="my-4 max-w-md">
			<CardHeader>
				<CardTitle>Hello from React!</CardTitle>
			</CardHeader>
			<CardContent>
				<Button onClick={() => alert('React 交互有效！')}>点击我</Button>
			</CardContent>
		</Card>
	)
}
