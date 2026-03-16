import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { leadsApi, scraperApi } from '@/lib/leadsApi'
import { toast } from 'sonner'
import type { Lead, ScraperConfig } from '@/types/lead'

export function useLeads() {
  return useQuery({
    queryKey: ['leads'],
    queryFn: leadsApi.getAll,
    staleTime: 5 * 60 * 1000,
  })
}

export function useLead(id: string) {
  return useQuery({
    queryKey: ['leads', id],
    queryFn: () => leadsApi.getById(id),
    enabled: !!id,
  })
}

export function useCreateLead() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: leadsApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leads'] })
      toast.success('Lead created successfully')
    },
    onError: () => {
      toast.error('Failed to create lead')
    },
  })
}

export function useUpdateLead() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Lead> }) =>
      leadsApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leads'] })
      toast.success('Lead updated successfully')
    },
    onError: () => {
      toast.error('Failed to update lead')
    },
  })
}

export function useDeleteLead() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: leadsApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leads'] })
      toast.success('Lead deleted successfully')
    },
    onError: () => {
      toast.error('Failed to delete lead')
    },
  })
}

export function useAssignLead() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ 
      leadId, 
      repId, 
      repName, 
      repInitials 
    }: { 
      leadId: string
      repId: string
      repName: string
      repInitials: string
    }) => leadsApi.assignRep(leadId, repId, repName, repInitials),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leads'] })
      toast.success('Lead assigned successfully')
    },
    onError: () => {
      toast.error('Failed to assign lead')
    },
  })
}

export function useUpdateLeadStatus() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ leadId, status }: { leadId: string; status: Lead['status'] }) =>
      leadsApi.updateStatus(leadId, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['leads'] })
      toast.success('Status updated')
    },
    onError: () => {
      toast.error('Failed to update status')
    },
  })
}

export function useLeadMetrics() {
  return useQuery({
    queryKey: ['leads', 'metrics'],
    queryFn: leadsApi.getMetrics,
    staleTime: 2 * 60 * 1000,
  })
}

export function useRunScraper() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (config: ScraperConfig) => scraperApi.run(config),
    onSuccess: () => {
      toast.success('Scraper started successfully')
      queryClient.invalidateQueries({ queryKey: ['scraper'] })
    },
    onError: () => {
      toast.error('Failed to start scraper')
    },
  })
}

export function useScraperLogs() {
  return useQuery({
    queryKey: ['scraper', 'logs'],
    queryFn: () => scraperApi.getLogs(),
    refetchInterval: 5000,
  })
}

export function useScraperStatus(jobId: string | null) {
  return useQuery({
    queryKey: ['scraper', 'status', jobId],
    queryFn: () => scraperApi.getStatus(jobId!),
    enabled: !!jobId,
    refetchInterval: (query) => {
      const status = query.state.data?.status
      return status === 'running' ? 2000 : false
    },
  })
}
