export interface InlineTask {
  raw: string
  checked: boolean
  label: string
  index: number
}

const INLINE_TASK_REGEX = /^- \[([ x])\] (.+)$/gm

export function parseInlineTasks(content: string): InlineTask[] {
  const matches: InlineTask[] = []
  let m: RegExpExecArray | null
  while ((m = INLINE_TASK_REGEX.exec(content)) !== null) {
    matches.push({
      raw: m[0],
      checked: m[1] === "x",
      label: m[2].trim(),
      index: m.index,
    })
  }
  return matches
}

export function updateInlineTask(content: string, index: number, checked: boolean): string {
  const tasks = parseInlineTasks(content)
  const target = tasks.find((t) => t.index === index)
  if (!target) return content
  const newLine = `- [${checked ? "x" : " "}] ${target.label}`
  return content.slice(0, index) + newLine + content.slice(index + target.raw.length)
}
