
import os
from pathlib import Path

from dotenv import load_dotenv
from openai import OpenAI

# Load environment variables from the VVA root folder
project_root = Path(__file__).resolve().parent.parent
load_dotenv(project_root / ".env.example")

api_key = os.getenv("NVIDIA_API_KEY")
model = os.getenv("NVIDIA_MODEL", "openai/gpt-oss-20b")

if not api_key:
    raise SystemExit(
        "ERROR: NVIDIA_API_KEY is missing from your .env file."
    )

client = OpenAI(
    base_url="https://integrate.api.nvidia.com/v1",
    api_key=api_key,
    timeout=60.0,
)

try:
    
    response = client.chat.completions.create(
        model=model,
        messages=[
            {
                "role": "user",
                "content": "What is 2 + 2? Reply with the answer only."
            }
        ],
        max_tokens=500,
    )

    print("Finish reason:", response.choices[0].finish_reason)
    print("Response:", response.choices[0].message.content)



except Exception as error:
    print("\nAPI TEST FAILED")
    print("Error type:", type(error).__name__)
    print("Details:", str(error))
