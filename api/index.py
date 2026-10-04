from fastapi import FastAPI
from backend.main import app as backend_app

# Export FastAPI app for Vercel Serverless Functions (Python runtime)
app = backend_app
