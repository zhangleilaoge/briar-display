// @ts-check

/** @type {string[]} */
let selectedFiles = []

/** @type {string | null} */
let resultPath = null

const dropZone = document.getElementById('drop-zone')
const fileInput = document.getElementById('file-input')
const fileListSection = document.getElementById('file-list-section')
const fileListEl = document.getElementById('file-list')
const runBtn = document.getElementById('run-compare')
const clearBtn = document.getElementById('clear-files')
const envResult = document.getElementById('env-result')
const recheckBtn = document.getElementById('recheck-env')
const logSection = document.getElementById('log-section')
const logOutput = document.getElementById('log-output')
const copyLogBtn = document.getElementById('copy-log')
const resultSection = document.getElementById('result-section')
const openResultBtn = document.getElementById('open-result')
const versionEl = document.getElementById('version')

const { invoke, Channel } = window.__TAURI__.core
const { listen } = window.__TAURI__.event
const { openPath } = window.__TAURI__.opener

/**
 * @param {string} text
 */
function log(text) {
	if (!logOutput) return
	logOutput.textContent += `${text}\n`
	logOutput.scrollTop = logOutput.scrollHeight
}

async function loadVersion() {
	if (!versionEl) return
	try {
		const version = await invoke('get_version')
		versionEl.textContent = `v${version}`
	} catch (err) {
		versionEl.textContent = 'v?'
		console.error('获取版本失败:', err)
	}
}

async function checkEnv() {
	if (!envResult) return
	envResult.textContent = '正在检查...'
	try {
		const timeout = new Promise((_, reject) =>
			setTimeout(() => reject(new Error('环境检查超时')), 5000),
		)
		const [ok, message] = await Promise.race([invoke('check_environment'), timeout])
		envResult.textContent = message
		envResult.classList.toggle('ok', ok)
		envResult.classList.toggle('error', !ok)
	} catch (err) {
		envResult.textContent = `检查失败: ${err}`
		envResult.classList.add('error')
	}
}

function renderFileList() {
	if (!fileListEl || !fileListSection || !runBtn) return
	fileListEl.innerHTML = ''
	if (selectedFiles.length === 0) {
		fileListSection.style.display = 'none'
		runBtn.disabled = true
		return
	}
	fileListSection.style.display = 'block'
	for (const path of selectedFiles) {
		const li = document.createElement('li')
		li.textContent = path
		fileListEl.appendChild(li)
	}
	runBtn.disabled = selectedFiles.length < 2
}

/**
 * @param {FileList | null} files
 */
function handleFiles(files) {
	if (!files) return
	const pdfs = Array.from(files)
		.filter((f) => f.name.toLowerCase().endsWith('.pdf'))
		.map((f) => f.path || f.name)
	if (pdfs.length === 0) return
	selectedFiles = Array.from(new Set([...selectedFiles, ...pdfs]))
	renderFileList()
	if (resultSection) {
		resultSection.style.display = 'none'
	}
}

async function runComparison() {
	if (selectedFiles.length < 2 || !runBtn) return

	runBtn.disabled = true
	runBtn.textContent = '比对中...'
	if (resultSection) {
		resultSection.style.display = 'none'
	}
	if (logSection && logOutput) {
		logSection.style.display = 'block'
		logOutput.textContent = ''
	}

	try {
		const onLog = new Channel()
		onLog.onmessage = (/** @type {string} */ line) => log(line)

		resultPath = await invoke('run_comparison', {
			docs: selectedFiles,
			onLog,
		})
		log('✅ 完成')
		if (resultSection) resultSection.style.display = 'block'
	} catch (err) {
		log(`❌ 失败: ${err}`)
	} finally {
		runBtn.disabled = false
		runBtn.textContent = '开始比对'
	}
}

// 监听 Rust 端发出的拖拽文件路径事件（带完整路径）
listen('files-dropped', (/** @type {{ payload: string[] }} */ event) => {
	const pdfs = event.payload.filter((p) => p.toLowerCase().endsWith('.pdf'))
	if (pdfs.length === 0) return
	selectedFiles = Array.from(new Set([...selectedFiles, ...pdfs]))
	renderFileList()
	if (resultSection) {
		resultSection.style.display = 'none'
	}
})

// 拖放事件（仅做视觉反馈，实际路径由 Rust 端 DragDrop 事件提供）
dropZone?.addEventListener('dragover', (e) => {
	e.preventDefault()
	dropZone.classList.add('dragover')
})

dropZone?.addEventListener('dragleave', () => {
	dropZone.classList.remove('dragover')
})
dropZone?.addEventListener('drop', (e) => {
	e.preventDefault()
	dropZone.classList.remove('dragover')
})
dropZone?.addEventListener('click', async () => {
	try {
		const paths = await invoke('select_pdfs')
		if (paths && paths.length > 0) {
			selectedFiles = Array.from(new Set([...selectedFiles, ...paths]))
			renderFileList()
			if (resultSection) {
				resultSection.style.display = 'none'
			}
		}
	} catch (err) {
		console.error('选择文件失败:', err)
	}
})
fileInput?.addEventListener('change', (e) => {
	const target = /** @type {HTMLInputElement} */ (e.target)
	handleFiles(target.files)
	target.value = ''
})

clearBtn?.addEventListener('click', () => {
	selectedFiles = []
	renderFileList()
	if (resultSection) {
		resultSection.style.display = 'none'
	}
})

runBtn?.addEventListener('click', runComparison)

recheckBtn?.addEventListener('click', checkEnv)

copyLogBtn?.addEventListener('click', async () => {
	if (!logOutput) return
	const text = logOutput.textContent || ''
	try {
		await navigator.clipboard.writeText(text)
		const original = copyLogBtn.textContent
		copyLogBtn.textContent = '已复制'
		setTimeout(() => {
			copyLogBtn.textContent = original
		}, 1500)
	} catch (err) {
		console.error('复制日志失败:', err)
		copyLogBtn.textContent = '复制失败'
		setTimeout(() => {
			copyLogBtn.textContent = '复制日志'
		}, 1500)
	}
})

openResultBtn?.addEventListener('click', async () => {
	if (resultPath) {
		await openPath(resultPath)
	}
})

loadVersion()
checkEnv()
