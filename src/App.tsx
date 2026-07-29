import { useStore } from './store/useStore'
import { CaseKanban } from './components/CaseKanban/CaseKanban'
import { TaskKanban } from './components/TaskKanban/TaskKanban'
import { SkipStageModal } from './components/SkipStageModal'
import { AuditDrawer } from './components/AuditDrawer'
import { CaseDetail } from './components/CaseDetail/CaseDetail'
import { Scale, AlertTriangle, CheckSquare, Briefcase } from 'lucide-react'

function Stat({
  label,
  value,
  icon: Icon,
  highlight,
}: {
  label: string
  value: number
  icon: React.ElementType
  highlight?: 'red' | 'amber' | 'blue'
}) {
  const valueColor =
    highlight === 'red'
      ? 'text-red-600'
      : highlight === 'amber'
      ? 'text-amber-600'
      : highlight === 'blue'
      ? 'text-blue-600'
      : 'text-ink'

  const iconColor =
    highlight === 'red'
      ? 'text-red-500'
      : highlight === 'amber'
      ? 'text-amber-500'
      : highlight === 'blue'
      ? 'text-blue-500'
      : 'text-ink-faint'

  return (
    <div className="stat-card">
      <div className="flex items-center gap-1.5 mb-0.5">
        <Icon size={12} className={iconColor} />
        <p className={`text-base font-bold tabular-nums leading-none ${valueColor}`}>{value}</p>
      </div>
      <p className="text-[10px] text-ink-faint leading-tight">{label}</p>
    </div>
  )
}

function Header() {
  const { cases, tasks } = useStore()
  const now = new Date()
  const overdueTasks = tasks.filter(
    (t) => t.status !== 'done' && t.dueDate && new Date(t.dueDate) < now,
  ).length
  const blockedTasks = tasks.filter((t) => t.status === 'blocked').length
  const activeCases = cases.filter((c) => c.stage !== 'closed').length

  return (
    <header
      className="flex items-center justify-between px-5 py-3 flex-shrink-0"
      style={{
        background: 'linear-gradient(90deg, #fffcfb 0%, #fdf6f4 40%, #fdf6f4 60%, #fffcfb 100%)',
        borderBottom: '1px solid rgba(140, 90, 80, 0.14)',
        boxShadow: '0 1px 16px rgba(120, 70, 60, 0.06)',
      }}
    >
      {/* Brand */}
      <div className="flex items-center gap-3">
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{
            background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)',
            boxShadow: '0 0 16px rgba(99,102,241,0.5), inset 0 1px 0 rgba(255,255,255,0.15)',
          }}
        >
          <Scale size={16} className="text-white" />
        </div>
        <div>
          <h1 className="text-sm font-bold text-ink leading-tight tracking-wide">
            Case Control
          </h1>
          <p className="text-[10px] text-indigo-500/80 leading-tight">Law Firm Workflow Dashboard</p>
        </div>
      </div>

      {/* Global stats */}
      <div className="flex items-center gap-2">
        <Stat label="Active Cases" value={activeCases} icon={Briefcase} highlight="blue" />
        <Stat
          label="Overdue Tasks"
          value={overdueTasks}
          icon={AlertTriangle}
          highlight={overdueTasks > 0 ? 'red' : undefined}
        />
        <Stat
          label="Blocked Tasks"
          value={blockedTasks}
          icon={CheckSquare}
          highlight={blockedTasks > 0 ? 'amber' : undefined}
        />
      </div>
    </header>
  )
}

function Boards() {
  return (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Case Workflow Board */}
      <div
        className="flex flex-col"
        style={{ flex: '0 0 55%', minHeight: 0, borderBottom: '1px solid var(--line)' }}
      >
        <CaseKanban />
      </div>

      {/* Task Board */}
      <div className="flex flex-col" style={{ flex: '0 0 45%', minHeight: 0 }}>
        <TaskKanban />
      </div>
    </div>
  )
}

function App() {
  const detailCaseId = useStore((s) => s.detailCaseId)

  return (
    <div className="flex flex-col h-screen overflow-hidden" style={{ background: 'var(--cream)' }}>
      <Header />

      {/* Case detail page replaces the boards when a case is opened */}
      <div className="flex flex-col flex-1 min-h-0">
        {detailCaseId ? <CaseDetail /> : <Boards />}
      </div>

      {/* Modals & Drawers */}
      <SkipStageModal />
      <AuditDrawer />
    </div>
  )
}

export default App
