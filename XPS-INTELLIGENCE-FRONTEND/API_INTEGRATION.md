# API Integration Guide

The XPS Intelligence application is now fully connected to a real backend API using the pre-built integration layer. This document explains how the integration works and how to configure it.

## Architecture Overview

The integration consists of three layers:

1. **API Client** (`src/lib/api.ts`) - Low-level HTTP client with auth support
2. **API Wrappers** (`src/lib/leadsApi.ts`) - Type-safe API endpoint wrappers
3. **React Query Hooks** (`src/hooks/useLeadsApi.ts`) - React hooks for data fetching/mutations

## Configuration

### API Endpoint

Set the backend API URL via environment variable:

```bash
VITE_API_URL=https://your-api-domain.com/api
```

If not set, defaults to `http://localhost:3000/api`

### Authentication

The API client supports Bearer token authentication. Tokens are automatically:
- Included in request headers
- Persisted to localStorage
- Retrieved on app initialization

```typescript
import { api } from '@/lib/api'

// Set auth token (e.g., after login)
api.setToken('your-jwt-token')

// Get current token
const token = api.getToken()

// Clear token (e.g., on logout)
api.clearToken()
```

## Available API Endpoints

### Leads API

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/leads` | Get all leads |
| GET | `/leads/:id` | Get single lead |
| POST | `/leads` | Create new lead |
| PUT | `/leads/:id` | Update lead |
| DELETE | `/leads/:id` | Delete lead |
| GET | `/leads/metrics` | Get dashboard metrics |
| POST | `/leads/:id/assign` | Assign lead to rep |
| PUT | `/leads/:id/status` | Update lead status |
| POST | `/leads/:id/notes` | Add note to lead |

### Scraper API

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/scraper/run` | Start scraper job |
| GET | `/scraper/status/:jobId` | Get job status |
| GET | `/scraper/logs` | Get scraper logs |
| POST | `/scraper/cancel/:jobId` | Cancel running job |

## React Query Hooks

### Fetching Data

```typescript
import { useLeads, useLead, useLeadMetrics } from '@/hooks/useLeadsApi'

// Get all leads
const { data: leads, isLoading, error } = useLeads()

// Get single lead
const { data: lead } = useLead(leadId)

// Get metrics
const { data: metrics } = useLeadMetrics()
```

### Mutations

```typescript
import { 
  useCreateLead, 
  useUpdateLead, 
  useDeleteLead,
  useAssignLead,
  useUpdateLeadStatus 
} from '@/hooks/useLeadsApi'

// Create lead
const createLead = useCreateLead()
createLead.mutate(newLeadData)

// Update lead
const updateLead = useUpdateLead()
updateLead.mutate({ id: leadId, data: updates })

// Delete lead
const deleteLead = useDeleteLead()
deleteLead.mutate(leadId)

// Assign lead to rep
const assignLead = useAssignLead()
assignLead.mutate({ 
  leadId, 
  repId, 
  repName, 
  repInitials 
})

// Update status
const updateStatus = useUpdateLeadStatus()
updateStatus.mutate({ leadId, status: 'qualified' })
```

### Scraper Hooks

```typescript
import { 
  useRunScraper, 
  useScraperStatus, 
  useScraperLogs 
} from '@/hooks/useLeadsApi'

// Run scraper
const runScraper = useRunScraper()
runScraper.mutate({
  city: 'San Francisco',
  category: 'restaurants',
  maxResults: 100,
  sources: {
    googleMaps: true,
    yelp: true,
    directories: false
  }
})

// Get scraper status (auto-refetches while running)
const { data: status } = useScraperStatus(jobId)

// Get scraper logs (auto-refetches every 5s)
const { data: logs } = useScraperLogs()
```

## React Query Configuration

The app is wrapped with `QueryClientProvider` in `src/main.tsx`:

```typescript
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,                     // Retry failed requests once
      refetchOnWindowFocus: false,  // Don't refetch on window focus
      staleTime: 30000,             // Data fresh for 30 seconds
    },
  },
})
```

### Automatic Features

- **Caching**: Data is cached automatically
- **Background Updates**: Stale data is refetched in the background
- **Optimistic Updates**: UI updates immediately, rolls back on error
- **Auto-retry**: Failed requests are retried once
- **Request Deduplication**: Multiple identical requests are merged

## Error Handling

### Connection Errors

The app displays a user-friendly error screen if the API is unreachable:

```typescript
if (error) {
  return (
    <div>
      <p>Failed to connect to API</p>
      <p>Make sure your backend server is running at {API_URL}</p>
      <button onClick={() => window.location.reload()}>
        Retry
      </button>
    </div>
  )
}
```

### Mutation Errors

Mutations show toast notifications on success/error:

```typescript
const deleteLead = useDeleteLead()

// Automatically shows:
// ✓ "Lead deleted successfully" on success
// ✗ "Failed to delete lead" on error
```

## Backend Requirements

Your backend API should:

1. **Accept JSON requests** with `Content-Type: application/json`
2. **Return JSON responses** matching the TypeScript types in `src/types/lead.ts`
3. **Support Bearer token auth** via `Authorization: Bearer <token>` header
4. **Return appropriate HTTP status codes**:
   - 200/201 for success
   - 204 for successful DELETE
   - 401 for unauthorized
   - 404 for not found
   - 500 for server errors

### Example Response Format

```json
{
  "id": "01HXE8KN7FQWZ3Y9J4R5T6M8P2",
  "company": "Acme Corp",
  "city": "San Francisco",
  "state": "CA",
  "phone": "+14155551234",
  "email": "contact@acme.com",
  "website": "https://acme.com",
  "rating": "A+",
  "opportunityScore": 95,
  "status": "new",
  "createdAt": "2024-01-15T10:30:00Z"
}
```

## Type Definitions

All API types are defined in `src/types/lead.ts`:

```typescript
interface Lead {
  id: string
  company: string
  city: string
  state?: string
  phone: string
  email: string
  website?: string
  rating: LeadRating
  opportunityScore: number
  assignedRep?: string
  assignedInitials?: string
  status: LeadStatus
  priority?: LeadPriority
  notes?: string
  createdAt: string
  updatedAt?: string
  revenue?: number
  // ... more fields
}

type LeadStatus = 'new' | 'contacted' | 'qualified' | 'proposal' | 'signed' | 'lost'
type LeadRating = 'A+' | 'A' | 'B+' | 'B' | 'C' | 'D'
type LeadPriority = 'green' | 'yellow' | 'red'
```

## Example Backend Setup (Node.js/Express)

```javascript
const express = require('express')
const cors = require('cors')

const app = express()

app.use(cors())
app.use(express.json())

// Auth middleware
const authenticate = (req, res, next) => {
  const token = req.headers.authorization?.replace('Bearer ', '')
  if (!token) return res.status(401).json({ message: 'Unauthorized' })
  // Verify token...
  next()
}

// Leads endpoints
app.get('/api/leads', authenticate, (req, res) => {
  // Return array of leads
  res.json(leads)
})

app.post('/api/leads', authenticate, (req, res) => {
  // Create lead
  const newLead = { id: generateId(), ...req.body, createdAt: new Date().toISOString() }
  res.status(201).json(newLead)
})

app.put('/api/leads/:id', authenticate, (req, res) => {
  // Update lead
  const updated = { ...findLead(req.params.id), ...req.body, updatedAt: new Date().toISOString() }
  res.json(updated)
})

app.delete('/api/leads/:id', authenticate, (req, res) => {
  // Delete lead
  res.status(204).send()
})

app.listen(3000, () => console.log('API running on port 3000'))
```

## Testing the Integration

1. **Start your backend** on the configured port
2. **Open the app** in your browser
3. **Check the Network tab** to verify API calls
4. **Test CRUD operations** through the UI

If the backend is not running, the app will display a helpful error message with the expected API URL.

## Migration from Mock Data

Previous version used `useKV` for local state:
```typescript
// OLD
const [leads, setLeads] = useKV('leads-data', mockLeads)
```

Now using React Query hooks:
```typescript
// NEW
const { data: leads = [] } = useLeads()
const deleteLead = useDeleteLead()
deleteLead.mutate(id)
```

All pages have been updated to use the new API hooks.
