from flask import Flask, render_template, request, jsonify
import google.generativeai as genai

app = Flask(__name__)

genai.configure(api_key="AIzaSyDN2pUrJH6ETWwSpVI-648c0Nd71vp-dMI")

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

    chat_session = model.start_chat(
        history=[
            {
                "role": "user",
                "parts": [
                    file,
                    "This is a math problem. Please solve it and provide step-by-step solution.",
                ],
            }
        ]
    )
    response = chat_session.send_message("Please solve this math problem")
    return jsonify({"solution": response.text})

if __name__ == "__main__":
    app.run(debug=True)
