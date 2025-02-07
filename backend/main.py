import os
import uuid
import shutil
import logging
import openai
import boto3
from flask import Flask, request, jsonify, render_template, session, stream_with_context, Response
from dotenv import load_dotenv
from duckduckgo_search import DDGS
from langchain_chroma import Chroma
from langchain_community.embeddings import HuggingFaceEmbeddings
from langchain.text_splitter import RecursiveCharacterTextSplitter
from PyPDF2 import PdfReader
from docx import Document

# Load environment variables from .env file
load_dotenv()

app = Flask(__name__)
app.secret_key = os.getenv("SECRET_KEY")

# Logging setup
logging.basicConfig(filename="app.log", level=logging.INFO)

# OpenRouter API Settings (DeepSeek R1)
openrouter_api_key = os.getenv("DEEPSEEK_API_KEY")
openai.api_base = "https://openrouter.ai/api/v1"
openai.api_key = openrouter_api_key
DEEPEEK_MODEL = "deepseek/deepseek-r1:free"

# S3 Bucket name
S3_BUCKET = os.getenv("S3_BUCKET")

# Text Splitter
text_splitter = RecursiveCharacterTextSplitter(chunk_size=500, chunk_overlap=50)

# Load global vector database
global_vector_db = Chroma(
    persist_directory="global_chroma",
    embedding_function=HuggingFaceEmbeddings(model_name="paraphrase-MiniLM-L6-v2")
)

#########################################
# Helper: Get or Create Session Vector DB
#########################################
def get_session_vector_db():
    if "session_id" not in session:
        session["session_id"] = str(uuid.uuid4())
    session_db_path = f"temp_chroma/{session['session_id']}"
    os.makedirs(session_db_path, exist_ok=True)
    return Chroma(
        persist_directory=session_db_path,
        embedding_function=HuggingFaceEmbeddings(model_name="paraphrase-MiniLM-L6-v2")
    )

#########################################
# Text Extraction Functions
#########################################
def extract_text_from_file(file):
    """Extracts text from PDF, DOCX, and TXT files."""
    try:
        if file.filename.endswith(".pdf"):
            reader = PdfReader(file)
            return "".join(page.extract_text() or "" for page in reader.pages)
        elif file.filename.endswith(".docx"):
            doc = Document(file)
            return "\n".join(para.text for para in doc.paragraphs)
        elif file.filename.endswith(".txt"):
            return file.read().decode("utf-8")
        else:
            return None
    except Exception as e:
        logging.error(f"Error extracting text from {file.filename}: {str(e)}")
        return None

#########################################
# Query DeepSeek R1 via OpenRouter
#########################################
def query_deepseek(prompt):
    """Queries DeepSeek R1 model via OpenRouter."""
    try:
        response = openai.ChatCompletion.create(
            model=DEEPEEK_MODEL,
            messages=[{"role": "user", "content": prompt}]
        )
        return response.choices[0].message.content.strip()
    except Exception as e:
        logging.error(f"Error querying DeepSeek R1: {str(e)}")
        return f"Error: {str(e)}"

#########################################
# Internet Search (Fallback)
#########################################
def internet_search(query):
    """Performs an internet search if no document context is found."""
    try:
        with DDGS() as ddgs:
            results = ddgs.text(query, max_results=1)
            if results:
                return results[0].get("body", results[0].get("snippet", "No relevant results found."))
            return "No relevant results found."
    except Exception as e:
        logging.error(f"Internet search error: {str(e)}")
        return "Error occurred while searching the internet."

#########################################
# Ask Question Route with Typewriter Effect
#########################################
@app.route("/ask", methods=["POST"])
def ask_question():
    """Handles user queries in three steps: session documents, global documents, and internet search."""
    data = request.get_json()
    question = data.get("question", "")
    if not question:
        return jsonify({"error": "No question provided"}), 400

    session_vector_db = get_session_vector_db()

    # Step 1: Check in session-specific documents
    session_docs = session_vector_db.similarity_search(question, k=3)
    if session_docs:
        source = "session documents"
        context = "\n".join([doc.page_content for doc in session_docs])
    else:
        # Step 2: Check in global documents
        global_docs = global_vector_db.similarity_search(question, k=3)
        if global_docs:
            source = "global documents"
            context = "\n".join([doc.page_content for doc in global_docs])
        else:
            # Step 3: Search the internet
            source = "internet"
            context = internet_search(question)

    # Create final prompt
    prompt = f"Context Source: {source}\n\nContext:\n{context}\n\nQuestion: {question}\nAnswer:"

    def generate_answer():
        response = query_deepseek(prompt)
        for word in response.split():
            yield word + " "
            import time; time.sleep(0.05)  # Typewriter effect

    return Response(stream_with_context(generate_answer()), mimetype='text/plain')

#########################################
# Frontend: Home Page with Loader
#########################################
@app.route("/")
def home():
    return render_template("index.html")

if __name__ == "__main__":
    app.run(debug=True)