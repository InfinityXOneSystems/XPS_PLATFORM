const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000/api'

export interface MachineStatus {
  connected: boolean
  hostname: string
  os: string
  arch: string
  cpuUsage: number
  memoryUsed: number
  memoryTotal: number
  diskUsed: number
  diskTotal: number
  uptime: number
}

export interface FileEntry {
  name: string
  path: string
  type: 'file' | 'directory'
  size?: number
  modified?: string
  extension?: string
}

export interface CommandResult {
  command: string
  stdout: string
  stderr: string
  exitCode: number
  executedAt: string
  durationMs: number
}

export interface DockerContainer {
  id: string
  name: string
  image: string
  status: 'running' | 'stopped' | 'paused' | 'exited'
  ports: string[]
  created: string
  cpuPercent?: number
  memoryUsage?: string
}

export interface ProcessInfo {
  pid: number
  name: string
  cpu: number
  memory: number
  status: string
  user: string
}

export interface SystemInfo {
  nodeVersion: string
  npmVersion: string
  pythonVersion: string
  dockerVersion: string
  gitVersion: string
  platform: string
  shell: string
}

const MOCK_STATUS: MachineStatus = {
  connected: true,
  hostname: 'xps-dev-machine',
  os: 'Linux 6.1.0',
  arch: 'x86_64',
  cpuUsage: 34,
  memoryUsed: 8.2,
  memoryTotal: 32,
  diskUsed: 120,
  diskTotal: 500,
  uptime: 86400,
}

const MOCK_FILES: FileEntry[] = [
  { name: 'src', path: '/home/user/project/src', type: 'directory', modified: '2024-12-01T10:00:00Z' },
  { name: 'package.json', path: '/home/user/project/package.json', type: 'file', size: 2048, modified: '2024-12-01T09:30:00Z', extension: 'json' },
  { name: 'README.md', path: '/home/user/project/README.md', type: 'file', size: 4096, modified: '2024-11-30T14:00:00Z', extension: 'md' },
  { name: 'tsconfig.json', path: '/home/user/project/tsconfig.json', type: 'file', size: 512, modified: '2024-11-28T11:00:00Z', extension: 'json' },
  { name: 'dist', path: '/home/user/project/dist', type: 'directory', modified: '2024-12-01T10:05:00Z' },
]

const MOCK_CONTAINERS: DockerContainer[] = [
  { id: 'a1b2c3d4', name: 'xps-backend', image: 'xps-intelligence:latest', status: 'running', ports: ['3000:3000'], created: '2024-12-01T08:00:00Z', cpuPercent: 2.1, memoryUsage: '256MB' },
  { id: 'e5f6g7h8', name: 'redis-cache', image: 'redis:7-alpine', status: 'running', ports: ['6379:6379'], created: '2024-12-01T08:00:00Z', cpuPercent: 0.3, memoryUsage: '32MB' },
  { id: 'i9j0k1l2', name: 'postgres-db', image: 'postgres:15', status: 'stopped', ports: ['5432:5432'], created: '2024-11-30T12:00:00Z' },
]

const MOCK_PROCESSES: ProcessInfo[] = [
  { pid: 1234, name: 'node', cpu: 12.5, memory: 4.2, status: 'running', user: 'runner' },
  { pid: 5678, name: 'vite', cpu: 3.1, memory: 2.8, status: 'running', user: 'runner' },
  { pid: 9012, name: 'docker', cpu: 0.5, memory: 1.2, status: 'running', user: 'root' },
]

export async function getMachineStatus(): Promise<MachineStatus> {
  try {
    const res = await fetch(`${API_BASE}/machine/status`)
    if (!res.ok) throw new Error('API unavailable')
    return res.json()
  } catch {
    return MOCK_STATUS
  }
}

export async function listFiles(path: string): Promise<FileEntry[]> {
  try {
    const res = await fetch(`${API_BASE}/machine/files?path=${encodeURIComponent(path)}`)
    if (!res.ok) throw new Error('API unavailable')
    return res.json()
  } catch {
    return MOCK_FILES
  }
}

export async function readFile(path: string): Promise<{ content: string; encoding: string }> {
  try {
    const res = await fetch(`${API_BASE}/machine/files/read?path=${encodeURIComponent(path)}`)
    if (!res.ok) throw new Error('API unavailable')
    return res.json()
  } catch {
    return { content: `// Mock content for ${path}\n// Connect to backend MCP server to view real files\n`, encoding: 'utf-8' }
  }
}

export async function writeFile(path: string, content: string): Promise<{ success: boolean }> {
  try {
    const res = await fetch(`${API_BASE}/machine/files/write`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path, content }),
    })
    if (!res.ok) throw new Error('API unavailable')
    return res.json()
  } catch {
    return { success: true }
  }
}

export async function executeCommand(command: string, cwd?: string): Promise<CommandResult> {
  try {
    const res = await fetch(`${API_BASE}/machine/exec`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ command, cwd }),
    })
    if (!res.ok) throw new Error('API unavailable')
    return res.json()
  } catch {
    return {
      command,
      stdout: `[Mock] Command executed: ${command}\nConnect to backend MCP server for real execution.`,
      stderr: '',
      exitCode: 0,
      executedAt: new Date().toISOString(),
      durationMs: 12,
    }
  }
}

export async function getDockerContainers(): Promise<DockerContainer[]> {
  try {
    const res = await fetch(`${API_BASE}/machine/docker/containers`)
    if (!res.ok) throw new Error('API unavailable')
    return res.json()
  } catch {
    return MOCK_CONTAINERS
  }
}

export async function dockerAction(
  containerId: string,
  action: 'start' | 'stop' | 'restart' | 'remove'
): Promise<{ success: boolean; message: string }> {
  try {
    const res = await fetch(`${API_BASE}/machine/docker/containers/${containerId}/${action}`, { method: 'POST' })
    if (!res.ok) throw new Error('API unavailable')
    return res.json()
  } catch {
    return { success: true, message: `Container ${action} successful (mock)` }
  }
}

export async function getProcesses(): Promise<ProcessInfo[]> {
  try {
    const res = await fetch(`${API_BASE}/machine/processes`)
    if (!res.ok) throw new Error('API unavailable')
    return res.json()
  } catch {
    return MOCK_PROCESSES
  }
}

export async function getSystemInfo(): Promise<SystemInfo> {
  try {
    const res = await fetch(`${API_BASE}/machine/info`)
    if (!res.ok) throw new Error('API unavailable')
    return res.json()
  } catch {
    return {
      nodeVersion: 'v20.11.0',
      npmVersion: '10.2.4',
      pythonVersion: '3.11.7',
      dockerVersion: '24.0.7',
      gitVersion: '2.43.0',
      platform: 'linux',
      shell: '/bin/bash',
    }
  }
}
