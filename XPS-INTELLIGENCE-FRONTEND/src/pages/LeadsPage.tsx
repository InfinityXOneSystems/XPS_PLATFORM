import { useState, useMemo } from 'react'
import { motion } from 'framer-motion'
import { Trash, Envelope, Phone, MagnifyingGlass } from '@phosphor-icons/react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import type { Lead, LeadRating } from '@/types/lead'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { BackButton } from '@/components/BackButton'
import { useLeads, useDeleteLead } from '@/hooks/useLeadsApi'

interface LeadsPageProps {
  onNavigate: (page: string) => void
}

const ratingColors: Record<LeadRating, string> = {
  'A+': 'bg-gradient-to-br from-[oklch(0.82_0.15_70)] to-[oklch(0.75_0.14_55)] text-primary-foreground border-primary/30',
  'A': 'bg-gradient-to-br from-[oklch(0.78_0.02_240)] to-[oklch(0.68_0.04_250)] text-white border-silver/30',
  'B+': 'bg-gradient-to-br from-[oklch(0.72_0.14_50)] to-[oklch(0.65_0.12_40)] text-white border-bronze/30',
  'B': 'bg-gradient-to-br from-[oklch(0.45_0.15_25)] to-[oklch(0.38_0.13_20)] text-white border-[rgba(139,0,35,0.4)]',
  'C': 'bg-yellow-500/20 text-yellow-500 border-yellow-500/30',
  'D': 'bg-red-500/20 text-red-500 border-red-500/30'
}

export function LeadsPage({ onNavigate }: LeadsPageProps) {
  const { data: leads = [] } = useLeads()
  const deleteLead = useDeleteLead()
  const [search, setSearch] = useState('')
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null)

  const filteredLeads = useMemo(() => {
    if (!search) return leads
    const query = search.toLowerCase()
    return leads.filter(
      (lead) =>
        lead.company.toLowerCase().includes(query) ||
        lead.city.toLowerCase().includes(query) ||
        lead.email.toLowerCase().includes(query) ||
        lead.phone.includes(query)
    )
  }, [leads, search])

  const handleDelete = (id: string) => {
    deleteLead.mutate(id)
  }

  const handleGenerateEmail = async (lead: Lead) => {
    toast.info('Generating email...')
    try {
      const promptText = `Generate a professional contractor outreach email for:
      
Company: ${lead.company}
City: ${lead.city}
Category: ${lead.category || 'contractor'}

Keep it under 150 words, friendly but professional. Include a compelling subject line.`

      const email = await window.spark.llm(promptText, 'gpt-4o-mini')
      toast.success('Email generated! Check AI chat panel.')
      console.log(email)
    } catch {
      toast.error('Failed to generate email')
    }
  }

  return (
    <div className="space-y-10">
      <BackButton onBack={() => onNavigate('home')} />
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold">Leads</h1>
          <p className="text-muted-foreground mt-2 text-base">
            Manage and track your contractor leads
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="relative">
            <MagnifyingGlass
              size={20}
              className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground z-10"
            />
            <div className="relative">
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search leads..."
                className="pl-12 w-80 border-2 border-transparent text-base py-6"
                style={{
                  background: 'rgba(0, 0, 0, 0.70)',
                  backdropFilter: 'blur(16px)',
                  WebkitBackdropFilter: 'blur(16px)',
                }}
              />
              <div 
                className="absolute inset-0 rounded-xl pointer-events-none"
                style={{
                  padding: '2px',
                  background: 'linear-gradient(135deg, var(--gradient-gold-start) 0%, var(--gradient-gold-mid) 25%, var(--gradient-silver-start) 50%, var(--gradient-gold-mid) 75%, var(--gradient-gold-start) 100%)',
                  WebkitMask: 'linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)',
                  WebkitMaskComposite: 'xor',
                  maskComposite: 'exclude',
                  backgroundSize: '200% 200%',
                  animation: 'gradient-shift 3s linear infinite',
                }}
              />
            </div>
          </div>
        </div>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-card rounded-lg overflow-hidden"
      >
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent border-border/50">
                <TableHead className="font-mono text-xs">Company</TableHead>
                <TableHead className="font-mono text-xs">City</TableHead>
                <TableHead className="font-mono text-xs">Phone</TableHead>
                <TableHead className="font-mono text-xs">Email</TableHead>
                <TableHead className="font-mono text-xs">Rating</TableHead>
                <TableHead className="font-mono text-xs text-right">Score</TableHead>
                <TableHead className="font-mono text-xs">Rep</TableHead>
                <TableHead className="font-mono text-xs">Status</TableHead>
                <TableHead className="font-mono text-xs text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredLeads.map((lead, index) => (
                <motion.tr
                  key={lead.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.03 }}
                  className={cn(
                    'border-border/50 cursor-pointer transition-all',
                    'hover:bg-muted/30 hover:shadow-[inset_3px_0_0_0_oklch(0.85_0.15_85)]'
                  )}
                  onClick={() => setSelectedLead(lead)}
                >
                  <TableCell className="font-medium">{lead.company}</TableCell>
                  <TableCell className="text-muted-foreground">{lead.city}</TableCell>
                  <TableCell className="font-mono text-sm">{lead.phone}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{lead.email}</TableCell>
                  <TableCell>
                    <Badge className={cn('border font-mono', ratingColors[lead.rating])}>
                      {lead.rating}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <span className="font-mono text-primary font-semibold">
                      {lead.opportunityScore}
                    </span>
                  </TableCell>
                  <TableCell className="text-sm">{lead.assignedRep || '—'}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="capitalize">
                      {lead.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleGenerateEmail(lead)
                        }}
                      >
                        <Envelope size={16} />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={(e) => {
                          e.stopPropagation()
                          toast.info(`Calling ${lead.phone}...`)
                        }}
                      >
                        <Phone size={16} />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleDelete(lead.id)
                        }}
                      >
                        <Trash size={16} />
                      </Button>
                    </div>
                  </TableCell>
                </motion.tr>
              ))}
            </TableBody>
          </Table>
        </div>

        {filteredLeads.length === 0 && (
          <div className="py-12 text-center">
            <p className="text-muted-foreground">No leads found</p>
          </div>
        )}
      </motion.div>

      <Sheet open={!!selectedLead} onOpenChange={() => setSelectedLead(null)}>
        <SheetContent className="glass-card border-l border-border/50 w-[500px]">
          {selectedLead && (
            <>
              <SheetHeader>
                <SheetTitle className="text-2xl">{selectedLead.company}</SheetTitle>
                <SheetDescription>
                  Lead Profile • ID: {selectedLead.id}
                </SheetDescription>
              </SheetHeader>

              <div className="mt-6 space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-xs font-medium text-muted-foreground uppercase">
                      Rating
                    </label>
                    <Badge className={cn('mt-1 border font-mono', ratingColors[selectedLead.rating])}>
                      {selectedLead.rating}
                    </Badge>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground uppercase">
                      Opportunity Score
                    </label>
                    <p className="text-2xl font-bold text-primary mt-1 font-mono">
                      {selectedLead.opportunityScore}
                    </p>
                  </div>
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="text-xs font-medium text-muted-foreground uppercase">
                      Phone
                    </label>
                    <p className="text-sm font-mono mt-1">{selectedLead.phone}</p>
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground uppercase">
                      Email
                    </label>
                    <p className="text-sm mt-1">{selectedLead.email}</p>
                  </div>
                  {selectedLead.website && (
                    <div>
                      <label className="text-xs font-medium text-muted-foreground uppercase">
                        Website
                      </label>
                      <p className="text-sm text-primary mt-1">{selectedLead.website}</p>
                    </div>
                  )}
                  <div>
                    <label className="text-xs font-medium text-muted-foreground uppercase">
                      Location
                    </label>
                    <p className="text-sm mt-1">
                      {selectedLead.city}{selectedLead.state ? `, ${selectedLead.state}` : ''}
                    </p>
                  </div>
                  {selectedLead.category && (
                    <div>
                      <label className="text-xs font-medium text-muted-foreground uppercase">
                        Category
                      </label>
                      <p className="text-sm mt-1">{selectedLead.category}</p>
                    </div>
                  )}
                  <div>
                    <label className="text-xs font-medium text-muted-foreground uppercase">
                      Status
                    </label>
                    <Badge variant="outline" className="capitalize mt-1">
                      {selectedLead.status}
                    </Badge>
                  </div>
                  {selectedLead.assignedRep && (
                    <div>
                      <label className="text-xs font-medium text-muted-foreground uppercase">
                        Assigned Rep
                      </label>
                      <p className="text-sm mt-1">{selectedLead.assignedRep}</p>
                    </div>
                  )}
                  {selectedLead.notes && (
                    <div>
                      <label className="text-xs font-medium text-muted-foreground uppercase">
                        Notes
                      </label>
                      <p className="text-sm mt-1 text-muted-foreground">{selectedLead.notes}</p>
                    </div>
                  )}
                </div>

                <div className="flex gap-2 pt-4">
                  <Button
                    onClick={() => handleGenerateEmail(selectedLead)}
                    className="flex-1"
                  >
                    <Envelope size={16} className="mr-2" />
                    Generate Email
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => toast.info(`Calling ${selectedLead.phone}...`)}
                  >
                    <Phone size={16} />
                  </Button>
                </div>
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  )
}
