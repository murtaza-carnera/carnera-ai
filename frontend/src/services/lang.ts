
import "cheerio";
import { CheerioWebBaseLoader } from "@langchain/community/document_loaders/web/cheerio";
import { Document } from "@langchain/core/documents";
import { ChatPromptTemplate } from "@langchain/core/prompts";
import { pull } from "langchain/hub";
import { Annotation, StateGraph } from "@langchain/langgraph";
import { RecursiveCharacterTextSplitter } from "@langchain/textsplitters";
import { vectorStore } from "@/db/db";
import { llm } from "./carneraai";
// import z from "zod";

// const searchSchema = z.object({
//   query: z.string().describe("Search query to run."),
//   section: z.enum(["beginning", "middle", "end"]).describe("Section to query."),
// });

// const structuredLlm = llm.withStructuredOutput(searchSchema);



export async function ai(){
    console.log("Hello from ai function");

// Load and chunk contents of blog
const pTagSelector = "p";
const cheerioLoader = new CheerioWebBaseLoader(
  "https://lilianweng.github.io/posts/2023-06-23-agent/",
  {
    selector: pTagSelector
  }
);

const docs = await cheerioLoader.load();

const splitter = new RecursiveCharacterTextSplitter({
  chunkSize: 1000, chunkOverlap: 200
});
const allSplits = await splitter.splitDocuments(docs);


// Index chunks


// const vectorStoreQA = new MemoryVectorStore(embeddings);
await vectorStore.addDocuments(allSplits)

// Define prompt for question-answering
const promptTemplate = await pull<ChatPromptTemplate>("rlm-carnera-ai-rag-1");

// Define state for application
const InputStateAnnotation = Annotation.Root({
  question: Annotation<string>,
});

const StateAnnotation = Annotation.Root({
  question: Annotation<string>,
  context: Annotation<Document[]>,
  answer: Annotation<string>,
});

// const StateAnnotationQA = Annotation.Root({
//   question: Annotation<string>,
//   search: Annotation<z.infer<typeof searchSchema>>,
//   context: Annotation<Document[]>,
//   answer: Annotation<string>,
// });

// const analyzeQuery = async (state: typeof InputStateAnnotation.State) => {
//   const result = await structuredLlm.invoke(state.question);
//   return { search: result };
// };

// Define application steps
const retrieve = async (state: typeof InputStateAnnotation.State) => {
  const retrievedDocs = await vectorStore.similaritySearch(state.question)
  return { context: retrievedDocs };
};

// const retrieveQA = async (state: typeof StateAnnotationQA.State) => {
//   const filter = (doc: any) => doc.metadata.section === state.search.section;
//   const retrievedDocs = await vectorStoreQA.similaritySearch(
//     state.search.query,
//     2,
//     filter
//   );
//   return { context: retrievedDocs };
// };




const generate = async (state: typeof StateAnnotation.State) => {
  const docsContent = state.context.map(doc => doc.pageContent).join("\n");
  const messages = await promptTemplate.invoke({ question: state.question, context: docsContent });
  const response = await llm.invoke(messages);
  return { answer: response.content };
};

// const generateQA = async (state: typeof StateAnnotationQA.State) => {
//   const docsContent = state.context.map((doc) => doc.pageContent).join("\n");
//   const messages = await promptTemplate.invoke({
//     question: state.question,
//     context: docsContent,
//   });
//   const response = await llm.invoke(messages);
//   return { answer: response.content };
// };


// Compile application and test
const graph = new StateGraph(StateAnnotation)
  .addNode("retrieve", retrieve)
  .addNode("generate", generate)
  .addEdge("__start__", "retrieve")
  .addEdge("retrieve", "generate")
  .addEdge("generate", "__end__")
  .compile();

  // const graphQA = new StateGraph(StateAnnotationQA)
  // .addNode("analyzeQuery", analyzeQuery)
  // .addNode("retrieveQA", retrieveQA)
  // .addNode("generateQA", generateQA)
  // .addEdge("__start__", "analyzeQuery")
  // .addEdge("analyzeQuery", "retrieveQA")
  // .addEdge("retrieveQA", "generateQA")
  // .addEdge("generateQA", "__end__")
  // .compile();

return {graph};


}