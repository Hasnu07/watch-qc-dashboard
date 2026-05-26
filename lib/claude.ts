import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

export async function estimateTaskMinutes(taskText: string): Promise<number> {
  try {
    const message = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 16,
      system:
        'You are a task time estimator for a watch trading business. Given a task description, estimate how many minutes it will take to complete. Reply with only a number. If multiple tasks are listed, estimate the total. Be realistic — most tasks take 15–90 minutes.',
      messages: [
        {
          role: 'user',
          content: taskText,
        },
      ],
    })

    const text =
      message.content[0].type === 'text' ? message.content[0].text.trim() : '30'
    const minutes = parseInt(text.replace(/\D/g, ''), 10)
    return isNaN(minutes) ? 30 : Math.min(Math.max(minutes, 5), 480)
  } catch (err) {
    console.error('Claude API error:', err)
    return 30
  }
}
