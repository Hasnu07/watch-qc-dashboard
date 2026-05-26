// Free keyword-based task time estimator — no AI, no API costs.
// Returns estimated minutes for a given task description.

const KEYWORD_ESTIMATES: Array<{ pattern: RegExp; minutes: number }> = [
  { pattern: /\bservice\b|\brepair\b|\bpolish/i,              minutes: 90 },
  { pattern: /\bshipment\b|\bshipping\b|\btransit\b|\bcourier/i, minutes: 45 },
  { pattern: /\binvoice\b|\bledger\b|\bfob\b|\baccounti/i,    minutes: 30 },
  { pattern: /\bprice\b|\bvaluat\b|\bmarket\b|\bresearch/i,    minutes: 20 },
  { pattern: /\bphoto\b|\bimage\b|\bupload\b|\bdrive\b/i,     minutes: 20 },
  { pattern: /\bpayment\b|\bbank\b|\btransfer\b|\bwire\b/i,   minutes: 25 },
  { pattern: /\bcheck\b|\bverif\b|\binspect\b/i,              minutes: 15 },
  { pattern: /\bregister\b|\binventor\b/i,                    minutes: 15 },
]

export async function estimateTaskMinutes(taskText: string): Promise<number> {
  if (!taskText) return 30
  for (const { pattern, minutes } of KEYWORD_ESTIMATES) {
    if (pattern.test(taskText)) return minutes
  }
  return 30
}
