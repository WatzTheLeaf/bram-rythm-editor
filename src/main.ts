import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";

interface AudioData {
    channel1: number[];
    channel2: number[];
}

let audioData: AudioData | null = null;
let selectedSample: { channel: number; index: number } | null = null;
let currentZoom = 40; // Default sample width in pixels
const MIN_ZOOM = 20;
const MAX_ZOOM = 100;
const ZOOM_STEP = 10;

async function loadAudioData(path: string): Promise<void> {

    const result: number[][] = await invoke("get_wav_data", { path });
    audioData = {
        channel1: result[0],
        channel2: result[1],
    };
    renderTimeline();
    updateSampleCount();

}

function renderTimeline(): void {
    if (!audioData) return;

    const channel1Element = document.getElementById("channel-1");
    const channel2Element = document.getElementById("channel-2");

    if (!channel1Element || !channel2Element) return;

    channel1Element.innerHTML = "";
    channel2Element.innerHTML = "";

    // Render channel 1
    audioData.channel1.forEach((value, index) => {
        const sample = createSampleElement(value, index, 1);
        channel1Element.appendChild(sample);
    });

    // Render channel 2
    audioData.channel2.forEach((value, index) => {
        const sample = createSampleElement(value, index, 2);
        channel2Element.appendChild(sample);
    });

    // Update scrollbar width after rendering
    setTimeout(() => {
        if ((window as any).updateScrollbarWidth) {
            (window as any).updateScrollbarWidth();
        }
    }, 100);
}

// Create a single sample element
function createSampleElement(value: number, index: number, channel: number): HTMLElement {
    const sample = document.createElement("div");
    sample.className = "sample";
    sample.dataset.channel = channel.toString();
    sample.dataset.index = index.toString();

    // Visual bar representing amplitude
    const bar = document.createElement("div");
    bar.className = "sample-bar";
    bar.style.height = `${Math.max(value * 100, 2)}%`;
    sample.appendChild(bar);

    // Letter display
    const letter = document.createElement("div");
    letter.className = "sample-letter";
    letter.textContent = "";
    sample.appendChild(letter);

    // Sample index
    const indexLabel = document.createElement("div");
    indexLabel.className = "sample-index";
    indexLabel.textContent = index.toString();
    sample.appendChild(indexLabel);

    // Click handler for selection
    sample.addEventListener("click", () => {
        selectSample(channel, index, sample);
    });

    return sample;
}

// Select a sample
function selectSample(channel: number, index: number, element: HTMLElement): void {

    deselectSamples();

    // Add new selection
    element.classList.add("selected");
    selectedSample = { channel, index };

    updateSelectionInfo();
}

function deselectSamples() {
    selectedSample = null;
    document.querySelectorAll(".sample.selected").forEach((el) => {
        el.classList.remove("selected");
    });
}

// Handle keyboard input for letter assignment
document.addEventListener("keydown", (e: KeyboardEvent) => {
    if (!selectedSample || !audioData) return;

    if (e.key === "Escape"){
        deselectSamples();
        return;
    }

    if (e.key === "Backspace" || e.key === "Delete") {
        assignLetter(selectedSample.channel, selectedSample.index, "");
    }

    const uppercaseKey = e.key.toUpperCase();
    if (uppercaseKey.length === 1 && uppercaseKey >= "A" && uppercaseKey <= "Z") {
        assignLetter(selectedSample.channel, selectedSample.index, uppercaseKey);
    }

});

function assignLetter(channel: number, index: number, letter: string): void {
    const channelEl = document.getElementById(`channel-${channel}`);
    if (!channelEl) return;

    const sample = channelEl.querySelector(
        `[data-channel="${channel}"][data-index="${index}"]`
    ) as HTMLElement;

    if (!sample) return;

    const letterEl = sample.querySelector(".sample-letter") as HTMLElement;
    if (!letterEl) return;

    letterEl.textContent = letter;

    if (letter) {
        sample.classList.add("has-letter");
    } else {
        sample.classList.remove("has-letter");
    }

    updateSelectionInfo();
}

function updateSampleCount(): void {

    if (!audioData) return;
    const countEl = document.getElementById("sample-count");

    if (!countEl) return;

    countEl.textContent = `${audioData.channel1.length} samples`;

}

function updateSelectionInfo(): void {
    const infoEl = document.getElementById("selection-info");
    if (!infoEl) return;

    if (!selectedSample) {
        infoEl.textContent = "";
        return;
    }

    const channelEl = document.getElementById(`channel-${selectedSample.channel}`);
    if (!channelEl) return;

    const sample = channelEl.querySelector(
        `[data-channel="${selectedSample.channel}"][data-index="${selectedSample.index}"]`
    );

    if (!sample) return;

    const letterEl = sample.querySelector(".sample-letter") as HTMLElement;
    const letter = letterEl?.textContent || "—";

    infoEl.textContent = `CH${selectedSample.channel} #${selectedSample.index}: ${letter}`;
}

// Initialize app
window.addEventListener("DOMContentLoaded", () => {
    const loadBtn = document.getElementById("load-btn");
    const zoomInBtn = document.getElementById("zoom-in");
    const zoomOutBtn = document.getElementById("zoom-out");

    if (loadBtn) {
        loadBtn.addEventListener("click", async () => {
            try {
                const selected = await open({
                    multiple: false,
                    filters: [{
                        name: 'WAV Audio',
                        extensions: ['wav']
                    }]
                });

                if (selected) {
                    await loadAudioData(selected);
                }
            } catch (error) {
                console.error("Failed to open file picker:", error);
            }
        });
    }

    if (zoomInBtn) {
        zoomInBtn.addEventListener("click", () => zoomIn());
    }

    if (zoomOutBtn) {
        zoomOutBtn.addEventListener("click", () => zoomOut());
    }

    setupUnifiedScrollbar();
});

// Setup unified scrollbar that controls both channels
function setupUnifiedScrollbar(): void {
    const scrollbar = document.getElementById("unified-scrollbar");
    const channel1 = document.getElementById("channel-1");
    const channel2 = document.getElementById("channel-2");

    if (!scrollbar || !channel1 || !channel2) return;

    // Update scrollbar content width when channels change
    const updateScrollbarWidth = () => {
        const totalWidth = channel1.scrollWidth;
        scrollbar.innerHTML = `<div style="width: ${totalWidth}px; height: 1px;"></div>`;
    };

    // Sync channels with scrollbar
    let isScrolling = false;

    scrollbar.addEventListener("scroll", () => {
        if (!isScrolling) {
            isScrolling = true;
            const scrollLeft = scrollbar.scrollLeft;
            channel1.scrollLeft = scrollLeft;
            channel2.scrollLeft = scrollLeft;
            requestAnimationFrame(() => {
                isScrolling = false;
            });
        }
    });

    const syncScrollbar = () => {
        if (!isScrolling) {
            isScrolling = true;
            scrollbar.scrollLeft = channel1.scrollLeft;
            requestAnimationFrame(() => {
                isScrolling = false;
            });
        }
    };

    channel1.addEventListener("scroll", syncScrollbar);
    channel2.addEventListener("scroll", syncScrollbar);

    (window as any).updateScrollbarWidth = updateScrollbarWidth;
}

function zoomIn(): void {
    if (currentZoom >= MAX_ZOOM) return;

    currentZoom = Math.min(currentZoom + ZOOM_STEP, MAX_ZOOM);
    applyZoom();
}

function zoomOut(): void {
    if (currentZoom <= MIN_ZOOM) return;

    currentZoom = Math.max(currentZoom - ZOOM_STEP, MIN_ZOOM);
    applyZoom();
}

function applyZoom(): void {
    document.documentElement.style.setProperty('--sample-width', `${currentZoom}px`);

    // Update scrollbar width after zoom
    setTimeout(() => {
        if ((window as any).updateScrollbarWidth) {
            (window as any).updateScrollbarWidth();
        }
    }, 100);
}