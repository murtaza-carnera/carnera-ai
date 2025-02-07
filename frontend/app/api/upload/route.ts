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

export async function POST(req: NextRequest, res: NextResponse) {
    try {
      let { file, fileName, fileType } = await req.json();
      const buffer = Buffer.from(file, 'base64');
      fileName = `${uuidv4()}.${fileName}`;

      const uploadParams = {
        Bucket: process.env.CARNERAAI_AWS_S3_BUCKET_NAME!,
        Key: fileName,
        Body: buffer,
        ContentEncoding: 'base64',
        ContentType: fileType
      };

      await s3Client.send(new PutObjectCommand(uploadParams));

      return NextResponse.json({ message: 'File uploaded successfully', fileName }, { status: 200 });
    } catch (error) {
      console.error(error);
      return NextResponse.json({ error: 'Error uploading file' }, { status: 500 });
  }
}
