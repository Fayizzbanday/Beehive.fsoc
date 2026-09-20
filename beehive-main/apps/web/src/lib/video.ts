export interface CaptureFrame {
  blob: Blob;
  url: string;
  timeOffset: number;
}
export interface Capture {
  source: "camera" | "upload";
  digest: string;
  durationSeconds: number;
  frames: CaptureFrame[];
  sizeBytes: number;
}
export const MAX_RECORDING_SECONDS = 12;
export const FRAME_TARGET = 4;
const FRAME_WIDTH = 640;
const RECORDER_TYPES = [
  "video/webm;codecs=vp9",
  "video/webm;codecs=vp8",
  "video/webm",
  "video/mp4",
];
export function recorderMimeType() {
  if (typeof MediaRecorder === "undefined") return "";
  return (
    RECORDER_TYPES.find((type) => MediaRecorder.isTypeSupported(type)) ?? ""
  );
}
export const cameraSupported = () =>
  typeof navigator !== "undefined" &&
  !!navigator.mediaDevices?.getUserMedia &&
  typeof MediaRecorder !== "undefined";
/** SHA-256 of the captured bytes. The same video always produces the same report, and the video itself never leaves the device. */
export async function digestBlob(blob: Blob) {
  const hash = await crypto.subtle.digest("SHA-256", await blob.arrayBuffer());
  return `0x${Array.from(new Uint8Array(hash), (b) => b.toString(16).padStart(2, "0")).join("")}`;
}
function drawFrame(video: HTMLVideoElement, timeOffset: number) {
  const width = Math.min(FRAME_WIDTH, video.videoWidth || FRAME_WIDTH);
  const scale = width / (video.videoWidth || FRAME_WIDTH);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = Math.round((video.videoHeight || FRAME_WIDTH * 0.56) * scale);
  canvas.getContext("2d")?.drawImage(video, 0, 0, canvas.width, canvas.height);
  return new Promise<CaptureFrame>((resolve, reject) =>
    canvas.toBlob(
      (blob) =>
        blob
          ? resolve({ blob, url: URL.createObjectURL(blob), timeOffset })
          : reject(new Error("This browser could not export a keyframe.")),
      "image/jpeg",
      0.72,
    ),
  );
}
const once = (element: HTMLVideoElement, event: string, timeout = 8000) =>
  new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => {
      element.removeEventListener(event, handler);
      reject(new Error("The video could not be decoded in this browser."));
    }, timeout);
    const handler = () => {
      clearTimeout(timer);
      element.removeEventListener(event, handler);
      resolve();
    };
    element.addEventListener(event, handler, { once: true });
  });
/** Some recorded WebM blobs report an infinite duration until they are seeked past the end. */
async function resolveDuration(video: HTMLVideoElement) {
  if (Number.isFinite(video.duration) && video.duration > 0)
    return video.duration;
  video.currentTime = 1e6;
  await once(video, "durationchange").catch(() => undefined);
  await once(video, "seeked").catch(() => undefined);
  video.currentTime = 0;
  return Number.isFinite(video.duration) && video.duration > 0
    ? video.duration
    : 0;
}
export async function captureFromFile(
  file: File,
  frameCount = FRAME_TARGET,
): Promise<Capture> {
  if (!file.type.startsWith("video/"))
    throw new Error("Choose a video file recorded on a phone or camera.");
  if (file.size > 220 * 1024 * 1024)
    throw new Error("Choose a clip under 220 MB.");
  const url = URL.createObjectURL(file);
  const video = document.createElement("video");
  video.muted = true;
  video.playsInline = true;
  video.preload = "auto";
  video.src = url;
  try {
    await once(video, "loadeddata");
    const duration = await resolveDuration(video);
    const frames: CaptureFrame[] = [];
    for (let index = 0; index < frameCount; index++) {
      const timeOffset = duration
        ? (duration * (index + 0.5)) / frameCount
        : index * 0.5;
      video.currentTime = Math.min(timeOffset, Math.max(0, duration - 0.05));
      await once(video, "seeked").catch(() => undefined);
      frames.push(await drawFrame(video, Number(timeOffset.toFixed(1))));
    }
    return {
      source: "upload",
      digest: await digestBlob(file),
      durationSeconds: Number((duration || frames.length * 0.5).toFixed(1)),
      frames,
      sizeBytes: file.size,
    };
  } finally {
    URL.revokeObjectURL(url);
  }
}
export interface Recording {
  stop: () => Promise<Capture>;
  cancel: () => void;
}
/**
 * Records the live preview and grabs keyframes from the same element while it runs,
 * which avoids seeking a WebM blob that may carry no duration metadata.
 */
export function recordFromPreview(
  video: HTMLVideoElement,
  stream: MediaStream,
  frameCount = FRAME_TARGET,
): Recording {
  const mimeType = recorderMimeType();
  const recorder = new MediaRecorder(
    stream,
    mimeType ? { mimeType, videoBitsPerSecond: 2_500_000 } : undefined,
  );
  const chunks: Blob[] = [];
  const frames: CaptureFrame[] = [];
  const started = performance.now();
  recorder.ondataavailable = (event) => {
    if (event.data.size) chunks.push(event.data);
  };
  recorder.start(250);
  const interval = window.setInterval(
    async () => {
      if (frames.length >= frameCount) return;
      const elapsed = (performance.now() - started) / 1000;
      frames.push(await drawFrame(video, Number(elapsed.toFixed(1))));
    },
    (MAX_RECORDING_SECONDS * 1000) / (frameCount + 1),
  );
  const finish = () => {
    window.clearInterval(interval);
    if (recorder.state !== "inactive") recorder.stop();
  };
  return {
    cancel: () => {
      finish();
      frames.forEach((frame) => URL.revokeObjectURL(frame.url));
    },
    stop: () =>
      new Promise<Capture>((resolve, reject) => {
        recorder.onstop = async () => {
          try {
            const blob = new Blob(chunks, {
              type: mimeType || "video/webm",
            });
            if (!frames.length) frames.push(await drawFrame(video, 0));
            resolve({
              source: "camera",
              digest: await digestBlob(blob),
              durationSeconds: Number(
                ((performance.now() - started) / 1000).toFixed(1),
              ),
              frames,
              sizeBytes: blob.size,
            });
          } catch (error) {
            reject(error as Error);
          }
        };
        recorder.onerror = () =>
          reject(new Error("Recording stopped unexpectedly. Try again."));
        finish();
      }),
  };
}
export const releaseCapture = (capture: Capture | null) =>
  capture?.frames.forEach((frame) => URL.revokeObjectURL(frame.url));
