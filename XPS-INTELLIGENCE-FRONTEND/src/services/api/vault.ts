import { api } from '@/lib/api'

export interface VaultToken {
  id: string
  name: string
  service: string
  token: string
  expiresAt?: string
  lastUsed?: string
  usageCount: number
  status: 'active' | 'expired' | 'revoked'
}

export const vaultApi = {
  list: () => api.get<{ tokens: VaultToken[] }>('/vault/tokens/list'),
  add: (data: Omit<VaultToken, 'id' | 'usageCount' | 'status'>) =>
    api.post<VaultToken>('/vault/tokens/add', data),
  update: (id: string, data: Partial<VaultToken>) =>
    api.put<VaultToken>(`/vault/tokens/${id}`, data),
  delete: (id: string) => api.delete<void>(`/vault/tokens/${id}`),
  test: (id: string) =>
    api.post<{ success: boolean; message: string }>(`/vault/tokens/${id}/test`, {}),
}
