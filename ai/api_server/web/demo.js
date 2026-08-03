const state = {
  file: null,
  originalUrl: null,
  resultUrl: null,
  ready: false,
  processing: false,
};

const elements = {
  status: document.querySelector("#model-status"),
  statusText: document.querySelector("#status-text"),
  dropZone: document.querySelector("#drop-zone"),
  fileInput: document.querySelector("#file-input"),
  selectedFile: document.querySelector("#selected-file"),
  fileName: document.querySelector("#file-name"),
  removeFile: document.querySelector("#remove-file"),
  extractButton: document.querySelector("#extract-button"),
  buttonLabel: document.querySelector("#button-label"),
  error: document.querySelector("#error-message"),
  emptyPreview: document.querySelector("#empty-preview"),
  comparison: document.querySelector("#comparison"),
  originalPreview: document.querySelector("#original-preview"),
  resultPreview: document.querySelector("#result-preview"),
  resultPlaceholder: document.querySelector("#result-placeholder"),
  processing: document.querySelector("#processing"),
  resultActions: document.querySelector("#result-actions"),
  processingTime: document.querySelector("#processing-time"),
  imageSize: document.querySelector("#image-size"),
  predictedRatio: document.querySelector("#predicted-ratio"),
  downloadButton: document.querySelector("#download-button"),
  logEmpty: document.querySelector("#log-empty"),
  logList: document.querySelector("#log-list"),
};

function setError(message = "") {
  elements.error.textContent = message;
  elements.error.hidden = !message;
}

function updateButton() {
  elements.extractButton.disabled =
    !state.file || !state.ready || state.processing;
}

function selectedOutput() {
  return document.querySelector('input[name="output"]:checked').value;
}

function resetResult() {
  if (state.resultUrl) {
    URL.revokeObjectURL(state.resultUrl);
    state.resultUrl = null;
  }
  elements.resultPreview.hidden = true;
  elements.resultPreview.removeAttribute("src");
  elements.resultPlaceholder.hidden = false;
  elements.processing.hidden = true;
  elements.resultActions.hidden = true;
}

function selectFile(file) {
  setError();
  if (!file.type.startsWith("image/")) {
    setError("JPG, PNG 또는 WEBP 이미지를 선택해주세요.");
    return;
  }
  if (file.size > 20 * 1024 * 1024) {
    setError("파일 크기는 20MB 이하여야 합니다.");
    return;
  }

  if (state.originalUrl) {
    URL.revokeObjectURL(state.originalUrl);
  }
  state.file = file;
  state.originalUrl = URL.createObjectURL(file);
  elements.originalPreview.src = state.originalUrl;
  elements.fileName.textContent = file.name;
  elements.dropZone.hidden = true;
  elements.selectedFile.hidden = false;
  elements.emptyPreview.hidden = true;
  elements.comparison.hidden = false;
  resetResult();
  updateButton();
}

function removeFile() {
  if (state.originalUrl) {
    URL.revokeObjectURL(state.originalUrl);
  }
  state.file = null;
  state.originalUrl = null;
  elements.fileInput.value = "";
  elements.originalPreview.removeAttribute("src");
  elements.dropZone.hidden = false;
  elements.selectedFile.hidden = true;
  elements.emptyPreview.hidden = false;
  elements.comparison.hidden = true;
  resetResult();
  setError();
  updateButton();
}

async function checkHealth() {
  try {
    const response = await fetch("/health", { cache: "no-store" });
    const health = await response.json();
    state.ready = health.pipeline_status === "ready";
    elements.status.className = `status ${
      state.ready
        ? "status-ready"
        : health.pipeline_status === "error"
          ? "status-error"
          : "status-loading"
    }`;
    if (state.ready) {
      const device = health.device?.toLowerCase().includes("cuda")
        ? "GPU 준비됨"
        : "CPU 준비됨";
      elements.statusText.textContent = device;
    } else if (health.pipeline_status === "error") {
      elements.statusText.textContent = "모델 오류";
    } else {
      elements.statusText.textContent = "모델 로딩 중";
    }
  } catch {
    state.ready = false;
    elements.status.className = "status status-error";
    elements.statusText.textContent = "서버 연결 안 됨";
  }
  updateButton();
}

function formatLogTime(timestamp) {
  const date = new Date(timestamp);
  return new Intl.DateTimeFormat("ko-KR", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).format(date);
}

async function refreshLogs() {
  try {
    const response = await fetch("/api/v1/logs?limit=30", {
      cache: "no-store",
    });
    if (!response.ok) return;
    const payload = await response.json();
    elements.logList.replaceChildren();
    elements.logEmpty.hidden = payload.events.length > 0;
    for (const event of payload.events.slice().reverse()) {
      const item = document.createElement("li");
      item.className = "log-item";
      item.dataset.level = event.level;

      const time = document.createElement("span");
      time.className = "log-time";
      time.textContent = formatLogTime(event.timestamp);

      const name = document.createElement("span");
      name.className = "log-event";
      name.textContent = event.event;

      const message = document.createElement("span");
      message.className = "log-message";
      const details = event.details
        ? ` · ${JSON.stringify(event.details)}`
        : "";
      message.textContent = `${event.message}${details}`;

      item.append(time, name, message);
      elements.logList.append(item);
    }
  } catch {
    // Health status already communicates server connection failures.
  }
}

async function extractTattoo() {
  if (!state.file || !state.ready || state.processing) {
    return;
  }

  state.processing = true;
  setError();
  resetResult();
  elements.resultPlaceholder.hidden = true;
  elements.processing.hidden = false;
  elements.buttonLabel.textContent = "추출 중...";
  updateButton();

  const output = selectedOutput();
  const form = new FormData();
  form.append("file", state.file);

  try {
    const response = await fetch(
      `/api/v1/extract?output=${encodeURIComponent(output)}`,
      {
        method: "POST",
        body: form,
      },
    );
    if (!response.ok) {
      let message = `추출 요청에 실패했습니다. (${response.status})`;
      try {
        const payload = await response.json();
        message = payload.error?.message || payload.detail || message;
      } catch {
        // Keep the status-based message when the body is not JSON.
      }
      throw new Error(message);
    }

    const blob = await response.blob();
    state.resultUrl = URL.createObjectURL(blob);
    elements.resultPreview.src = state.resultUrl;
    elements.resultPreview.hidden = false;
    elements.processing.hidden = true;
    elements.processingTime.textContent = `${Number(
      response.headers.get("X-Processing-Seconds") || 0,
    ).toFixed(1)}초`;
    elements.imageSize.textContent = `${response.headers.get(
      "X-Image-Width",
    )} × ${response.headers.get("X-Image-Height")}`;
    const ratio = Number(response.headers.get("X-Predicted-Ratio") || 0);
    elements.predictedRatio.textContent = `${(ratio * 100).toFixed(1)}%`;
    elements.downloadButton.href = state.resultUrl;
    elements.downloadButton.download = `${state.file.name.replace(
      /\.[^.]+$/,
      "",
    )}_${output}.png`;
    elements.resultActions.hidden = false;
    await refreshLogs();
  } catch (error) {
    elements.processing.hidden = true;
    elements.resultPlaceholder.hidden = false;
    setError(error instanceof Error ? error.message : "추출에 실패했습니다.");
    await refreshLogs();
  } finally {
    state.processing = false;
    elements.buttonLabel.textContent = "도안 추출하기";
    updateButton();
  }
}

elements.dropZone.addEventListener("click", () => elements.fileInput.click());
elements.dropZone.addEventListener("keydown", (event) => {
  if (event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    elements.fileInput.click();
  }
});
elements.fileInput.addEventListener("change", () => {
  const [file] = elements.fileInput.files;
  if (file) selectFile(file);
});
elements.removeFile.addEventListener("click", removeFile);
elements.extractButton.addEventListener("click", extractTattoo);

for (const eventName of ["dragenter", "dragover"]) {
  elements.dropZone.addEventListener(eventName, (event) => {
    event.preventDefault();
    elements.dropZone.classList.add("is-dragging");
  });
}
for (const eventName of ["dragleave", "drop"]) {
  elements.dropZone.addEventListener(eventName, (event) => {
    event.preventDefault();
    elements.dropZone.classList.remove("is-dragging");
  });
}
elements.dropZone.addEventListener("drop", (event) => {
  const [file] = event.dataTransfer.files;
  if (file) selectFile(file);
});

document.querySelectorAll('input[name="output"]').forEach((input) => {
  input.addEventListener("change", resetResult);
});

checkHealth();
refreshLogs();
setInterval(checkHealth, 3000);
setInterval(refreshLogs, 2000);
