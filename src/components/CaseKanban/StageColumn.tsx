import { useState } from 'react'
import type { CaseStage, Case } from '../../types'
import { CaseCard } from './CaseCard'
import { useStore } from '../../store/useStore'

interface Props {
  stage: CaseStage
  cases: Case[]
  selectedCaseId: string | null
}

export function StageColumn({ stage, cases, selectedCaseId }: Props) {
  const { moveCase } = useStore()
  const [dragOver, setDragOver] = useState(false)

  const handleDragOver = (e: React.DragEvent) => {
    if (!e.dataTransfer.types.includes('caseid')) return
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
    setDragOver(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    // Ignore bubbling from children moving between each other
    if (e.currentTarget.contains(e.relatedTarget as Node)) return
    setDragOver(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const caseId = e.dataTransfer.getData('caseId')
    // moveCase routes multi-stage jumps through the skip-reason modal
    if (caseId) moveCase(caseId, stage.id)
  }

  const handleDragStart = (e: React.DragEvent, caseId: string) => {
    e.dataTransfer.setData('caseId', caseId)
    e.dataTransfer.effectAllowed = 'move'
  }

  return (
    <div
      className="kanban-col flex-shrink-0"
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      style={
        dragOver
          ? { borderColor: 'rgba(99,102,241,0.55)', background: 'var(--drop-wash)' }
          : undefined
      }
    >
      {/* Colored top accent bar */}
      <div className={`h-0.5 w-full ${stage.color}`} />

      {/* Column header with subtle stage-colored background */}
      <div className={`kanban-col-header ${stage.accentBg}`}>
        <div className="flex items-center gap-2 min-w-0">
          <span className={`w-2 h-2 rounded-full flex-shrink-0 ${stage.color}`} style={{ boxShadow: `0 0 6px currentColor` }} />
          <span className={`text-xs font-bold uppercase tracking-wider truncate ${stage.textColor}`}>
            {stage.label}
          </span>
        </div>
        <span
          className={`text-xs font-semibold px-1.5 py-0.5 rounded-full flex-shrink-0 ${stage.textColor}`}
          style={{ background: 'var(--pill-bg)' }}
        >
          {cases.length}
        </span>
      </div>

      {/* Cards */}
      <div className="flex flex-col gap-2 p-2 overflow-y-auto flex-1">
        {cases.length === 0 ? (
          <div
            className="text-center text-xs py-6 rounded-lg"
            style={{
              color: dragOver ? '#6366f1' : 'var(--ink-ghost)',
              border: `1px dashed ${dragOver ? 'rgba(99,102,241,0.55)' : 'var(--line)'}`,
            }}
          >
            {dragOver ? 'Drop here' : 'No cases'}
          </div>
        ) : (
          cases.map((c) => (
            <div
              key={c.id}
              draggable
              onDragStart={(e) => handleDragStart(e, c.id)}
              className="cursor-grab active:cursor-grabbing"
            >
              <CaseCard c={c} selected={selectedCaseId === c.id} />
            </div>
          ))
        )}
      </div>
    </div>
  )
}
