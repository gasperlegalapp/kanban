import { X, ArrowRight, SkipForward, FileText } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import { useStore } from '../store/useStore'
import { STAGE_MAP } from '../data/stages'
import type { AuditEntry } from '../types'

function EntryRow({ entry }: { entry: AuditEntry }) {
  const isSkip = entry.type === 'stage_skip'
  const fromStage = entry.fromStage ? STAGE_MAP.get(entry.fromStage) : null
  const toStage = entry.toStage ? STAGE_MAP.get(entry.toStage) : null

  return (
    <div className="flex gap-3 pb-4 relative">
      {/* Timeline dot */}
      <div className="flex flex-col items-center flex-shrink-0">
        <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 z-10 ${
          isSkip ? 'bg-amber-500/20 border border-amber-500/40' : 'bg-blue-500/15 border border-blue-500/30'
        }`}>
          {isSkip
            ? <SkipForward size={13} className="text-amber-600" />
            : <ArrowRight size={13} className="text-blue-600" />
          }
        </div>
        <div className="w-px flex-1 bg-[var(--line)] mt-1" />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0 pb-1">
        <div className="flex items-start justify-between gap-2 mb-1">
          <p className="text-xs font-medium text-ink">{entry.description}</p>
          {isSkip && (
            <span className="badge bg-amber-100 text-amber-600 flex-shrink-0">Skip</span>
          )}
        </div>

        {fromStage && toStage && (
          <div className="flex items-center gap-1.5 mb-1">
            <span className={`text-[11px] font-medium ${fromStage.textColor}`}>{fromStage.label}</span>
            <ArrowRight size={10} className="text-ink-faint" />
            <span className={`text-[11px] font-medium ${toStage.textColor}`}>{toStage.label}</span>
          </div>
        )}

        {entry.reason && (
          <div className="bg-amber-50 border border-amber-300/70 rounded p-2 mb-1">
            <div className="flex items-start gap-1.5">
              <FileText size={10} className="text-amber-600 mt-0.5 flex-shrink-0" />
              <p className="text-[11px] text-amber-800">{entry.reason}</p>
            </div>
          </div>
        )}

        <p className="text-[10px] text-ink-faint">
          {entry.actor} · {format(parseISO(entry.timestamp), 'MMM d, yyyy h:mm a')}
        </p>
      </div>
    </div>
  )
}

export function AuditDrawer() {
  const { auditDrawerOpen, auditDrawerCaseId, closeAuditDrawer, auditLog, cases } = useStore()

  if (!auditDrawerOpen) return null

  const c = cases.find((x) => x.id === auditDrawerCaseId)
  const entries = auditLog
    .filter((e) => e.caseId === auditDrawerCaseId)
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())

  return (
    <div className="fixed inset-0 z-40 flex justify-end">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40"
        onClick={closeAuditDrawer}
      />

      {/* Drawer */}
      <div className="relative bg-surface-1 border-l border-[var(--line)] w-80 flex flex-col h-full shadow-2xl">
        {/* Header */}
        <div className="flex items-start justify-between p-4 border-b border-[var(--line-soft)] flex-shrink-0">
          <div>
            <h3 className="text-sm font-semibold text-ink">Audit Log</h3>
            {c && (
              <p className="text-[11px] text-ink-muted mt-0.5">
                {c.caseNumber} — {c.title}
              </p>
            )}
          </div>
          <button onClick={closeAuditDrawer} className="btn-ghost p-1">
            <X size={16} />
          </button>
        </div>

        {/* Entries */}
        <div className="flex-1 overflow-y-auto p-4">
          {entries.length === 0 ? (
            <p className="text-xs text-ink-faint text-center py-8">No audit entries yet.</p>
          ) : (
            entries.map((entry) => <EntryRow key={entry.id} entry={entry} />)
          )}
        </div>
      </div>
    </div>
  )
}
