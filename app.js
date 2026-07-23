(() => {
  'use strict';

  const MAX_FILE_SIZE = 25 * 1024 * 1024;
  const state = {
    file: null,
    image: null,
    action: 'optimize',
    objectUrl: null,
  };

  const $ = (selector) => document.querySelector(selector);
  const $$ = (selector) => [...document.querySelectorAll(selector)];

  const fileInput = $('#file-input');
  const dropZone = $('#drop-zone');
  const filePanel = $('#file-panel');
  const actionArea = $('#action-area');
  const preview = $('#file-preview');
  const fileName = $('#file-name');
  const fileMeta = $('#file-meta');
  const processButton = $('#process-button');
  const statusMessage = $('#status-message');
  const formatSelect = $('#format-select');
  const qualityRange = $('#quality-range');
  const qualityOutput = $('#quality-output');
  const widthInput = $('#width-input');
  const thresholdField = $('.threshold-field');
  const thresholdRange = $('#threshold-range');
  const thresholdOutput = $('#threshold-output');
  const actionTitle = $('#action-title');
  const canvas = $('#processing-canvas');

  const actionConfig = {
    optimize: {
      title: 'Optimizar imagen',
      format: 'image/webp',
      quality: 82,
      width: '',
      button: 'Comprimir y descargar',
    },
    convert: {
      title: 'Convertir formato',
      format: 'image/png',
      quality: 92,
      width: '',
      button: 'Convertir y descargar',
    },
    resize: {
      title: 'Redimensionar imagen',
      format: 'image/webp',
      quality: 88,
      width: 1200,
      button: 'Redimensionar y descargar',
    },
    signature: {
      title: 'Limpiar fondo de firma',
      format: 'image/png',
      quality: 100,
      width: '',
      button: 'Limpiar y descargar',
    },
  };

  const formatBytes = (bytes) => {
    if (!Number.isFinite(bytes)) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  };

  const safeBaseName = (name) => {
    const withoutExtension = name.replace(/\.[^/.]+$/, '');
    return withoutExtension.replace(/[^a-zA-Z0-9áéíóúÁÉÍÓÚñÑ_-]+/g, '-').replace(/^-+|-+$/g, '') || 'toolisto';
  };

  const extensionFor = (mime) => ({
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
  }[mime] || 'png');

  const showStatus = (message, isError = false) => {
    statusMessage.textContent = message;
    statusMessage.style.color = isError ? '#a43a3a' : '#167155';
  };

  function resetFile() {
    if (state.objectUrl) URL.revokeObjectURL(state.objectUrl);
    state.file = null;
    state.image = null;
    state.objectUrl = null;
    fileInput.value = '';
    preview.removeAttribute('src');
    filePanel.hidden = true;
    actionArea.hidden = true;
    dropZone.hidden = false;
    showStatus('');
  }

  function selectAction(action, preserveValues = false) {
    if (!actionConfig[action]) return;
    state.action = action;
    $$('.action-tab').forEach((tab) => tab.classList.toggle('active', tab.dataset.action === action));

    const config = actionConfig[action];
    actionTitle.textContent = config.title;
    processButton.querySelector('span').textContent = config.button;
    thresholdField.hidden = action !== 'signature';

    if (!preserveValues) {
      formatSelect.value = config.format;
      qualityRange.value = config.quality;
      widthInput.value = config.width;
      qualityOutput.textContent = `${config.quality}%`;
    }

    if (action === 'signature') {
      formatSelect.value = 'image/png';
      formatSelect.disabled = true;
      qualityRange.disabled = true;
    } else {
      formatSelect.disabled = false;
      qualityRange.disabled = false;
    }
    showStatus('');
  }

  function inferAction(file) {
    const name = file.name.toLowerCase();
    if (/(firma|signature|sign|rubrica|rúbrica)/.test(name)) return 'signature';
    if (file.type === 'image/png' && file.size > 1.5 * 1024 * 1024) return 'optimize';
    return 'optimize';
  }

  async function handleFile(file) {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      showStatus('Por ahora Toolisto admite imágenes JPG, PNG, WebP, GIF y SVG.', true);
      return;
    }
    if (file.size > MAX_FILE_SIZE) {
      showStatus('La imagen supera el límite de 25 MB.', true);
      return;
    }

    try {
      const objectUrl = URL.createObjectURL(file);
      const img = new Image();
      img.decoding = 'async';
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = () => reject(new Error('No se pudo leer la imagen.'));
        img.src = objectUrl;
      });

      if (state.objectUrl) URL.revokeObjectURL(state.objectUrl);
      state.file = file;
      state.image = img;
      state.objectUrl = objectUrl;

      preview.src = objectUrl;
      fileName.textContent = file.name;
      fileMeta.textContent = `${img.naturalWidth} × ${img.naturalHeight} · ${formatBytes(file.size)}`;
      $('#detected-badge').textContent = file.type.includes('svg') ? 'SVG detectado' : 'Imagen detectada';

      dropZone.hidden = true;
      filePanel.hidden = false;
      actionArea.hidden = false;
      selectAction(inferAction(file));
    } catch (error) {
      showStatus(error.message || 'No se pudo abrir la imagen.', true);
      URL.revokeObjectURL(objectUrl);
    }
  }

  function getOutputSize() {
    const image = state.image;
    const requestedWidth = Number.parseInt(widthInput.value, 10);
    if (!requestedWidth || requestedWidth >= image.naturalWidth) {
      return { width: image.naturalWidth, height: image.naturalHeight };
    }
    const ratio = requestedWidth / image.naturalWidth;
    return {
      width: requestedWidth,
      height: Math.max(1, Math.round(image.naturalHeight * ratio)),
    };
  }

  function cleanSignature(context, width, height) {
    const imageData = context.getImageData(0, 0, width, height);
    const data = imageData.data;
    const threshold = Number(thresholdRange.value) / 100;
    const cutoff = 255 * threshold;

    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      const darkness = Math.max(0, Math.min(1, (cutoff - luminance) / Math.max(cutoff, 1)));

      data[i] = Math.round(r * 0.16);
      data[i + 1] = Math.round(g * 0.18);
      data[i + 2] = Math.round(b * 0.24);
      data[i + 3] = Math.round(255 * Math.pow(darkness, 0.72));
    }
    context.putImageData(imageData, 0, 0);
  }

  const canvasToBlob = (canvasElement, mime, quality) => new Promise((resolve, reject) => {
    canvasElement.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('El navegador no pudo generar el archivo.'));
    }, mime, quality);
  });

  async function processImage() {
    if (!state.file || !state.image) return;

    processButton.disabled = true;
    processButton.querySelector('span').textContent = 'Procesando…';
    showStatus('Preparando tu archivo…');

    try {
      const { width, height } = getOutputSize();
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext('2d', { willReadFrequently: state.action === 'signature' });
      context.clearRect(0, 0, width, height);

      if (formatSelect.value === 'image/jpeg' && state.action !== 'signature') {
        context.fillStyle = '#ffffff';
        context.fillRect(0, 0, width, height);
      }
      context.imageSmoothingEnabled = true;
      context.imageSmoothingQuality = 'high';
      context.drawImage(state.image, 0, 0, width, height);

      let mime = formatSelect.value;
      let quality = Number(qualityRange.value) / 100;
      if (state.action === 'signature') {
        cleanSignature(context, width, height);
        mime = 'image/png';
        quality = 1;
      }

      const blob = await canvasToBlob(canvas, mime, quality);
      const extension = extensionFor(mime);
      const suffix = state.action === 'signature' ? '-firma-limpia' : `-${state.action}`;
      const downloadName = `${safeBaseName(state.file.name)}${suffix}.${extension}`;
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = downloadName;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1500);

      const reduction = state.file.size > blob.size
        ? ` · ${Math.round((1 - blob.size / state.file.size) * 100)}% menos`
        : '';
      showStatus(`Listo: ${formatBytes(blob.size)}${reduction}`);
    } catch (error) {
      console.error(error);
      showStatus(error.message || 'Ocurrió un problema al procesar la imagen.', true);
    } finally {
      processButton.disabled = false;
      processButton.querySelector('span').textContent = actionConfig[state.action].button;
    }
  }

  $('#choose-file').addEventListener('click', (event) => {
    event.stopPropagation();
    fileInput.click();
  });
  dropZone.addEventListener('click', () => fileInput.click());
  dropZone.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      fileInput.click();
    }
  });
  fileInput.addEventListener('change', () => handleFile(fileInput.files[0]));
  $('#remove-file').addEventListener('click', resetFile);

  ['dragenter', 'dragover'].forEach((eventName) => {
    dropZone.addEventListener(eventName, (event) => {
      event.preventDefault();
      dropZone.classList.add('dragging');
    });
  });
  ['dragleave', 'drop'].forEach((eventName) => {
    dropZone.addEventListener(eventName, (event) => {
      event.preventDefault();
      dropZone.classList.remove('dragging');
    });
  });
  dropZone.addEventListener('drop', (event) => handleFile(event.dataTransfer.files[0]));

  $$('.action-tab').forEach((tab) => tab.addEventListener('click', () => selectAction(tab.dataset.action)));
  qualityRange.addEventListener('input', () => { qualityOutput.textContent = `${qualityRange.value}%`; });
  thresholdRange.addEventListener('input', () => { thresholdOutput.textContent = `${thresholdRange.value}%`; });
  processButton.addEventListener('click', processImage);

  $$('.tool-card').forEach((card) => {
    card.querySelector('button').addEventListener('click', () => {
      const action = card.dataset.jumpAction;
      if (state.file) selectAction(action);
      document.querySelector('#inicio').scrollIntoView({ behavior: 'smooth' });
      if (!state.file) setTimeout(() => fileInput.click(), 500);
    });
  });

  const menuButton = $('.menu-button');
  const nav = $('.main-nav');
  menuButton.addEventListener('click', () => {
    const open = nav.classList.toggle('open');
    menuButton.setAttribute('aria-expanded', String(open));
  });
  $$('.main-nav a').forEach((link) => link.addEventListener('click', () => {
    nav.classList.remove('open');
    menuButton.setAttribute('aria-expanded', 'false');
  }));

  $('#year').textContent = new Date().getFullYear();
  selectAction('optimize');
})();
