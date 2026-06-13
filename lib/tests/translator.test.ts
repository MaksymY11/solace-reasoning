import {
    detectLanguage,
    translateTexts,
    translateResponse,
} from "../translator"
import { TriageResult, FeedbackResult } from "../types"

// Mock global fetch
global.fetch = jest.fn()

describe("translator", () => {
    beforeEach(() => {
        jest.clearAllMocks()
        jest.resetAllMocks()
    })

    describe("detectLanguage", () => {
        it("should detect language from text and return language code", async () => {
            const mockResponse = [{ language: "es" }]
            ;(global.fetch as jest.Mock).mockResolvedValueOnce({
                json: async () => mockResponse,
            })

            const result = await detectLanguage("Hola mundo")

            expect(result).toBe("es")
            expect(global.fetch).toHaveBeenCalledWith(
                "https://api.cognitive.microsofttranslator.com/detect?api-version=3.0",
                {
                    method: "POST",
                    headers: {
                        "Ocp-Apim-Subscription-Key": process.env.AZURE_TRANSLATOR_KEY!,
                        "Ocp-Apim-Subscription-Region": process.env.AZURE_TRANSLATOR_REGION!,
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify([{ Text: "Hola mundo" }]),
                }
            )
        })

        it("should return 'en' for English text", async () => {
            const mockResponse = [{ language: "en" }]
            ;(global.fetch as jest.Mock).mockResolvedValueOnce({
                json: async () => mockResponse,
            })

            const result = await detectLanguage("Hello world")

            expect(result).toBe("en")
        })

        it("should detect various languages", async () => {
            const testCases = [
                ["Bonjour", "fr"],
                ["Guten Tag", "de"],
                ["Ciao", "it"],
                ["你好", "zh-Hans"],
            ]

            for (const [text, lang] of testCases) {
                jest.clearAllMocks()
                ;(global.fetch as jest.Mock).mockResolvedValueOnce({
                    json: async () => [{ language: lang }],
                })

                const result = await detectLanguage(text)
                expect(result).toBe(lang)
            }
        })
    })

    describe("translateTexts", () => {
        it("should translate array of texts and return translated strings", async () => {
            const texts = ["Hello", "World"]
            const translations = ["Hola", "Mundo"]
            const mockResponse = [
                { translations: [{ text: "Hola" }] },
                { translations: [{ text: "Mundo" }] },
            ]
            ;(global.fetch as jest.Mock).mockResolvedValueOnce({
                json: async () => mockResponse,
            })

            const result = await translateTexts(texts, "es")

            expect(result).toEqual(translations)
            expect(global.fetch).toHaveBeenCalledWith(
                "https://api.cognitive.microsofttranslator.com/translate?api-version=3.0&to=es",
                {
                    method: "POST",
                    headers: {
                        "Ocp-Apim-Subscription-Key": process.env.AZURE_TRANSLATOR_KEY!,
                        "Ocp-Apim-Subscription-Region": process.env.AZURE_TRANSLATOR_REGION!,
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify(
                        texts.map(t => ({ Text: t }))
                    ),
                }
            )
        })

        it("should handle single text translation", async () => {
            const texts = ["Testing"]
            const mockResponse = [{ translations: [{ text: "Prueba" }] }]
            ;(global.fetch as jest.Mock).mockResolvedValueOnce({
                json: async () => mockResponse,
            })

            const result = await translateTexts(texts, "es")

            expect(result).toEqual(["Prueba"])
        })

        it("should handle batch translation of multiple items", async () => {
            const texts = ["Text1", "Text2", "Text3", "Text4", "Text5"]
            const mockResponse = texts.map(t => ({
                translations: [{ text: `${t}_translated` }],
            }))
            ;(global.fetch as jest.Mock).mockResolvedValueOnce({
                json: async () => mockResponse,
            })

            const result = await translateTexts(texts, "fr")

            expect(result).toEqual(
                texts.map(t => `${t}_translated`)
            )
            expect(result).toHaveLength(5)
        })

        it("should preserve order of translations", async () => {
            const texts = ["A", "B", "C"]
            const mockResponse = [
                { translations: [{ text: "Alpha" }] },
                { translations: [{ text: "Beta" }] },
                { translations: [{ text: "Gamma" }] },
            ]
            ;(global.fetch as jest.Mock).mockResolvedValueOnce({
                json: async () => mockResponse,
            })

            const result = await translateTexts(texts, "de")

            expect(result).toEqual(["Alpha", "Beta", "Gamma"])
        })
    })

    describe("translateResponse", () => {
        const mockTriageResult: TriageResult = {
            intent: "visa_status",
            facts: {
                visa_type: "H-1B",
                status: "Active",
                dates: "2023-2025",
                employer: "TechCorp",
                family: undefined,
                state: "CA",
                country_of_origin: "India",
            },
            complexity: "moderate",
            summary: "Question about H-1B visa status",
            skip_research: false,
            skip_research_summary: "",
        }

        const mockFeedbackResult: FeedbackResult = {
            gaps: ["Need more employment history"],
            follow_up_questions: [
                {
                    question: "When did you last travel?",
                    options: ["Within 6 months", "6-12 months", "Over a year"],
                },
                {
                    question: "Any dependents?",
                    options: null,
                },
            ],
            next_steps: ["Schedule consultation", "Gather documents"],
            needs_attorney: true,
        }

        const mockResearchResult = `[Analyzing your question...]
Analysis of H-1B status inquiry

[Researching sources...]
H-1B regulations and recent updates

[Applying to your situation...]
Your specific case analysis

[Evaluating confidence...]
Confidence level assessment

[Answering...]
Final answer content

[Citations...]
Source 1, Source 2`

        it("should return null for English input", async () => {
            ;(global.fetch as jest.Mock).mockResolvedValueOnce({
                json: async () => [{ language: "en" }],
            })

            const result = await translateResponse(
                "Hello",
                mockTriageResult,
                mockResearchResult,
                mockFeedbackResult
            )

            expect(result).toBeNull()
        })

        it("should translate response for non-English input", async () => {
            // Mock detect language
            ;(global.fetch as jest.Mock).mockResolvedValueOnce({
                json: async () => [{ language: "es" }],
            })

            // Create mock translations for batch call
            // The order: triage summary, triage facts (6 non-null), 5 research sections, 2 next_steps, 1 gap, 2 questions, 3 options, 9 UI strings
            // Total: 1 + 6 + 5 + 2 + 1 + 2 + 3 + 9 = 29 items
            const mockTranslations = Array.from({ length: 29 }, (_, i) => ({
                translations: [{ text: `translated_${i}` }],
            }))

            ;(global.fetch as jest.Mock).mockResolvedValueOnce({
                json: async () => mockTranslations,
            })

            const result = await translateResponse(
                "¿Pregunta?",
                mockTriageResult,
                mockResearchResult,
                mockFeedbackResult
            )

            expect(result).not.toBeUndefined()
            expect(result?.triage).toBeDefined()
            expect(result?.sectionContent).toBeDefined()
            expect(result?.feedback).toBeDefined()
            expect(result?.ui).toBeDefined()
        })

        it("should correctly translate and reconstruct triage result", async () => {
            ;(global.fetch as jest.Mock).mockResolvedValueOnce({
                json: async () => [{ language: "es" }],
            })

            const mockTranslations = Array.from({ length: 29 }, (_, i) => ({
                translations: [{ text: `translated_${i}` }],
            }))

            ;(global.fetch as jest.Mock).mockResolvedValueOnce({
                json: async () => mockTranslations,
            })

            const result = await translateResponse(
                "¿Pregunta?",
                mockTriageResult,
                mockResearchResult,
                mockFeedbackResult
            )

            expect(result?.triage?.intent).toBe(mockTriageResult.intent)
            expect(result?.triage?.complexity).toBe(mockTriageResult.complexity)
            expect(result?.triage?.summary).toBe("translated_0") // First translated item
            expect(result?.triage?.facts.visa_type).toBe("translated_1")
            expect(result?.triage?.facts.status).toBe("translated_2")
            expect(result?.triage?.facts.dates).toBe("translated_3")
            expect(result?.triage?.facts.employer).toBe("translated_4")
            expect(result?.triage?.facts.state).toBe("translated_5")
            expect(result?.triage?.facts.country_of_origin).toBe("translated_6")
            // family is null, so it shouldn't be included
            expect(result?.triage?.facts.family).toBeUndefined()
        })

        it("should correctly translate and reconstruct research sections", async () => {
            ;(global.fetch as jest.Mock).mockResolvedValueOnce({
                json: async () => [{ language: "es" }],
            })

            const mockTranslations = Array.from({ length: 29 }, (_, i) => ({
                translations: [{ text: `translated_${i}` }],
            }))

            ;(global.fetch as jest.Mock).mockResolvedValueOnce({
                json: async () => mockTranslations,
            })

            const result = await translateResponse(
                "¿Pregunta?",
                mockTriageResult,
                mockResearchResult,
                mockFeedbackResult
            )

            // Section content starts after triage (1 summary + 6 facts)
            expect(result?.sectionContent["Analyzing your question..."]).toBe("translated_7")
            expect(result?.sectionContent["Researching sources..."]).toBe("translated_8")
            expect(result?.sectionContent["Applying to your situation..."]).toBe("translated_9")
            expect(result?.sectionContent["Evaluating confidence..."]).toBe("translated_10")
            expect(result?.sectionContent["Answering..."]).toBe("translated_11")
        })

        it("should correctly translate and reconstruct feedback", async () => {
            ;(global.fetch as jest.Mock).mockResolvedValueOnce({
                json: async () => [{ language: "es" }],
            })

            const mockTranslations = Array.from({ length: 29 }, (_, i) => ({
                translations: [{ text: `translated_${i}` }],
            }))

            ;(global.fetch as jest.Mock).mockResolvedValueOnce({
                json: async () => mockTranslations,
            })

            const result = await translateResponse(
                "¿Pregunta?",
                mockTriageResult,
                mockResearchResult,
                mockFeedbackResult
            )

            // After sections (1 + 6 + 5 = 12), next_steps (2 items start at index 12)
            expect(result?.feedback?.next_steps).toEqual([
                "translated_12",
                "translated_13",
            ])
            // gaps (1 item at index 14)
            expect(result?.feedback?.gaps).toEqual(["translated_14"])
            // questions (2 items at indices 15, 16)
            expect(result?.feedback?.follow_up_questions[0].question).toBe("translated_15")
            expect(result?.feedback?.follow_up_questions[1].question).toBe("translated_16")
            // options for first question (3 items at indices 17, 18, 19)
            expect(result?.feedback?.follow_up_questions[0].options).toEqual([
                "translated_17",
                "translated_18",
                "translated_19",
            ])
            // second question has no options
            expect(result?.feedback?.follow_up_questions[1].options).toBeNull()
            // needs_attorney should be preserved
            expect(result?.feedback?.needs_attorney).toBe(true)
        })

        it("should correctly translate and reconstruct UI strings", async () => {
            ;(global.fetch as jest.Mock).mockResolvedValueOnce({
                json: async () => [{ language: "es" }],
            })

            const mockTranslations = Array.from({ length: 29 }, (_, i) => ({
                translations: [{ text: `translated_${i}` }],
            }))

            ;(global.fetch as jest.Mock).mockResolvedValueOnce({
                json: async () => mockTranslations,
            })

            const result = await translateResponse(
                "¿Pregunta?",
                mockTriageResult,
                mockResearchResult,
                mockFeedbackResult
            )

            // UI strings start at index 20
            const uiKeys = [
                "Consult an attorney",
                "Next steps",
                "To provide better guidance, please answer the questions below.",
                "Show reasoning",
                "Hide reasoning",
                "Your answer",
                "Skip",
                "Write a message...",
                "This is general legal information, not legal advice. For guidance specific to your situation, consult a qualified immigration attorney.",
            ]

            for (let i = 0; i < uiKeys.length; i++) {
                expect(result?.ui?.[uiKeys[i]]).toBe(`translated_${20 + i}`)
            }
        })

        it("should handle sparse fact values (some null)", async () => {
            const sparseTriageResult: TriageResult = {
                intent: "asylum",
                facts: {
                    visa_type: undefined,
                    status: "Pending",
                    dates: undefined,
                    employer: undefined,
                    family: "Spouse and 2 children",
                    state: "TX",
                    country_of_origin: "Venezuela",
                },
                complexity: "complex",
                summary: "Asylum case",
                skip_research: false,
                skip_research_summary: "",
            }

            ;(global.fetch as jest.Mock).mockResolvedValueOnce({
                json: async () => [{ language: "es" }],
            })

            // Only 4 non-null facts (status, family, state, country_of_origin)
            // 1 summary + 4 facts + 5 sections + 2 next_steps + 1 gap + 2 questions + 3 options + 9 UI = 27
            const mockTranslations = Array.from({ length: 27 }, (_, i) => ({
                translations: [{ text: `translated_${i}` }],
            }))

            ;(global.fetch as jest.Mock).mockResolvedValueOnce({
                json: async () => mockTranslations,
            })

            const result = await translateResponse(
                "¿Pregunta?",
                sparseTriageResult,
                mockResearchResult,
                mockFeedbackResult
            )

            expect(result?.triage?.summary).toBe("translated_0")
            expect(result?.triage?.facts.status).toBe("translated_1")
            expect(result?.triage?.facts.family).toBe("translated_2")
            expect(result?.triage?.facts.state).toBe("translated_3")
            expect(result?.triage?.facts.country_of_origin).toBe("translated_4")
            expect(result?.triage?.facts.visa_type).toBeUndefined()
            expect(result?.triage?.facts.employer).toBeUndefined()
            expect(result?.triage?.facts.dates).toBeUndefined()
        })

        it("should handle empty feedback arrays", async () => {
            const emptyFeedback: FeedbackResult = {
                gaps: [],
                follow_up_questions: [],
                next_steps: [],
                needs_attorney: false,
            }

            ;(global.fetch as jest.Mock).mockResolvedValueOnce({
                json: async () => [{ language: "es" }],
            })

            // 1 summary + 6 facts + 5 sections + 0 next_steps + 0 gaps + 0 questions + 0 options + 9 UI = 21
            const mockTranslations = Array.from({ length: 21 }, (_, i) => ({
                translations: [{ text: `translated_${i}` }],
            }))

            ;(global.fetch as jest.Mock).mockResolvedValueOnce({
                json: async () => mockTranslations,
            })

            const result = await translateResponse(
                "¿Pregunta?",
                mockTriageResult,
                mockResearchResult,
                emptyFeedback
            )

            expect(result?.feedback?.gaps).toEqual([])
            expect(result?.feedback?.follow_up_questions).toEqual([])
            expect(result?.feedback?.next_steps).toEqual([])
            expect(result?.feedback?.needs_attorney).toBe(false)
        })

        it("should return undefined feedback when feedbackResult is not provided", async () => {
            ;(global.fetch as jest.Mock).mockResolvedValueOnce({
                json: async () => [{ language: "es" }],
            })

            // Without feedback: 1 summary + 6 facts + 5 sections + 9 UI = 21
            const mockTranslations = Array.from({ length: 21 }, (_, i) => ({
                translations: [{ text: `translated_${i}` }],
            }))

            ;(global.fetch as jest.Mock).mockResolvedValueOnce({
                json: async () => mockTranslations,
            })

            const result = await translateResponse(
                "¿Pregunta?",
                mockTriageResult,
                mockResearchResult,
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                undefined as any
            )

            expect(result?.feedback).toBeUndefined()
        })

        it("should call detectLanguage before batch translation", async () => {
            ;(global.fetch as jest.Mock)
                .mockResolvedValueOnce({
                    json: async () => [{ language: "fr" }],
                })
                .mockResolvedValueOnce({
                    json: async () => Array.from({ length: 29 }, (_, i) => ({
                        translations: [{ text: `translated_${i}` }],
                    })),
                })

            await translateResponse(
                "Bonjour",
                mockTriageResult,
                mockResearchResult,
                mockFeedbackResult
            )

            expect(global.fetch).toHaveBeenCalledTimes(2)
            // First call is detect
            expect((global.fetch as jest.Mock).mock.calls[0][0]).toContain("detect")
            // Second call is translate
            expect((global.fetch as jest.Mock).mock.calls[1][0]).toContain("translate?api-version=3.0&to=fr")
        })

        it("should handle research result with missing sections gracefully", async () => {
            const incompleteResearch = `[Analyzing your question...]
Analysis

[Answering...]
Answer`

            ;(global.fetch as jest.Mock).mockResolvedValueOnce({
                json: async () => [{ language: "es" }],
            })

            // With missing sections, should have fewer section items
            const mockTranslations = Array.from({ length: 24 }, (_, i) => ({
                translations: [{ text: `translated_${i}` }],
            }))

            ;(global.fetch as jest.Mock).mockResolvedValueOnce({
                json: async () => mockTranslations,
            })

            const result = await translateResponse(
                "¿Pregunta?",
                mockTriageResult,
                incompleteResearch,
                mockFeedbackResult
            )

            expect(result).not.toBeUndefined()
            expect(result?.sectionContent).toBeDefined()
        })
    })
})
