import { NextResponse } from "next/server";
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
  organization: process.env.OPENAI_ORG!,
});

// ✅ Define a Function for Summarization
const summarizeFunction = {
  name: "summarize_document",
  description: "Summarizes the uploaded document in a few sentences.",
  parameters: {
    type: "object",
    properties: {
      detail_level: { type: "string", enum: ["short", "detailed"] },
    },
    required: ["detail_level"],
  },
};

// 🎯 Run Assistant with Function Calling
export async function GET() {
  try {
    console.log("🔎 Running Assistant with Functions...");

    const response = await openai.beta.threads.createAndRun({
      assistant_id: "asst_7rdHvldYzbkUUnYSVz2FVQBY", // Replace with your assistant ID
      model: "gpt-4-1106-preview",
      thread: {
        messages: [{ role: "user", content: "Summarize this document." }],
      },
      tools: [{ type: "function", function: summarizeFunction }], // 🔥 Enable Function
    });

    console.log("💡 AI Response:", response);
    return NextResponse.json({ message: response.results[0]?.message.content });
    // return NextResponse.json({ message: response });

  } catch (error: any) {
    console.error("❌ Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
