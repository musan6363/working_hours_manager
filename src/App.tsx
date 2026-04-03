import { useEffect, useState } from 'react'
import './App.css'
import {
  calculateMonthlyAttendanceSummary,
  calculateWorkSummary,
  formatDuration,
  formatSignedDuration,
} from './lib/calculateWorkSummary'
import {
  DEFAULT_STANDARD_HOURS,
  clearDailyDraft,
  deleteAttendanceRecord,
  listAttendanceRecordsByMonth,
  loadAttendanceRecord,
  loadDailyDraft,
  loadStandardHours,
  saveAttendanceRecord,
  saveDailyDraft,
  saveStandardHours,
} from './lib/storage'
import type { DailyAttendanceDraft, DailyAttendanceRecord } from './types/attendance'

type AppScreen = 'daily' | 'monthly' | 'settings'

function isValidIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false
  }

  const [year, month, day] = value.split('-').map(Number)
  const date = new Date(`${value}T00:00:00`)

  return (
    !Number.isNaN(date.getTime()) &&
    date.getFullYear() === year &&
    date.getMonth() + 1 === month &&
    date.getDate() === day
  )
}

function getTodayIsoDate(): string {
  const now = new Date()
  const offset = now.getTimezoneOffset() * 60_000
  return new Date(now.getTime() - offset).toISOString().slice(0, 10)
}

function createEmptyDraft(date: string): DailyAttendanceDraft {
  return {
    date,
    clockIn: '',
    clockOut: '',
    breakMinutes: '60',
  }
}

function createDraftFromRecord(record: DailyAttendanceRecord): DailyAttendanceDraft {
  return {
    date: record.date,
    clockIn: record.clockIn,
    clockOut: record.clockOut,
    breakMinutes: record.breakMinutes,
  }
}

function getMonthKey(value: string): string {
  return isValidIsoDate(value) ? value.slice(0, 7) : ''
}

function formatDisplayDate(value: string): string {
  if (!isValidIsoDate(value)) {
    return '日付未選択'
  }

  return new Intl.DateTimeFormat('ja-JP', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    weekday: 'short',
  }).format(new Date(`${value}T00:00:00`))
}

function formatMonthLabel(value: string): string {
  if (!/^\d{4}-\d{2}$/.test(value)) {
    return '月未選択'
  }

  return new Intl.DateTimeFormat('ja-JP', {
    year: 'numeric',
    month: 'long',
  }).format(new Date(`${value}-01T00:00:00`))
}

function shiftMonth(date: string, delta: number): string {
  if (!isValidIsoDate(date)) {
    return getTodayIsoDate()
  }

  const [year, month] = date.slice(0, 7).split('-').map(Number)
  const baseDate = new Date(year, month - 1 + delta, 1)
  const nextYear = baseDate.getFullYear()
  const nextMonth = `${baseDate.getMonth() + 1}`.padStart(2, '0')

  return `${nextYear}-${nextMonth}-01`
}

export default function App() {
  const today = getTodayIsoDate()
  const [screen, setScreen] = useState<AppScreen>('daily')
  const [draft, setDraft] = useState<DailyAttendanceDraft>(() => {
    return loadDailyDraft() ?? createEmptyDraft(today)
  })
  const hasValidDraftDate = isValidIsoDate(draft.date)
  const [standardHours, setStandardHours] = useState<string>(() => loadStandardHours())
  const [monthlyRecords, setMonthlyRecords] = useState<DailyAttendanceRecord[]>([])
  const [isMonthLoading, setIsMonthLoading] = useState(false)
  const [storageError, setStorageError] = useState<string | null>(null)
  const [saveNotice, setSaveNotice] = useState<string | null>(null)
  const [recordsVersion, setRecordsVersion] = useState(0)

  useEffect(() => {
    saveDailyDraft(draft)
  }, [draft])

  useEffect(() => {
    saveStandardHours(standardHours)
  }, [standardHours])

  useEffect(() => {
    if (!hasValidDraftDate) {
      setMonthlyRecords([])
      setIsMonthLoading(false)
      setStorageError(null)
      return
    }

    let isCancelled = false

    async function loadMonthRecords() {
      setIsMonthLoading(true)

      try {
        const records = await listAttendanceRecordsByMonth(draft.date)

        if (!isCancelled) {
          setMonthlyRecords(records)
          setStorageError(null)
        }
      } catch {
        if (!isCancelled) {
          setMonthlyRecords([])
          setStorageError('履歴読込エラー')
        }
      } finally {
        if (!isCancelled) {
          setIsMonthLoading(false)
        }
      }
    }

    void loadMonthRecords()

    return () => {
      isCancelled = true
    }
  }, [draft.date, hasValidDraftDate, recordsVersion])

  const { summary, error } = calculateWorkSummary({
    ...draft,
    standardHours,
  })

  const monthlySummaryResult = hasValidDraftDate
    ? calculateMonthlyAttendanceSummary(monthlyRecords, standardHours, getMonthKey(draft.date))
    : { summary: null, error: null }
  const { summary: monthlySummary, error: monthlyError } = monthlySummaryResult

  function updateDraft<Key extends keyof DailyAttendanceDraft>(key: Key, value: DailyAttendanceDraft[Key]) {
    setSaveNotice(null)
    setDraft((currentDraft) => ({
      ...currentDraft,
      [key]: value,
    }))
  }

  async function loadDraftForDate(nextDate: string) {
    if (!isValidIsoDate(nextDate)) {
      setDraft((currentDraft) => ({
        ...currentDraft,
        date: nextDate,
      }))
      setStorageError(null)
      return
    }

    try {
      const savedRecord = await loadAttendanceRecord(nextDate)

      setDraft(savedRecord ? createDraftFromRecord(savedRecord) : createEmptyDraft(nextDate))
      setStorageError(null)
      setSaveNotice(null)
    } catch {
      setDraft(createEmptyDraft(nextDate))
      setStorageError('日別読込エラー')
      setSaveNotice(null)
    }
  }

  async function saveSelectedDay() {
    if (!hasValidDraftDate) {
      setStorageError('日付エラー')
      setSaveNotice(null)
      return
    }

    if (!summary || error) {
      setStorageError(error ?? '出退勤入力後')
      setSaveNotice(null)
      return
    }

    try {
      await saveAttendanceRecord({
        date: draft.date,
        clockIn: draft.clockIn,
        clockOut: draft.clockOut,
        breakMinutes: draft.breakMinutes,
      })

      setStorageError(null)
      setSaveNotice('保存済み')
      setRecordsVersion((currentValue) => currentValue + 1)
    } catch {
      setStorageError('履歴保存エラー')
      setSaveNotice(null)
    }
  }

  async function clearSelectedDay() {
    if (!isValidIsoDate(draft.date)) {
      setStorageError('削除対象なし')
      return
    }

    const confirmed = window.confirm('選択日の記録を削除します。')

    if (!confirmed) {
      return
    }

    try {
      await deleteAttendanceRecord(draft.date)
      setDraft(createEmptyDraft(draft.date))
      clearDailyDraft()
      setStorageError(null)
      setSaveNotice(null)
      setRecordsVersion((currentValue) => currentValue + 1)
    } catch {
      setStorageError('削除エラー')
    }
  }

  return (
    <main className="app-shell">
      <section className="hero-card">
        <p className="eyebrow">Working Hours Manager</p>
        <h1>勤怠管理</h1>
        <p className="hero-copy">当日入力。当月集計。端末保存。</p>
        <div className="hero-meta">
          <div className="date-badge">{formatDisplayDate(draft.date)}</div>
          <div className="hero-total">
            <span>当月残業</span>
            <strong>
              {monthlySummary ? formatSignedDuration(monthlySummary.totalOvertimeMinutes) : '--'}
            </strong>
          </div>
        </div>
      </section>

      <nav className="screen-nav" aria-label="画面切替">
        <button
          className={screen === 'daily' ? 'nav-button is-active' : 'nav-button'}
          type="button"
          onClick={() => setScreen('daily')}
        >
          当日
        </button>
        <button
          className={screen === 'monthly' ? 'nav-button is-active' : 'nav-button'}
          type="button"
          onClick={() => setScreen('monthly')}
        >
          月次
        </button>
        <button
          className={screen === 'settings' ? 'nav-button is-active' : 'nav-button'}
          type="button"
          onClick={() => setScreen('settings')}
        >
          設定
        </button>
      </nav>

      {screen === 'daily' ? (
        <section className="panel-grid">
          <section className="panel">
            <div className="panel-header">
              <div>
                <p className="panel-title">当日入力</p>
                <p className="panel-caption">1日分の入力</p>
              </div>
            </div>

            <form className="form-grid">
              <label className="field">
                <span>日付</span>
                <input
                  type="date"
                  value={draft.date}
                  onChange={(event) => {
                    void loadDraftForDate(event.target.value)
                  }}
                />
              </label>

              <label className="field">
                <span>出勤</span>
                <input
                  type="time"
                  value={draft.clockIn}
                  onChange={(event) => updateDraft('clockIn', event.target.value)}
                />
              </label>

              <label className="field">
                <span>退勤</span>
                <input
                  type="time"
                  value={draft.clockOut}
                  onChange={(event) => updateDraft('clockOut', event.target.value)}
                />
              </label>

              <label className="field">
                <span>休憩分</span>
                <input
                  type="number"
                  inputMode="numeric"
                  min="0"
                  step="5"
                  value={draft.breakMinutes}
                  onChange={(event) => updateDraft('breakMinutes', event.target.value)}
                />
              </label>
            </form>

            <div className="form-actions">
              <button
                className="primary-button"
                type="button"
                onClick={() => void saveSelectedDay()}
              >
                保存
              </button>
              {saveNotice ? <p className="save-note">{saveNotice}</p> : null}
            </div>

            <p className="storage-note">月次反映は保存後</p>
          </section>

          <section className="panel summary-panel">
            <div className="panel-header">
              <div>
                <p className="panel-title">計算結果</p>
                <p className="panel-caption">自動計算</p>
              </div>
            </div>

            {error ? <p className="error-message">{error}</p> : null}
            {storageError ? <p className="error-message">{storageError}</p> : null}

            <div className="summary-grid">
              <article className="summary-card accent-amber">
                <span className="summary-label">実働</span>
                <strong className="summary-value">
                  {summary ? formatDuration(summary.workedMinutes) : '--'}
                </strong>
              </article>

              <article className="summary-card accent-blue">
                <span className="summary-label">残業</span>
                <strong className="summary-value">
                  {summary ? formatSignedDuration(summary.overtimeMinutes) : '--'}
                </strong>
              </article>

              <article className="summary-card accent-sand">
                <span className="summary-label">当月合計</span>
                <strong className="summary-value">
                  {monthlySummary ? formatSignedDuration(monthlySummary.totalOvertimeMinutes) : '--'}
                </strong>
              </article>
            </div>

            <div className="tips">
              <p>所定 {standardHours || DEFAULT_STANDARD_HOURS}</p>
              <p>実働 退勤 - 出勤 - 休憩</p>
              <p>残業 実働 - 所定</p>
            </div>
          </section>
        </section>
      ) : null}

      {screen === 'monthly' ? (
        <section className="settings-layout monthly-layout">
          <section className="panel monthly-panel">
            <div className="panel-header monthly-header">
              <div>
                <p className="panel-title">月次一覧</p>
                <p className="panel-caption">{formatMonthLabel(getMonthKey(draft.date))}</p>
              </div>
              <div className="month-switcher">
                <button
                  className="ghost-button"
                  type="button"
                  onClick={() => {
                    void loadDraftForDate(shiftMonth(draft.date, -1))
                  }}
                >
                  前月
                </button>
                <button
                  className="ghost-button"
                  type="button"
                  onClick={() => {
                    void loadDraftForDate(shiftMonth(draft.date, 1))
                  }}
                >
                  次月
                </button>
              </div>
            </div>

            {monthlyError ? <p className="error-message">{monthlyError}</p> : null}
            {storageError ? <p className="error-message">{storageError}</p> : null}

            <article className="summary-card accent-blue month-total-card">
              <span className="summary-label">月合計</span>
              <strong className="summary-value">
                {monthlySummary ? formatSignedDuration(monthlySummary.totalOvertimeMinutes) : '--'}
              </strong>
            </article>

            {isMonthLoading ? <p className="storage-note">読込中</p> : null}

            {!isMonthLoading && monthlySummary && monthlySummary.records.length === 0 ? (
              <p className="empty-state">記録なし</p>
            ) : null}

            {!isMonthLoading && monthlySummary && monthlySummary.records.length > 0 ? (
              <div className="monthly-list">
                {monthlySummary.records.map((record) => (
                  <article className="monthly-item" key={record.date}>
                    <div className="monthly-item-header">
                      <strong>{formatDisplayDate(record.date)}</strong>
                      <span>{formatSignedDuration(record.overtimeMinutes)}</span>
                    </div>
                    <dl className="monthly-item-grid">
                      <div>
                        <dt>出勤</dt>
                        <dd>{record.clockIn}</dd>
                      </div>
                      <div>
                        <dt>退勤</dt>
                        <dd>{record.clockOut}</dd>
                      </div>
                      <div>
                        <dt>休憩</dt>
                        <dd>{record.breakMinutes}分</dd>
                      </div>
                      <div>
                        <dt>実働</dt>
                        <dd>{formatDuration(record.workedMinutes)}</dd>
                      </div>
                    </dl>
                  </article>
                ))}
              </div>
            ) : null}
          </section>
        </section>
      ) : null}

      {screen === 'settings' ? (
        <section className="settings-layout">
          <section className="panel settings-panel">
            <div className="panel-header">
              <div>
                <p className="panel-title">所定時間</p>
                <p className="panel-caption">h:mm 形式</p>
              </div>
            </div>

            <div className="form-grid">
              <label className="field">
                <span>所定</span>
                <input
                  type="text"
                  inputMode="text"
                  placeholder="例 7:40"
                  value={standardHours}
                  onChange={(event) => setStandardHours(event.target.value)}
                />
              </label>
            </div>

            <p className="storage-note">初期値 {DEFAULT_STANDARD_HOURS}</p>
          </section>

          <section className="panel settings-panel danger-panel">
            <div className="panel-header">
              <div>
                <p className="panel-title">選択日削除</p>
                <p className="panel-caption">{formatDisplayDate(draft.date)}</p>
              </div>
            </div>

            <p className="storage-note danger-note">選択日の入力と保存記録の削除</p>

            <button className="danger-button" type="button" onClick={() => void clearSelectedDay()}>
              削除
            </button>
          </section>
        </section>
      ) : null}
    </main>
  )
}