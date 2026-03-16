import { Image, VideoCamera, User, Spinner } from '@phosphor-icons/react'
import type { MediaCanvasData } from '@/types/canvas'

interface MediaCanvasContentProps {
  data: MediaCanvasData
}

const mediaIcons = {
  logo: Image,
  avatar: User,
  video: VideoCamera,
  image: Image
}

const mediaTitles = {
  logo: 'Logo Preview',
  avatar: 'AI Avatar',
  video: 'Video Player',
  image: 'Image Viewer'
}

export function MediaCanvasContent({ data }: MediaCanvasContentProps) {
  const Icon = mediaIcons[data.type]
  const title = mediaTitles[data.type]

  return (
    <div className="h-full flex items-center justify-center bg-black/40 p-8">
      {data.status === 'loading' ? (
        <div className="text-center space-y-4">
          <Spinner size={48} className="mx-auto text-primary animate-spin" />
          <p className="text-sm text-muted-foreground">Loading {data.type}...</p>
        </div>
      ) : data.status === 'error' ? (
        <div className="text-center space-y-4">
          <Icon size={64} weight="duotone" className="mx-auto text-destructive opacity-50" />
          <div>
            <p className="text-sm font-medium text-destructive">Failed to load {data.type}</p>
            <p className="text-xs text-muted-foreground mt-1">Please try again</p>
          </div>
        </div>
      ) : data.url ? (
        <div className="w-full h-full flex flex-col">
          <div className="flex-1 flex items-center justify-center">
            {data.type === 'video' ? (
              <video 
                src={data.url} 
                controls 
                className="max-w-full max-h-full rounded-lg shadow-2xl"
              >
                Your browser does not support the video tag.
              </video>
            ) : (
              <img 
                src={data.url} 
                alt={title}
                className="max-w-full max-h-full object-contain rounded-lg shadow-2xl"
              />
            )}
          </div>
        </div>
      ) : (
        <div className="text-center space-y-4">
          <Icon size={64} weight="duotone" className="mx-auto text-muted-foreground opacity-50" />
          <div>
            <p className="text-sm font-medium">{title}</p>
            <p className="text-xs text-muted-foreground mt-1">No {data.type} to display</p>
          </div>
        </div>
      )}
    </div>
  )
}
