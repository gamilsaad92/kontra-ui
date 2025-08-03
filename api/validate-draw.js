import express from 'express'
import { openai } from './lib/openaiClient.js'

const router = express.Router()

router.post('/', async (req, res) => {
  const { budget, invoices, waiver, previousDraws } = req.body
  const prompt = `Validate draw:\nBudget: ${budget}\nInvoices: ${invoices}\nWaiver: ${waiver}\nPrevious: ${previousDraws}`
  const response = await openai.chat.completions.create({
    model: 'gpt-4',
    messages: [{ role: 'user', content: prompt }],
  })
  res.json({ recommendation: response.choices[0].message.content })
})

export default router
