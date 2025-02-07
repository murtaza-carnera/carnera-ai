import { ai } from "@/services/lang";
import { NextRequest } from "next/server";

const graph = ai();

export async function GET(request: NextRequest): Promise<Response> {
  try {
    const { searchParams } = new URL(request.url);
    let inputs = { question: searchParams.get('question')?.toString() };
    const result = await (await graph).invoke(inputs);
    return new Response(result.answer, { status: 200 });
  } catch (error) {
    console.error(error);
    return new Response('Error', { status: 500 });
  }
}