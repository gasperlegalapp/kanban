import { useEffect } from 'react'
import {
  ArrowLeft,
  ArrowRight,
  Clock,
  CheckSquare,
  AlertCircle,
  Eye,
  History,
  Check,
  Circle,
  User,
  Calendar,
  Tag,
  SkipForward,
  FileText,
} from 'lucide-react'
import { format, formatDistanceToNow, parseISO, isPast } from 'date-fns'
import { useStore } from '../../store/useStore'
import { STAGES, STAGE_MAP } from '../../data/stages'
import { TASK_COLUMNS } from '../TaskKanban/TaskColumn'
import { HealthDot } from '../shared/HealthDot'
import { PriorityBadge } from '../shared/PriorityBadge'
import type { Task, TaskStatus, AuditEntry, CaseStageId } from '../../types'

// ─── Small building blocks ───────────────────────────────────────────────────

function MetricTile({
  icon: Icon,
  value,
  label,
  warn,
}: {
  icon: React.ElementType
  value: number
  label: string
  warn?: boolean
}) {
  const color = warn && value > 0 ? 'text-red-600' : 'text-ink'
  const iconColor = warn && value > 0 ? 'text-red-500' : 'text-ink-muted'
  return (
    <div
      className="flex flex-col gap-1 rounded-lg px-4 py-3"
      style={{
        background: '#fffcfb',
        border: '1px solid var(--line)',
      }}
    >
      <div className="flex items-center gap-1.5">
        <Icon size={13} className={iconColor} />
        <span className={`text-xl font-bold tabular-nums leading-none ${color}`}>{value}</span>
      </div>
      <span className="text-[10px] uppercase tracking-wide text-ink-muted">{label}</span>
    </div>
  )
}

function Section({
  title,
  action,
  children,
}: {
  title: string
  action?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <section
      className="rounded-xl overflow-hidden"
      style={{
        background: 'linear-gradient(180deg, #fffcfb 0%, #f9f1ef 100%)',
        border: '1px solid var(--line)',
        boxShadow: '0 4px 20px rgba(120, 70, 60, 0.07), inset 0 1px 0 rgba(255,255,255,0.7)',
      }}
    >
      <div
        className="flex items-center justify-between px-4 py-2.5"
        style={{ borderBottom: '1px solid var(--line-soft)' }}
      >
        <h3 className="text-xs font-semibold uppercase tracking-wide text-ink-muted">{title}</h3>
        {action}
      </div>
      <div className="p-4">{children}</div>
    </section>
  )
}

// ─── Stage pipeline ──────────────────────────────────────────────────────────

function StagePipeline({ currentStage }: { currentStage: CaseStageId }) {
  const currentIdx = STAGES.findIndex((s) => s.id === currentStage)

  return (
    <div className="flex items-center gap-1 overflow-x-auto pb-1">
      {STAGES.map((stage, i) => {
        const done = i < currentIdx
        const active = i === currentIdx
        return (
          <div key={stage.id} className="flex items-center gap-1 flex-shrink-0">
            <div
              className={`px-2.5 py-1 rounded-md text-[11px] font-medium whitespace-nowrap ${
                active
                  ? `${stage.accentBg} ${stage.textColor}`
                  : done
                  ? 'text-ink-muted'
                  : 'text-ink-ghost'
              }`}
              style={
                active
                  ? { border: '1px solid var(--line)' }
                  : { border: '1px solid transparent' }
              }
            >
              {done && <Check size={9} className="inline mr-1 text-emerald-500" />}
              {stage.label}
            </div>
            {i < STAGES.length - 1 && (
              <ArrowRight size={10} className="text-ink-ghost flex-shrink-0" />
            )}
          </div>
        )
      })}
    </div>
  )
}

// ─── Step checklist for the current stage ────────────────────────────────────

function StepChecklist({
  stageId,
  stepId,
  subStepId,
}: {
  stageId: CaseStageId
  stepId: string
  subStepId: string
}) {
  const stage = STAGE_MAP.get(stageId)
  if (!stage) return null

  const currentStepIdx = stage.steps.findIndex((s) => s.id === stepId)

  return (
    <div className="flex flex-col gap-3">
      {stage.steps.map((step, si) => {
        const stepDone = si < currentStepIdx
        const stepActive = si === currentStepIdx
        const currentSubIdx = stepActive
          ? step.subSteps.findIndex((ss) => ss.id === subStepId)
          : -1

        return (
          <div key={step.id}>
            <div className="flex items-center gap-2 mb-1.5">
              {stepDone ? (
                <Check size={12} className="text-emerald-500 flex-shrink-0" />
              ) : (
                <Circle
                  size={12}
                  className={stepActive ? 'text-indigo-500 flex-shrink-0' : 'text-ink-ghost flex-shrink-0'}
                />
              )}
              <span
                className={`text-xs font-medium ${
                  stepActive ? 'text-ink' : stepDone ? 'text-ink-muted' : 'text-ink-faint'
                }`}
              >
                {step.label}
              </span>
            </div>

            <div className="flex flex-col gap-1 pl-5">
              {step.subSteps.map((ss, ssi) => {
                const subDone = stepDone || (stepActive && ssi < currentSubIdx)
                const subActive = stepActive && ssi === currentSubIdx
                return (
                  <div key={ss.id} className="flex items-center gap-2">
                    <span
                      className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                        subDone ? 'bg-emerald-500' : subActive ? 'bg-indigo-400' : 'bg-ink-ghost'
                      }`}
                    />
                    <span
                      className={`text-[11px] ${
                        subActive
                          ? 'text-indigo-600 font-medium'
                          : subDone
                          ? 'text-ink-muted'
                          : 'text-ink-faint'
                      }`}
                    >
                      {ss.label}
                    </span>
                    {subActive && (
                      <span className="badge bg-indigo-100 text-indigo-700 text-[9px]">
                        Current
                      </span>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ─── Task row ────────────────────────────────────────────────────────────────

function TaskRow({ task }: { task: Task }) {
  const { moveTask } = useStore()
  const col = TASK_COLUMNS.find((c) => c.id === task.status)
  const overdue = task.status !== 'done' && task.dueDate && isPast(parseISO(task.dueDate))

  return (
    <div
      className="flex items-center gap-3 px-3 py-2 rounded-lg"
      style={{
        background: 'var(--cream-sunk)',
        border: '1px solid var(--line-soft)',
      }}
    >
      <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${col?.color ?? 'bg-gray-500'}`} />

      <div className="flex-1 min-w-0">
        <p
          className={`text-xs font-medium truncate ${
            task.status === 'done' ? 'text-ink-muted line-through' : 'text-ink'
          }`}
        >
          {task.title}
        </p>
        <p className="text-[10px] text-ink-faint truncate">
          {task.assignee}
          {task.dueDate && (
            <>
              {' · '}
              <span className={overdue ? 'text-red-600' : undefined}>
                due {format(parseISO(task.dueDate), 'MMM d')}
              </span>
            </>
          )}
        </p>
      </div>

      <PriorityBadge priority={task.priority} />

      <select
        value={task.status}
        onChange={(e) => moveTask(task.id, e.target.value as TaskStatus)}
        className="filter-select text-[11px] py-1 px-1.5 flex-shrink-0"
        title="Change status"
      >
        {TASK_COLUMNS.map((c) => (
          <option key={c.id} value={c.id}>
            {c.label}
          </option>
        ))}
      </select>
    </div>
  )
}

// ─── Activity timeline ───────────────────────────────────────────────────────

function ActivityRow({ entry }: { entry: AuditEntry }) {
  const isSkip = entry.type === 'stage_skip'
  const fromStage = entry.fromStage ? STAGE_MAP.get(entry.fromStage) : null
  const toStage = entry.toStage ? STAGE_MAP.get(entry.toStage) : null

  return (
    <div className="flex gap-3 pb-3">
      <div className="flex flex-col items-center flex-shrink-0">
        <div
          className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${
            isSkip
              ? 'bg-amber-500/20 border border-amber-500/40'
              : 'bg-blue-500/15 border border-blue-500/30'
          }`}
        >
          {isSkip ? (
            <SkipForward size={11} className="text-amber-600" />
          ) : (
            <ArrowRight size={11} className="text-blue-600" />
          )}
        </div>
        <div className="w-px flex-1 bg-[var(--line)] mt-1" />
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-xs text-ink">{entry.description}</p>
        {fromStage && toStage && (
          <div className="flex items-center gap-1.5 mt-0.5">
            <span className={`text-[10px] font-medium ${fromStage.textColor}`}>
              {fromStage.label}
            </span>
            <ArrowRight size={9} className="text-ink-faint" />
            <span className={`text-[10px] font-medium ${toStage.textColor}`}>{toStage.label}</span>
          </div>
        )}
        {entry.reason && (
          <div className="bg-amber-50 border border-amber-300/70 rounded p-1.5 mt-1">
            <div className="flex items-start gap-1.5">
              <FileText size={9} className="text-amber-600 mt-0.5 flex-shrink-0" />
              <p className="text-[10px] text-amber-800">{entry.reason}</p>
            </div>
          </div>
        )}
        <p className="text-[10px] text-ink-faint mt-0.5">
          {entry.actor} · {format(parseISO(entry.timestamp), 'MMM d, yyyy h:mm a')}
        </p>
      </div>
    </div>
  )
}

// ─── Page ────────────────────────────────────────────────────────────────────

export function CaseDetail() {
  const {
    detailCaseId,
    closeCaseDetail,
    cases,
    tasks,
    auditLog,
    getMetrics,
    openAuditDrawer,
    openSkipModal,
    moveCase,
  } = useStore()

  // Escape closes the page
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeCaseDetail()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [closeCaseDetail])

  const c = cases.find((x) => x.id === detailCaseId)
  if (!c) return null

  const m = getMetrics(c.id)
  const stage = STAGE_MAP.get(c.stage)
  const caseTasks = tasks.filter((t) => t.caseId === c.id)
  const entries = auditLog
    .filter((e) => e.caseId === c.id)
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())

  const currentIdx = STAGES.findIndex((s) => s.id === c.stage)
  const prevStage = currentIdx > 0 ? STAGES[currentIdx - 1] : null
  const nextStage = currentIdx < STAGES.length - 1 ? STAGES[currentIdx + 1] : null

  const advance = (toStage: (typeof STAGES)[number]) => {
    const skip = Math.abs(STAGES.findIndex((s) => s.id === toStage.id) - currentIdx) > 1
    if (skip) openSkipModal(c.id, toStage.id)
    else moveCase(c.id, toStage.id)
  }

  // Open tasks first, then done; overdue floats to the top
  const sortedTasks = [...caseTasks].sort((a, b) => {
    const aDone = a.status === 'done' ? 1 : 0
    const bDone = b.status === 'done' ? 1 : 0
    if (aDone !== bDone) return aDone - bDone
    return (a.dueDate ?? '').localeCompare(b.dueDate ?? '')
  })

  return (
    <div className="flex flex-col h-full min-h-0 overflow-y-auto">
      {/* ─── Page header ─────────────────────────────────────────────────── */}
      <div
        className="flex items-start justify-between gap-4 px-6 py-4 flex-shrink-0"
        style={{ borderBottom: '1px solid var(--line)' }}
      >
        <div className="flex items-start gap-4 min-w-0">
          <button onClick={closeCaseDetail} className="btn-ghost p-2 mt-0.5 flex-shrink-0" title="Back to boards (Esc)">
            <ArrowLeft size={16} />
          </button>

          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <HealthDot health={m.health} size="md" />
              <span className="text-[11px] font-mono text-ink-muted">{c.caseNumber}</span>
              {stage && (
                <span className={`badge ${stage.accentBg} ${stage.textColor}`}>{stage.label}</span>
              )}
            </div>
            <h2 className="text-lg font-bold text-ink leading-tight">{c.title}</h2>
            <p className="text-xs text-ink-muted mt-0.5">{c.client}</p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          <button onClick={() => openAuditDrawer(c.id)} className="btn-ghost text-xs gap-1.5">
            <History size={13} />
            Audit log
          </button>
          {prevStage && (
            <button onClick={() => advance(prevStage)} className="btn-ghost text-xs gap-1.5" title={`Move back to ${prevStage.label}`}>
              <ArrowLeft size={13} />
              {prevStage.label}
            </button>
          )}
          {nextStage && (
            <button onClick={() => advance(nextStage)} className="btn-primary text-xs gap-1.5" title={`Advance to ${nextStage.label}`}>
              {nextStage.label}
              <ArrowRight size={13} />
            </button>
          )}
        </div>
      </div>

      {/* ─── Body ────────────────────────────────────────────────────────── */}
      <div className="flex-1 px-6 py-5 flex flex-col gap-5">
        {/* Metrics */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <MetricTile
            icon={Clock}
            value={m.daysInStage}
            label="Days in stage"
            warn={m.daysInStage >= (stage?.stuckThresholdDays ?? 999)}
          />
          <MetricTile icon={CheckSquare} value={m.openTasks} label="Open tasks" />
          <MetricTile icon={AlertCircle} value={m.overdueTasks} label="Overdue" warn />
          <MetricTile icon={Eye} value={m.reviewTasks} label="In review" />
        </div>

        {/* Stage progress */}
        <Section title="Workflow position">
          <div className="flex flex-col gap-4">
            <StagePipeline currentStage={c.stage} />
            <div style={{ borderTop: '1px solid var(--line-soft)' }} className="pt-4">
              <StepChecklist stageId={c.stage} stepId={c.stepId} subStepId={c.subStepId} />
            </div>
          </div>
        </Section>

        {/* Two-column: details + activity */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <Section title="Case details">
            <dl className="flex flex-col gap-3">
              <div className="flex items-center gap-2">
                <User size={12} className="text-ink-faint flex-shrink-0" />
                <dt className="text-[11px] text-ink-muted w-28 flex-shrink-0">Responsible</dt>
                <dd className="text-xs text-ink truncate">{c.owner}</dd>
              </div>
              <div className="flex items-center gap-2">
                <Calendar size={12} className="text-ink-faint flex-shrink-0" />
                <dt className="text-[11px] text-ink-muted w-28 flex-shrink-0">Stage entered</dt>
                <dd className="text-xs text-ink truncate">
                  {format(parseISO(c.stageEnteredAt), 'MMM d, yyyy')}
                  <span className="text-ink-faint">
                    {' '}
                    ({formatDistanceToNow(parseISO(c.stageEnteredAt), { addSuffix: true })})
                  </span>
                </dd>
              </div>
              <div className="flex items-center gap-2">
                <Clock size={12} className="text-ink-faint flex-shrink-0" />
                <dt className="text-[11px] text-ink-muted w-28 flex-shrink-0">Last activity</dt>
                <dd className="text-xs text-ink truncate">
                  {formatDistanceToNow(parseISO(c.lastActivity), { addSuffix: true })}
                </dd>
              </div>
              {c.tags.length > 0 && (
                <div className="flex items-start gap-2">
                  <Tag size={12} className="text-ink-faint flex-shrink-0 mt-0.5" />
                  <dt className="text-[11px] text-ink-muted w-28 flex-shrink-0">Tags</dt>
                  <dd className="flex flex-wrap gap-1">
                    {c.tags.map((t) => (
                      <span key={t} className="badge bg-[var(--cream-sunk)] border border-[var(--line-soft)] text-ink-muted text-[10px]">
                        {t}
                      </span>
                    ))}
                  </dd>
                </div>
              )}
            </dl>
          </Section>

          <Section title="Recent activity">
            {entries.length === 0 ? (
              <p className="text-xs text-ink-faint py-4 text-center">No activity recorded yet.</p>
            ) : (
              <div className="flex flex-col">
                {entries.slice(0, 5).map((e) => (
                  <ActivityRow key={e.id} entry={e} />
                ))}
                {entries.length > 5 && (
                  <button
                    onClick={() => openAuditDrawer(c.id)}
                    className="text-[11px] text-indigo-600 hover:text-indigo-700 self-start mt-1"
                  >
                    View all {entries.length} entries →
                  </button>
                )}
              </div>
            )}
          </Section>
        </div>

        {/* Tasks */}
        <Section
          title="Tasks"
          action={
            <span className="text-[11px] text-ink-muted">
              {m.openTasks} open · {caseTasks.length} total
            </span>
          }
        >
          {sortedTasks.length === 0 ? (
            <p className="text-xs text-ink-faint py-4 text-center">No tasks on this case.</p>
          ) : (
            <div className="flex flex-col gap-1.5">
              {sortedTasks.map((t) => (
                <TaskRow key={t.id} task={t} />
              ))}
            </div>
          )}
        </Section>
      </div>
    </div>
  )
}
