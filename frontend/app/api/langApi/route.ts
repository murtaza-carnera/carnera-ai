import { ai } from "@/services/lang";
import { NextRequest } from "next/server";



// export async function _GET(request: NextRequest): Promise<Response> {
//   try {
//     const carneraAi = ai();
//     const { searchParams } = new URL(request.url);
//     let inputs = { question: searchParams.get('question')?.toString() };

//     const stream = await (await carneraAi).graphQA.stream(inputs, { streamMode: "messages" });

//     const readableStream = new ReadableStream({
//       async start(controller) {
//         for await (const [message, _metadata] of stream) {
//           controller.enqueue(new TextEncoder().encode(message.content));
//         }
//         controller.close();
//       }
//     });

//     return new Response(readableStream, {
//       headers: { "Content-Type": "text/plain" },
//       status: 200
//     });

//   } catch (error) {
//     console.error(error);
//     return new Response('Error', { status: 500 });
//   }
// }

export async function GET(request: NextRequest): Promise<Response> {
  try {
    const carneraAi = await ai(); // Ensure ai() is awaited properly
    const { searchParams } = new URL(request.url);
    let inputs = { question: searchParams.get("question")?.toString() };

    console.log("Received Inputs:", inputs);

    const stream = await carneraAi.graphQA.stream(inputs, { streamMode: "updates" });

    const readableStream = new ReadableStream({
      async start(controller) {
        for await (const chunk of stream) {
          console.log("Streaming Chunk:", chunk); // Debugging Step
          if(chunk && chunk.generateQA && chunk.generateQA.answer) {
          controller.enqueue(new TextEncoder().encode(JSON.stringify(chunk.generateQA.answer) + "\n====\n"));
          }
        }
        controller.close();
      },
    });

    return new Response(readableStream, {
      headers: { "Content-Type": "text/plain" },
      status: 200,
    });

  } catch (error) {
    console.error("Error in API:", error);
    return new Response("Error", { status: 500 });
  }
}

