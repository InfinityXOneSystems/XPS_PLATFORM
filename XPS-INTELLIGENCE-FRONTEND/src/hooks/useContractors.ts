import { useState, useEffect, useCallback } from 'react'
import { contractorsApi, type Contractor, type ContractorFilters } from '@/services/api/contractors'
import { toast } from 'sonner'

export function useContractors(initialFilters?: ContractorFilters) {
  const [contractors, setContractors] = useState<Contractor[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(false)
  const [filters, setFilters] = useState<ContractorFilters>(initialFilters || {})

  const fetchContractors = useCallback(async () => {
    setLoading(true)
    try {
      const result = await contractorsApi.list(filters)
      setContractors(result.contractors)
      setTotal(result.total)
    } catch (err) {
      console.error('Failed to fetch contractors:', err)
      setContractors([])
      setTotal(0)
    } finally {
      setLoading(false)
    }
  }, [filters])

  useEffect(() => {
    fetchContractors()
  }, [fetchContractors])

  const updateContractor = async (id: string, data: Partial<Contractor>) => {
    try {
      await contractorsApi.update(id, data)
      toast.success('Contractor updated')
      fetchContractors()
    } catch {
      toast.error('Failed to update contractor')
    }
  }

  const deleteContractor = async (id: string) => {
    try {
      await contractorsApi.delete(id)
      toast.success('Contractor deleted')
      fetchContractors()
    } catch {
      toast.error('Failed to delete contractor')
    }
  }

  return {
    contractors,
    total,
    loading,
    filters,
    setFilters,
    updateContractor,
    deleteContractor,
    refresh: fetchContractors,
  }
}
