import type { SummarizedAttendanceRecord } from '../types/attendance'

/**
 * 月次サマリーのレコードを受け取り、CSVとしてダウンロードする
 */
export const exportMonthlyCsv = (records: SummarizedAttendanceRecord[], monthLabel: string) => {
  // ヘッダーの定義
  const header = ['日付', '出勤', '退勤', '休憩(分)', '実働(分)', '残業(分)'].join(',')

  // 各行のデータ生成
  const rows = records.map(record => [
    record.date,           // string
    record.clockIn,        // string
    record.clockOut,       // string
    record.breakMinutes,   // string
    record.workedMinutes,  // number
    record.overtimeMinutes // number
  ].join(','))

  // CSV全体を結合（Excelの文字化け対策でBOMを先頭に付加）
  const csvString = '\uFEFF' + [header, ...rows].join('\n')
  
  const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  
  const link = document.createElement('a')
  link.href = url
  link.setAttribute('download', `勤怠記録_${monthLabel}.csv`)
  document.body.appendChild(link)
  link.click()
  
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}
