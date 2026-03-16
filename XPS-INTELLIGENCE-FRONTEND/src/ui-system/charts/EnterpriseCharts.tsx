import React from 'react'
import { BarChart, Bar, LineChart, Line, AreaChart, Area, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'

export interface ChartDataPoint {
  name: string
  value: number
  [key: string]: string | number
}

const CHART_COLORS = {
  gold: '#D4AF37',
  silver: '#C0C0C0',
  bronze: '#CD7F32',
  maroon: '#8B0023',
  cyan: '#00E5FF',
  teal: '#14B8A6',
  slate: '#64748B',
  green: '#10B981'
}

const CHART_CONFIG = {
  margin: { top: 5, right: 30, left: 20, bottom: 5 },
  gridStyle: { stroke: 'rgba(255, 255, 255, 0.08)', strokeDasharray: '3 3' },
  axisStyle: { stroke: '#6B7280', fontSize: 12 },
  tooltipStyle: {
    backgroundColor: 'rgba(0, 0, 0, 0.95)',
    border: '1px solid rgba(212, 175, 55, 0.3)',
    borderRadius: '8px',
    padding: '12px'
  }
}

export interface EnterpriseBarChartProps {
  data: ChartDataPoint[]
  dataKeys: string[]
  colors?: string[]
  height?: number
}

export const EnterpriseBarChart: React.FC<EnterpriseBarChartProps> = ({
  data,
  dataKeys,
  colors = [CHART_COLORS.gold, CHART_COLORS.silver, CHART_COLORS.bronze, CHART_COLORS.maroon],
  height = 300
}) => {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={CHART_CONFIG.margin}>
        <CartesianGrid {...CHART_CONFIG.gridStyle} />
        <XAxis dataKey="name" {...CHART_CONFIG.axisStyle} />
        <YAxis {...CHART_CONFIG.axisStyle} />
        <Tooltip
          contentStyle={CHART_CONFIG.tooltipStyle}
          labelStyle={{ color: '#FFFFFF', fontWeight: 600 }}
          itemStyle={{ color: '#A0A0A0' }}
        />
        <Legend wrapperStyle={{ color: '#A0A0A0' }} />
        {dataKeys.map((key, index) => (
          <Bar
            key={key}
            dataKey={key}
            fill={colors[index % colors.length]}
            radius={[8, 8, 0, 0]}
          />
        ))}
      </BarChart>
    </ResponsiveContainer>
  )
}

export interface EnterpriseLineChartProps {
  data: ChartDataPoint[]
  dataKeys: string[]
  colors?: string[]
  height?: number
}

export const EnterpriseLineChart: React.FC<EnterpriseLineChartProps> = ({
  data,
  dataKeys,
  colors = [CHART_COLORS.gold, CHART_COLORS.silver, CHART_COLORS.bronze, CHART_COLORS.maroon],
  height = 300
}) => {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={CHART_CONFIG.margin}>
        <CartesianGrid {...CHART_CONFIG.gridStyle} />
        <XAxis dataKey="name" {...CHART_CONFIG.axisStyle} />
        <YAxis {...CHART_CONFIG.axisStyle} />
        <Tooltip
          contentStyle={CHART_CONFIG.tooltipStyle}
          labelStyle={{ color: '#FFFFFF', fontWeight: 600 }}
          itemStyle={{ color: '#A0A0A0' }}
        />
        <Legend wrapperStyle={{ color: '#A0A0A0' }} />
        {dataKeys.map((key, index) => (
          <Line
            key={key}
            type="monotone"
            dataKey={key}
            stroke={colors[index % colors.length]}
            strokeWidth={2}
            dot={{ fill: colors[index % colors.length], r: 4 }}
            activeDot={{ r: 6 }}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  )
}

export interface EnterpriseAreaChartProps {
  data: ChartDataPoint[]
  dataKeys: string[]
  colors?: string[]
  height?: number
}

export const EnterpriseAreaChart: React.FC<EnterpriseAreaChartProps> = ({
  data,
  dataKeys,
  colors = [CHART_COLORS.gold, CHART_COLORS.silver, CHART_COLORS.bronze, CHART_COLORS.maroon],
  height = 300
}) => {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={CHART_CONFIG.margin}>
        <defs>
          {dataKeys.map((key, index) => (
            <linearGradient key={key} id={`gradient-${key}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={colors[index % colors.length]} stopOpacity={0.3} />
              <stop offset="95%" stopColor={colors[index % colors.length]} stopOpacity={0} />
            </linearGradient>
          ))}
        </defs>
        <CartesianGrid {...CHART_CONFIG.gridStyle} />
        <XAxis dataKey="name" {...CHART_CONFIG.axisStyle} />
        <YAxis {...CHART_CONFIG.axisStyle} />
        <Tooltip
          contentStyle={CHART_CONFIG.tooltipStyle}
          labelStyle={{ color: '#FFFFFF', fontWeight: 600 }}
          itemStyle={{ color: '#A0A0A0' }}
        />
        <Legend wrapperStyle={{ color: '#A0A0A0' }} />
        {dataKeys.map((key, index) => (
          <Area
            key={key}
            type="monotone"
            dataKey={key}
            stroke={colors[index % colors.length]}
            strokeWidth={2}
            fill={`url(#gradient-${key})`}
          />
        ))}
      </AreaChart>
    </ResponsiveContainer>
  )
}

export interface EnterprisePieChartProps {
  data: ChartDataPoint[]
  colors?: string[]
  height?: number
  innerRadius?: number
}

export const EnterprisePieChart: React.FC<EnterprisePieChartProps> = ({
  data,
  colors = [CHART_COLORS.gold, CHART_COLORS.silver, CHART_COLORS.bronze, CHART_COLORS.maroon, CHART_COLORS.cyan],
  height = 300,
  innerRadius = 0
}) => {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <PieChart>
        <Pie
          data={data}
          cx="50%"
          cy="50%"
          labelLine={false}
          label={({ name, percent }) => `${name}: ${((percent ?? 0) * 100).toFixed(0)}%`}
          outerRadius={80}
          innerRadius={innerRadius}
          fill="#8884d8"
          dataKey="value"
        >
          {data.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
          ))}
        </Pie>
        <Tooltip
          contentStyle={CHART_CONFIG.tooltipStyle}
          itemStyle={{ color: '#FFFFFF' }}
        />
      </PieChart>
    </ResponsiveContainer>
  )
}

export interface SystemHealthWidgetProps {
  status: 'healthy' | 'warning' | 'critical'
  uptime: string
  requests: number
  errors: number
}

export const SystemHealthWidget: React.FC<SystemHealthWidgetProps> = ({
  status,
  uptime,
  requests,
  errors
}) => {
  const statusColors = {
    healthy: CHART_COLORS.green,
    warning: '#F59E0B',
    critical: '#EF4444'
  }

  return (
    <div className="p-6 rounded-xl bg-card backdrop-blur-xl border border-border-subtle">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider">System Health</h3>
        <div 
          className="w-3 h-3 rounded-full animate-pulse"
          style={{ backgroundColor: statusColors[status] }}
        />
      </div>
      <div className="grid grid-cols-3 gap-4">
        <div>
          <p className="text-xs text-muted-foreground mb-1">Uptime</p>
          <p className="text-lg font-bold text-foreground">{uptime}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground mb-1">Requests</p>
          <p className="text-lg font-bold text-foreground">{requests.toLocaleString()}</p>
        </div>
        <div>
          <p className="text-xs text-muted-foreground mb-1">Errors</p>
          <p className="text-lg font-bold text-destructive">{errors}</p>
        </div>
      </div>
    </div>
  )
}

export interface AgentStatusPanelProps {
  agents: Array<{
    id: string
    name: string
    status: 'active' | 'idle' | 'error'
    tasksCompleted: number
  }>
}

export const AgentStatusPanel: React.FC<AgentStatusPanelProps> = ({ agents }) => {
  const statusColors = {
    active: CHART_COLORS.green,
    idle: CHART_COLORS.slate,
    error: '#EF4444'
  }

  return (
    <div className="p-6 rounded-xl bg-card backdrop-blur-xl border border-border-subtle">
      <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider mb-4">Agent Status</h3>
      <div className="space-y-3">
        {agents.map((agent) => (
          <div key={agent.id} className="flex items-center justify-between p-3 rounded-lg bg-background/50">
            <div className="flex items-center gap-3">
              <div 
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: statusColors[agent.status] }}
              />
              <span className="text-sm font-medium text-foreground">{agent.name}</span>
            </div>
            <span className="text-xs text-muted-foreground">{agent.tasksCompleted} tasks</span>
          </div>
        ))}
      </div>
    </div>
  )
}

export interface PipelineFlowProps {
  stages: Array<{
    name: string
    count: number
    color?: string
  }>
}

export const PipelineFlow: React.FC<PipelineFlowProps> = ({ stages }) => {
  const maxCount = Math.max(...stages.map(s => s.count))

  return (
    <div className="p-6 rounded-xl bg-card backdrop-blur-xl border border-border-subtle">
      <h3 className="text-sm font-semibold text-foreground uppercase tracking-wider mb-4">Pipeline Flow</h3>
      <div className="space-y-4">
        {stages.map((stage, _index) => {
          const percentage = (stage.count / maxCount) * 100
          const color = stage.color || CHART_COLORS.gold

          return (
            <div key={stage.name}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-foreground">{stage.name}</span>
                <span className="text-sm font-bold text-foreground">{stage.count}</span>
              </div>
              <div className="h-2 bg-background rounded-full overflow-hidden">
                <div 
                  className="h-full transition-all duration-500 rounded-full"
                  style={{ 
                    width: `${percentage}%`,
                    backgroundColor: color,
                    boxShadow: `0 0 8px ${color}40`
                  }}
                />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
