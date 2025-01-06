const video = document.getElementById("video");
const canvas = document.getElementById("canvas");
const captureButton = document.getElementById("capture");
const solutionElement = document.getElementById("solution");
const youtubeLinkElement = document.getElementById("youtube-link");
const flash = document.createElement('div');
const ResetMe = document.getElementById("ResetMe");
const flipCameraButton = document.getElementById("flip-camera");

flash.className = 'flash-effect';
document.body.appendChild(flash);

let stream = null; // Store stream in global variable
let currentFacingMode = "environment"; // Start with back camera (environment)

// Function to speak the solution
function speakSolution(solution) {
    if ("speechSynthesis" in window) {
        const utterance = new SpeechSynthesisUtterance(`The solution is ${solution}`);
        utterance.lang = "en-US"; // Set the language
        utterance.pitch = 1;      // Set the pitch
        utterance.rate = 1;       // Set the speed
        utterance.volume = 1;     // Set the volume
        window.speechSynthesis.speak(utterance);
    } else {
        console.error("Web Speech API is not supported in this browser.");
        alert("Sorry, your browser does not support the Web Speech API.");
    }
}

// Play camera shutter sound
function playShutterSound() {
    const audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdH2Fg4J9gIOFiIqHh4eBfX99goaPkpGQjoySm5ybmpybnaGjoKGgoaGlqamsrq6urq6vsbKysrGvsK6urq6urq2pop+bmpiTjYeBfHZwamRfW1ZRTEhFQj82LysoJSIgHE1mlJmaloNvdoSTloZ6eYSOk5OQjoyMjpCRlpmZm5ycoKampqyrqrG0tbW1tLW1trW1trW2tLW1tLSysK2ppKCbl5KMiYR/fXp5dXNxcG9tbGtramppY1BNR0A5Mi0oIhwXEg4KBwQCAQEBAQEBAQEBAgICAwMDAwMDAwMDAgICAgEBAQAAAAAAAAEBAQEBAQEAAAAAAAAAAAAAAAABAQEBAgICAgICAgEBAQEBAQEBAQEBAQEBAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAEBAQEBAQEBAQEBAQEBAgICAyxTg4yMhHpxc32IjohvcnqFjo2JhoODhYeJjI2Oj5CQlZmcnZ2enqGjpaWmpqaoqaqqqquqq6qqqainpqShn5yZlZKOioaEgoB+fXt6eXh4d3d3d3h2blZMRT4zLCYhGxYRDQoHBAIBAQEBAQEBAgICAgMDAwMDAwQDAwMDAgICAgEBAQAAAAAAAAEBAQEBAQEAAAAAAAAAAAAAAAABAQEBAgICAgICAgEBAQEBAQEBAQEBAQEBAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAQEBAQEBAQEBAQEBAQEBAgICAwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAQAAAAAAAAAAAAAAAAAAAAAAAAA=');
    audio.play();
}

// Access the user's webcam
function startWebcam(facingMode = "user") {
    navigator.mediaDevices.getUserMedia({ video: { facingMode: facingMode } })
        .then((mediaStream) => {
            stream = mediaStream; // Save stream reference
            video.srcObject = stream;
            video.play();
        })
        .catch((error) => {
            console.error("Error accessing webcam:", error);
            alert("Could not access the webcam. Please allow webcam access.");
        });
}

// Function to stop the webcam
function stopWebcam() {
    if (stream) {
        stream.getTracks().forEach(track => track.stop());
        video.srcObject = null;
        stream = null;
    }
}

// Capture the image and send it to the Flask backend
captureButton.addEventListener("click", () => {
    flash.style.display = 'block';
    playShutterSound();
    setTimeout(() => {
        flash.style.display = 'none';
    }, 150);

    const context = canvas.getContext("2d");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    context.drawImage(video, 0, 0, canvas.width, canvas.height);

    stopWebcam();

    solutionElement.textContent = "Please wait, calculating...";
    solutionElement.style.color = "blue";

    canvas.toBlob((blob) => {
        const formData = new FormData();
        formData.append("image", blob, "math_problem.jpg");

        fetch("/process-image", {
            method: "POST",
            body: formData,
        })
            .then((response) => response.json())
            .then((data) => {
                const cleanSolution = data.solution.replace(/\*/g, '\n');
                solutionElement.textContent = `Solution: \n ${cleanSolution}`;
                solutionElement.style.color = "green";

                if (data.youtube_reference) {
                    youtubeLinkElement.textContent = `YouTube Reference: ${data.youtube_reference}`;
                    youtubeLinkElement.style.color = "blue";
                } else {
                    youtubeLinkElement.textContent = "No YouTube reference found.";
                    youtubeLinkElement.style.color = "red";
                }

                speakSolution(cleanSolution);
            })
            .catch((error) => {
                console.error("Error processing the image:", error);
                solutionElement.textContent = "Error processing the image.";
                solutionElement.style.color = "red";
            });
    });
});

// Flip camera functionality
flipCameraButton.addEventListener("click", () => {
    stopWebcam(); // Stop the current webcam

    // Toggle between front and rear cameras
    currentFacingMode = currentFacingMode === "user" ? "environment" : "user";

    startWebcam(currentFacingMode); // Restart webcam with the new facing mode
});

ResetMe.addEventListener("click", () => {
    if ("speechSynthesis" in window) {
        window.speechSynthesis.cancel();
    }

    window.location.reload();
});

// Start the webcam with the rear camera initially
startWebcam(currentFacingMode);
