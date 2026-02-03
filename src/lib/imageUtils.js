const MAX_SIZE = 400;
const JPEG_QUALITY = 0.82;

/**
 * 將檔案轉為壓縮後的 base64 資料 URL，方便存進 localStorage
 */
export function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/')) {
      reject(new Error('請選擇圖片檔案'));
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target.result;
      compressImage(dataUrl)
        .then(resolve)
        .catch(() => resolve(dataUrl));
    };
    reader.onerror = () => reject(new Error('讀取檔案失敗'));
    reader.readAsDataURL(file);
  });
}

function compressImage(dataUrl) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      let { width, height } = img;
      if (width > MAX_SIZE || height > MAX_SIZE) {
        if (width > height) {
          height = Math.round((height * MAX_SIZE) / width);
          width = MAX_SIZE;
        } else {
          width = Math.round((width * MAX_SIZE) / height);
          height = MAX_SIZE;
        }
      }
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, width, height);
      try {
        const result = canvas.toDataURL('image/jpeg', JPEG_QUALITY);
        resolve(result);
      } catch {
        resolve(dataUrl);
      }
    };
    img.onerror = () => reject(new Error('圖片載入失敗'));
    img.src = dataUrl;
  });
}
