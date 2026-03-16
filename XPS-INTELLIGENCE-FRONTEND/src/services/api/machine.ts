import { api } from '@/lib/api'

export interface FileEntry {
  name: string
  path: string
  type: 'file' | 'directory'
  size?: number
  modified?: string
}

export interface SystemInfo {
  cpu: { usage: number; cores: number; model: string }
  memory: { total: number; used: number; free: number }
  disk: { total: number; used: number; free: number }
  uptime: number
  platform: string
}

export interface DockerContainer {
  id: string
  name: string
  image: string
  status: string
  ports: string
  created: string
}

export const machineApi = {
  listFiles: (path: string) =>
    api.get<{ files: FileEntry[] }>(`/machine/files/list?path=${encodeURIComponent(path)}`),
  readFile: (path: string) =>
    api.get<{ content: string }>(`/machine/files/read?path=${encodeURIComponent(path)}`),
  writeFile: (path: string, content: string) =>
    api.post<void>('/machine/files/write', { path, content }),
  executeCommand: (command: string, cwd?: string) =>
    api.post<{ output: string; exitCode: number }>('/machine/execute-command', { command, cwd }),
  getDockerStatus: () =>
    api.get<{ containers: DockerContainer[] }>('/machine/docker/status'),
  getSystemInfo: () => api.get<SystemInfo>('/machine/system-info'),
}
