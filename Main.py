from fastapi import FastAPI, Request, File, UploadFile, HTTPException
from fastapi.responses import HTMLResponse
from fastapi.templating import Jinja2Templates
from fastapi.staticfiles import StaticFiles

from groq import Groq
from pydantic import BaseModel

import shutil
import re
import base64
import os
import mimetypes
import requests
import httpx

from dotenv import load_dotenv, find_dotenv

load_dotenv(find_dotenv())

app = FastAPI()

app.mount("/static", StaticFiles(directory="static"), name="static")

templates = Jinja2Templates(directory="templates")

# API clients
client = Groq(api_key=os.getenv("GROQ_API_KEY"))

YOUTUBE_API_KEY = os.getenv("YOUTUBE_API_KEY")

MODEL_NAME = "qwen/qwen3.8-27b"

# Project 2 (video generator) base URL
PROJECT2_URL = os.getenv("PROJECT2_URL")


@app.get("/", response_class=HTMLResponse)
async def home(request: Request):
    return templates.TemplateResponse(request, "index.html")


# ------------------------------------------------------
# Trigger fallback video generation on project 2
# ------------------------------------------------------

async def trigger_fallback_video(image_path: str, mime_type: str) -> str | None:
    try:
        async with httpx.AsyncClient(timeout=15) as http_client:
            with open(image_path, "rb") as f:
                files = {"image": (os.path.basename(image_path), f, mime_type)}
                resp = await http_client.post(
                    f"{PROJECT2_URL}/image/generate/video-job", files=files
                )
            resp.raise_for_status()
            return resp.json()["job_id"]
    except Exception as e:
        print("❌ Failed to trigger fallback video:", e)
        return None


@app.post("/generate-video-manual")
async def generate_video_manual(image: UploadFile = File(...)):
    """
    Manually trigger project 2's video generation for a given image,
    regardless of whether a YouTube video was found.
    """
    image_path = f"./manual_{image.filename}"

    with open(image_path, "wb") as buffer:
        shutil.copyfileobj(image.file, buffer)

    mime_type = (
        image.content_type
        or mimetypes.guess_type(image.filename)[0]
        or "image/jpeg"
    )

    job_id = await trigger_fallback_video(image_path, mime_type)

    if not job_id:
        raise HTTPException(
            status_code=502,
            detail="Could not start video generation. Is project 2 running?"
        )

    return {"job_id": job_id}


@app.post("/process-image")
async def process_image(image: UploadFile = File(...)):

    # Save uploaded image
    image_path = f"./{image.filename}"

    with open(image_path, "wb") as buffer:
        shutil.copyfileobj(image.file, buffer)

    # Detect MIME type
    mime_type = (
        image.content_type
        or mimetypes.guess_type(image.filename)[0]
        or "image/jpeg"
    )

    # Convert image to Base64
    with open(image_path, "rb") as img_file:
        base64_image = base64.b64encode(
            img_file.read()
        ).decode("utf-8")

    image_data_url = f"data:{mime_type};base64,{base64_image}"

    # --------------------------------------------------
    # 1. Solve the math problem using Groq
    # --------------------------------------------------

    solution_completion = client.chat.completions.create(
        model=MODEL_NAME,
        messages=[
            {
                "role": "user",
                "content": [
                    {
                        "type": "text",
                        "text": (
                            "This is a math problem. "
                            "Solve it and provide a clear "
                            "step-by-step solution."
                        )
                    },
                    {
                        "type": "image_url",
                        "image_url": {
                            "url": image_data_url
                        }
                    }
                ]
            }
        ]
    )

    solution_text = (
        solution_completion
        .choices[0]
        .message
        .content
        .strip()
    )

    # --------------------------------------------------
    # 2. Ask Groq for the mathematical topic
    # --------------------------------------------------

    topic_completion = client.chat.completions.create(
        model=MODEL_NAME,
        messages=[
            {
                "role": "user",
                "content": [
                    {
                        "type": "text",
                        "text": (
                            "Identify the main mathematical topic "
                            "of this problem and return ONLY a "
                            "short YouTube search query. "
                            "For example: "
                            "'quadratic equations', "
                            "'integration by parts', "
                            "'Newton Raphson method'. "
                            "Do not provide a URL."
                        )
                    },
                    {
                        "type": "image_url",
                        "image_url": {
                            "url": image_data_url
                        }
                    }
                ]
            }
        ]
    )

    youtube_query = (
        topic_completion
        .choices[0]
        .message
        .content
        .strip()
    )

    # Remove unnecessary quotation marks
    youtube_query = youtube_query.strip("\"'")

    # --------------------------------------------------
    # 2b. Ask Groq to extract the literal question text
    #     (used to find a video solving this exact problem)
    # --------------------------------------------------

    question_completion = client.chat.completions.create(
        model=MODEL_NAME,
        messages=[
            {
                "role": "user",
                "content": [
                    {
                        "type": "text",
                        "text": (
                            "Transcribe ONLY the exact math question/equation "
                            "shown in this image as plain text. "
                            "No explanation, no solution, just the question. "
                            "Example: '2x + 5 = 10'"
                        )
                    },
                    {
                        "type": "image_url",
                        "image_url": {
                            "url": image_data_url
                        }
                    }
                ]
            }
        ]
    )

    question_text = (
        question_completion
        .choices[0]
        .message
        .content
        .strip()
        .strip("\"'")
    )

    # --------------------------------------------------
    # 3. Search YouTube: try the exact question first,
    #    fall back to the general topic if nothing relevant.
    # --------------------------------------------------

    youtube_videos = find_best_youtube_matches(question_text, youtube_query)

    # --------------------------------------------------
    # 4. If no YouTube results, trigger fallback video generation
    # --------------------------------------------------

    fallback_video_job_id = None
    if not youtube_videos:
        fallback_video_job_id = await trigger_fallback_video(image_path, mime_type)

    # --------------------------------------------------
    # 5. Return everything to frontend
    # --------------------------------------------------

    return {
        "solution": solution_text,
        "youtube_query": youtube_query,
        "youtube_reference": (
            youtube_videos[0]["url"]
            if youtube_videos
            else None
        ),
        "youtube_videos": youtube_videos,
        "fallback_video_job_id": fallback_video_job_id
    }


# ------------------------------------------------------
# Manual (typed) question endpoint
# ------------------------------------------------------

class ManualQuestionRequest(BaseModel):
    question: str


@app.post("/process-manual-question")
async def process_manual_question(payload: ManualQuestionRequest):

    question = payload.question.strip()

    if not question:
        raise HTTPException(status_code=400, detail="Question cannot be empty")

    # 1. Solve the question using Groq
    solution_completion = client.chat.completions.create(
        model=MODEL_NAME,
        messages=[
            {
                "role": "user",
                "content": (
                    "Solve this math problem and provide a clear, "
                    f"step-by-step solution:\n\n{question}"
                )
            }
        ]
    )

    solution_text = (
        solution_completion
        .choices[0]
        .message
        .content
        .strip()
    )

    # 2. Ask Groq for the mathematical topic (for YouTube search)
    topic_completion = client.chat.completions.create(
        model=MODEL_NAME,
        messages=[
            {
                "role": "user",
                "content": (
                    "Identify the main mathematical topic of this question "
                    "and return ONLY a short YouTube search query. "
                    "For example: 'quadratic equations', "
                    "'integration by parts', 'Newton Raphson method'. "
                    f"Do not provide a URL.\n\nQuestion: {question}"
                )
            }
        ]
    )

    youtube_query = (
        topic_completion
        .choices[0]
        .message
        .content
        .strip()
        .strip("\"'")
    )

    # 3. Search YouTube
    youtube_videos = search_youtube_videos(youtube_query)

    return {
        "solution": solution_text,
        "youtube_query": youtube_query,
        "youtube_reference": (
            youtube_videos[0]["url"]
            if youtube_videos
            else None
        ),
        "youtube_videos": youtube_videos
    }


# ------------------------------------------------------
# Proxy: check fallback video job status on project 2
# ------------------------------------------------------

@app.get("/video-status/{job_id}")
async def video_status(job_id: str):
    async with httpx.AsyncClient(timeout=10) as http_client:
        try:
            resp = await http_client.get(f"{PROJECT2_URL}/jobs/{job_id}")
        except Exception as e:
            raise HTTPException(status_code=502, detail=f"Could not reach video service: {e}")

    if resp.status_code == 404:
        raise HTTPException(status_code=404, detail="Job not found")

    data = resp.json()

    if data.get("status") == "done" and data.get("video_url"):
        data["video_url"] = f"{PROJECT2_URL}{data['video_url']}"

    return data


# ------------------------------------------------------
# Relevance scoring + two-stage YouTube search
# ------------------------------------------------------

import difflib
import re as _re


def _normalize(text: str) -> str:
    """Lowercase and strip non-alphanumeric characters for comparison."""
    return _re.sub(r"[^a-z0-9]+", " ", text.lower()).strip()


def _title_relevance(question_text: str, title: str) -> float:
    """
    Score 0.0-1.0 for how closely a video title matches the question.
    Combines exact-token overlap (good for equations like '2x+5=10')
    with a fuzzy string similarity as a fallback signal.
    """
    q_norm = _normalize(question_text)
    t_norm = _normalize(title)

    if not q_norm:
        return 0.0

    q_tokens = set(q_norm.split())
    t_tokens = set(t_norm.split())

    if not q_tokens:
        return 0.0

    overlap = len(q_tokens & t_tokens) / len(q_tokens)
    fuzzy = difflib.SequenceMatcher(None, q_norm, t_norm).ratio()

    # Weight exact token overlap higher than fuzzy similarity,
    # since numbers/variables matching exactly matters most.
    return (0.7 * overlap) + (0.3 * fuzzy)


def find_best_youtube_matches(
    question_text: str,
    topic_query: str,
    relevance_threshold: float = 0.45
):
    """
    Try to find YouTube videos that solve this exact question.
    1. Search using the literal question text.
    2. Score each result's title against the question.
    3. If nothing clears the threshold, fall back to a topic search
       (scored the same way, with a lower bar since it's a broader query).
    4. If still nothing relevant, return an empty list so the
       fallback AI video generation kicks in.
    """

    # Stage 1: search by the exact question text
    exact_results = search_youtube_videos(question_text)

    scored = []
    for video in exact_results:
        score = _title_relevance(question_text, video.get("title", ""))
        scored.append((score, video))

    scored.sort(key=lambda pair: pair[0], reverse=True)

    relevant = [video for score, video in scored if score >= relevance_threshold]

    if relevant:
        return relevant

    # Stage 2: fall back to the general topic search
    topic_results = search_youtube_videos(topic_query)

    scored_topic = []
    for video in topic_results:
        score = _title_relevance(question_text, video.get("title", ""))
        scored_topic.append((score, video))

    scored_topic.sort(key=lambda pair: pair[0], reverse=True)

    # Lower bar here since topic queries are inherently more generic
    relevant_topic = [
        video for score, video in scored_topic if score >= (relevance_threshold * 0.5)
    ]

    return relevant_topic


# ------------------------------------------------------
# YouTube API Search Function
# ------------------------------------------------------

def search_youtube_videos(query: str):

    url = "https://www.googleapis.com/youtube/v3/search"

    params = {
        "part": "snippet",
        "q": query,
        "type": "video",
        "maxResults": 5,
        "key": YOUTUBE_API_KEY
    }

    try:

        response = requests.get(
            url,
            params=params,
            timeout=10
        )

        response.raise_for_status()

        data = response.json()

        videos = []

        for item in data.get("items", []):

            video_id = item["id"].get("videoId")

            if not video_id:
                continue

            snippet = item.get("snippet", {})

            videos.append({
                "title": snippet.get("title"),
                "description": snippet.get("description"),
                "channel": snippet.get("channelTitle"),
                "thumbnail": (
                    snippet
                    .get("thumbnails", {})
                    .get("medium", {})
                    .get("url")
                ),
                "url": f"https://www.youtube.com/watch?v={video_id}",
                "video_id": video_id
            })

        return videos

    except requests.exceptions.Timeout:
        print("❌ YouTube API request timed out.")
        return []

    except requests.exceptions.ConnectionError as e:
        print("❌ YouTube API connection error:", e)
        return []

    except requests.exceptions.HTTPError as e:
        print("❌ YouTube API HTTP error:", e)
        return []

    except requests.exceptions.RequestException as e:
        print("❌ YouTube API request failed:", e)
        return []

    except Exception as e:
        print("❌ Unexpected YouTube API error:", e)
        return []


# ------------------------------------------------------
# Existing video-link endpoint
# ------------------------------------------------------

@app.post("/video-link")
async def video_link(request: Request):

    data = await request.json()

    text = data.get("text", "")

    youtube_link = extract_youtube_link(text)

    return {
        "youtube_link": youtube_link
    }


# ------------------------------------------------------
# Extract YouTube URL
# ------------------------------------------------------

def extract_youtube_link(text):

    match = re.search(
        r"https?://(?:www\.)?youtube\.com/watch\?v=[\w-]+",
        text
    )

    if match:
        return match.group(0)

    return None


# ------------------------------------------------------
# Run application
# ------------------------------------------------------

if __name__ == "__main__":

    import uvicorn

    uvicorn.run(
        "Main:app",
        host="127.0.0.1",
        port=8000,
        reload=True
    )
