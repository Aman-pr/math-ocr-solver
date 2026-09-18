import requests
import json

url = "https://www.googleapis.com/youtube/v3/search"

api = "AIzaSyBguW2FC7QroxzsXJLma26uLWOgjWY51lg"

params = {
    "part": "snippet",
    "q": "quadratic equations",
    "type": "video",
    "maxResults": 5,
    "key": api
}

print("Sending request...")

try:
    response = requests.get(url, params=params, timeout=10)

    print("Status code:", response.status_code)
    print("Response received!")

    response.raise_for_status()

    data = response.json()

    print(json.dumps(data, indent=4))

except requests.exceptions.Timeout:
    print("❌ Request timed out.")

except requests.exceptions.ConnectionError as e:
    print("❌ Connection error:", e)

except requests.exceptions.HTTPError as e:
    print("❌ HTTP error:", e)

except requests.exceptions.RequestException as e:
    print("❌ Request failed:", e)