import express from 'express'
import { openai } from './lib/openaiClient.js'
const router = express.Router()

router.post('/', async (req, res) => {
  const { statement } = req.body
  const response = await openai.chat.completions.create({
    model: 'gpt-4',
    messages: [{ role: 'user', content: `Analyze this financial: ${statement}` }],
  })
  res.json({ analysis: response.choices[0].message.content })
})

export default router
