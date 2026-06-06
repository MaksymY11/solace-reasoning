"use client"

// TODO: CONVERSATION MEMORY

import { useState } from "react"
import { Message, SSEEvent } from "@/lib/types"
import { ChatInput } from "@/components/ChatInput"
import { ChatMessages } from "@/components/ChatMessages"

export default function Home() {
  const [input, setInput] = useState("")
  const [messages, setMessages] = useState<Message[]>([])
  const loading = messages.length > 0 && messages[messages.length-1].loading === true

  async function handleSend() {
    
    if (!input.trim() || loading) {
      return
    }

    setInput("")
    const userMessage: Message = {
      id: crypto.randomUUID(),
      role: "user",
      content: input,
    }
    const assistantMessage: Message = {
      id: crypto.randomUUID(),
      role: "assistant",
      content: "",
      loading: true,
    }
    const assistantId = assistantMessage.id
    setMessages(prev => [...prev, userMessage, assistantMessage])
    try{
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({message:input}),
      })

      // Read loop
      if (!response.body) throw new Error("No response body")
      let buffer = ""
      let error = false
      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      while (true) {
        if (error) break
        const {done, value} = await reader.read()
        if (done) break
        buffer += decoder.decode(value, {stream: true})
        const parts = buffer.split("\n\n")
        buffer = parts.pop() ?? "" // Last piece of data

        for (const part of parts) {
          if (!part.trim()) continue
          const json = part.replace("data: ", "")
          const event = JSON.parse(json) as SSEEvent
          if (event.type === "content") {
            setMessages(prev => prev.map( m => 
              m.id === assistantId ? {...m, content: m.content + event.data} : m
            ))
          } else if (event.type === "triage") {
            setMessages(prev => prev.map( m =>
              m.id === assistantId ? {...m, triage: event.data} : m
            ))
          } else if (event.type === "feedback") {
            setMessages(prev => prev.map( m =>
              m.id === assistantId ? {...m, feedback: event.data} : m
            ))
          } else if (event.type === "error") {
            setMessages(prev => prev.map ( m =>
              m.id === assistantId ? {...m, content: event.data.message, loading: false} : m
            ))
            error = true
            break
          } 
        }
      }

      // Flushing the buffer
      if (buffer.trim()) {
        const json = buffer.replace("data: ", "")
        const event = JSON.parse(json) as SSEEvent
        if (event.type === "content") {
          setMessages(prev => prev.map( m => 
            m.id === assistantId ? {...m, content: m.content + event.data} : m
          ))
        }
      }
    }
    catch {
      setMessages(prev => prev.map( m =>
        m.id === assistantId ? {...m, content: "Could not fetch a response. Please try again.", loading: false} : m
      ))
    }
    finally {
      setMessages(prev => prev.map( m =>
        m.id === assistantId ? {...m, loading: false} : m
      ))
    }
  }

  return (
    <main className="flex min-h-screen flex-col items-center p-8">
      <div className="self-start flex items-center gap-2">
        <img src={"solace_logo_cropped.png"} alt="Solace" className="h-12 w-auto" />
        <span className="text-lg font-semibold">Solace</span>
      </div>
      <div className={messages.length === 0 
        ? "flex-1 flex items-center"
        : "flex-1 flex flex-col items-center w-full"
      }
      >
        <div className={`w-full max-w-xl flex flex-col gap-4 ${messages.length > 0 ? "flex-1" : ""}`}>
          {messages.length ===0 && (
            <div className="flex items-center justify-center gap-2 mb-4">
              <img src={"solace_logo_cropped.png"} alt="Solace" className="h-7 w-auto" />
              <span className="text-xl">Hello, I&apos;m <strong className="text-[#017b80]">Solace</strong></span>
            </div>
          )}
          <ChatMessages
            messages={messages}
          />
          <ChatInput 
            input={input} 
            setInput={setInput} 
            onSend={handleSend} 
            loading={loading}
            showStarters={messages.length === 0}
          />
        </div>
      </div>
    </main>
  )
}

