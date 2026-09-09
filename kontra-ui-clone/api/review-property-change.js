import express from 'express'
import { createInstitutionalOpenAIClient } from './lib/openaiClient.js'
const openai = createInstitutionalOpenAIClient()

const router = express.Router()

router.post('/', async (req, res) => {
  const { requestDetails, loanTerms } = req.body
  const prompt = `Review property manager change:\nRequest: ${requestDetails}\nLoan Terms: ${loanTerms}`
  const response = await openai.chat.completions.create({
    model: 'gpt-4',
    messages: [{ role: 'user', content: prompt }],
  })
  res.json({ review: response.choices[0].message.content })
})

export default router
