import { useState } from 'react'
import { motion } from 'framer-motion'
import {
  Users,
  MagnifyingGlass,
  Plus,
  Export,
  Star,
  Phone,
  Envelope,
  MapPin,
  Buildings,
  ArrowsClockwise,
} from '@phosphor-icons/react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { BackButton } from '@/components/BackButton'
import { toast } from 'sonner'

interface ContractorsPageProps {
  onNavigate: (page: string) => void
}

interface Contractor {
  id: string
  name: string
  company: string
  email: string
  phone: string
  city: string
  state: string
  category: string
  status: 'new' | 'contacted' | 'qualified' | 'converted' | 'lost'
  score: number
  source: string
}

const MOCK_CONTRACTORS: Contractor[] = [
  {
    id: '1',
    name: 'John Martinez',
    company: 'Pro Epoxy Solutions',
    email: 'john@proepoxy.com',
    phone: '(555) 123-4567',
    city: 'Los Angeles',
    state: 'CA',
    category: 'Epoxy Flooring',
    status: 'qualified',
    score: 87,
    source: 'Google Maps',
  },
  {
    id: '2',
    name: 'Sarah Chen',
    company: 'Elite Flooring Inc',
    email: 'sarah@eliteflooring.com',
    phone: '(555) 234-5678',
    city: 'San Francisco',
    state: 'CA',
    category: 'Flooring',
    status: 'contacted',
    score: 72,
    source: 'Yelp',
  },
  {
    id: '3',
    name: 'Mike Johnson',
    company: 'MJ Construction',
    email: 'mike@mjconstruction.com',
    phone: '(555) 345-6789',
    city: 'Phoenix',
    state: 'AZ',
    category: 'General Contractor',
    status: 'new',
    score: 65,
    source: 'Google Maps',
  },
  {
    id: '4',
    name: 'Lisa Park',
    company: 'Diamond Coatings',
    email: 'lisa@diamondcoatings.com',
    phone: '(555) 456-7890',
    city: 'Las Vegas',
    state: 'NV',
    category: 'Epoxy Flooring',
    status: 'converted',
    score: 95,
    source: 'Directory',
  },
  {
    id: '5',
    name: 'David Torres',
    company: 'Southwest Concrete',
    email: 'david@swconcrete.com',
    phone: '(555) 567-8901',
    city: 'Tucson',
    state: 'AZ',
    category: 'Concrete',
    status: 'new',
    score: 58,
    source: 'Scraper',
  },
  {
    id: '6',
    name: 'Amanda White',
    company: 'Pure Floors LLC',
    email: 'amanda@purefloors.com',
    phone: '(555) 678-9012',
    city: 'Denver',
    state: 'CO',
    category: 'Flooring',
    status: 'qualified',
    score: 81,
    source: 'Google Maps',
  },
]

const STATUS_COLORS: Record<string, string> = {
  new: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  contacted: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  qualified: 'bg-purple-500/20 text-purple-400 border-purple-500/30',
  converted: 'bg-green-500/20 text-green-400 border-green-500/30',
  lost: 'bg-red-500/20 text-red-400 border-red-500/30',
}

export function ContractorsPage({ onNavigate }: ContractorsPageProps) {
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [view, setView] = useState<'table' | 'cards'>('table')

  const searchLower = search.toLowerCase()
  const filtered = MOCK_CONTRACTORS.filter(c => {
    const matchSearch =
      !search ||
      c.name.toLowerCase().includes(searchLower) ||
      c.company.toLowerCase().includes(searchLower) ||
      c.email.toLowerCase().includes(searchLower)
    const matchStatus = statusFilter === 'all' || c.status === statusFilter
    return matchSearch && matchStatus
  })

  const stats = {
    total: MOCK_CONTRACTORS.length,
    new: MOCK_CONTRACTORS.filter(c => c.status === 'new').length,
    contacted: MOCK_CONTRACTORS.filter(c => c.status === 'contacted').length,
    qualified: MOCK_CONTRACTORS.filter(c => c.status === 'qualified').length,
    converted: MOCK_CONTRACTORS.filter(c => c.status === 'converted').length,
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <BackButton onBack={() => onNavigate('home')} />
          <div>
            <h1 className="text-2xl font-bold text-foreground">Contractors Database</h1>
            <p className="text-sm text-muted-foreground">Manage and track contractor leads</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => toast.info('Export coming soon')}>
            <Export size={16} className="mr-2" />
            Export
          </Button>
          <Button size="sm" onClick={() => toast.info('Add contractor coming soon')}>
            <Plus size={16} className="mr-2" />
            Add Contractor
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        {[
          { label: 'Total', value: stats.total, color: 'text-foreground' },
          { label: 'New', value: stats.new, color: 'text-blue-400' },
          { label: 'Contacted', value: stats.contacted, color: 'text-yellow-400' },
          { label: 'Qualified', value: stats.qualified, color: 'text-purple-400' },
          { label: 'Converted', value: stats.converted, color: 'text-green-400' },
        ].map(stat => (
          <motion.div key={stat.label} whileHover={{ scale: 1.02 }}>
            <Card>
              <CardContent className="p-4 text-center">
                <div className={`text-2xl font-bold ${stat.color}`}>{stat.value}</div>
                <div className="text-xs text-muted-foreground mt-1">{stat.label}</div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <MagnifyingGlass
            size={16}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            placeholder="Search contractors..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex gap-2">
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
            className="px-3 py-2 rounded-md border border-border bg-background text-sm text-foreground"
          >
            <option value="all">All Status</option>
            <option value="new">New</option>
            <option value="contacted">Contacted</option>
            <option value="qualified">Qualified</option>
            <option value="converted">Converted</option>
            <option value="lost">Lost</option>
          </select>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setSearch('')
              setStatusFilter('all')
            }}
          >
            <ArrowsClockwise size={16} />
          </Button>
        </div>
        <div className="flex gap-1 border border-border rounded-md p-1">
          <Button
            variant={view === 'table' ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => setView('table')}
          >
            Table
          </Button>
          <Button
            variant={view === 'cards' ? 'secondary' : 'ghost'}
            size="sm"
            onClick={() => setView('cards')}
          >
            Cards
          </Button>
        </div>
      </div>

      {/* Table View */}
      {view === 'table' && (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left p-4 text-muted-foreground font-medium">Name / Company</th>
                  <th className="text-left p-4 text-muted-foreground font-medium">Contact</th>
                  <th className="text-left p-4 text-muted-foreground font-medium">Location</th>
                  <th className="text-left p-4 text-muted-foreground font-medium">Category</th>
                  <th className="text-left p-4 text-muted-foreground font-medium">Status</th>
                  <th className="text-left p-4 text-muted-foreground font-medium">Score</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((contractor, i) => (
                  <motion.tr
                    key={contractor.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05 }}
                    className="border-b border-border/50 hover:bg-muted/50 transition-colors cursor-pointer"
                  >
                    <td className="p-4">
                      <div className="font-medium text-foreground">{contractor.name}</div>
                      <div className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                        <Buildings size={12} />
                        {contractor.company}
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-1 text-muted-foreground">
                        <Envelope size={12} />
                        <span className="text-xs">{contractor.email}</span>
                      </div>
                      <div className="flex items-center gap-1 text-muted-foreground mt-0.5">
                        <Phone size={12} />
                        <span className="text-xs">{contractor.phone}</span>
                      </div>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <MapPin size={12} />
                        {contractor.city}, {contractor.state}
                      </div>
                    </td>
                    <td className="p-4">
                      <span className="text-xs text-muted-foreground">{contractor.category}</span>
                    </td>
                    <td className="p-4">
                      <span
                        className={`text-xs px-2 py-1 rounded-full border ${STATUS_COLORS[contractor.status]}`}
                      >
                        {contractor.status}
                      </span>
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-1">
                        <Star size={12} className="text-yellow-400" weight="fill" />
                        <span className="text-xs font-medium">{contractor.score}</span>
                      </div>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
            {filtered.length === 0 && (
              <div className="text-center py-12 text-muted-foreground">
                <Users size={40} className="mx-auto mb-3 opacity-50" />
                <p>No contractors found</p>
              </div>
            )}
          </div>
        </Card>
      )}

      {/* Cards View */}
      {view === 'cards' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((contractor, i) => (
            <motion.div
              key={contractor.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
            >
              <Card className="hover:border-primary/30 transition-colors cursor-pointer">
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-sm">{contractor.name}</CardTitle>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
                        <Buildings size={11} />
                        {contractor.company}
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      <Star size={12} className="text-yellow-400" weight="fill" />
                      <span className="text-xs font-bold">{contractor.score}</span>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Envelope size={11} />
                    {contractor.email}
                  </div>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Phone size={11} />
                    {contractor.phone}
                  </div>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <MapPin size={11} />
                    {contractor.city}, {contractor.state}
                  </div>
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-xs text-muted-foreground">{contractor.category}</span>
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full border ${STATUS_COLORS[contractor.status]}`}
                    >
                      {contractor.status}
                    </span>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
          {filtered.length === 0 && (
            <div className="col-span-3 text-center py-12 text-muted-foreground">
              <Users size={40} className="mx-auto mb-3 opacity-50" />
              <p>No contractors found</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
