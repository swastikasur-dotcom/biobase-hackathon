/** Quote a CSV cell when it contains a comma, quote or newline. */
function cell(value: string | number | null | undefined): string {
  const s = value == null ? '' : String(value)
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export function toCsv(rows: ReadonlyArray<ReadonlyArray<string | number | null | undefined>>): string {
  return rows.map((row) => row.map(cell).join(',')).join('\r\n') + '\r\n'
}

export function downloadCsv(filename: string, rows: Parameters<typeof toCsv>[0]): void {
  const url = URL.createObjectURL(new Blob([toCsv(rows)], { type: 'text/csv;charset=utf-8' }))
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
