<p align="center">
  <img src="public/solace_logo.png" alt="Solace logo" width="120" />
</p>

<h1 align="center">Solace</h1>

<p align="center">
  A multi-agent reasoning system that helps immigrants understand their legal rights
  in the United States — three specialized agents orchestrate intake, grounded legal
  research, and follow-up through a sequential pipeline built on Microsoft Foundry.
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Microsoft%20Agents%20League-Hackathon-0078D4" alt="Microsoft Agents League" />
  <img src="https://img.shields.io/badge/Next.js-16-white?logo=next.js&logoColor=black" alt="Next.js 16" />
  <img src="https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Azure%20AI%20Foundry-gpt--4.1-5E5CE6?logo=microsoft-azure&logoColor=white" alt="Azure AI Foundry" />
  <img src="https://github.com/MaksymY11/solace-reasoning/actions/workflows/test.yml/badge.svg" alt="Tests & Lint" />
  <img src="https://img.shields.io/badge/Vercel-Deployed-E44D90?logo=vercel&logoColor=white" alt="Vercel" />
  <img src="https://img.shields.io/badge/License-GPL--3.0-2ea043" alt="GPL-3.0 License" />
</p>

<p align="center">
  Built for the <strong>Microsoft Agents League Hackathon</strong> · Reasoning Agents Track
</p>

<p align="center">
  <img src="public/solace_demo.gif" alt="Solace demo — asking about rights when detained by ICE" width="700" />
</p>
<p align="center">
  <a href="https://youtu.be/Z-xfSGtm9Ss">
    <img src="https://img.shields.io/badge/YouTube-Watch%20Demo-red?style=for-the-badge&logo=youtube&logoColor=white" alt="Watch Demo on YouTube" />
  </a>
  &nbsp;
  <a href="https://asksolace.vercel.app/">
    <img src="https://img.shields.io/badge/Vercel-Try%20Solace%20Live-black?style=for-the-badge&logo=vercel&logoColor=white" alt="Try Solace Live" />
  </a>
</p>

## 💡 The Problem

> Over 45 million immigrants live in the United States. When faced with legal questions — about work authorization, asylum, detention, or family petitions — most can't afford an immigration attorney, and the information available online is fragmented, outdated, or misleading.

Solace bridges that gap. It provides accurate, cited legal information grounded in the USCIS Policy Manual and current federal sources, while clearly distinguishing between what it can confidently answer and when a user should consult a licensed attorney. Immigration questions are inherently multi-step — the system must classify the legal domain, retrieve from authoritative sources, reason over the user's specific facts, assess its own confidence, and identify what information is still missing.

## 🏗️ Multi-Agent Architecture

Solace uses a three-agent pipeline that mirrors how an immigration law firm handles intake — a paralegal screens the case, a specialist researches the law, and a follow-up consultation identifies what's missing. Splitting responsibilities lets each agent use the right model: gpt-4.1-mini for fast classification, gpt-4.1 for deep reasoning.

| Agent | Model | Role | Why this model? |
|-------|-------|------|-----------------|
| **Triage Agent** | gpt-4.1-mini | Classifies intent, extracts structured facts (visa type, status, dates), assesses complexity | Fast + cheap — classification doesn't need deep reasoning |
| **Research Agent** | gpt-4.1 | Searches Bing + USCIS Knowledge Base, reasons over sources, writes a cited answer with confidence assessment | Full-size model for multi-source legal reasoning and citation accuracy |
| **Feedback Agent** | gpt-4.1-mini | Identifies information gaps, generates follow-up questions with multiple-choice options, recommends next steps | Structured output from existing context — no retrieval needed |

**1.** User submits a question → **2.** Triage Agent classifies intent, extracts facts, assesses complexity → **3.** Research Agent searches Bing + USCIS Knowledge Base, reasons over sources, writes a cited answer → **4.** Feedback Agent identifies gaps, generates follow-up questions, recommends next steps → **5.** Confidence Gate always delivers the answer, but adds an attorney referral banner when confidence is LOW.

<p align="center">
  <img src="public/solace_diagram.png" alt="Solace architecture diagram" width="700" />
</p>

**MCP Tool Approval:** The Research Agent uses MCP tools (Grounding with Bing Search + Knowledge Base) that require runtime approval. The orchestrator auto-approves tool calls and re-streams the response — without this, the agent returns zero text. This is handled by the `streamResearch()` function in `lib/agentOrchestrator.ts`.

**Conversation Memory:** The last 6 messages are passed to the Triage and Research agents as conversation history, enabling multi-turn reasoning without the user re-explaining their situation.

## 🧠 Reasoning Patterns

Solace implements all four reasoning patterns recommended in the challenge starter kit:

| Pattern | Implementation |
|---------|---------------|
| **Planner–Executor** | Triage Agent plans (classifies intent, extracts facts, assesses complexity) → Research Agent executes (retrieves sources, reasons, writes cited answer) |
| **Critic / Verifier** | Research Agent self-assesses confidence (HIGH/MEDIUM/LOW) in a dedicated `[Evaluating confidence...]` section; Feedback Agent critiques gaps in the user's information |
| **Self-reflection & Iteration** | Low-confidence answers trigger attorney referral + follow-up questions that loop back into the pipeline with additional context |
| **Role-based Specialization** | Each agent has a single bounded responsibility — classification, research, or feedback — with the right model for each task |

## 📚 Foundry IQ & Grounding

The Research Agent is grounded in a knowledge base containing the USCIS Policy Manual (Volumes 1–4, 6–12), indexed with `text-embedding-3-small` embeddings via Azure AI Search. Combined with Grounding with Bing Search, this ensures answers are sourced from authoritative federal documents and current policy.

| Source | What it provides |
|--------|-----------------|
| **USCIS Policy Manual (Knowledge Base)** | 11 volumes, 97 files — deep retrieval from the authoritative federal source on immigration policy |
| **Grounding with Bing Search** | Real-time web results with verified URLs — citation accuracy went from ~50% to 100% after replacing the original Web Search MCP tool |

## 🛡️ Safety & Guardrails

| # | Guardrail | Level | Implementation |
|---|-----------|-------|---------------|
| G-1 | **Input sanitization** | BLOCK | Strips control characters, enforces max length |
| G-2 | **Distress detection** | PREPEND | Crisis keyword matching → hotline resources surfaced *before* agent pipeline |
| G-3 | **Jailbreak detection** | BLOCK | Azure Content Filters — blocks jailbreak attempts on user input |
| G-4 | **Indirect prompt injection** | BLOCK | Azure Content Filters — blocks injection in user input + tool results |
| G-5 | **Content harms** | BLOCK | Azure Content Filters — hate, sexual, self-harm, violence (lowest severity threshold, user input + output) |
| G-6 | **Protected materials** | BLOCK | Azure Content Filters — blocks copyrighted code + text in output |
| G-7 | **Off-topic blocking** | BLOCK | Content filter 400 responses caught → friendly redirect message |
| G-8 | **Confidence gate** | WARN | Research agent self-assesses HIGH/MEDIUM/LOW → attorney referral banner on LOW |
| G-9 | **Non-immigration redirect** | SKIP | Triage agent sets `skip_research: true` → friendly redirect, no research/feedback agents invoked |
| G-10 | **Audit logging** | LOG | Structured JSON on every interaction — query, triage, research, feedback, errors, distress |
| G-11 | **WCAG AA compliance** | UX | ARIA labels, screen reader announcements, `prefers-reduced-motion` support |

## 🔧 Tools

| Tool | What it does | Why |
|------|-------------|-----|
| **Azure AI Search (Knowledge Base)** | Indexes 11 volumes of the USCIS Policy Manual with vector embeddings | Deep retrieval from authoritative federal sources — the model reasons over real policy, not training data |
| **Grounding with Bing Search** | Returns web results with verified URLs for citation | Eliminates hallucinated links — citation accuracy went from ~50% to 100% |
| **Azure Content Filters** | Custom guardrail blocks prompt injection and off-topic abuse | Safety at the model layer, not brittle client-side regex |
| **Azure Translator** | Detects input language and batch-translates all user-facing content post-response | Automatic multilingual support without fragile prompt engineering |

## 🧪 Testing

```bash
npm test
```

75 tests across five modules:

| Module | Tests | What it covers |
|--------|-------|---------------|
| `StreamParser` | 7 | SSE chunk parsing — split headers, bracket disambiguation, cross-section flush, buffer drain |
| `Safety` | 37 | Distress detection (DV, self-harm, trafficking), false positives on normal immigration queries, input sanitization |
| `Citations` | 6 | Citation parsing from agent output, malformed lines, markdown link cleanup, graceful fallback |
| `AuditLog` | 7 | Structured JSON output shape, partial failure logs, distress flags, tool call arrays |
| `Translator` | 18 | Language detection, batch translation, slice-back reconstruction, sparse facts, empty feedback |

## 🧰 Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19, Tailwind CSS 4, TypeScript |
| Backend | Next.js 16 (App Router, API Routes, SSE streaming) |
| AI Agents | Azure AI Foundry (3 agents), gpt-4.1, gpt-4.1-mini |
| Knowledge | Azure AI Search, USCIS Policy Manual (11 volumes) |
| Web Search | Bing Search via Foundry MCP tools |
| Translation | Azure Translator API (language detection + batch translation) |
| Auth | `DefaultAzureCredential` (local), `ClientSecretCredential` (production) |
| Deployment | Vercel |

## 🎨 User Experience

| Feature | What it does | Why |
|---------|-------------|-----|
| **Real-time reasoning chain** | Users watch triage, tool calls, and research sections stream in live | Responses take 15–20s across three agents — transparency beats a spinner |
| **Citation pills** | Every claim links back to its source as clickable chips | Legal information without a source is just an opinion |
| **Follow-up form** | Interactive multiple-choice questions to refine the user's situation | Immigration cases are fact-specific — the first question rarely has enough detail |
| **Conversation memory** | Follow-up questions retain context from prior exchanges | Users shouldn't have to re-explain their situation every message |
| **Automatic translation** | Detects the user's language and translates the full response — answer, reasoning chain, feedback, and UI chrome | An app for immigrants shouldn't assume they all read English |

## 📋 Judging Criteria Alignment

| Criterion | Weight | How Solace Addresses It |
|-----------|--------|-------------------------|
| **Accuracy & Relevance** | 25% | Grounded in 11 volumes of the USCIS Policy Manual via Foundry IQ + Bing web search; citations link every claim to its source |
| **Reasoning & Multi-step Thinking** | 25% | Three-agent pipeline with all 4 starter kit reasoning patterns; triage classifies and extracts facts, research retrieves and reasons across sources, feedback identifies gaps and generates follow-ups |
| **Creativity & Originality** | 15% | Real-time reasoning chain lets users watch the agent think; confidence gate supplements answers with attorney referrals instead of withholding information; crisis detection surfaces hotlines for users in distress; automatic multilingual support via post-response translation |
| **UX & Presentation** | 15% | Calming visual design, streaming answers, interactive follow-up form, citation pills, automatic translation of all UI elements, mobile-responsive, custom animations |
| **Reliability & Safety** | 20% | 11 named guardrails (G-1 through G-11), 75 automated tests with CI, structured audit logging, confidence-based attorney referral, legal disclaimer |

## 🚀 Getting Started

### Prerequisites

- Node.js 18+
- An [Azure AI Foundry](https://ai.azure.com) project with:
  - Three deployed agents (Triage, Research, Feedback)
  - A gpt-4.1 model deployment
  - Azure AI Search resource with a knowledge base
  - Bing Search MCP tool connected to the Research agent
  - Azure Translator resource (Free F0 tier)
- Azure CLI (`az login` for local authentication)

### Installation

```bash
git clone https://github.com/MaksymY11/solace-reasoning.git
cd solace-reasoning
npm install
```

### Environment Variables

Create a `.env.local` file in the `solace/` directory:

```env
AZURE_FOUNDRY_ENDPOINT=https://your-resource.services.ai.azure.com/api/projects/your-project
AZURE_TRIAGE_AGENT_ID=your-triage-agent-name
AZURE_RESEARCH_AGENT_ID=your-research-agent-name
AZURE_FEEDBACK_AGENT_ID=your-feedback-agent-name
AZURE_TRANSLATOR_KEY=your-translator-key
AZURE_TRANSLATOR_REGION=your-translator-region
```

### Run Locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Deploy to Vercel

The app deploys to Vercel with the same environment variables above, plus service principal credentials for Azure authentication:

```env
AZURE_TENANT_ID=your-tenant-id
AZURE_CLIENT_ID=your-client-id
AZURE_CLIENT_SECRET=your-client-secret
```

<details>
<summary><strong>Project Structure</strong></summary>

```
solace/
├── app/
│   ├── api/chat/route.ts       # SSE streaming endpoint
│   ├── page.tsx                # Chat UI + state management
│   ├── layout.tsx              # Root layout + metadata
│   └── globals.css             # Tailwind + animations
├── components/
│   ├── ChatMessages.tsx        # Message list + attorney banner + next steps
│   ├── ChatInput.tsx           # Input + starter chips
│   ├── ReasoningChain.tsx      # Real-time reasoning visualization
│   └── FollowUpForm.tsx        # Interactive follow-up questions
├── lib/
│   ├── agentOrchestrator.ts    # Three-agent pipeline + SSE events
│   ├── streamParser.ts         # SSE chunk parser + section tracker
│   ├── foundryClient.ts        # Azure AI Foundry client singleton
│   ├── translator.ts           # Azure Translator — language detection + batch translation
│   ├── parseCitations.ts       # Citation extraction + pill formatting
│   ├── safety.ts               # Input sanitization + crisis detection
│   ├── auditLog.ts             # Structured JSON audit logging
│   ├── types.ts                # Shared TypeScript types
│   └── tests/                  # Jest test suites (75 tests)
│       ├── streamParser.test.ts
│       ├── safety.test.ts
│       ├── parseCitations.test.ts
│       ├── auditLog.test.ts
│       └── translator.test.ts
└── public/
    ├── solace_logo.png         # Logo assets
    └── copilot_usage/          # Copilot Chat screenshots
```

</details>

<details>
<summary><strong>GitHub Copilot Usage</strong></summary>

GitHub Copilot was used throughout development — inline completions and Copilot Chat for design, explaining SDK patterns, integrating safety flows, refactoring the stream parser, and generating test cases. See `public/copilot_usage/` for annotated screenshots.

</details>

---

> **Disclaimer:** Solace provides **legal information, not legal advice**. The information is grounded in publicly available federal sources including the USCIS Policy Manual, but immigration law is complex and fact-specific. Solace includes a confidence gate that recommends consulting a licensed immigration attorney when it cannot provide a well-sourced answer. Always verify information with a qualified legal professional before making decisions about your immigration case.

## 📄 License

GPL-3.0
