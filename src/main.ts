import {convertFileSrc, invoke} from "@tauri-apps/api/core";
import {open} from "@tauri-apps/plugin-dialog";
import {clamp} from "./maths.ts";

enum ChannelType {
    Audio, Input
}

interface SamplesData {
    left: number[];
    right: number[];
}

interface Channel {
    id: number,
    type: ChannelType
}

let samplesData: SamplesData | null = null;
let audio: HTMLAudioElement | null = null;
let selectedSample: { index: number } | null = null;
let currentZoom = 40; // Default sample width in pixels
const MIN_ZOOM = 20;
const MAX_ZOOM = 100;
const ZOOM_STEP = 10;

async function loadSamplesData(path: string): Promise<void> {

    const result: number[][] = await invoke("get_wav_data", {path});
    samplesData = {
        left: result[0], right: result[1],
    };
    renderTimeline();
    updateSampleCount();

}

function loadAudio(path: string){
    const assetUrl = convertFileSrc(path);
    audio = new Audio(assetUrl);
}

function renderTimeline(): void {
    if (!samplesData) return;

    const channel1Element = document.getElementById("channel-1");
    const channel2Element = document.getElementById("channel-2");
    const channelInputElement = document.getElementById("channel-input");

    if (!channel1Element || !channel2Element || !channelInputElement) return;

    channel1Element.innerHTML = "";
    channel2Element.innerHTML = "";
    channelInputElement.innerHTML = "";
    const channel1Object = {id: 1, type: ChannelType.Audio}
    const channel2Object = {id: 2, type: ChannelType.Audio}
    const channelInputObject = {id: 3, type: ChannelType.Input}

    // Render channel 1
    samplesData.left.forEach((value, index) => {
        const sample = createSampleElement(value, index, channel1Object);
        channel1Element.appendChild(sample);
    });

    // Render channel 2
    samplesData.right.forEach((value, index) => {
        const sample = createSampleElement(value, index, channel2Object);
        channel2Element.appendChild(sample);
    });

    // Render input channel
    samplesData.left.forEach((_value, index) => {
        const sample = createSampleElement(0, index, channelInputObject);
        channelInputElement.appendChild(sample);
    });

    // Update scrollbar width after rendering
    setTimeout(() => {
        if ((window as any).updateScrollbarWidth) {
            (window as any).updateScrollbarWidth();
        }
    }, 100);
}

// Create a single sample element
function createSampleElement(value: number, index: number, channel: Channel): HTMLElement {
    const sample = document.createElement("div");
    sample.className = "sample";
    sample.dataset.channel = channel.id.toString();
    sample.dataset.index = index.toString();

    if (channel.type === ChannelType.Audio) {// Visual bar representing amplitude
        const bar = document.createElement("div");
        bar.className = "sample-bar";
        bar.style.height = `${Math.max(value * 100, 2)}%`;
        sample.appendChild(bar);
    }

    if (channel.type === ChannelType.Input) {
        // Letter display
        const letter = document.createElement("div");
        letter.className = "sample-letter";
        letter.textContent = "";
        sample.appendChild(letter);
    }

    // Sample index
    const indexLabel = document.createElement("div");
    indexLabel.className = "sample-index";
    indexLabel.textContent = index.toString();
    sample.appendChild(indexLabel);

    // Click handler for selection
    sample.addEventListener("click", () => {
        selectSample(index);
    });

    return sample;
}

// Select a sample
function selectSample(index: number): void {

    deselectSamples();

    document.querySelectorAll(`[data-index="${index}"]`).forEach((el) => {
        el.classList.add("selected")
    })

    selectedSample = {index};

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
    if (!selectedSample || !samplesData) return;

    // console.log(e.key)

    if (e.key === "Escape") {
        deselectSamples();
        return;
    }

    if (e.key === "ArrowLeft") {
        if (selectedSample.index > 0) {
            selectSample(selectedSample.index - 1);
        }
        return;
    }

    if (e.key === "ArrowRight") {
        if (selectedSample.index < samplesData.left.length - 1) {
            selectSample(selectedSample.index + 1);
        }
        return;
    }

    if (e.key === "Backspace" || e.key === "Delete") {
        assignLetter(selectedSample.index, "");
        return;
    }

    const uppercaseKey = e.key.toUpperCase();
    if (uppercaseKey.length === 1 && uppercaseKey >= "A" && uppercaseKey <= "Z") {
        assignLetter(selectedSample.index, uppercaseKey);
    }

});

function assignLetter(index: number, letter: string): void {
    const channelEl = document.getElementById(`channel-input`);
    if (!channelEl) return;
    const sample = channelEl.querySelector(`[data-index="${index}"]`) as HTMLElement;
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

    if (!samplesData) return;
    const countEl = document.getElementById("sample-count");

    if (!countEl) return;

    countEl.textContent = `${samplesData.left.length} samples`;

}

function updateSelectionInfo(): void {
    const infoEl = document.getElementById("selection-info");
    if (!infoEl) return;
    if (!selectedSample) {
        infoEl.textContent = "";
        return;
    }

    const channelEl = document.getElementById(`channel-input`);
    if (!channelEl) return;
    const sample = channelEl.querySelector(`[data-index="${selectedSample.index}"]`);
    if (!sample) return;
    const letterEl = sample.querySelector(".sample-letter") as HTMLElement;
    const letter = letterEl?.textContent || "—";
    infoEl.textContent = `CHinput #${selectedSample.index}: ${letter}`;

    const scrollbar = document.getElementById("unified-scrollbar");
    const channel1 = document.getElementById("channel-1");
    if (!scrollbar) return;
    const value: number = (selectedSample.index + 1.5) * (currentZoom + 4) - (channel1?.getBoundingClientRect().width || 0) * 0.5;
    scrollbar.scrollTo({left: clamp(value, 0, scrollbar.scrollWidth)})
}

function audioPlay() {
    if (!audio) return;
    audio.play().then(_ => {});
    activeStyleForPlayButton();
}

function audioPause() {
    if (!audio) return;
    audio.pause();
    activeStyleForPauseButton();
}

function audioStepStart() {
    if (!audio) return;
    audio.pause();
    audio.currentTime = 0;
    activeStyleForPauseButton();
}

function audioStepEnd() {
    if (!audio) return;
    audio.pause();
    audio.currentTime = audio.duration;
    activeStyleForPauseButton();
}

window.addEventListener("DOMContentLoaded", () => {
    const loadBtn = document.getElementById("load-btn");
    const zoomInBtn = document.getElementById("zoom-in");
    const zoomOutBtn = document.getElementById("zoom-out");
    const audioPlayBtn = document.getElementById("audio-play");
    const audioPauseBtn = document.getElementById("audio-pause");
    const audioStepStartBtn = document.getElementById("audio-stepstart");
    const audioStepEndBtn = document.getElementById("audio-stepend");

    if (loadBtn) {
        loadBtn.addEventListener("click", async () => {
            try {
                const selected = await open({
                    multiple: false, filters: [{
                        name: 'WAV Audio', extensions: ['wav']
                    }]
                });

                if (selected) {
                    await loadSamplesData(selected);
                    loadAudio(selected);
                }
            } catch (error) {
                console.error("Failed to open file picker:", error);
            }
        });
    }

    if (audioPlayBtn) {
        audioPlayBtn.addEventListener("click", () => audioPlay());
    }

    if (audioPauseBtn) {
        audioPauseBtn.addEventListener("click", () => audioPause());
    }

    if (audioStepStartBtn) {
        audioStepStartBtn.addEventListener("click", () => audioStepStart());
    }

    if (audioStepEndBtn) {
        audioStepEndBtn.addEventListener("click", () => audioStepEnd());
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
    const channelInput = document.getElementById("channel-input");

    if (!scrollbar || !channel1 || !channel2 || !channelInput) return;

    // Update scrollbar content width when channels change
    const updateScrollbarWidth = () => {
        if (!samplesData) return;
        const totalWidth = (currentZoom + 4) * (samplesData.left.length + 1);
        scrollbar.innerHTML = `<div style="width: ${totalWidth}px; height: 1px;"/>`;
    };

    // Sync channels with scrollbar
    let isScrolling = false;

    scrollbar.addEventListener("scroll", () => {
        if (!isScrolling) {
            isScrolling = true;
            const scrollLeft = scrollbar.scrollLeft;
            channel1.scrollLeft = scrollLeft;
            channel2.scrollLeft = scrollLeft;
            channelInput.scrollLeft = scrollLeft;
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
    channelInput.addEventListener("scroll", syncScrollbar);

    (window as any).updateScrollbarWidth = updateScrollbarWidth;
}

function activeStyleForPlayButton(){
    const audioPlayBtn = document.getElementById("audio-play");
    const audioPauseBtn = document.getElementById("audio-pause");
    if (!audioPlayBtn || !audioPauseBtn) return;
    audioPlayBtn.classList.add("btn-playing")
    audioPauseBtn.classList.remove("btn-playing")
}

function activeStyleForPauseButton(){
    const audioPlayBtn = document.getElementById("audio-play");
    const audioPauseBtn = document.getElementById("audio-pause");
    if (!audioPlayBtn || !audioPauseBtn) return;
    audioPauseBtn.classList.add("btn-playing")
    audioPlayBtn.classList.remove("btn-playing")
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

    if ((window as any).updateScrollbarWidth) {
        (window as any).updateScrollbarWidth();
    }
}