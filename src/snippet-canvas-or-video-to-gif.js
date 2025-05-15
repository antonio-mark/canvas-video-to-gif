const main = async () => {
  const GIF_DURATION_SECONDS = 3;
  const FRAME_RATE = 20;
  const START_AT = 1;

  await loadGifLibrary();

  const element = getCanvasOrVideoElement();
  if (!element) return;

  const workerScriptUrl = createWorkerBlobUrl();
  const frameCount = Math.round(GIF_DURATION_SECONDS * FRAME_RATE);

  const capturedFrames = await captureFrames(
    element,
    frameCount,
    FRAME_RATE,
    START_AT
  );

  await generateAndDownloadGif(capturedFrames, FRAME_RATE, workerScriptUrl);
};

/**
 * Carrega a biblioteca gif.js dinamicamente.
 */
const loadGifLibrary = async () => {
  return new Promise((resolve) => {
    const script = document.createElement("script");
    script.src = "https://cdnjs.cloudflare.com/ajax/libs/gif.js/0.2.0/gif.js";
    script.onload = resolve;
    document.head.appendChild(script);
  });
};

/**
 * Retorna o canvas ou vídeo encontrado e visível.
 */
const getCanvasOrVideoElement = () => {
  const canvas = document.querySelector("canvas");
  if (canvas && canvas.offsetParent !== null) return canvas;

  const video = document.querySelector("video");
  if (video && video.offsetParent !== null) return video;

  console.error("Nenhum elemento <canvas> ou <video> visível encontrado.");
  return null;
};

/**
 * Cria uma URL para o worker script do gif.js.
 */
const createWorkerBlobUrl = () => {
  const blob = new Blob(
    [
      `importScripts('https://cdnjs.cloudflare.com/ajax/libs/gif.js/0.2.0/gif.worker.js');`,
    ],
    { type: "application/javascript" }
  );
  return URL.createObjectURL(blob);
};

/**
 * Captura os frames de um <canvas> ou <video>.
 * @param {HTMLCanvasElement|HTMLVideoElement} element - Elemento de origem
 * @param {number} frameCount - Quantidade de frames
 * @param {number} frameRate - FPS
 * @param {number} startAt - Tempo inicial (apenas para vídeo)
 * @returns {Promise<string[]>}
 */
const captureFrames = (element, frameCount, frameRate, startAt) => {
  return new Promise((resolve) => {
    const frames = [];
    let currentFrame = 0;
    const intervalTime = 1000 / frameRate;

    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d", { willReadFrequently: true });

    if (element instanceof HTMLVideoElement) {
      element.currentTime = startAt;

      const onSeeked = () => {
        canvas.width = element.videoWidth;
        canvas.height = element.videoHeight;

        const intervalId = setInterval(() => {
          if (currentFrame >= frameCount) {
            clearInterval(intervalId);
            resolve(frames);
            return;
          }

          ctx.drawImage(element, 0, 0, canvas.width, canvas.height);
          frames.push(canvas.toDataURL("image/png"));
          element.currentTime += 1 / frameRate;
          currentFrame++;
        }, intervalTime);
      };

      element.addEventListener("seeked", onSeeked, { once: true });
    } else if (element instanceof HTMLCanvasElement) {
      canvas.width = element.width;
      canvas.height = element.height;

      const intervalId = setInterval(() => {
        if (currentFrame >= frameCount) {
          clearInterval(intervalId);
          resolve(frames);
          return;
        }

        ctx.drawImage(element, 0, 0);
        frames.push(canvas.toDataURL("image/png"));
        currentFrame++;
      }, intervalTime);
    } else {
      console.error("Elemento inválido para captura de frames.");
      resolve([]);
    }
  });
};

/**
 * Gera e baixa um GIF a partir dos frames capturados.
 */
const generateAndDownloadGif = (frames, frameRate, workerScriptUrl) => {
  return new Promise((resolve) => {
    const gif = new GIF({
      workers: 2,
      quality: 10,
      workerScript: workerScriptUrl,
    });

    let framesLoaded = 0;

    frames.forEach((frameDataUrl) => {
      const image = new Image();
      image.onload = () => {
        gif.addFrame(image, { delay: 1000 / frameRate });
        framesLoaded++;
        if (framesLoaded === frames.length) gif.render();
      };
      image.src = frameDataUrl;
    });

    gif.on("finished", (blob) => {
      const downloadUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = downloadUrl;
      link.download = `${crypto.randomUUID()}.gif`;
      link.click();
      resolve();
    });
  });
};

main();
