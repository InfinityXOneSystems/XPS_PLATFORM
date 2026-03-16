import { BackButton } from '@/components/BackButton'

export function PlaceholderPage({ title, description, onNavigate }: { title: string; description: string; onNavigate: (page: string) => void }) {
  return (
    <div className="space-y-6">
      <BackButton onBack={() => onNavigate('home')} />
      <div>
        <h1 className="text-3xl font-bold">{title}</h1>
        <p className="text-muted-foreground mt-1">{description}</p>
      </div>
      <div className="glass-card p-12 rounded-lg text-center">
        <p className="text-lg text-muted-foreground">
          This feature is coming soon
        </p>
      </div>
    </div>
  )
}
