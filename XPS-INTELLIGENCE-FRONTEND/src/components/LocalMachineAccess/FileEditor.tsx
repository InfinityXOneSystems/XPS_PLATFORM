import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, FloppyDisk, FileText } from '@phosphor-icons/react'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { readFile, writeFile } from '@/services/localMachineService'

interface FileEditorProps {
  open: boolean
  onClose: () => void
  filePath?: string
}

export function FileEditor({ open, onClose, filePath }: FileEditorProps) {
  const [content, setContent] = useState('')
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [dirty, setDirty] = useState(false)

  useEffect(() => {
    if (open && filePath) {
      readFile(filePath).then(result => {
        setContent(result.content)
        setLoading(false)
        setDirty(false)
      })
    }
  }, [open, filePath])

  const handleSave = async () => {
    if (!filePath) return
    setSaving(true)
    await writeFile(filePath, content)
    setSaving(false)
    setDirty(false)
    toast.success('File saved')
  }

  const handleChange = (value: string) => {
    setContent(value)
    setDirty(true)
  }

  return (
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="w-full max-w-3xl mx-4 bg-background border border-white/12 rounded-2xl shadow-2xl flex flex-col"
            style={{ maxHeight: '85vh' }}
          >
            {/* Header */}
            <div className="flex items-center gap-3 p-4 border-b border-white/8 shrink-0">
              <FileText size={18} className="text-blue-400" />
              <div className="flex-1 min-w-0">
                <h2 className="text-base font-bold text-white">File Editor</h2>
                {filePath && (
                  <p className="text-xs font-mono text-white/40 truncate">{filePath}</p>
                )}
              </div>
              {dirty && (
                <span className="text-xs text-yellow-400 px-2 py-0.5 rounded-full bg-yellow-500/10 border border-yellow-500/20">
                  unsaved
                </span>
              )}
              <button onClick={onClose} className="text-white/40 hover:text-white transition-colors ml-2">
                <X size={20} />
              </button>
            </div>

            {/* Editor */}
            <div className="flex-1 overflow-hidden p-4">
              {loading ? (
                <div className="flex items-center justify-center h-full">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-400" />
                </div>
              ) : (
                <textarea
                  value={content}
                  onChange={e => handleChange(e.target.value)}
                  spellCheck={false}
                  className="w-full h-full bg-black/60 border border-white/15 rounded-lg text-white/90 font-mono text-xs p-4 resize-none focus:outline-none focus:ring-1 focus:ring-blue-500/50 leading-relaxed"
                  placeholder={filePath ? 'Loading...' : 'No file selected. Open a file from the File Browser.'}
                />
              )}
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-white/8 flex items-center justify-between shrink-0">
              <p className="text-xs text-white/30">
                {content.split('\n').length} lines · {content.length} chars
              </p>
              <div className="flex gap-2">
                <Button variant="outline" onClick={onClose} className="border-white/20 text-white/60 hover:bg-white/5">Cancel</Button>
                <Button
                  onClick={handleSave}
                  disabled={!filePath || !dirty || saving}
                  className="bg-blue-500/20 border border-blue-500/40 text-blue-300 hover:bg-blue-500/30 disabled:opacity-50"
                >
                  <FloppyDisk size={14} className="mr-2" />
                  {saving ? 'Saving...' : 'Save'}
                </Button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}
