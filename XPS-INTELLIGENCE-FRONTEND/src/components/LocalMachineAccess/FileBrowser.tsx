import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  X,
  FolderOpen,
  ArrowLeft,
  House,
} from '@phosphor-icons/react'
import { Button } from '@/components/ui/button'
import { listFiles, type FileEntry } from '@/services/localMachineService'

interface FileBrowserProps {
  open: boolean
  onClose: () => void
  onFileSelect?: (path: string) => void
}

const FILE_ICONS: Record<string, string> = {
  ts: '🟦', tsx: '⚛️', js: '🟨', jsx: '⚛️', json: '📋', md: '📝',
  css: '🎨', html: '🌐', py: '🐍', sh: '⚙️', yaml: '📄', yml: '📄',
  txt: '📃', png: '🖼️', jpg: '🖼️', svg: '🎭', pdf: '📑',
}

function getFileIcon(entry: FileEntry): string {
  if (entry.type === 'directory') return '📁'
  return FILE_ICONS[entry.extension || ''] || '📄'
}

export function FileBrowser({ open, onClose, onFileSelect }: FileBrowserProps) {
  const [currentPath, setCurrentPath] = useState('/home/user/project')
  const [files, setFiles] = useState<FileEntry[]>([])
  const [loading, setLoading] = useState(false)
  const [history, setHistory] = useState<string[]>([])

  useEffect(() => {
    if (!open) return
    listFiles(currentPath).then(entries => {
      setFiles(entries)
      setLoading(false)
    })
  }, [open, currentPath])

  const navigateTo = (path: string) => {
    setHistory(prev => [...prev, currentPath])
    setCurrentPath(path)
  }

  const navigateBack = () => {
    const prev = history[history.length - 1]
    if (prev) {
      setHistory(h => h.slice(0, -1))
      setCurrentPath(prev)
    }
  }

  const navigateUp = () => {
    const parts = currentPath.split('/')
    if (parts.length > 1) {
      navigateTo(parts.slice(0, -1).join('/') || '/')
    }
  }

  const handleEntryClick = (entry: FileEntry) => {
    if (entry.type === 'directory') {
      navigateTo(entry.path)
    } else {
      onFileSelect?.(entry.path)
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="w-full max-w-2xl mx-4 bg-background border border-white/12 rounded-2xl shadow-2xl flex flex-col"
            style={{ maxHeight: '80vh' }}
          >
            {/* Header */}
            <div className="flex items-center gap-3 p-4 border-b border-white/8 shrink-0">
              <FolderOpen size={18} className="text-yellow-400" />
              <h2 className="text-base font-bold text-white flex-1">File Browser</h2>
              <button onClick={onClose} className="text-white/40 hover:text-white transition-colors">
                <X size={20} />
              </button>
            </div>

            {/* Toolbar */}
            <div className="flex items-center gap-2 px-4 py-2 border-b border-white/8 bg-black/20 shrink-0">
              <Button variant="ghost" size="sm" onClick={navigateBack} disabled={history.length === 0} className="h-7 px-2 text-white/60 hover:text-white">
                <ArrowLeft size={14} />
              </Button>
              <Button variant="ghost" size="sm" onClick={navigateUp} className="h-7 px-2 text-white/60 hover:text-white">
                <span className="text-white/60 text-sm">↑</span>
              </Button>
              <Button variant="ghost" size="sm" onClick={() => navigateTo('/home/user')} className="h-7 px-2 text-white/60 hover:text-white">
                <House size={14} />
              </Button>
              <div className="flex-1 px-3 py-1 rounded-md bg-black/40 border border-white/15 text-xs font-mono text-white/70 truncate">
                {currentPath}
              </div>
            </div>

            {/* File list */}
            <div className="flex-1 overflow-y-auto p-2">
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-yellow-400" />
                </div>
              ) : files.length === 0 ? (
                <div className="text-center py-12 text-white/30 text-sm">Empty directory</div>
              ) : (
                files.map(entry => (
                  <button
                    key={entry.path}
                    onClick={() => handleEntryClick(entry)}
                    className="w-full flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-white/5 transition-colors text-left group"
                  >
                    <span className="text-base shrink-0">{getFileIcon(entry)}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-white/90 truncate group-hover:text-white">{entry.name}</p>
                      {entry.type === 'file' && (
                        <p className="text-xs text-white/30">
                          {entry.size ? `${(entry.size / 1024).toFixed(1)} KB` : ''}{entry.modified ? ` · ${new Date(entry.modified).toLocaleDateString()}` : ''}
                        </p>
                      )}
                    </div>
                    {entry.type === 'file' && onFileSelect && (
                      <span className="text-xs text-yellow-400/60 opacity-0 group-hover:opacity-100 shrink-0">Select</span>
                    )}
                  </button>
                ))
              )}
            </div>

            <div className="p-4 border-t border-white/8 flex justify-end gap-2 shrink-0">
              <Button variant="outline" onClick={onClose} className="border-white/20 text-white/60 hover:bg-white/5">Close</Button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}
