import { auditLog } from "../auditLog"
import type { TriageResult, FeedbackResult, ToolActivityEvent } from "../types"

describe("auditLog", () => {
  let spy: jest.SpyInstance

  beforeEach(() => {
    spy = jest.spyOn(console, "log").mockImplementation(() => {})
  })

  afterEach(() => {
    spy.mockRestore()
  })

  test("writes JSON with timestamp and user query", () => {
    auditLog({ user: { query: "hello" } })

    expect(spy).toHaveBeenCalledTimes(1)
    const logged = spy.mock.calls[0][0]
    expect(typeof logged).toBe("string")

    const parsed = JSON.parse(logged)
    expect(parsed.timestamp).toBeDefined()
    expect(!isNaN(Date.parse(parsed.timestamp))).toBe(true)
    expect(parsed.user).toEqual({ query: "hello" })
  })

  test("includes assistant triage, research tool calls, feedback, and errors", () => {
    const triage: TriageResult = {
      intent: "other",
      facts: { country_of_origin: "Neverland" },
      complexity: "moderate",
      summary: "short",
      skip_research: false,
      skip_research_summary: "",
    }

    const toolEvent: ToolActivityEvent = {
      type: "tool_activity",
      data: { tool: "finder", status: "started", query: "q" },
    }

    const feedback: FeedbackResult = {
      gaps: ["gap1"],
      follow_up_questions: [{ question: "q1", options: null }],
      next_steps: ["step1"],
      needs_attorney: false,
    }

    auditLog({
      user: { query: "test", distressDetected: true },
      assistant: {
        triage,
        research: { result: "ok", toolCalls: [toolEvent] },
        feedback,
      },
      errors: { contentFiltered: true, error: "err" },
    })

    expect(spy).toHaveBeenCalledTimes(1)
    const parsed = JSON.parse(spy.mock.calls[0][0])

    expect(parsed.assistant).toBeDefined()
    expect(parsed.assistant.triage).toEqual(triage)
    expect(parsed.assistant.research.result).toBe("ok")
    expect(parsed.assistant.research.toolCalls).toEqual([toolEvent])
    expect(parsed.assistant.feedback).toEqual(feedback)
    expect(parsed.errors).toEqual({ contentFiltered: true, error: "err" })
  })

  test("partial failure log with only user and errors fields", () => {
    auditLog({ user: { query: "partial" }, errors: { contentFiltered: false, error: "failed" } })

    expect(spy).toHaveBeenCalledTimes(1)
    const parsed = JSON.parse(spy.mock.calls[0][0])
    expect(parsed.user).toEqual({ query: "partial" })
    expect(parsed.errors).toEqual({ contentFiltered: false, error: "failed" })
    expect(parsed.assistant).toBeUndefined()
  })

  test("distress-detected log with no assistant or errors", () => {
    auditLog({ user: { query: "help", distressDetected: true } })

    expect(spy).toHaveBeenCalledTimes(1)
    const parsed = JSON.parse(spy.mock.calls[0][0])
    expect(parsed.user).toEqual({ query: "help", distressDetected: true })
    expect(parsed.assistant).toBeUndefined()
    expect(parsed.errors).toBeUndefined()
  })

  test("research with empty toolCalls array", () => {
    auditLog({
      user: { query: "research-empty" },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      assistant: { research: { result: "none", toolCalls: [] } } as any,
    })

    expect(spy).toHaveBeenCalledTimes(1)
    const parsed = JSON.parse(spy.mock.calls[0][0])
    expect(parsed.assistant.research.result).toBe("none")
    expect(Array.isArray(parsed.assistant.research.toolCalls)).toBe(true)
    expect(parsed.assistant.research.toolCalls).toHaveLength(0)
  })

  test("research with multiple tool calls", () => {
    const a: ToolActivityEvent = { type: "tool_activity", data: { tool: "a", status: "started" } }
    const b: ToolActivityEvent = { type: "tool_activity", data: { tool: "b", status: "completed" } }

    auditLog({
      user: { query: "research-multi" },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      assistant: { research: { result: "many", toolCalls: [a, b] } } as any,
    })

    expect(spy).toHaveBeenCalledTimes(1)
    const parsed = JSON.parse(spy.mock.calls[0][0])
    expect(parsed.assistant.research.toolCalls).toEqual([a, b])
  })

  test("feedback with needs_attorney true", () => {
    const feedback: FeedbackResult = {
      gaps: [],
      follow_up_questions: [],
      next_steps: [],
      needs_attorney: true,
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    auditLog({ user: { query: "attorney" }, assistant: { feedback } as any })

    expect(spy).toHaveBeenCalledTimes(1)
    const parsed = JSON.parse(spy.mock.calls[0][0])
    expect(parsed.assistant.feedback.needs_attorney).toBe(true)
  })
})
