'use client'

import { useState, useEffect, useCallback } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

type Question = {
  id: string
  name: string
  question_text: string
  upvotes: number
  created_at: string
}

type Answer = {
  id: string
  question_id: string
  name: string
  answer_text: string
  created_at: string
}

function timeAgo(dateStr: string): string {
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000)
  if (seconds < 60) return `${seconds}s ago`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

export default function Home() {
  const [questions, setQuestions] = useState<Question[]>([])
  const [answers, setAnswers] = useState<Record<string, Answer[]>>({})
  const [name, setName] = useState('')
  const [questionText, setQuestionText] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [upvotedIds, setUpvotedIds] = useState<Set<string>>(new Set())
  // which question has the answer box open
  const [answeringId, setAnsweringId] = useState<string | null>(null)
  // answer form state per question
  const [answerName, setAnswerName] = useState('')
  const [answerText, setAnswerText] = useState('')
  const [submittingAnswer, setSubmittingAnswer] = useState(false)

  const fetchQuestions = useCallback(async () => {
    const { data } = await supabase
      .from('questions')
      .select('*')
      .order('upvotes', { ascending: false })
    if (data) setQuestions(data)
  }, [])

  const fetchAnswers = useCallback(async () => {
    const { data } = await supabase
      .from('answers')
      .select('*')
      .order('created_at', { ascending: true })
    if (data) {
      const grouped: Record<string, Answer[]> = {}
      for (const a of data) {
        if (!grouped[a.question_id]) grouped[a.question_id] = []
        grouped[a.question_id].push(a)
      }
      setAnswers(grouped)
    }
  }, [])

  useEffect(() => {
    fetchQuestions()
    fetchAnswers()

    const channel = supabase
      .channel('realtime-all')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'questions' }, () =>
        fetchQuestions()
      )
      .on('postgres_changes', { event: '*', schema: 'public', table: 'answers' }, () =>
        fetchAnswers()
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [fetchQuestions, fetchAnswers])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim() || !questionText.trim()) return
    setSubmitting(true)
    const { error } = await supabase.from('questions').insert({
      name: name.trim(),
      question_text: questionText.trim(),
    })
    if (!error) {
      setName('')
      setQuestionText('')
      await fetchQuestions()
    }
    setSubmitting(false)
  }

  async function handleUpvote(id: string, currentUpvotes: number) {
    if (upvotedIds.has(id)) return
    setUpvotedIds((prev) => new Set([...prev, id]))
    setQuestions((prev) =>
      [...prev.map((q) => (q.id === id ? { ...q, upvotes: q.upvotes + 1 } : q))].sort(
        (a, b) => b.upvotes - a.upvotes
      )
    )
    await supabase.from('questions').update({ upvotes: currentUpvotes + 1 }).eq('id', id)
  }

  function openAnswerBox(questionId: string) {
    setAnsweringId(questionId)
    setAnswerName('')
    setAnswerText('')
  }

  function closeAnswerBox() {
    setAnsweringId(null)
    setAnswerName('')
    setAnswerText('')
  }

  async function handleSubmitAnswer(questionId: string) {
    if (!answerName.trim() || !answerText.trim()) return
    setSubmittingAnswer(true)
    const { error } = await supabase.from('answers').insert({
      question_id: questionId,
      name: answerName.trim(),
      answer_text: answerText.trim(),
    })
    if (!error) {
      closeAnswerBox()
      await fetchAnswers()
    }
    setSubmittingAnswer(false)
  }

  return (
    <main className="min-h-screen bg-gray-950 text-gray-100 py-12 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="text-center mb-10">
          <h1 className="text-4xl font-bold text-white tracking-tight mb-2">
            Ask the Cohort
          </h1>
          <p className="text-gray-400">Got a question? Throw it in. Upvote what matters.</p>
        </div>

        {/* Question Form */}
        <form
          onSubmit={handleSubmit}
          className="bg-gray-900 rounded-2xl p-6 mb-8 border border-gray-800"
        >
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-400 mb-1.5">Your name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Alex"
              className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-white placeholder-gray-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors"
            />
          </div>
          <div className="mb-5">
            <label className="block text-sm font-medium text-gray-400 mb-1.5">Your question</label>
            <textarea
              value={questionText}
              onChange={(e) => setQuestionText(e.target.value)}
              placeholder="What's on your mind?"
              rows={3}
              className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-2.5 text-white placeholder-gray-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-colors resize-none"
            />
          </div>
          <button
            type="submit"
            disabled={submitting || !name.trim() || !questionText.trim()}
            className="w-full bg-indigo-600 hover:bg-indigo-500 disabled:bg-gray-800 disabled:text-gray-600 text-white font-semibold py-2.5 px-4 rounded-xl transition-colors cursor-pointer disabled:cursor-not-allowed"
          >
            {submitting ? 'Posting...' : 'Ask Question'}
          </button>
        </form>

        {/* Feed */}
        <div className="space-y-4">
          {questions.length === 0 ? (
            <div className="text-center text-gray-600 py-16">
              <p className="text-lg">No questions yet.</p>
              <p className="text-sm mt-1">Be the first to ask something.</p>
            </div>
          ) : (
            questions.map((q) => {
              const questionAnswers = answers[q.id] || []
              const isAnswering = answeringId === q.id

              return (
                <div
                  key={q.id}
                  className="bg-gray-900 rounded-2xl border border-gray-800 hover:border-gray-700 transition-colors overflow-hidden"
                >
                  {/* Question row */}
                  <div className="flex gap-4 p-5">
                    {/* Upvote column */}
                    <div className="flex flex-col items-center gap-1.5 pt-0.5 min-w-[48px]">
                      <button
                        onClick={() => handleUpvote(q.id, q.upvotes)}
                        disabled={upvotedIds.has(q.id)}
                        className={`flex items-center justify-center w-10 h-10 rounded-xl border transition-all ${
                          upvotedIds.has(q.id)
                            ? 'text-indigo-400 bg-indigo-950 border-indigo-700 cursor-default'
                            : 'text-gray-300 bg-gray-800 border-gray-700 hover:text-indigo-400 hover:border-indigo-500 cursor-pointer'
                        }`}
                        aria-label="Upvote"
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          width="18"
                          height="18"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2.5"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <path d="M12 19V5" />
                          <path d="M5 12l7-7 7 7" />
                        </svg>
                      </button>
                      <span
                        className={`text-sm font-bold tabular-nums ${
                          upvotedIds.has(q.id) ? 'text-indigo-400' : 'text-gray-200'
                        }`}
                      >
                        {q.upvotes}
                      </span>
                    </div>

                    {/* Question content */}
                    <div className="flex-1 min-w-0">
                      <p className="text-white leading-relaxed mb-2">{q.question_text}</p>
                      <div className="flex items-center gap-3">
                        <p className="text-sm text-gray-600">
                          Asked by{' '}
                          <span className="text-gray-400 font-medium">{q.name}</span>
                          {' · '}
                          {timeAgo(q.created_at)}
                        </p>
                        <button
                          onClick={() => (isAnswering ? closeAnswerBox() : openAnswerBox(q.id))}
                          className="text-sm text-indigo-400 hover:text-indigo-300 transition-colors cursor-pointer"
                        >
                          {isAnswering ? 'Cancel' : `Answer${questionAnswers.length > 0 ? ` (${questionAnswers.length})` : ''}`}
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Answers list */}
                  {questionAnswers.length > 0 && (
                    <div className="border-t border-gray-800 divide-y divide-gray-800">
                      {questionAnswers.map((a) => (
                        <div key={a.id} className="flex gap-3 px-5 py-3 bg-gray-950/50">
                          <div className="w-1 rounded-full bg-indigo-700 shrink-0 mt-1" />
                          <div className="flex-1 min-w-0">
                            <p className="text-gray-200 text-sm leading-relaxed">{a.answer_text}</p>
                            <p className="text-xs text-gray-600 mt-1">
                              <span className="text-gray-500 font-medium">{a.name}</span>
                              {' · '}
                              {timeAgo(a.created_at)}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Answer input box */}
                  {isAnswering && (
                    <div className="border-t border-gray-800 p-4 bg-gray-950/30">
                      <div className="flex gap-2 mb-2">
                        <input
                          type="text"
                          value={answerName}
                          onChange={(e) => setAnswerName(e.target.value)}
                          placeholder="Your name"
                          className="w-36 bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-indigo-500 transition-colors"
                        />
                      </div>
                      <textarea
                        value={answerText}
                        onChange={(e) => setAnswerText(e.target.value)}
                        placeholder="Write your answer..."
                        rows={2}
                        autoFocus
                        className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 focus:outline-none focus:border-indigo-500 transition-colors resize-none mb-2"
                      />
                      <div className="flex gap-2 justify-end">
                        <button
                          onClick={closeAnswerBox}
                          className="text-sm text-gray-500 hover:text-gray-300 px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
                        >
                          Cancel
                        </button>
                        <button
                          onClick={() => handleSubmitAnswer(q.id)}
                          disabled={submittingAnswer || !answerName.trim() || !answerText.trim()}
                          className="text-sm bg-indigo-600 hover:bg-indigo-500 disabled:bg-gray-700 disabled:text-gray-500 text-white font-medium px-4 py-1.5 rounded-lg transition-colors cursor-pointer disabled:cursor-not-allowed"
                        >
                          {submittingAnswer ? 'Posting...' : 'Post Answer'}
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )
            })
          )}
        </div>
      </div>
    </main>
  )
}
