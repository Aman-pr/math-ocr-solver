/* ==================== DOM ELEMENTS ==================== */
const DOM = {
    video: document.getElementById("video"),
    canvas: document.getElementById("canvas"),
    solution: document.getElementById("solution"),
    youtubeLink: document.getElementById("youtube-link"),
    resetBtn: document.getElementById("ResetMe"),
    captureBtn: document.getElementById("capture"),
    flipCameraBtn: document.getElementById("flip-camera"),
    startCameraBtn: document.getElementById("startCamera"),
    cameraPlaceholder: document.getElementById("cameraPlaceholder"),
    manualInput: document.getElementById("manualQuestion"),
    submitManualBtn: document.getElementById("submitManual"),
    uploadPhotoBtn: document.getElementById("uploadPhoto"),
    fileInput: document.getElementById("fileInput"),
    generateVideoBtn: document.getElementById("generateVideoBtn"),
};

/* ==================== APPLICATION STATE ==================== */
const AppState = {
    stream: null,
    currentFacingMode: "environment",
    lastImageBlob: null,
    lastImageFilename: "math_problem.jpg",
    isProcessing: false,
};

/* ==================== UI & EFFECTS ==================== */
const UI = {
    flash: (() => {
        const el = document.createElement('div');
        el.className = 'flash-effect';
        document.body.appendChild(el);
        return el;
    })(),

    showFlash() {
        this.flash.style.display = 'block';
        setTimeout(() => {
            this.flash.style.display = 'none';
        }, 150);
    },

    setProcessing(isProcessing) {
        AppState.isProcessing = isProcessing;
        DOM.captureBtn.disabled = isProcessing;
        DOM.submitManualBtn.disabled = isProcessing;
        DOM.uploadPhotoBtn.disabled = isProcessing;
        DOM.flipCameraBtn.disabled = isProcessing;
    },

    setSolutionLoading() {
        DOM.solution.textContent = "Please wait, calculating...";
        DOM.solution.style.color = "#777A73";
        this.setProcessing(true);
    },

    setSolutionError(message = "An error occurred") {
        DOM.solution.textContent = message;
        DOM.solution.style.color = "#B5453D";
        this.setProcessing(false);
    },

    setVideoLoading() {
        DOM.youtubeLink.textContent = "No video found — generating one for you...";
        DOM.youtubeLink.style.color = "#C9CCC7";
    },

    setVideoError() {
        DOM.youtubeLink.textContent = "No YouTube reference found.";
        DOM.youtubeLink.style.color = "#9CA39D";
    },
};

/* ==================== AUDIO MODULE ==================== */
const Audio = {
    shutterData: 'data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdH2Fg4J9gIOFiIqHh4eBfX99goaPkpGQjoySm5ybmpybnaGjoKGgoaGlqamsrq6urq6vsbKysrGvsK6urq6urq2pop+bmpiTjYeBfHZwamRfW1ZRTEhFQj82LysoJSIgHE1mlJmaloNvdoSTloZ6eYSOk5OQjoyMjpCRlpmZm5ycoKampqyrqrG0tbW1tLW1trW1trW2tLW1tLSysK2ppKCbl5KMiYR/fXp5dXNxcG9tbGtramppY1BNR0A5My0oIhwXEg4KBwQCAQEBAQEBAQEBAgICAwMDAwMDAwMDAgICAgEBAQAAAAAAAAEBAQEBAQEAAAAAAAAAAAAAAAABAQEBAgICAgICAgEBAQEBAQEBAQEBAQEBAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAEBAQEBAQEBAQEBAQEBAgICAyxTg4yMhHpxc32IjohvcnqFjo2JhoODhYeJjI2Oj5CQlZmcnZ2enqGjpaWmpqaoqaqqqquqq6qqqainpqShn5yZlZKOioaEgoB+fXt6eXh4d3d3d3h2blZMRT4zLCYhGxYRDQoHBAIBAQEBAQEBAgICAgMDAwMDAwQDAwMDAgICAgEBAQAAAAAAAAEBAQEBAQEAAAAAAAAAAAAAAAABAQEBAgICAgICAgEBAQEBAQEBAQEBAQEBAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAQEBAQEBAQEBAQEBAQEBAgICAwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAQAAAAAAAAAAAAAAAAAAAAAAAAA=',

    playShutter() {
        try {
            const audio = new Audio(this.shutterData);
            audio.play().catch(() => {
                // Silently fail if audio doesn't play
            });
        } catch (err) {
            console.log("Audio playback not available");
        }
    },

    speak(text) {
        if (!("speechSynthesis" in window)) {
            console.warn("Speech synthesis not supported");
            return;
        }

        // Cancel any ongoing speech
        window.speechSynthesis.cancel();

        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = "en-US";
        utterance.pitch = 1;
        utterance.rate = 1;
        utterance.volume = 1;

        try {
            window.speechSynthesis.speak(utterance);
        } catch (err) {
            console.error("Speech synthesis error:", err);
        }
    },
};

/* ==================== UTILITIES MODULE ==================== */
const Utils = {
    escapeHtml(str) {
        const div = document.createElement("div");
        div.textContent = str;
        return div.innerHTML;
    },

    async typesetMath(element) {
        if (window.MathJax && window.MathJax.typesetPromise) {
            try {
                await window.MathJax.typesetPromise([element]);
            } catch (err) {
                console.error("MathJax typeset error:", err);
            }
        }
    },

    renderSolution(rawSolution) {
        const cleanSolution = rawSolution.replace(/\*/g, "\n");
        const safeHtml = this.escapeHtml(cleanSolution).replace(/\n/g, "<br>");

        DOM.solution.innerHTML = `<strong>Solution:</strong><br>${safeHtml}`;
        DOM.solution.style.color = "#20221F";

        // Typeset math asynchronously
        this.typesetMath(DOM.solution);

        return cleanSolution;
    },

    async delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    },
};

/* ==================== CAMERA MODULE ==================== */
const Camera = {
    async start(facingMode = "environment") {
        try {
            const constraints = {
                video: {
                    facingMode: { ideal: facingMode }
                }
            };

            const mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
            AppState.stream = mediaStream;
            DOM.video.srcObject = mediaStream;
            await DOM.video.play();

            if (DOM.cameraPlaceholder) DOM.cameraPlaceholder.style.display = "none";
            DOM.captureBtn.disabled = false;
        } catch (error) {
            console.error("Camera error:", error);
            alert("Could not access the webcam. Please allow webcam access.");
        }
    },

    stop() {
        if (AppState.stream) {
            AppState.stream.getTracks().forEach(track => track.stop());
            DOM.video.srcObject = null;
            AppState.stream = null;
        }

        if (DOM.cameraPlaceholder) DOM.cameraPlaceholder.style.display = "flex";
        DOM.captureBtn.disabled = true;
    },

    flip() {
        this.stop();
        AppState.currentFacingMode = AppState.currentFacingMode === "user" ? "environment" : "user";
        this.start(AppState.currentFacingMode);
    },

    async capture() {
        UI.showFlash();
        Audio.playShutter();

        const context = DOM.canvas.getContext("2d");
        DOM.canvas.width = DOM.video.videoWidth;
        DOM.canvas.height = DOM.video.videoHeight;
        context.drawImage(DOM.video, 0, 0, DOM.canvas.width, DOM.canvas.height);

        this.stop();

        return new Promise((resolve) => {
            DOM.canvas.toBlob((blob) => {
                resolve(blob);
            });
        });
    },
};

/* ==================== VIDEO MODULE ==================== */
const Video = {
    currentInterval: null,

    /**
     * Clears any in-flight video-generation poll and wipes the panel back to
     * its placeholder state. Must run at the start of every new question so
     * a previous question's video (or a late-arriving poll result for it)
     * can never bleed into the new one.
     */
    reset() {
        if (this.currentInterval) {
            clearInterval(this.currentInterval);
            this.currentInterval = null;
        }
        DOM.youtubeLink.innerHTML = "";
        const placeholder = document.createElement("p");
        placeholder.textContent = "A video walkthrough will appear here.";
        DOM.youtubeLink.appendChild(placeholder);
        DOM.youtubeLink.style.color = "";

        if (DOM.generateVideoBtn) {
            DOM.generateVideoBtn.style.display = "none";
            DOM.generateVideoBtn.disabled = false;
        }
    },

    pollStatus(jobId, maxAttempts = 120) {
        let attempts = 0;

        // A fresh poll always supersedes whatever was running before.
        if (this.currentInterval) {
            clearInterval(this.currentInterval);
        }

        this.currentInterval = setInterval(() => {
            attempts++;

            if (attempts > maxAttempts) {
                clearInterval(this.currentInterval);
                this.currentInterval = null;
                UI.setVideoError();
                return;
            }

            fetch(`/video-status/${jobId}`)
                .then((r) => r.json())
                .then((job) => {
                    if (job.status === "done") {
                        clearInterval(this.currentInterval);
                        this.currentInterval = null;
                        DOM.youtubeLink.innerHTML = `<video controls src="${job.video_url}" style="max-width:100%;"></video>`;
                    } else if (job.status === "error") {
                        clearInterval(this.currentInterval);
                        this.currentInterval = null;
                        UI.setVideoError();
                    }
                })
                .catch((err) => {
                    console.error("Error polling video status:", err);
                    clearInterval(this.currentInterval);
                    this.currentInterval = null;
                });
        }, 3000);
    },

    handleReference(data) {
        const bestVideo = data.youtube_videos && data.youtube_videos[0];

        if (bestVideo && bestVideo.video_id) {
            DOM.youtubeLink.innerHTML = `
                <p style="margin-bottom:10px; color: #F1F1EC; font-weight: 500; text-align: left;">Recommended video: ${Utils.escapeHtml(bestVideo.title || "")}</p>
                <iframe
                    width="100%"
                    height="360"
                    src="https://www.youtube.com/embed/${bestVideo.video_id}"
                    title="YouTube video player"
                    frameborder="0"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                    allowfullscreen
                    style="border-radius:2px;">
                </iframe>
            `;
        } else if (data.fallback_video_job_id) {
            UI.setVideoLoading();
            this.pollStatus(data.fallback_video_job_id);
        } else {
            UI.setVideoError();
        }
    },
};

/* ==================== API MODULE ==================== */
const API = {
    async processImage(imageBlob, filename = "math_problem.jpg") {
        const formData = new FormData();
        formData.append("image", imageBlob, filename);

        const response = await fetch("/process-image", {
            method: "POST",
            body: formData,
        });

        if (!response.ok) throw new Error("Failed to process image");
        return await response.json();
    },

    async processManualQuestion(question) {
        const response = await fetch("/process-manual-question", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ question }),
        });

        if (!response.ok) throw new Error("Failed to process question");
        return await response.json();
    },

    async generateVideo(imageBlob, filename = "math_problem.jpg") {
        const formData = new FormData();
        formData.append("image", imageBlob, filename);

        const response = await fetch("/generate-video-manual", {
            method: "POST",
            body: formData,
        });

        if (!response.ok) {
            const err = await response.json();
            throw new Error(err.detail || "Failed to start video generation");
        }

        return await response.json();
    },
};

/* ==================== HANDLERS MODULE ==================== */
const Handlers = {
    async handleSolution(data) {
        UI.setProcessing(false);
        const cleanSolution = Utils.renderSolution(data.solution);
        Video.handleReference(data);
        Audio.speak(`The solution is ${cleanSolution}`);
    },

    async handleImageCapture() {
        Video.reset();
        UI.setSolutionLoading();

        try {
            const blob = await Camera.capture();
            AppState.lastImageBlob = blob;
            AppState.lastImageFilename = "math_problem.jpg";

            if (DOM.generateVideoBtn) {
                DOM.generateVideoBtn.style.display = "inline-block";
            }

            const data = await API.processImage(blob, "math_problem.jpg");
            await this.handleSolution(data);
        } catch (error) {
            console.error("Error processing image:", error);
            UI.setSolutionError("Error processing the image.");
        }
    },

    async handleImageUpload(file) {
        Video.reset();
        UI.setSolutionLoading();

        try {
            Camera.stop();
            AppState.lastImageBlob = file;
            AppState.lastImageFilename = file.name;

            if (DOM.generateVideoBtn) {
                DOM.generateVideoBtn.style.display = "inline-block";
            }

            const data = await API.processImage(file, file.name);
            await this.handleSolution(data);
        } catch (error) {
            console.error("Error processing upload:", error);
            UI.setSolutionError("Error processing the image.");
        }
    },

    async handleManualQuestion(question) {
        if (!question.trim()) {
            alert("Please type a question before submitting.");
            return;
        }

        Video.reset();
        UI.setSolutionLoading();

        try {
            const data = await API.processManualQuestion(question);
            await this.handleSolution(data);
        } catch (error) {
            console.error("Error processing question:", error);
            UI.setSolutionError("Error processing the question.");
        }
    },

    async handleVideoGeneration() {
        if (!AppState.lastImageBlob) {
            alert("Please capture or upload an image first.");
            return;
        }

        DOM.generateVideoBtn.disabled = true;
        UI.setVideoLoading();

        try {
            const data = await API.generateVideo(
                AppState.lastImageBlob,
                AppState.lastImageFilename
            );
            Video.pollStatus(data.job_id);
        } catch (error) {
            console.error("Error generating video:", error);
            UI.setVideoError();
        } finally {
            DOM.generateVideoBtn.disabled = false;
        }
    },

    handleReset() {
        if ("speechSynthesis" in window) {
            window.speechSynthesis.cancel();
        }
        window.location.reload();
    },

    async handleStartCamera() {
        if (!DOM.startCameraBtn) return;
        DOM.startCameraBtn.disabled = true;
        const originalLabel = DOM.startCameraBtn.textContent;
        DOM.startCameraBtn.textContent = "Requesting access…";

        await Camera.start(AppState.currentFacingMode);

        DOM.startCameraBtn.disabled = false;
        DOM.startCameraBtn.textContent = originalLabel;
    },
};

/* ==================== EVENT LISTENERS ==================== */
function setupEventListeners() {
    // Camera Events
    DOM.captureBtn.addEventListener("click", () => Handlers.handleImageCapture());
    DOM.flipCameraBtn.addEventListener("click", () => Camera.flip());
    if (DOM.startCameraBtn) {
        DOM.startCameraBtn.addEventListener("click", () => Handlers.handleStartCamera());
    }

    // Upload Events
    DOM.uploadPhotoBtn.addEventListener("click", () => DOM.fileInput.click());
    DOM.fileInput.addEventListener("change", (e) => {
        const file = e.target.files[0];
        if (file) {
            Handlers.handleImageUpload(file);
            DOM.fileInput.value = "";
        }
    });

    // Manual Input Events
    DOM.submitManualBtn.addEventListener("click", () => {
        Handlers.handleManualQuestion(DOM.manualInput.value);
    });

    DOM.manualInput.addEventListener("keypress", (e) => {
        if (e.key === "Enter") {
            Handlers.handleManualQuestion(DOM.manualInput.value);
        }
    });

    // Video Generation
    if (DOM.generateVideoBtn) {
        DOM.generateVideoBtn.addEventListener("click", () => Handlers.handleVideoGeneration());
    }

    // Reset
    DOM.resetBtn.addEventListener("click", () => Handlers.handleReset());
}

/* ==================== INITIALIZATION ==================== */
function initialize() {
    setupEventListeners();
    // Camera stays off until the person taps "Turn on camera" — no
    // permission prompt fires just from loading the page.
}

// Start the app when DOM is ready
if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initialize);
} else {
    initialize();
}
