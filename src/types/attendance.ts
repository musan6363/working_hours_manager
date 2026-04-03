export type DailyAttendanceDraft = {
  date: string
  clockIn: string
  clockOut: string
  breakMinutes: string
}

export type DailyAttendanceRecord = DailyAttendanceDraft

export type WorkCalculationInput = DailyAttendanceDraft & {
  standardHours: string
}

export type WorkSummary = {
  workedMinutes: number
  overtimeMinutes: number
}

export type WorkSummaryResult = {
  summary: WorkSummary | null
  error: string | null
}

export type SummarizedAttendanceRecord = DailyAttendanceRecord & WorkSummary

export type MonthlyAttendanceSummary = {
  monthKey: string
  records: SummarizedAttendanceRecord[]
  totalOvertimeMinutes: number
}

export type MonthlyAttendanceSummaryResult = {
  summary: MonthlyAttendanceSummary | null
  error: string | null
}