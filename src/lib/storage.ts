import type { DailyAttendanceDraft, DailyAttendanceRecord } from '../types/attendance'

const STANDARD_HOURS_KEY = 'working-hours-manager.standard-hours'
const DAILY_DRAFT_KEY = 'working-hours-manager.daily-draft'
const ATTENDANCE_DATABASE_NAME = 'working-hours-manager'
const ATTENDANCE_DATABASE_VERSION = 1
const ATTENDANCE_STORE_NAME = 'attendance-records'
export const DEFAULT_STANDARD_HOURS = '7:40'

type StoredDailyDraft = DailyAttendanceDraft

let databasePromise: Promise<IDBDatabase> | null = null

function getMonthKey(value: string): string {
  return value.slice(0, 7)
}

function isValidDailyDraft(value: Partial<StoredDailyDraft>): value is StoredDailyDraft {
  return (
    typeof value.date === 'string' &&
    typeof value.clockIn === 'string' &&
    typeof value.clockOut === 'string' &&
    typeof value.breakMinutes === 'string'
  )
}

function openAttendanceDatabase(): Promise<IDBDatabase> {
  if (databasePromise) {
    return databasePromise
  }

  databasePromise = new Promise((resolve, reject) => {
    const request = window.indexedDB.open(ATTENDANCE_DATABASE_NAME, ATTENDANCE_DATABASE_VERSION)

    request.onerror = () => {
      reject(request.error ?? new Error('IndexedDB open failed'))
    }

    request.onupgradeneeded = () => {
      const database = request.result

      if (!database.objectStoreNames.contains(ATTENDANCE_STORE_NAME)) {
        database.createObjectStore(ATTENDANCE_STORE_NAME, {
          keyPath: 'date',
        })
      }
    }

    request.onsuccess = () => {
      resolve(request.result)
    }
  })

  return databasePromise
}

function requestToPromise<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onerror = () => {
      reject(request.error ?? new Error('IndexedDB request failed'))
    }

    request.onsuccess = () => {
      resolve(request.result)
    }
  })
}

function transactionToPromise(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.onerror = () => {
      reject(transaction.error ?? new Error('IndexedDB transaction failed'))
    }

    transaction.onabort = () => {
      reject(transaction.error ?? new Error('IndexedDB transaction aborted'))
    }

    transaction.oncomplete = () => {
      resolve()
    }
  })
}

async function pruneAttendanceRecords(database: IDBDatabase): Promise<void> {
  const readTransaction = database.transaction(ATTENDANCE_STORE_NAME, 'readonly')
  const records = await requestToPromise(
    readTransaction.objectStore(ATTENDANCE_STORE_NAME).getAll(),
  ) as DailyAttendanceRecord[]
  await transactionToPromise(readTransaction)

  const recentMonths = [...new Set(records.map((record) => getMonthKey(record.date)))].sort()

  if (recentMonths.length <= 2) {
    return
  }

  const keepMonths = new Set(recentMonths.slice(-2))
  const deleteTransaction = database.transaction(ATTENDANCE_STORE_NAME, 'readwrite')
  const store = deleteTransaction.objectStore(ATTENDANCE_STORE_NAME)

  for (const record of records) {
    if (!keepMonths.has(getMonthKey(record.date))) {
      store.delete(record.date)
    }
  }

  await transactionToPromise(deleteTransaction)
}

export function loadStandardHours(): string {
  return window.localStorage.getItem(STANDARD_HOURS_KEY) ?? DEFAULT_STANDARD_HOURS
}

export function saveStandardHours(value: string): void {
  const trimmedValue = value.trim()

  if (trimmedValue === '') {
    window.localStorage.removeItem(STANDARD_HOURS_KEY)
    return
  }

  window.localStorage.setItem(STANDARD_HOURS_KEY, trimmedValue)
}

export function loadDailyDraft(): DailyAttendanceDraft | null {
  const raw = window.localStorage.getItem(DAILY_DRAFT_KEY)

  if (!raw) {
    return null
  }

  try {
    const parsed = JSON.parse(raw) as Partial<StoredDailyDraft>

    if (!isValidDailyDraft(parsed)) {
      return null
    }

    return {
      date: parsed.date,
      clockIn: parsed.clockIn,
      clockOut: parsed.clockOut,
      breakMinutes: parsed.breakMinutes,
    }
  } catch {
    return null
  }
}

export function saveDailyDraft(value: DailyAttendanceDraft): void {
  window.localStorage.setItem(DAILY_DRAFT_KEY, JSON.stringify(value))
}

export function clearDailyDraft(): void {
  window.localStorage.removeItem(DAILY_DRAFT_KEY)
}

export async function loadAttendanceRecord(date: string): Promise<DailyAttendanceRecord | null> {
  const database = await openAttendanceDatabase()
  const transaction = database.transaction(ATTENDANCE_STORE_NAME, 'readonly')
  const result = await requestToPromise(
    transaction.objectStore(ATTENDANCE_STORE_NAME).get(date),
  ) as DailyAttendanceRecord | undefined
  await transactionToPromise(transaction)

  return result ?? null
}

export async function listAttendanceRecordsByMonth(date: string): Promise<DailyAttendanceRecord[]> {
  const database = await openAttendanceDatabase()
  const transaction = database.transaction(ATTENDANCE_STORE_NAME, 'readonly')
  const records = await requestToPromise(
    transaction.objectStore(ATTENDANCE_STORE_NAME).getAll(),
  ) as DailyAttendanceRecord[]
  await transactionToPromise(transaction)

  const monthKey = getMonthKey(date)

  return records
    .filter((record) => getMonthKey(record.date) === monthKey)
    .sort((left, right) => left.date.localeCompare(right.date))
}

export async function saveAttendanceRecord(record: DailyAttendanceRecord): Promise<void> {
  const database = await openAttendanceDatabase()
  const transaction = database.transaction(ATTENDANCE_STORE_NAME, 'readwrite')
  transaction.objectStore(ATTENDANCE_STORE_NAME).put(record)
  await transactionToPromise(transaction)
  await pruneAttendanceRecords(database)
}

export async function deleteAttendanceRecord(date: string): Promise<void> {
  const database = await openAttendanceDatabase()
  const transaction = database.transaction(ATTENDANCE_STORE_NAME, 'readwrite')
  transaction.objectStore(ATTENDANCE_STORE_NAME).delete(date)
  await transactionToPromise(transaction)
}