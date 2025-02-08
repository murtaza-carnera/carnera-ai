import 'cheerio';
import { CheerioWebBaseLoader } from '@langchain/community/document_loaders/web/cheerio';
import { S3Loader } from '@langchain/community/document_loaders/web/s3';
import { Document } from '@langchain/core/documents';
import { ChatPromptTemplate } from '@langchain/core/prompts';
import { pull } from 'langchain/hub';
import {
  Annotation,
  StateGraph,
  MessagesAnnotation,
} from '@langchain/langgraph';
import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters';
import { vectorStore } from '@/db/db';
import { llm } from './carneraai';

import { z } from "zod";

const searchSchema = z.object({
  query: z.string().describe("Search query to run."),
  section: z.enum(["beginning", "middle", "end"]).describe("Section to query."),
});

const structuredLlm = llm.withStructuredOutput(searchSchema);

// Define annotations
const InputStateAnnotation = Annotation.Root({
  question: Annotation<string>,
});

const StateAnnotation = Annotation.Root({
  question: Annotation<string>,
  context: Annotation<Document[]>,
  answer: Annotation<string>,
});

const StateAnnotationQA = Annotation.Root({
  question: Annotation<string>,
  search: Annotation<z.infer<typeof searchSchema>>,
  context: Annotation<Document[]>,
  answer: Annotation<string>,
});

// Define functions for retrieval and generation
const analyzeQuery = async (state: typeof InputStateAnnotation.State) => {
  const result = await structuredLlm.invoke(state.question);
  return { search: result };
};

const retrieve = async (state: typeof InputStateAnnotation.State) => {
  const retrievedDocs = await vectorStore.similaritySearch(state.question);
  return { context: retrievedDocs };
};

const retrieveQA = async (state: typeof StateAnnotationQA.State) => {
  const filter = (doc: any) => doc.metadata.section === state.search.section;
  const retrievedDocs = await vectorStore.similaritySearch(
    state.search.query,
    2,
    filter
  );
  return { context: retrievedDocs };
};

const generate = async (state: typeof StateAnnotation.State) => {
  const docsContent = state.context.map((doc) => doc.pageContent).join('\n');
  const promptTemplate = await pull<ChatPromptTemplate>('rlm/rag-prompt');
  const messages = await promptTemplate.invoke({
    question: state.question,
    context: docsContent,
  });
  const response = await llm.invoke(messages);
  return { answer: response.content };
};

const generateQA = async (state: typeof StateAnnotationQA.State) => {
  const docsContent = state.context.map((doc) => doc.pageContent).join("\n");
  const promptTemplate = await pull<ChatPromptTemplate>('rlm/rag-prompt');
  const messages = await promptTemplate.invoke({
    question: state.question,
    context: docsContent,
  });
  const response = await llm.invoke(messages);
  return { answer: response.content };
};

// Function to load and process documents
export async function loadAndProcessDocuments() {
  console.log('Loading and processing documents...');

  const loader = new S3Loader({
    bucket: process.env.CARNERAAI_AWS_S3_BUCKET_NAME!,
    key: 'b27ec1e2-3d81-4517-bf50-1584706663aa.Carnera Profile - Harsh Tenguriya.docx',
    s3Config: {
      region: process.env.CARNERAAI_AWS_REGION!,
      credentials: {
        accessKeyId: process.env.CARNERAAI_AWS_ACCESS_KEY_ID!,
        secretAccessKey: process.env.CARNERAAI_AWS_SECRET_ACCESS_KEY!,
      },
    },
    unstructuredAPIURL: process.env.CARNERAAI_UNSTRUCTURED_API_URL!,
    unstructuredAPIKey: process.env.CARNERAAI_UNSTRUCTURED_API_KEY!,
  });

  const docs = await loader.load();

  const splitter = new RecursiveCharacterTextSplitter({
    chunkSize: 1000,
    chunkOverlap: 200,
  });
  const allSplits = await splitter.splitDocuments(docs);

  // Index chunks
  await vectorStore.addDocuments(allSplits);
}

// Function to create the standard retrieval-augmented generation graph
export function createGraph() {
  return new StateGraph(StateAnnotation)
    .addNode('retrieve', retrieve)
    .addNode('generate', generate)
    .addEdge('__start__', 'retrieve')
    .addEdge('retrieve', 'generate')
    .addEdge('generate', '__end__')
    .compile();
}

// Function to create the question-answering graph with query analysis
export function createGraphQA() {
  return new StateGraph(StateAnnotationQA)
    .addNode("analyzeQuery", analyzeQuery)
    .addNode("retrieveQA", retrieveQA)
    .addNode("generateQA", generateQA)
    .addEdge("__start__", "analyzeQuery")
    .addEdge("analyzeQuery", "retrieveQA")
    .addEdge("retrieveQA", "generateQA")
    .addEdge("generateQA", "__end__")
    .compile();
}

// Main function to execute both graphs
export async function ai() {
  await loadAndProcessDocuments();

  const graph = createGraph();
  const graphQA = createGraphQA();

  return { graph, graphQA };
}
