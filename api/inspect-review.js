import express from 'express'
import multer from 'multer'
import { openai } from './lib/openaiClient.js'

const upload = multer()
const router = express.Router()

router.post('/', upload.any(), async (req, res) => {
  const { notes } = req.body
  const response = await openai.chat.completions.create({
    model: 'gpt-4',
    messages: [{ role: 'user', content: `Summarize this inspection: ${notes}` }],
  })
  res.json({ visionSummary: 'Mock visual analysis', textSummary: response.choices[0].message.content })
})

export default router
