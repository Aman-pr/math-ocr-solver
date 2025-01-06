from flask import Flask, render_template, request, jsonify
import google.generativeai as genai

app = Flask(__name__)

genai.configure(api_key="Enter your API_KEY")

@app.route("/")
def home():
    # Render the HTML page
    return render_template("index.html")

@app.route("/process-image", methods=["POST"])
def process_image():
    image = request.files["image"]
    image_path = f"./{image.filename}"
    image.save(image_path)

    model = genai.GenerativeModel(model_name="gemini-2.0-flash-exp")
    file = genai.upload_file(image_path, mime_type="image/jpeg")
    print(file)

    # First message to get the solution
    chat_session = model.start_chat(
        history=[
            {
                "role": "user",
                "parts": [
                    file,
                    "This is a math problem. Please solve it and provide step-by-step solution."
                ],
            }
        ]
    )
    solution_response = chat_session.send_message("Please solve the math problem and provide a step-by-step solution.")
    solution_text = solution_response.text.strip()

    # Second message to get the YouTube reference link
    chat_session = model.start_chat(
        history=[
            {
                "role": "user",
                "parts": [
                    file,
                    "Please provide a YouTube reference link for this solution."
                ],
            }
        ]
    )
    youtube_response = chat_session.send_message("Provide a YouTube link related to the solution.")
    youtube_linkresponse = youtube_response.text.strip()
    youtube_link=extract_youtube_link(youtube_linkresponse)

    # Return the solution and YouTube link as separate responses
    return jsonify({
        "solution": solution_text,
        "youtube_reference": youtube_link
    })
def extract_youtube_link(text):
    import re
    # Use a regex pattern to find YouTube URLs in the text
    match = re.search(r'(https?://www\.youtube\.com/watch\?v=[\w-]+)', text)
    if match:
        return match.group(0)
    return None

if __name__ == "__main__":
    app.run(debug=True)
