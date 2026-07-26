import fs from 'node:fs'
import path from 'node:path'

const ENCODER_DIR = path.join(import.meta.dir, '..', 'python_encoder')
const IS_WINDOWS = process.platform === 'win32'

/**
 * Python 环境未准备好的错误
 * 会附带修复建议，方便用户自助排查
 */
export class PythonEnvError extends Error {
	constructor(message: string) {
		super(message)
		this.name = 'PythonEnvError'
	}
}

/**
 * 获取默认的 venv Python 可执行文件路径
 * Windows: python_encoder/.venv/Scripts/python.exe
 * macOS/Linux: python_encoder/.venv/bin/python
 */
export function getVenvPythonPath(): string {
	if (IS_WINDOWS) {
		return path.join(ENCODER_DIR, '.venv', 'Scripts', 'python.exe')
	}
	return path.join(ENCODER_DIR, '.venv', 'bin', 'python')
}

/**
 * 查找可用的 Python 解释器路径
 * 优先级：PYTHON_PATH 环境变量 > ./python_encoder/.venv/{bin|Scripts}/python > python3/python
 */
export function findPythonPath(): string {
	const envPath = process.env.PYTHON_PATH
	if (envPath && fs.existsSync(envPath)) {
		return envPath
	}

	const venvPath = getVenvPythonPath()
	if (fs.existsSync(venvPath)) {
		return venvPath
	}

	// 回退到系统命令；Windows 通常没有 python3，优先尝试 python
	return IS_WINDOWS ? 'python' : 'python3'
}

/**
 * 如果 Python 解释器不可用，抛出带修复建议的错误
 */
export function assertPythonPath(): string {
	const pythonPath = findPythonPath()

	// 显式指定的路径不存在
	if (path.isAbsolute(pythonPath) && !fs.existsSync(pythonPath)) {
		throw new PythonEnvError(buildNotFoundMessage(pythonPath))
	}

	return pythonPath
}

function buildNotFoundMessage(pythonPath: string): string {
	const venvHint = `在 ${path.relative(process.cwd(), ENCODER_DIR)} 目录下创建虚拟环境：`
	const setupHint = IS_WINDOWS
		? '  运行 setup-windows.bat（如有）或手动创建 venv'
		: '  bash setup.sh'
	const manualHint = IS_WINDOWS
		? '  python -m venv python_encoder/.venv && python_encoder/.venv/Scripts/pip install -r python_encoder/requirements.txt'
		: '  python3 -m venv python_encoder/.venv && source python_encoder/.venv/bin/activate && pip install -r python_encoder/requirements.txt'
	const envHint = '或者设置 PYTHON_PATH 环境变量指向可用的 Python 可执行文件。'

	if (pythonPath === getVenvPythonPath()) {
		return [`未找到 Python 虚拟环境：${pythonPath}`, venvHint, setupHint, manualHint, envHint].join(
			'\n',
		)
	}

	return [`未找到 Python 解释器：${pythonPath}`, setupHint, manualHint, envHint].join('\n')
}

/**
 * 从 Python stderr 识别常见环境/依赖错误并增强提示
 */
export function enhancePythonError(stderr: string): string {
	if (stderr.includes('ModuleNotFoundError') || stderr.includes('No module named')) {
		return [
			stderr.trim(),
			'\n检测到依赖缺失，请运行：',
			IS_WINDOWS
				? '  在 venv 中执行 pip install -r python_encoder/requirements.txt'
				: '  bash setup.sh',
			'或激活虚拟环境后执行：',
			'  pip install -r python_encoder/requirements.txt',
		].join('\n')
	}

	if (stderr.includes('No such file or directory') && stderr.includes('python')) {
		return [stderr.trim(), '\n', buildNotFoundMessage(findPythonPath())].join('\n')
	}

	return stderr
}
