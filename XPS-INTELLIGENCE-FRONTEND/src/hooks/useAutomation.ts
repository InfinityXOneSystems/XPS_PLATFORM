import { useState, useEffect, useCallback } from 'react'
import { automationApi, type Workflow } from '@/services/api/automation'
import { toast } from 'sonner'

export function useAutomation() {
  const [workflows, setWorkflows] = useState<Workflow[]>([])
  const [loading, setLoading] = useState(false)

  const fetchWorkflows = useCallback(async () => {
    setLoading(true)
    try {
      const result = await automationApi.list()
      setWorkflows(result.workflows)
    } catch (err) {
      console.error('Failed to fetch workflows:', err)
      setWorkflows([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchWorkflows()
  }, [fetchWorkflows])

  const executeWorkflow = async (id: string) => {
    try {
      await automationApi.execute(id)
      toast.success('Workflow triggered')
    } catch {
      toast.error('Failed to trigger workflow')
    }
  }

  const toggleWorkflow = async (id: string, enabled: boolean) => {
    try {
      await automationApi.toggle(id, enabled)
      toast.success(enabled ? 'Workflow enabled' : 'Workflow paused')
      fetchWorkflows()
    } catch {
      toast.error('Failed to update workflow')
    }
  }

  const deleteWorkflow = async (id: string) => {
    try {
      await automationApi.delete(id)
      toast.success('Workflow deleted')
      fetchWorkflows()
    } catch {
      toast.error('Failed to delete workflow')
    }
  }

  return {
    workflows,
    loading,
    executeWorkflow,
    toggleWorkflow,
    deleteWorkflow,
    refresh: fetchWorkflows,
  }
}
