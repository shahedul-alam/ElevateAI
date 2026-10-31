const number = new Intl.NumberFormat('en-US')

export function formatSalary(min?: number, max?: number) {
  if (min !== undefined && max !== undefined) return `${number.format(min)} – ${number.format(max)} / year`
  if (min !== undefined) return `From ${number.format(min)} / year`
  if (max !== undefined) return `Up to ${number.format(max)} / year`
  return null
}
