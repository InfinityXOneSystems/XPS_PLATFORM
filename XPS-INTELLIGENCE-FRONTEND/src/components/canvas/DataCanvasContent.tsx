import { useState } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from 'recharts'
import type { DataCanvasData } from '@/types/canvas'

interface DataCanvasContentProps {
  data: DataCanvasData
}

const sampleChartData = [
  { name: 'Jan', value: 4000, leads: 240 },
  { name: 'Feb', value: 3000, leads: 139 },
  { name: 'Mar', value: 2000, leads: 980 },
  { name: 'Apr', value: 2780, leads: 390 },
  { name: 'May', value: 1890, leads: 480 },
  { name: 'Jun', value: 2390, leads: 380 },
]

const samplePieData = [
  { name: 'A+ Leads', value: 400 },
  { name: 'B Leads', value: 300 },
  { name: 'C Leads', value: 200 },
  { name: 'D Leads', value: 100 },
]

const COLORS = ['oklch(0.85 0.15 85)', 'oklch(0.65 0.08 220)', 'oklch(0.65 0.12 50)', 'oklch(0.55 0.01 250)']

export function DataCanvasContent({ data: _data }: DataCanvasContentProps) {
  const [vizType, setVizType] = useState<'bar' | 'line' | 'pie'>('bar')

  return (
    <div className="h-full flex flex-col p-8 bg-gradient-to-br from-black/20 via-transparent to-black/30">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Data Visualization</h2>
          <p className="text-sm text-muted-foreground mt-1">Interactive lead analytics</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setVizType('bar')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              vizType === 'bar'
                ? 'bg-primary text-primary-foreground'
                : 'bg-white/5 text-muted-foreground hover:bg-white/10'
            }`}
          >
            Bar Chart
          </button>
          <button
            onClick={() => setVizType('line')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              vizType === 'line'
                ? 'bg-primary text-primary-foreground'
                : 'bg-white/5 text-muted-foreground hover:bg-white/10'
            }`}
          >
            Line Chart
          </button>
          <button
            onClick={() => setVizType('pie')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              vizType === 'pie'
                ? 'bg-primary text-primary-foreground'
                : 'bg-white/5 text-muted-foreground hover:bg-white/10'
            }`}
          >
            Pie Chart
          </button>
        </div>
      </div>

      <div className="flex-1 glass-panel rounded-2xl p-6">
        {vizType === 'bar' && (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={sampleChartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
              <XAxis dataKey="name" stroke="rgba(255,255,255,0.5)" />
              <YAxis stroke="rgba(255,255,255,0.5)" />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'rgba(0,0,0,0.8)',
                  border: '1px solid rgba(255,255,255,0.2)',
                  borderRadius: '8px',
                }}
              />
              <Bar dataKey="value" fill="oklch(0.85 0.15 85)" radius={[8, 8, 0, 0]} />
              <Bar dataKey="leads" fill="oklch(0.65 0.08 220)" radius={[8, 8, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}

        {vizType === 'line' && (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={sampleChartData}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
              <XAxis dataKey="name" stroke="rgba(255,255,255,0.5)" />
              <YAxis stroke="rgba(255,255,255,0.5)" />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'rgba(0,0,0,0.8)',
                  border: '1px solid rgba(255,255,255,0.2)',
                  borderRadius: '8px',
                }}
              />
              <Line type="monotone" dataKey="value" stroke="oklch(0.85 0.15 85)" strokeWidth={3} />
              <Line type="monotone" dataKey="leads" stroke="oklch(0.65 0.08 220)" strokeWidth={3} />
            </LineChart>
          </ResponsiveContainer>
        )}

        {vizType === 'pie' && (
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={samplePieData}
                cx="50%"
                cy="50%"
                labelLine={false}
                label={(entry) => entry.name}
                outerRadius={150}
                fill="#8884d8"
                dataKey="value"
              >
                {samplePieData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  backgroundColor: 'rgba(0,0,0,0.8)',
                  border: '1px solid rgba(255,255,255,0.2)',
                  borderRadius: '8px',
                }}
              />
            </PieChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  )
}
