from flask import Flask, request, jsonify, render_template, session
from langchain_chroma import Chroma  
from langchain_community.embeddings import HuggingFaceEmbeddings
from langchain.text_splitter import RecursiveCharacterTextSplitter
import requests
import os
import shutil
import uuid
from werkzeug.utils import secure_filename
from PyPDF2 import PdfReader
from docx import Document
import logging

app = Flask(__name__)
app.secret_key = os.getenv("SECRET_KEY")        # Needed for managing Flask sessions

# Logging setup
logging.basicConfig(filename="app.log", level=logging.INFO)

# Hugging Face API Settings
HF_TOKEN = os.getenv("HF_TOKEN")
MISTRAL_API_URL = "https://api-inference.huggingface.co/models/tiiuae/falcon-7b-instruct"
HEADERS = {"Authorization": f"Bearer {HF_TOKEN}"}

# Text Splitter
text_splitter = RecursiveCharacterTextSplitter(chunk_size=500, chunk_overlap=50)

# Query Mistral API
def query_mistral(prompt):
    payload = {"inputs": prompt, "parameters": {"max_length": 500, "temperature": 0.2}}
    try:
        response = requests.post(MISTRAL_API_URL, headers=HEADERS, json=payload)
        if response.status_code == 200:
            return response.json()[0]["generated_text"]
        else:
            logging.error(f"Mistral API Error: {response.json()}")
            return f"Error: {response.json()}"
    except Exception as e:
        logging.error(f"Error querying Mistral API: {str(e)}")
        return f"Error: {str(e)}"

# Extract Text from File
def extract_text_from_file(file):
    try:
        if file.filename.endswith(".pdf"):
            reader = PdfReader(file)
            return "".join(page.extract_text() for page in reader.pages)
        elif file.filename.endswith(".docx"):
            return "\n".join(para.text for para in Document(file).paragraphs)
        elif file.filename.endswith(".txt"):
            return file.read().decode("utf-8")
        else:
            raise Exception("Unsupported file format")
    except Exception as e:
        logging.error(f"Error extracting text from file {file.filename}: {str(e)}")
        return None

# Initialize temporary storage per session
def get_session_vector_db():
    if "session_id" not in session:
        session["session_id"] = str(uuid.uuid4())  # Unique session ID

    session_db_path = f"temp_chroma/{session['session_id']}"
    
    # Ensure directory exists
    os.makedirs(session_db_path, exist_ok=True)
    
    return Chroma(
        persist_directory=session_db_path,
        embedding_function=HuggingFaceEmbeddings(model_name="paraphrase-MiniLM-L6-v2")
    )

# Upload Document Route
@app.route("/upload", methods=["POST"])
def upload_document():
    file = request.files.get("file")
    if not file:
        return jsonify({"error": "No file uploaded"}), 400

    text = extract_text_from_file(file)
    if not text:
        return jsonify({"error": "Failed to extract text"}), 400

    chunks = text_splitter.split_text(text)
    documents = [{"content": chunk, "metadata": {"source": file.filename}} for chunk in chunks]

    # Get session-specific vector database
    vector_db = get_session_vector_db()
    vector_db.add_texts([doc["content"] for doc in documents], metadatas=[doc["metadata"] for doc in documents])

    logging.info(f"Uploaded {file.filename} with {len(chunks)} chunks for session {session['session_id']}.")
    return jsonify({"message": "Document uploaded successfully!"}), 200

# Ask Question Route
@app.route("/ask", methods=["POST"])
def ask_question():
    data = request.get_json()
    question = data.get("question", "")

    if not question:
        return jsonify({"error": "No question provided"}), 400

    vector_db = get_session_vector_db()
    docs = vector_db.similarity_search(question, k=3)
    context = "\n".join([doc.page_content for doc in docs])

    prompt = f"""Answer the question based on the provided document. 
                If you don't know the answer, say you don't know.
                Context:\n{context}\n\nQuestion: {question}\nAnswer:"""

    answer = query_mistral(prompt)
    return jsonify({"answer": answer})

# Clear Session and Temporary Data
@app.route("/end_session", methods=["POST"])
def end_session():
    if "session_id" in session:
        session_db_path = f"temp_chroma/{session['session_id']}"

        # Delete stored embeddings for the session
        if os.path.exists(session_db_path):
            shutil.rmtree(session_db_path)

        # Clear session variables and prevent caching
        session.clear()
        response = jsonify({"message": "Session cleared successfully."})
        response.headers["Cache-Control"] = "no-cache, no-store, must-revalidate"
        response.headers["Pragma"] = "no-cache"
        response.headers["Expires"] = "0"
        return response, 200

    return jsonify({"message": "No active session to clear."}), 400
# Home Page
@app.route("/")
def home():
    return render_template("index.html")

if __name__ == "__main__":
    app.run(debug=True)
