export default function Hello() {
	return (
		<div style={{ padding: '20px', backgroundColor: '#eee' }}>
			<h2>Hello from React!</h2>
			<button onClick={() => alert('React 交互有效！')}>点击我</button>
		</div>
	)
}
