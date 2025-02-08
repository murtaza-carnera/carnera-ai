import { NextResponse } from "next/server";
import OpenAI from "openai";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
  organization: process.env.OPENAI_ORG!,
});

export async function POST(req: Request) {
  try {
    console.log("🔎 Running Assistant with Functions...");

    // 1️⃣ Parse the API request body
    const { prompt, thread_id } = await req.json();

    if (!prompt) {
      return NextResponse.json({ error: "Prompt is required" }, { status: 400 });
    }

    let thread;
    if (thread_id) {
      // 2️⃣ Use the provided thread ID
      console.log("🔄 Using existing thread:", thread_id);
      thread = { id: thread_id };
    } else {
      // 2️⃣ Create a new thread if none is provided
      thread = await openai.beta.threads.create();
      console.log("✨ Created new thread:", thread.id);
    }

    // 3️⃣ Start a run with the Assistant
    let run = await openai.beta.threads.runs.createAndPoll(thread.id, {
      assistant_id: "asst_7rdHvldYzbkUUnYSVz2FVQBY",
      instructions: prompt, // Use the prompt from the API request
    });

    // 4️⃣ Check if the run is completed
    if (run.status === "completed") {
      const messages = await openai.beta.threads.messages.list(thread.id);

      // 5️⃣ Extract the assistant's response text
      let responseText = "";
      for (const message of messages.data.reverse()) {
        const content = message.content[0];
        if ("text" in content) {
          responseText += `${content.text.value}\n\n`;
        }
      }

      console.log("📝 Assistant Response:", responseText);

      // 6️⃣ Return the response along with the thread ID
      return NextResponse.json({ 
        thread_id: thread.id, 
        message: responseText.trim() 
      });
    } else {
      console.log("🔄 Run Status:", run.status);
      return NextResponse.json({ 
        thread_id: thread.id, 
        message: "Processing, please wait..." 
      });
    }

  } catch (error: any) {
    console.error("❌ Error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
