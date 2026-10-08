import { spawn, spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import net from 'node:net'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const children = new Map()
let stopping = false
const apiRevision = 'c1nc0-2026-10-08-vercel-deploy-1'
const apiPorts = Array.from({ length: 11 }, (_, index) => 8000 + index)

function print(name, message) {
  console.log(`[${name}] ${message}`)
}

function spawnService(name, executable, args, env = process.env) {
  const child = spawn(executable, args, {
    cwd: root,
    stdio: 'inherit',
    windowsHide: true,
    env,
  })
  children.set(name, child)
  child.on('error', error => {
    console.error(`[${name}] Não foi possível iniciar o serviço: ${error.message}`)
    stopAll(1)
  })
  child.on('exit', (code, signal) => {
    children.delete(name)
    if (!stopping) {
      if (signal) print(name, `encerrado (${signal})`)
      else if (code !== 0) console.error(`[${name}] terminou com código ${code}`)
      stopAll(code || 0)
    }
  })
  return child
}

function stopAll(exitCode = 0) {
  if (stopping) return
  stopping = true
  for (const child of children.values()) child.kill()
  process.exitCode = exitCode
}

process.on('SIGINT', () => stopAll(0))
process.on('SIGTERM', () => stopAll(0))

async function getApiStatus(port) {
  try {
    const response = await fetch(`http://127.0.0.1:${port}/api/health`, { signal: AbortSignal.timeout(800) })
    if (!response.ok) return null
    return await response.json()
  } catch {
    return null
  }
}

function isPortAvailable(port) {
  return new Promise(resolve => {
    const server = net.createServer()
    server.once('error', () => resolve(false))
    server.listen(port, '127.0.0.1', () => server.close(() => resolve(true)))
  })
}

async function chooseApiPort() {
  let firstAvailable = null
  for (const port of apiPorts) {
    const status = await getApiStatus(port)
    if (status?.status === 'ok' && status.api_revision === apiRevision) {
      return { port, status, reused: true }
    }
    if (firstAvailable === null && await isPortAvailable(port)) firstAvailable = port
  }
  if (firstAvailable !== null) return { port: firstAvailable, status: null, reused: false }
  throw new Error('As portas 8000–8010 estão ocupadas por APIs antigas ou outros serviços. Feche uma delas e rode npm run dev novamente.')
}

async function waitForApi(child, port) {
  const deadline = Date.now() + 15_000
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error('A API foi encerrada antes de ficar pronta.')
    const status = await getApiStatus(port)
    if (status?.status === 'ok' && status.api_revision === apiRevision) return status
    await new Promise(resolve => setTimeout(resolve, 300))
  }
  throw new Error(`A API não respondeu na porta ${port} após 15 segundos. Confira o erro de inicialização do Python acima.`)
}

function checkPythonDependencies(python) {
  const modules = ['fastapi', 'uvicorn', 'httpx', 'bs4', 'pandas', 'numpy', 'sklearn', 'joblib']
  const script = `import importlib.util; missing=[name for name in ${JSON.stringify(modules)} if importlib.util.find_spec(name) is None]; print(','.join(missing)); raise SystemExit(bool(missing))`
  const result = spawnSync(python, ['-c', script], { cwd: root, encoding: 'utf8', windowsHide: true })
  if (result.error) throw new Error(`Não consegui verificar as dependências do Python: ${result.error.message}`)
  if (result.status !== 0) {
    const missing = result.stdout?.trim() || result.stderr?.trim() || 'dependências do backend'
    throw new Error(`Dependências Python ausentes: ${missing}. Instale-as com .\\.venv\\Scripts\\python.exe -m pip install -r backend\\requirements.txt`)
  }
}

async function main() {
  const api = await chooseApiPort()
  let apiStatus = api.status
  if (api.reused) {
    print('API', `versão atual já está ativa em http://127.0.0.1:${api.port}; vou reutilizá-la.`)
  } else {
    const venv = process.env.VIRTUAL_ENV || path.join(root, '.venv')
    const candidates = process.platform === 'win32'
      ? [path.join(venv, 'Scripts', 'python.exe')]
      : [path.join(venv, 'bin', 'python')]
    const python = candidates.find(candidate => existsSync(candidate))
    if (!python) {
      throw new Error('Não encontrei o Python do ambiente .venv. Crie o ambiente seguindo backend/README.md.')
    }
    checkPythonDependencies(python)
    if (api.port !== 8000) print('API', `a porta 8000 está ocupada por uma versão antiga; iniciando a versão atual na porta ${api.port}.`)
    else print('API', `iniciando em http://127.0.0.1:${api.port}...`)
    const apiProcess = spawnService('API', python, ['-m', 'uvicorn', 'backend.app:app', '--host', '127.0.0.1', '--port', String(api.port), '--reload'])
    apiStatus = await waitForApi(apiProcess, api.port)
    if (!apiStatus.model_ready) print('API', 'servidor ativo, mas os arquivos do modelo não foram encontrados.')
    else if (apiStatus.page_reading_ready) print('API', 'modelos carregados.')
    else print('API', 'leitura do texto disponível; leitura complementar da página indisponível sem todas as dependências.')
  }

  print('WEB', 'iniciando Vite...')
  const viteEnv = { ...process.env, C1NC0_API_TARGET: `http://127.0.0.1:${api.port}` }
  spawnService('WEB', process.execPath, [path.join(root, 'node_modules', 'vite', 'bin', 'vite.js'), '--host', '127.0.0.1'], viteEnv)
}

main().catch(error => {
  console.error(`\n${error.message}`)
  stopAll(1)
})
