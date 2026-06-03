import { AIProjectClient } from "@azure/ai-projects";
import { DefaultAzureCredential } from "@azure/identity";
import { NextRequest,NextResponse } from "next/server";

const endpoint = process.env.AZURE_FOUNDRY_ENDPOINT!;
const agentId = process.env.AZURE_AGENT_ID!;

export async function POST(req: NextRequest) {
    const {message} = await req.json();

    if (!message || typeof message!=="string") {
        return NextResponse.json({error: "Message is required"}, {status: 400});
    }

    const client = new AIProjectClient(endpoint, new DefaultAzureCredential());
    const openai = client.getOpenAIClient({
        azureConfig: {agentName: agentId, allowPreview: true},
    });

    const response = await openai.responses.create({
        model: "gpt-4.1",
        input: message,
    });

    const outputText = response.output
        .filter((item): item is typeof item & {type: "message"} => item.type === "message")
        .flatMap((item) => item.content)
        .filter((c): c is typeof c & {type: "output_text"} => c.type === "output_text")
        .map((c) => c.text)
        .join("");

    return NextResponse.json({reply: outputText});
}