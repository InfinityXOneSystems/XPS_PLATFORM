# Quick Start: Connecting Frontend to Backend

## TL;DR

Your app currently uses:
- ✅ **`useKV` hook** - Browser-based persistence (like localStorage)
- ✅ **Mock data** - Empty `mockLeads` array in `src/lib/mockData.ts`
- ❌ **No backend** - Everything runs in the browser

## Three Ways to Connect

### 1. Simple REST API (Start Here)

**Step 1:** Set up your API endpoint

```bash
cp .env.example .env
# Edit .env and set: VITE_API_URL=https://your-api.com/api
```

**Step 2:** Use the pre-built API hooks in your components

```typescript
import { useLeads, useUpdateLead } from '@/hooks/useLeadsApi'

function MyComponent() {
  const { data: leads, isLoading } = useLeads()
  const { mutate: updateLead } = useUpdateLead()
  
  // That's it! The hooks handle everything.
}
```

**Files created for you:**
- `src/lib/api.ts` - REST API client
- `src/lib/leadsApi.ts` - Lead-specific API functions
- `src/hooks/useLeadsApi.ts` - React Query hooks (already configured!)

### 2. Add Real-Time Updates (Optional)

For live scraper updates, use WebSocket:

```typescript
import { wsClient } from '@/lib/websocket'

useEffect(() => {
  wsClient.connect()
  
  wsClient.on('lead:created', (newLead) => {
    toast.success('New lead found!')
  })
  
  return () => wsClient.disconnect()
}, [])
```

**Step:** Set WebSocket URL in `.env`
```bash
VITE_WS_URL=wss://your-api.com
```

### 3. Keep Using Browser Storage (Current State)

Your app works perfectly right now with `useKV`:

```typescript
// This already works - no backend needed!
const [leads, setLeads] = useKV<Lead[]>('leads-data', [])
```

## Your Backend API Should Provide

```
GET    /api/leads              → Get all leads
GET    /api/leads/:id          → Get single lead
POST   /api/leads              → Create lead
PUT    /api/leads/:id          → Update lead
DELETE /api/leads/:id          → Delete lead
GET    /api/leads/metrics      → Get dashboard stats
POST   /api/leads/:id/assign   → Assign lead to rep

POST   /api/scraper/run        → Start scraper
GET    /api/scraper/status/:id → Check scraper status
GET    /api/scraper/logs       → Get scraper logs
```

## Migration Path

### Current (Browser-Only)
```typescript
// App.tsx - lines 27-28
const [leads, setLeads] = useKV<Lead[]>('leads-data', mockLeads)
// Data persists in browser only
```

### With Backend (Option A: Simple)
```typescript
// App.tsx
const [leads, setLeads] = useState<Lead[]>([])

useEffect(() => {
  leadsApi.getAll().then(setLeads)
}, [])

const handleUpdate = async (lead) => {
  await leadsApi.update(lead.id, lead)
  // Refresh list
}
```

### With Backend (Option B: React Query - Recommended)
```typescript
// App.tsx
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useLeads } from '@/hooks/useLeadsApi'

const queryClient = new QueryClient()

function AppContent() {
  const { data: leads = [] } = useLeads() // Auto-caching, refetching!
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AppContent />
    </QueryClientProvider>
  )
}
```

## Testing Without a Backend

Use the browser console to test API integration:

```javascript
// In browser DevTools
import { leadsApi } from './src/lib/leadsApi'

// This will fail gracefully if backend isn't running
await leadsApi.getAll()
```

## Next Steps

1. ✅ **Read**: `BACKEND_INTEGRATION_GUIDE.md` (comprehensive guide)
2. ✅ **Copy**: `.env.example` → `.env` and add your API URL
3. ✅ **Choose**: REST-only or REST + WebSocket
4. ✅ **Update**: `App.tsx` to use API hooks instead of `useKV`
5. ✅ **Test**: Run your backend and see data flow!

## Questions?

- **"Do I need a backend?"** → No! App works great with `useKV` for demos/prototypes
- **"Which option should I use?"** → Option B (React Query) for production apps
- **"Can I mix useKV and API?"** → Yes! Use `useKV` for UI state, API for data
- **"How do I handle auth?"** → See `api.ts` - token management is already built in

## Key Files

| File | Purpose |
|------|---------|
| `BACKEND_INTEGRATION_GUIDE.md` | Comprehensive integration guide |
| `src/lib/api.ts` | Base API client with auth |
| `src/lib/leadsApi.ts` | Lead-specific endpoints |
| `src/lib/websocket.ts` | WebSocket client for real-time |
| `src/hooks/useLeadsApi.ts` | React Query hooks (ready to use) |
| `.env.example` | Environment variables template |
