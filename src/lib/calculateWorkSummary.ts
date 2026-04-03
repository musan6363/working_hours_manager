import type {
  DailyAttendanceRecord,
  MonthlyAttendanceSummaryResult,
  SummarizedAttendanceRecord,
  WorkCalculationInput,
  WorkSummaryResult,
} from '../types/attendance'

const MINUTES_PER_HOUR = 60

function parseTimeToMinutes(value: string): number | null {
  if (!/^\d{2}:\d{2}$/.test(value)) {
    return null
  }

  const [hours, minutes] = value.split(':').map(Number)

  if (hours > 23 || minutes > 59) {
    return null
  }

  return hours * MINUTES_PER_HOUR + minutes
}

function parseWholeMinutes(value: string): number | null {
  if (value.trim() === '') {
    return 0
  }

  const parsed = Number(value)

  if (!Number.isFinite(parsed) || parsed < 0) {
    return null
  }

  return Math.round(parsed)
}

function parseStandardMinutes(value: string): number | null {
  if (value.trim() === '') {
    return null
  }

  if (!/^\d+:\d{2}$/.test(value)) {
    return null
  }

  const [hours, minutes] = value.split(':').map(Number)

  if (!Number.isFinite(hours) || !Number.isFinite(minutes) || hours < 0 || minutes > 59) {
    return null
  }

  return hours * MINUTES_PER_HOUR + minutes
}

export function calculateWorkSummary(input: WorkCalculationInput): WorkSummaryResult {
  const { clockIn, clockOut, breakMinutes, standardHours } = input

  if (!clockIn || !clockOut) {
    return {
      summary: null,
      error: null,
    }
  }

  const startMinutes = parseTimeToMinutes(clockIn)
  const endMinutes = parseTimeToMinutes(clockOut)
  const breakDuration = parseWholeMinutes(breakMinutes)
  const standardMinutes = parseStandardMinutes(standardHours)

  if (startMinutes === null || endMinutes === null) {
    return {
      summary: null,
      error: '時刻は 00:00 形式で入力してください。',
    }
  }

  if (breakDuration === null) {
    return {
      summary: null,
      error: '休憩時間は 0 以上の分数で入力してください。',
    }
  }

  if (standardHours.trim() !== '' && standardMinutes === null) {
    return {
      summary: null,
      error: '所定労働時間は h:mm 形式で入力してください。例: 7:40',
    }
  }

  const totalMinutes = endMinutes - startMinutes

  if (totalMinutes <= 0) {
    return {
      summary: null,
      error: '退勤時間は出勤時間より後に設定してください。',
    }
  }

  if (breakDuration > totalMinutes) {
    return {
      summary: null,
      error: '休憩時間が勤務時間を超えています。',
    }
  }

  if (standardMinutes === null) {
    return {
      summary: {
        workedMinutes: totalMinutes - breakDuration,
        overtimeMinutes: 0,
      },
      error: null,
    }
  }

  const workedMinutes = totalMinutes - breakDuration

  return {
    summary: {
      workedMinutes,
      overtimeMinutes: workedMinutes - standardMinutes,
    },
    error: null,
  }
}

export function formatDuration(minutes: number): string {
  const absoluteMinutes = Math.abs(minutes)
  const hours = Math.floor(absoluteMinutes / MINUTES_PER_HOUR)
  const remainMinutes = absoluteMinutes % MINUTES_PER_HOUR

  return `${hours}時間${remainMinutes.toString().padStart(2, '0')}分`
}

export function formatSignedDuration(minutes: number): string {
  const sign = minutes < 0 ? '-' : '+'
  return `${sign}${formatDuration(minutes)}`
}

export function calculateMonthlyAttendanceSummary(
  records: DailyAttendanceRecord[],
  standardHours: string,
  monthKey: string,
): MonthlyAttendanceSummaryResult {
  const summarizedRecords: SummarizedAttendanceRecord[] = []
  let totalOvertimeMinutes = 0

  for (const record of [...records].sort((left, right) => left.date.localeCompare(right.date))) {
    const { summary, error } = calculateWorkSummary({
      ...record,
      standardHours,
    })

    if (error) {
      return {
        summary: null,
        error,
      }
    }

    if (!summary) {
      continue
    }

    summarizedRecords.push({
      ...record,
      ...summary,
    })
    totalOvertimeMinutes += summary.overtimeMinutes
  }

  return {
    summary: {
      monthKey,
      records: summarizedRecords,
      totalOvertimeMinutes,
    },
    error: null,
  }
}