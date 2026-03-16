# Backend Integration Guide for XPS Intelligence Dashboard

This is a **frontend-on






const API_BASE_URL = import.meta.e

  status: number

  private baseUrl: string

  }

    options: 
    const url = `${this.baseUrl}${endpoint}`

      headers: {
        ...option
    }
 

        const err
          status: respons


    } catch (error) {
   

  async get<T>(endpoint: st
  }
  async post<T>(endpoint: str
      method: 'PO
    })

    return this.request<T>(endpoi
      body: JSON.
  }
  async delete<T>(endpoint: string): Promis
  }

```

Create `/
```typescript
import
export const leadsApi = {
    return api.get<Lead[]>('/lead

    return api.get<Lead>(`/leads/$

    return api.post



    return api.delete

    return api.ge

   





import { toast } from 'sonner'

  const [currentPage,
  const [mobileMenuOpen, setMobil
  // R
  c

  useEffect(() => {
  }, [])
  const fetchLeads =
      setLoading(true)
      
   

    }

   
 

    } catch (error) {
   

  const handleDeleteLead = async (id: string) =

      toast.success('Lead deleted successfully')

    }

}



VITE_API_URL=http://localhost:3000/a


VITE_API_URL=https://your-production-api.com







import { toast } from 'sonner'

  re

  })

  re

  })

  co

      leadsApi.update(id, data),
      queryClient.invalidateQueries({ queryKey: ['leads'] })
    
 
  }

  const queryClient = useQueryClient()

    onSuccess: () => {

    onError: 
    },
}
export function useCreateLead(


      queryClien
    },
      toast.error('Failed to create lead')
  })
``
  // Replace useKV with regular useState
  const [leads, setLeads] = useState<Lead[]>([])
  const [loading, setLoading] = useState(true)
  const isMobile = useIsMobile()

  // Fetch leads on mount
  useEffect(() => {
    fetchLeads()
  }, [])

  const fetchLeads = async () => {
    try {
      setLoading(true)
      const data = await leadsApi.getAll()
      setLeads(data)
    } catch (error) {
      toast.error('Failed to load leads')
      console.error(error)
    } finally {
      setLoading(false)
    }
  }

  const handleUpdateLead = async (updatedLead: Lead) => {
    try {
      const result = await leadsApi.update(updatedLead.id, updatedLead)
      setLeads((currentLeads) =>
        currentLeads.map((lead) => (lead.id === result.id ? result : lead))
      )
      toast.success('Lead updated successfully')
    } catch (error) {
      toast.error('Failed to update lead')
      console.error(error)
    }
  }

  const handleDeleteLead = async (id: string) => {
    try {
      await leadsApi.delete(id)
      setLeads((currentLeads) => currentLeads.filter((lead) => lead.id !== id))
      toast.success('Lead deleted successfully')
    } catch (error) {
      toast.error('Failed to delete lead')
      console.error(error)
    }
  }

  // ... rest of component
}
```

#### Step 4: Add Environment Variables

Create `/workspaces/spark-template/.env`:

```env
VITE_API_URL=http://localhost:3000/api
```

Create `/workspaces/spark-template/.env.production`:

```env
VITE_API_URL=https://your-production-api.com/api
```

---

### Option 2: Using React Query (Best for Complex Apps)

React Query (@tanstack/react-query) is already installed! This provides caching, background refetching, and better error handling.

#### Step 1: Create API Hooks

Create `/workspaces/spark-template/src/hooks/useLeads.ts`:

```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { leadsApi } from '@/lib/leadsApi'
import { toast } from 'sonner'
import type { Lead } from '@/types/lead'

export function useLeads() {
  return useQuery({
    queryKey: ['leads'],
    queryFn: leadsApi.getAll,
    staleTime: 5 * 60 * 1000, // 5 minutes
  })
}

export function useLead(id: string) {
  return useQuery({
    queryKey: ['leads', id],
    queryFn: () => leadsApi.getById(id),
    enabled: !!id,
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
```

#### Step 2: Setup QueryClient in App

Modify `/workspaces/spark-template/src/App.tsx`:

```typescript
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useLeads } from '@/hooks/useLeads'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 3,
      staleTime: 5 * 60 * 1000,
    },
  },
})

function AppContent() {
  const { data: leads = [], isLoading } = useLeads()
  const { mutate: updateLead } = useUpdateLead()
  const { mutate: deleteLead } = useDeleteLead()

  // Use leads data directly
  // handleUpdateLead and handleDeleteLead now just call the mutations
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AppContent />
      </ThemeProvider>
    </QueryClientProvider>
  )
}
```

---

### Option 3: WebSocket for Real-Time Updates

For real-time scraper updates and lead notifications:

Create `/workspaces/spark-template/src/lib/websocket.ts`:

```typescript
type MessageHandler = (data: any) => void

class WebSocketClient {
  private ws: WebSocket | null = null
  private handlers: Map<string, MessageHandler[]> = new Map()
  private reconnectTimeout: number = 3000
  private url: string

  constructor(url: string) {
    this.url = url
  }

  connect() {
    this.ws = new WebSocket(this.url)

    this.ws.onopen = () => {
      console.log('WebSocket connected')
    }

    this.ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data)
        const { type, data } = message

        const handlers = this.handlers.get(type) || []
        handlers.forEach((handler) => handler(data))
      } catch (error) {
        console.error('WebSocket message error:', error)
      }
    }

    this.ws.onclose = () => {
      console.log('WebSocket disconnected, reconnecting...')
      setTimeout(() => this.connect(), this.reconnectTimeout)
    }

    this.ws.onerror = (error) => {
      console.error('WebSocket error:', error)
    }
  }

  on(type: string, handler: MessageHandler) {
    if (!this.handlers.has(type)) {
      this.handlers.set(type, [])
    }
    this.handlers.get(type)!.push(handler)
  }

  off(type: string, handler: MessageHandler) {
    const handlers = this.handlers.get(type) || []
    const index = handlers.indexOf(handler)
    if (index > -1) {
      handlers.splice(index, 1)
    }
  }

  send(type: string, data: any) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type, data }))
    }
  }

  disconnect() {
    this.ws?.close()
  }
}

const WS_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:3000'
export const wsClient = new WebSocketClient(WS_URL)
```

Use in components:

```typescript
useEffect(() => {
  wsClient.connect()

  const handleNewLead = (lead: Lead) => {
    setLeads((prev) => [...prev, lead])
    toast.success('New lead scraped!')
  }

  wsClient.on('lead:created', handleNewLead)

  return () => {
    wsClient.off('lead:created', handleNewLead)
  }
}, [])
```

---

## Authentication Setup

If your backend requires authentication:

#### Step 1: Add Auth to API Client

```typescript
// In api.ts
class ApiClient {
  private token: string | null = null

  setToken(token: string) {
    this.token = token
    localStorage.setItem('auth_token', token)
  }

  getToken(): string | null {
    if (!this.token) {
      this.token = localStorage.getItem('auth_token')
    }
    return this.token
  }

  clearToken() {
    this.token = null
    localStorage.removeItem('auth_token')
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const token = this.getToken()
    
    const config: RequestInit = {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(token && { Authorization: `Bearer ${token}` }),
        ...options.headers,
      },
    }

    // ... rest of request logic
  }
}
```

#### Step 2: Create Auth Hooks

```typescript
// src/hooks/useAuth.ts
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'

export function useAuth() {
  return useQuery({
    queryKey: ['auth', 'user'],
    queryFn: async () => {
      // Use Spark's built-in user API
      const user = await spark.user()
      return user
    },
  })
}
```

---

## Backend API Requirements

Your backend should provide these endpoints:

### Lead Endpoints
- `GET /api/leads` - Get all leads
- `GET /api/leads/:id` - Get single lead
- `POST /api/leads` - Create lead
- `PUT /api/leads/:id` - Update lead
- `DELETE /api/leads/:id` - Delete lead
- `GET /api/leads/metrics` - Get dashboard metrics
- `POST /api/leads/:id/assign` - Assign lead to rep

### Scraper Endpoints
- `POST /api/scraper/run` - Trigger scraper
- `GET /api/scraper/status` - Get scraper status
- `GET /api/scraper/logs` - Get scraper logs

### WebSocket Events (Optional)
- `lead:created` - New lead scraped
- `lead:updated` - Lead updated
- `scraper:progress` - Scraper progress update
- `scraper:completed` - Scraper finished

---

## Example Backend Response Formats

### GET /api/leads
```json
[
  {
    "id": "lead_123",
    "company": "Acme Construction",
    "city": "San Francisco",
    "state": "CA",
    "phone": "(555) 123-4567",
    "email": "contact@acme.com",
    "website": "https://acme.com",
    "rating": "A+",
    "opportunityScore": 95,
    "status": "new",
    "createdAt": "2024-01-15T10:30:00Z"
  }
]
```

### POST /api/leads/:id/assign
```json
{
  "repId": "user_456"
}
```

Response:
```json
{
  "id": "lead_123",
  "assignedRep": "John Doe",
  "assignedInitials": "JD",
  "updatedAt": "2024-01-15T11:00:00Z"
}
```

---

## Migration Checklist

- [ ] Create API service layer (`api.ts`, `leadsApi.ts`)
- [ ] Set up environment variables (`.env`, `.env.production`)
- [ ] Replace `useKV` with API calls in `App.tsx`
- [ ] Add error handling and loading states
- [ ] (Optional) Set up React Query for better caching
- [ ] (Optional) Add WebSocket for real-time updates
- [ ] (Optional) Implement authentication
- [ ] Test with your backend API
- [ ] Update scraper functionality to call backend
- [ ] Add proper error boundaries for API failures

---

## Testing Without a Backend

To test the integration layer without a backend, use Mock Service Worker (MSW):

```bash
npm install msw --save-dev
```

Create `/workspaces/spark-template/src/mocks/handlers.ts`:

```typescript
import { http, HttpResponse } from 'msw'
import { mockLeads } from '@/lib/mockData'

export const handlers = [
  http.get('/api/leads', () => {
    return HttpResponse.json(mockLeads)
  }),

  http.post('/api/leads', async ({ request }) => {
    const newLead = await request.json()
    return HttpResponse.json({ id: 'new_lead_123', ...newLead })
  }),

  http.put('/api/leads/:id', async ({ request, params }) => {
    const updates = await request.json()
    return HttpResponse.json({ id: params.id, ...updates })
  }),

  http.delete('/api/leads/:id', () => {
    return new HttpResponse(null, { status: 204 })
  }),
]
```

---

## Performance Considerations

1. **Caching**: Use React Query's cache to avoid unnecessary API calls
2. **Pagination**: Implement pagination for large lead lists
3. **Debouncing**: Debounce search/filter inputs to reduce API calls
4. **Optimistic Updates**: Update UI immediately, rollback on error
5. **Background Sync**: Use service worker to sync when connection returns

---

## Current State vs. Future State

### Current (Frontend-Only)
```
┌─────────────────┐
│  React Frontend │ ──useKV──> Browser Storage
└─────────────────┘
```

### Future (With Backend)
```
┌─────────────────┐        ┌──────────────┐        ┌──────────────┐
│  React Frontend │ ──API─> │ Backend API  │ ──DB─> │   Database   │
└─────────────────┘        └──────────────┘        └──────────────┘
        │                          │
        └────────WebSocket─────────┘
```

---

## Questions?

This guide covers the main approaches for connecting your frontend to a backend. Choose:
- **Option 1** for simplicity
- **Option 2** for production apps with complex data needs
- **Option 3** when you need real-time features

The current app is fully functional as a frontend-only application using Spark's `useKV` for persistence, but can be easily migrated to any backend by following these patterns.
#### Step 2: Setup QueryClient in App

Modify `/workspaces/spark-template/src/App.tsx`:

```typescript
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useLeads } from '@/hooks/useLeads'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 3,
      staleTime: 5 * 60 * 1000,
    },
  },
})

function AppContent() {
  const { data: leads = [], isLoading } = useLeads()
  const { mutate: updateLead } = useUpdateLead()
  const { mutate: deleteLead } = useDeleteLead()

  // Use leads data directly
  // handleUpdateLead and handleDeleteLead now just call the mutations
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AppContent />
      </ThemeProvider>
    </QueryClientProvider>
  )
}
```

---

### Option 3: WebSocket for Real-Time Updates

For real-time scraper updates and lead notifications:

Create `/workspaces/spark-template/src/lib/websocket.ts`:

```typescript
type MessageHandler = (data: any) => void

class WebSocketClient {
  private ws: WebSocket | null = null
  private handlers: Map<string, MessageHandler[]> = new Map()
  private reconnectTimeout: number = 3000
  private url: string

  constructor(url: string) {
    this.url = url
  }

  connect() {
    this.ws = new WebSocket(this.url)

    this.ws.onopen = () => {
      console.log('WebSocket connected')
    }

    this.ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data)
        const { type, data } = message

        const handlers = this.handlers.get(type) || []
        handlers.forEach((handler) => handler(data))
      } catch (error) {
        console.error('WebSocket message error:', error)
      }
    }

    this.ws.onclose = () => {
      console.log('WebSocket disconnected, reconnecting...')
      setTimeout(() => this.connect(), this.reconnectTimeout)
    }

    this.ws.onerror = (error) => {
      console.error('WebSocket error:', error)
    }
  }

  on(type: string, handler: MessageHandler) {
    if (!this.handlers.has(type)) {
      this.handlers.set(type, [])
    }
    this.handlers.get(type)!.push(handler)
  }

  off(type: string, handler: MessageHandler) {
    const handlers = this.handlers.get(type) || []
    const index = handlers.indexOf(handler)
    if (index > -1) {
      handlers.splice(index, 1)
    }
  }

  send(type: string, data: any) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type, data }))
    }
  }

  disconnect() {
    this.ws?.close()
  }
}

const WS_URL = import.meta.env.VITE_WS_URL || 'ws://localhost:3000'
export const wsClient = new WebSocketClient(WS_URL)
```

Use in components:

```typescript
useEffect(() => {
  wsClient.connect()

  const handleNewLead = (lead: Lead) => {
    setLeads((prev) => [...prev, lead])
    toast.success('New lead scraped!')
  }

  wsClient.on('lead:created', handleNewLead)

  return () => {
    wsClient.off('lead:created', handleNewLead)
  }
}, [])
```

---

## Authentication Setup

If your backend requires authentication:

#### Step 1: Add Auth to API Client

```typescript
// In api.ts
class ApiClient {
  private token: string | null = null

  setToken(token: string) {
    this.token = token
    localStorage.setItem('auth_token', token)
  }

  getToken(): string | null {
    if (!this.token) {
      this.token = localStorage.getItem('auth_token')
    }
    return this.token
  }

  clearToken() {
    this.token = null
    localStorage.removeItem('auth_token')
  }

  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const token = this.getToken()
    
    const config: RequestInit = {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(token && { Authorization: `Bearer ${token}` }),
        ...options.headers,
      },
    }

    // ... rest of request logic
  }
}
```

#### Step 2: Create Auth Hooks

```typescript
// src/hooks/useAuth.ts
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'

export function useAuth() {
  return useQuery({
    queryKey: ['auth', 'user'],
    queryFn: async () => {
      // Use Spark's built-in user API
      const user = await spark.user()
      return user
    },
  })
}
```

---

## Backend API Requirements

Your backend should provide these endpoints:

### Lead Endpoints
- `GET /api/leads` - Get all leads
- `GET /api/leads/:id` - Get single lead
- `POST /api/leads` - Create lead
- `PUT /api/leads/:id` - Update lead
- `DELETE /api/leads/:id` - Delete lead
- `GET /api/leads/metrics` - Get dashboard metrics
- `POST /api/leads/:id/assign` - Assign lead to rep

### Scraper Endpoints
- `POST /api/scraper/run` - Trigger scraper
- `GET /api/scraper/status` - Get scraper status
- `GET /api/scraper/logs` - Get scraper logs

### WebSocket Events (Optional)
- `lead:created` - New lead scraped
- `lead:updated` - Lead updated
- `scraper:progress` - Scraper progress update
- `scraper:completed` - Scraper finished

---

## Example Backend Response Formats

### GET /api/leads
```json
[
  {
    "id": "lead_123",
    "company": "Acme Construction",
    "city": "San Francisco",
    "state": "CA",
    "phone": "(555) 123-4567",
    "email": "contact@acme.com",
    "website": "https://acme.com",
    "rating": "A+",
    "opportunityScore": 95,
    "status": "new",
    "createdAt": "2024-01-15T10:30:00Z"
  }
]
```

### POST /api/leads/:id/assign
```json
{
  "repId": "user_456"
}
```

Response:
```json
{
  "id": "lead_123",
  "assignedRep": "John Doe",
  "assignedInitials": "JD",
  "updatedAt": "2024-01-15T11:00:00Z"
}
```

---

## Migration Checklist

- [ ] Create API service layer (`api.ts`, `leadsApi.ts`)
- [ ] Set up environment variables (`.env`, `.env.production`)
- [ ] Replace `useKV` with API calls in `App.tsx`
- [ ] Add error handling and loading states
- [ ] (Optional) Set up React Query for better caching
- [ ] (Optional) Add WebSocket for real-time updates
- [ ] (Optional) Implement authentication
- [ ] Test with your backend API
- [ ] Update scraper functionality to call backend
- [ ] Add proper error boundaries for API failures

---

## Testing Without a Backend

To test the integration layer without a backend, use Mock Service Worker (MSW):

```bash
npm install msw --save-dev
```

Create `/workspaces/spark-template/src/mocks/handlers.ts`:

```typescript
import { http, HttpResponse } from 'msw'
import { mockLeads } from '@/lib/mockData'

export const handlers = [
  http.get('/api/leads', () => {
    return HttpResponse.json(mockLeads)
  }),

  http.post('/api/leads', async ({ request }) => {
    const newLead = await request.json()
    return HttpResponse.json({ id: 'new_lead_123', ...newLead })
  }),

  http.put('/api/leads/:id', async ({ request, params }) => {
    const updates = await request.json()
    return HttpResponse.json({ id: params.id, ...updates })
  }),

  http.delete('/api/leads/:id', () => {
    return new HttpResponse(null, { status: 204 })
  }),
]
```

---

## Performance Considerations

1. **Caching**: Use React Query's cache to avoid unnecessary API calls
2. **Pagination**: Implement pagination for large lead lists
3. **Debouncing**: Debounce search/filter inputs to reduce API calls
4. **Optimistic Updates**: Update UI immediately, rollback on error
5. **Background Sync**: Use service worker to sync when connection returns

---

## Current State vs. Future State

### Current (Frontend-Only)
```
┌─────────────────┐
│  React Frontend │ ──useKV──> Browser Storage
└─────────────────┘
```

### Future (With Backend)
```
┌─────────────────┐        ┌──────────────┐        ┌──────────────┐
│  React Frontend │ ──API─> │ Backend API  │ ──DB─> │   Database   │
└─────────────────┘        └──────────────┘        └──────────────┘
        │                          │
        └────────WebSocket─────────┘
```

---

## Questions?

This guide covers the main approaches for connecting your frontend to a backend. Choose:
- **Option 1** for simplicity
- **Option 2** for production apps with complex data needs
- **Option 3** when you need real-time features

The current app is fully functional as a frontend-only application using Spark's `useKV` for persistence, but can be easily migrated to any backend by following these patterns.
