const video = document.getElementById("video");
const canvas = document.getElementById("canvas");
const captureButton = document.getElementById("capture");
const solutionElement = document.getElementById("solution");
const flash = document.createElement('div');
flash.className = 'flash-effect';
document.body.appendChild(flash);

let stream = null; // Store stream in global variable

function speakSolution(solution) {
    // Check if the Web Speech API is supported
    if ("speechSynthesis" in window) {
        const utterance = new SpeechSynthesisUtterance(`The solution is ${solution}`);
        utterance.lang = "en-US"; // Set the language
        utterance.pitch = 1;      // Set the pitch (0 to 2)
        utterance.rate = 1;       // Set the speed (0.1 to 10)
        utterance.volume = 1;     // Set the volume (0 to 1)

        // Speak the text
        window.speechSynthesis.speak(utterance);
    } else {
        console.error("Web Speech API is not supported in this browser.");
        alert("Sorry, your browser does not support the Web Speech API.");
    }
}

// Play camera shutter sound
function playShutterSound() {
    const audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdH2Fg4J9gIOFiIqHh4eBfX99goaPkpGQjoySm5ybmpybnaGjoKGgoaGlqamsrq6urq6vsbKysrGvsK6urq6urq2pop+bmpiTjYeBfHZwamRfW1ZRTEhFQj82LysoJSIgHE1mlJmaloNvdoSTloZ6eYSOk5OQjoyMjpCRlpmZm5ycoKampqyrqrG0tbW1tLW1trW1trW2tLW1tLSysK2ppKCbl5KMiYR/fXp5dXNxcG9tbGtramppY1BNR0A5Mi0oIhwXEg4KBwQCAQEBAQEBAQEBAgICAwMDAwMDAwMDAgICAgEBAQAAAAAAAAEBAQEBAQEAAAAAAAAAAAAAAAABAQEBAgICAgICAgEBAQEBAQEBAQEBAQEBAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAEBAQEBAQEBAQEBAQEBAgICAyxTg4yMhHpxc32IjohvcnqFjo2JhoODhYeJjI2Oj5CQlZmcnZ2enqGjpaWmpqaoqaqqqquqq6qqqainpqShn5yZlZKOioaEgoB+fXt6eXh4d3d3d3h2blZMRT4zLCYhGxYRDQoHBAIBAQEBAQEBAgICAgMDAwMDAwMDAwMCAgICAQEBAAAAAAAAAQEBAQEBAQAAAAAAAAAAAAAAAAEBAQECAgICAgICAQEBAQEBAQEBAQEBAQEAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAQEBAQEBAQEBAQEBAQECAgIDLFODjIyEenFzfYiOiG9yeoWOjYmGg4OFh4mMjY6PkJCVmZydnZ6eoaOlpaampqipqqqqq6qrqqqqp6akop+cmZWSjoqGhIKAfn17enl4eHd3d3d4dnhYTkdAOTIrJR8aFRALCAUDAgEBAQEBAgICAgMDAwMDAwQDAwMDAgICAgEBAQAAAAAAAAEBAQEBAQEAAAAAAAAAAAAAAAABAQEBAgICAgICAgEBAQEBAQEBAQEBAQEBAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAEBAQEBAQEBAQEBAQEBAgICAwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAQAAAAAAAAAAAAAAAAAAAAAAAAA=');
    audio.play();
}

// Access the user's webcam
navigator.mediaDevices.getUserMedia({ video: true })
    .then((mediaStream) => {
        stream = mediaStream; // Save stream reference
        video.srcObject = stream;
        video.play();
    })
    .catch((error) => {
        console.error("Error accessing webcam:", error);
        alert("Could not access the webcam. Please allow webcam access.");
    });

// Function to stop the webcam
function stopWebcam() {
    if (stream) {
        stream.getTracks().forEach(track => {
            track.stop();
        });
        video.srcObject = null;
        stream = null;
    }
}

// Capture the image and send it to the Flask backend
captureButton.addEventListener("click", () => {
    // Play camera effect
    flash.style.display = 'block';
    playShutterSound();
    setTimeout(() => {
        flash.style.display = 'none';
    }, 150);

    const context = canvas.getContext("2d");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    context.drawImage(video, 0, 0, canvas.width, canvas.height);

    // Stop the webcam immediately after capturing
    stopWebcam();

    // Show calculating message
    solutionElement.textContent = "Please wait, calculating...";
    solutionElement.style.color = "blue";

    // Convert canvas to image blob
    canvas.toBlob((blob) => {
        const formData = new FormData();
        formData.append("image", blob, "math_problem.jpg");

        // Send image to Flask backend
        fetch("/process-image", {
            method: "POST",
            body: formData,
        })
            .then((response) => response.json())
            .then((data) => {
                // Remove asterisks from the solution
                const cleanSolution = data.solution.replace(/\*/g, '');
                solutionElement.textContent = `Solution: ${cleanSolution}`;
                solutionElement.style.color = "green";
                speakSolution(cleanSolution);
            })
            .catch((error) => {
                console.error("Error processing the image:", error);
                solutionElement.textContent = "Error processing the image.";
                solutionElement.style.color = "red";
            });
    });
});
