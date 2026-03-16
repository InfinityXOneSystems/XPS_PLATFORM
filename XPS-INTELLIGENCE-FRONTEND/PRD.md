# XPS Intelligence Dashboard - AI Operating System

A futuristic AI operating system interface for managing scored contractor leads with real-time visualization, intelligent agent assistance, mission control-grade command execution, progressive web app capabilities, and adaptive light/dark theme support.

**Experience Qualities**:
1. **Futuristic** - Cutting-edge interface with glassmorphic cards, animated gradients, and metallic effects that feel like mission control technology
2. **Powerful** - Command-driven workflows and AI assistance that makes users feel they have unfair advantages in lead generation
3. **Elite** - Premium aesthetic with gold accents, liquid silver highlights, and bronze secondary tones that communicate high-value intelligence operations

**Complexity Level**: Complex Application (advanced functionality, likely with multiple views)
This is an enterprise-grade AI operating system with glassmorphic UI, animated system indicators, universal execution canvas, AI agent integration, multi-mode content rendering, sophisticated real-time command processing across interconnected intelligence modules, PWA support for offline functionality, and adaptive theming for user preference.

## Essential Features

### Progressive Web App (PWA)
- **Functionality**: Installable web application with offline support and native-like experience
- **Purpose**: Enable users to install the dashboard on their devices and access it like a native app, with offline caching for key resources
- **Trigger**: Browser detects manifest.json and service worker, prompting installation
- **Progression**: User visits app → Browser shows install prompt → User installs → App opens in standalone mode → Service worker caches resources → Offline access enabled
- **Success criteria**: App is installable on all modern browsers, service worker caches critical assets, app functions offline for viewing cached data

### Theme Switching (Light/Dark Mode)
- **Functionality**: User-selectable theme toggle between light and dark modes with persistent preference storage
- **Purpose**: Allow users to customize visual appearance based on environment, preference, or time of day
- **Trigger**: Clicking theme toggle button in top bar
- **Progression**: Click toggle → Theme switches instantly with smooth transitions → Preference saved to KV storage → Theme persists across sessions
- **Success criteria**: Smooth transition animations (<300ms), preference persists, all components adapt correctly, WCAG contrast ratios maintained in both themes

### Lead Management System
- **Functionality**: Display, filter, search, and manage scored contractor leads with full CRUD operations
- **Purpose**: Central hub for sales teams to access and action qualified leads
- **Trigger**: Navigating to Leads page or clicking lead cards
- **Progression**: View leads table → Filter/search → Select lead → View full profile → Take action (assign/email/call/edit) → Confirm → Update persists
- **Success criteria**: All lead operations complete within 2 seconds, changes persist and sync across views

### Real-time Dashboard Metrics
- **Functionality**: Display key performance indicators with live updates from scored leads data
- **Purpose**: Provide at-a-glance business health and opportunity assessment
- **Trigger**: Landing on dashboard or periodic auto-refresh
- **Progression**: Load dashboard → Fetch leads data → Calculate metrics → Animate card transitions → Display with visual hierarchy
- **Success criteria**: Metrics accurately reflect lead data, update within 1 second of data changes

### Data Visualization Suite
- **Functionality**: Interactive charts showing score distribution, pipeline stages, and geographic distribution
- **Purpose**: Enable pattern recognition and strategic decision-making through visual analytics
- **Trigger**: Dashboard load or switching to Analytics view
- **Progression**: Render chart skeleton → Load data → Animate chart drawing → Enable hover interactions → Allow filtering
- **Success criteria**: Charts render smoothly, respond to hover within 100ms, accurately represent underlying data

### AI Lead Assistant (Lead Sniper)
- **Functionality**: Conversational AI interface for lead queries, email generation, and search
- **Purpose**: Accelerate sales workflows through intelligent automation and natural language interaction
- **Trigger**: Typing in chat panel or using command bar
- **Progression**: User inputs query → Parse intent → Execute function (search/generate/analyze) → Stream response → Display actionable results
- **Success criteria**: Response latency under 3 seconds, generated content is contextually relevant, commands execute correctly

### Scraper Control Interface
- **Functionality**: Manual trigger for lead scraping with configurable parameters
- **Purpose**: Enable on-demand lead generation from external sources
- **Trigger**: Navigate to Scraper Control, configure settings, click Run Scraper
- **Progression**: Set parameters (city/category/sources) → Validate inputs → Trigger scraper → Show progress → Display results/logs
- **Success criteria**: Scraper executes with valid parameters, provides real-time status, handles errors gracefully

### Lead Profile Detail View
- **Functionality**: Comprehensive lead information panel with editing and action capabilities
- **Purpose**: Provide full context for sales engagement decisions
- **Trigger**: Clicking lead name/row in table
- **Progression**: Click lead → Slide-in panel animation → Load full profile → Display sections → Edit mode → Save changes → Close panel
- **Success criteria**: Profile loads within 500ms, edits save successfully, all lead data visible and actionable

### Command Bar Interface
- **Functionality**: Terminal-style command input for power users
- **Purpose**: Enable rapid navigation and actions via keyboard shortcuts
- **Trigger**: Keyboard shortcut (Cmd/Ctrl+K) or clicking command bar
- **Progression**: Open command palette → Type command → Show suggestions → Execute → Provide feedback → Close
- **Success criteria**: Opens within 100ms, commands execute reliably, suggestions are contextually relevant

### Role-Based Access Control
- **Functionality**: Filter leads and features based on user role (Admin vs Sales Rep)
- **Purpose**: Ensure sales reps only access their assigned leads while admins see all
- **Trigger**: User authentication on app load
- **Progression**: Check user role → Set permissions → Filter data queries → Hide/show UI elements → Enforce on actions
- **Success criteria**: Sales reps only see assigned leads, admins have full access, unauthorized actions are blocked

## Edge Case Handling

- **Empty Data States**: Display helpful empty states with CTA to run scraper or add first lead
- **API Failures**: Show toast notifications with retry option, gracefully degrade to cached data
- **Invalid Scraper Parameters**: Inline validation with helpful error messages, prevent submission
- **Malformed Lead Data**: Sanitize inputs, show fallback values (N/A), log errors for debugging
- **Concurrent Edits**: Last-write-wins with timestamp, show warning if data changed during edit
- **Network Offline**: Queue actions for retry, show offline indicator via PWA, use cached data from service worker
- **Large Datasets**: Implement virtual scrolling for tables, pagination for charts, lazy load profiles
- **Chat API Timeout**: Show timeout message with retry, allow canceling long-running requests
- **Service Worker Registration Failure**: Gracefully degrade to online-only mode, log error for debugging
- **Theme Switch Mid-Interaction**: Ensure smooth transitions without disrupting user workflows, maintain component state
- **Browser PWA Support**: Detect capabilities and provide appropriate install prompts or fallback messaging

## Design Direction

The design should evoke a sense of **futuristic AI mission control** - like an elite intelligence agency's command center. The interface must feel alive with animated gradients, pulsing indicators, and glassmorphic cards that suggest sophisticated AI working seamlessly. The application now supports both light and dark themes, allowing users to choose their preferred aesthetic. In dark mode, deep black backgrounds (#000000) provide maximum contrast for electric gold accents and liquid silver highlights. In light mode, clean white backgrounds (#FFFFFF) with refined gold accents maintain the premium aesthetic while improving readability in bright environments. Every interaction should feel precise and powerful, with glassmorphic blurred effects and glowing borders reinforcing the premium, cutting-edge aesthetic. Think high-tech military operations meets luxury automotive interfaces, now accessible in any lighting condition.

## Color Selection

The color scheme establishes a futuristic, elite intelligence aesthetic with animated electric gold gradients, available in both dark and light themes for optimal viewing in any environment.

**Dark Theme (Default):**
- **Primary Color**: Electric Gold `oklch(0.905 0.182 98.111)` - Animated gradient power accent representing high-value intelligence and mission-critical actions
- **Background**: Deep Black `#000000` - Pure background for maximum contrast and futuristic depth
- **Foreground**: Pure White `#FFFFFF` - Primary text with exceptional contrast
- **Secondary Colors**: 
  - Liquid Silver `oklch(0.75 0.02 240)` - Metallic accents for secondary UI elements
  - Bronze `oklch(0.72 0.14 50)` - Tertiary highlights for gradient complexity
  - Card Background `rgba(255, 255, 255, 0.03)` - Subtle glassmorphic surfaces

**Light Theme:**
- **Primary Color**: Rich Gold `oklch(0.72 0.15 85)` - Refined gold for light backgrounds
- **Background**: Pure White `#FFFFFF` - Clean, professional background
- **Foreground**: Deep Charcoal `#1a1a1a` - Primary text with strong contrast
- **Secondary Colors**:
  - Muted Gold `#C4A040` - Borders and accent elements
  - Warm Bronze `#B77028` - Secondary accents
  - Card Background `rgba(255, 255, 255, 0.95)` - Elevated surfaces with subtle opacity

**Foreground/Background Pairings**:
- Dark Mode - Deep Black `#000000`: White text `#FFFFFF` - Ratio 21:1 ✓
- Dark Mode - Electric Gold `oklch(0.905 0.182 98.111)`: Black text `#000000` - Ratio 18:1 ✓
- Light Mode - Pure White `#FFFFFF`: Charcoal text `#1a1a1a` - Ratio 12:1 ✓
- Light Mode - Rich Gold `oklch(0.72 0.15 85)`: Charcoal text `#1a1a1a` - Ratio 6.5:1 ✓
- Both Modes - Glassmorphic Cards: Foreground text - Ratio >7:1 ✓

## Font Selection

Typography should convey **precision, modernity, and technological sophistication** - a blend of geometric clarity for data and refined elegance for branding.

- **Typographic Hierarchy**:
  - App Title/Logo: Space Grotesk Bold / 32px / -0.02em letter spacing
  - Page Headings (H1): Space Grotesk SemiBold / 24px / -0.01em letter spacing / 1.2 line height
  - Section Headings (H2): Space Grotesk Medium / 18px / normal letter spacing / 1.3 line height
  - Card Titles (H3): Inter SemiBold / 16px / normal letter spacing / 1.4 line height
  - Body Text: Inter Regular / 14px / normal letter spacing / 1.5 line height
  - Table Data: JetBrains Mono Regular / 13px / normal letter spacing / 1.4 line height
  - Captions/Labels: Inter Medium / 12px / 0.01em letter spacing / 1.4 line height / uppercase
  - Command Bar: JetBrains Mono Medium / 14px / normal letter spacing

## Animations

Animations should feel **futuristic and alive** - like sophisticated AI systems engaging and responding. Use precise, purposeful motion that reinforces the intelligence theme: gradients shifting across borders (3s infinite), glow effects pulsing on high-value items (2s ease-in-out), system indicators breathing with activity. Micro-interactions snap instantly (<100ms) while larger state transitions flow smoothly (300-400ms) with easing that feels technological rather than organic. Logo sparkles should animate subtly. Charts reveal with staggered data point emergence. Hover states scale elements slightly (1.02x) with simultaneous glow intensification. Everything should feel mission-critical and responsive, never casual.

## Component Selection

- **Components**:
  - Sidebar: Custom component with collapsed/expanded states using framer-motion
  - Card: shadcn Card with glassmorphic styling (rgba(255, 255, 255, 0.03) background, 24px backdrop-blur, subtle borders)
  - Table: shadcn Table with custom row hover states and virtual scrolling for performance
  - Dialog/Sheet: shadcn Sheet for lead profile panels with slide-in animations
  - Button: shadcn Button with custom gold gradient variant and glow hover effects
  - Input: shadcn Input with gold focus rings and dark styling
  - Select: shadcn Select with dark theme overrides
  - Badge: shadcn Badge for status indicators (A+, Assigned, etc.)
  - Tabs: shadcn Tabs for switching dashboard views
  - Command: shadcn Command (cmdk) for command bar interface
  - Toaster: sonner for notifications with dark theme
  - Charts: Recharts (BarChart, PieChart, AreaChart) with custom dark theme and gold accents
  
- **Customizations**:
  - Glassmorphic card component with 24px backdrop-blur and rgba(255, 255, 255, 0.03) background
  - Glow button variant with box-shadow animation on hover
  - Custom table component with striped rows and selection states
  - AI chat message components with streaming text animation
  - Metric card component with animated number counting and glassmorphic background
  - Command palette with fuzzy search and keyboard navigation
  
- **States**:
  - Buttons: Default (gold border), Hover (gold glow), Active (gold filled), Disabled (opacity-50)
  - Inputs: Default (border-slate), Focus (border-gold ring-gold), Error (border-red), Filled (bg-slate-900)
  - Table Rows: Default, Hover (bg-slate-900/50 gold-glow-left), Selected (bg-gold/10), Loading (skeleton)
  - Cards: Default (glass), Hover (border-gold glow), Active (lift-shadow), Loading (pulse)
  
- **Icon Selection**:
  - Dashboard: ChartBar (overview metrics)
  - Leads: Users (lead management)
  - Scraper: Gear/Robot (automation control)
  - Pipeline: FunnelSimple (sales stages)
  - Outreach: PaperPlaneTilt (communications)
  - Analytics: ChartLine (data insights)
  - Team: UserList (team management)
  - Settings: GearSix (configuration)
  - Actions: PencilSimple (edit), Trash (delete), UserPlus (assign), Envelope (email), Phone (call)
  - Command: Terminal (command bar trigger)
  - Search: MagnifyingGlass (filters)
  
- **Spacing**:
  - Page padding: p-10 md:p-16 (generous breathing room)
  - Card padding: p-8 md:p-10 (spacious internal spacing)
  - Section gaps: gap-10 md:gap-16 (significant separation between sections)
  - Component gaps: gap-6 md:gap-8 (clear visual grouping)
  - Button padding: px-8 py-4 (comfortable touch targets)
  - Input padding: px-5 py-3.5 (relaxed input fields)
  - Table cell padding: px-6 py-5 (breathing room for data)
  - Sidebar padding: p-6 (comfortable navigation)
  
- **Mobile**:
  - Sidebar collapses to bottom navigation bar on mobile (<768px)
  - Right chat panel becomes modal/sheet on mobile
  - Table switches to card-based mobile view with stacked information
  - Charts resize responsively with adjusted dimensions
  - Command bar becomes full-screen modal on mobile
  - Metric cards stack vertically in single column
  - All touch targets minimum 44x44px
  - Reduced padding/gaps (p-6 instead of p-10)

## Layout Philosophy (Inspired by ZoomInfo, Apollo.io, LinkedIn Sales Navigator)

**Psychological Principles Applied:**
1. **Progressive Disclosure**: Show only what's immediately actionable, hide complexity until needed
2. **Visual Hierarchy**: Clear importance ranking through size, color, and spacing
3. **Breathing Room**: Generous whitespace (2-4x current) reduces cognitive load
4. **Focused Attention**: Single primary action per screen section
5. **Contextual Navigation**: Each page is self-contained with clear entry/exit points

**Layout Structure:**
- **Home**: Minimalist dashboard with 4 key metrics and quick actions (inspired by Notion, Linear)
- **Dashboard**: Mobile-optimized priority view - only show what needs action NOW
- **Leads**: Spacious table with generous padding, clear visual hierarchy
- **Canvas**: Moved to bottom of navigation - utility tool, not core workflow
- **All Pages**: Back button for clear navigation, generous spacing between all elements

## Backend Integration Architecture

**Current State:**
- Frontend-only application using Spark's `useKV` hook for browser-based persistence
- Mock data structure in place for development
- All data operations handled client-side

**Backend Integration Options:**
1. **REST API Integration** - Standard HTTP API with React Query for caching and state management
2. **WebSocket Support** - Real-time updates for scraper progress and new lead notifications
3. **Hybrid Approach** - REST for CRUD operations, WebSocket for live updates

**API Layer Structure:**
- `src/lib/api.ts` - Base API client with authentication and error handling
- `src/lib/leadsApi.ts` - Lead-specific endpoints (CRUD, metrics, assignment)
- `src/lib/websocket.ts` - WebSocket client for real-time features
- `src/hooks/useLeadsApi.ts` - React Query hooks wrapping API calls

**Required Backend Endpoints:**
- Lead Management: GET/POST/PUT/DELETE `/api/leads`, GET `/api/leads/metrics`
- Scraper Control: POST `/api/scraper/run`, GET `/api/scraper/status/:id`, GET `/api/scraper/logs`
- Real-time Events: `lead:created`, `lead:updated`, `scraper:progress`, `scraper:completed`

**Migration Path:**
- Application works standalone with `useKV` (no backend required)
- Can progressively adopt backend by replacing `useKV` calls with API hooks
- Environment variables control API endpoints (development/production)
- React Query provides caching, optimistic updates, and background sync

**Documentation:**
- `BACKEND_INTEGRATION_GUIDE.md` - Comprehensive integration patterns and examples
- `QUICK_START_BACKEND.md` - Quick reference for common backend connection scenarios
- `.env.example` - Template for API configuration
