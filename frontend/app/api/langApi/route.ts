import { ai } from "@/services/lang";
import { NextRequest } from "next/server";

const carneraAi = ai();

export async function GET(request: NextRequest): Promise<Response> {
  try {
    const { searchParams } = new URL(request.url);
    let inputs = { question: searchParams.get('question')?.toString() };

    const stream = await (await carneraAi).graph.stream(inputs, { streamMode: "messages" });

    const readableStream = new ReadableStream({
      async start(controller) {
        for await (const [message, _metadata] of stream) {
          controller.enqueue(new TextEncoder().encode(message.content));
        }
        controller.close();
      }
    });

    return new Response(readableStream, {
      headers: { "Content-Type": "text/plain" },
      status: 200
    });

  } catch (error) {
    console.error(error);
    return new Response('Error', { status: 500 });
  }
}
