// src/main/resources/your/package/js/recorder.js
console.log("[AudioRecordPage] recorder.js loaded");

let mediaRecorder, chunks = [];

function getEl(id, name) {
    const el = document.getElementById(id);
    if (!el) {
        console.error(`[AudioRecordPage] ${name} id not found:`, id);
    }
    return el;
}

function stopAndSubmit(uploadId, submitId) {
    const uploadInp = getEl(uploadId, "upload");
    const submitBtn = getEl(submitId, "submitBtn");
    if (!uploadInp || !submitBtn) return;

    const blob = new Blob(chunks, { type: "audio/webm" });
    const file = new File([blob], "recorded.webm", { type: "audio/webm" });
    const dt = new DataTransfer();
    dt.items.add(file);
    uploadInp.files = dt.files;

    submitBtn.click();
}

window.toggleRecording = async function(recordBtnId, uploadId, submitId) {
    const recordBtn = getEl(recordBtnId, "recordBtn");
    const icon = recordBtn.querySelector("i");

    if (!recordBtn) return;

    try {
        if (!mediaRecorder || mediaRecorder.state === "inactive") {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            mediaRecorder = new MediaRecorder(stream, { mimeType: "audio/webm;codecs=opus" });
            chunks = [];
            mediaRecorder.ondataavailable = e => chunks.push(e.data);
            mediaRecorder.onstop = () => stopAndSubmit(uploadId, submitId);
            mediaRecorder.start();
            icon.className = "ri-mic-off-fill";
        } else {
            mediaRecorder.stop();
            icon.className = "ri-mic-fill";
        }
    } catch (err) {
        alert("無法存取麥克風：" + err);
        console.error(err);
    }
};
