import { ai } from "@/services/lang";
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { v4 as uuidv4 } from 'uuid';
import { NextRequest, NextResponse } from 'next/server';

const s3Client = new S3Client({
  region: process.env.CARNERAAI_AWS_REGION,
  credentials: {
    accessKeyId: process.env.CARNERAAI_AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.CARNERAAI_AWS_SECRET_ACCESS_KEY!,
  },
});

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const question = formData.get("question")?.toString(); // Retrieve the question
    const file = formData.get("file") as File | null; // Retrieve file if present

    let uploadedFileName: string | null = null;

    if (file) {
      const fileBuffer = Buffer.from(await file.arrayBuffer());
      const fileName = `${uuidv4()}-${file.name}`;

      const uploadParams = {
        Bucket: process.env.CARNERAAI_AWS_S3_BUCKET_NAME!,
        Key: fileName,
        Body: fileBuffer,
        ContentType: file.type,
      };

      await s3Client.send(new PutObjectCommand(uploadParams));
      uploadedFileName = fileName;
    }

    // Process AI response
    const carneraAi = await ai();
    const inputs = { question };

    console.log("Received Inputs:", inputs);

    const stream = await carneraAi.graphQA.stream(inputs, { streamMode: "updates" });

    const readableStream = new ReadableStream({
      async start(controller) {
        for await (const chunk of stream) {
          console.log("Streaming Chunk:", chunk);
          if (chunk?.generateQA?.answer) {
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
    return NextResponse.json({ error: 'Error processing request' }, { status: 500 });
  }
}
