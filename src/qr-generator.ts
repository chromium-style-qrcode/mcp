import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { join, dirname } from 'node:path';

import {
  QuietZone,
  initialize,
  CenterImage,
  ModuleStyle,
  LocatorStyle,
  isInitialized,
  generateQRCode as wasmGenerateQRCode,
} from '@chromium-style-qrcode/generator';
import { loadImage, createCanvas, type SKRSContext2D } from '@napi-rs/canvas';

const require = createRequire(import.meta.url);

async function ensureWasmInitialized(): Promise<void> {
  if (isInitialized()) return;
  const pkgDir = dirname(
    require.resolve('@chromium-style-qrcode/generator/package.json'),
  );
  const wasmPath = join(pkgDir, 'dist', 'qrcode_bg.wasm');
  const wasmBuffer = await readFile(wasmPath);
  await initialize(wasmBuffer);
}

export interface GenerateOptions {
  showLogo?: boolean;
  customLogo?: string;
}

// Constants matching Chromium implementation
const MODULE_SIZE_PIXELS = 10;
const DINO_TILE_SIZE_PIXELS = 4;
const LOCATOR_SIZE_MODULES = 7;
const QUIET_ZONE_SIZE_PIXELS = MODULE_SIZE_PIXELS * 4;

const moduleColor = '#000000'; // Black
const backgroundColor = '#FFFFFF'; // White

// --- Dino Data (EXACT copy from Chromium dino_image.h) ---
const kDinoWidth = 20;
const kDinoHeight = 22;
const kDinoHeadHeight = 8;
const kDinoBodyHeight = 14; // kDinoHeight - kDinoHeadHeight
const kDinoWidthBytes = 3; // (kDinoWidth + 7) / 8

// Pixel data for the dino's head, facing right - EXACT from Chromium
const kDinoHeadRight = [
  0b00000000, 0b00011111, 0b11100000, 0b00000000, 0b00111111, 0b11110000,
  0b00000000, 0b00110111, 0b11110000, 0b00000000, 0b00111111, 0b11110000,
  0b00000000, 0b00111111, 0b11110000, 0b00000000, 0b00111111, 0b11110000,
  0b00000000, 0b00111110, 0b00000000, 0b00000000, 0b00111111, 0b11000000,
];

// Pixel data for the dino's body - EXACT from Chromium
const kDinoBody = [
  0b10000000, 0b01111100, 0b00000000, 0b10000001, 0b11111100, 0b00000000,
  0b11000011, 0b11111111, 0b00000000, 0b11100111, 0b11111101, 0b00000000,
  0b11111111, 0b11111100, 0b00000000, 0b11111111, 0b11111100, 0b00000000,
  0b01111111, 0b11111000, 0b00000000, 0b00111111, 0b11111000, 0b00000000,
  0b00011111, 0b11110000, 0b00000000, 0b00001111, 0b11100000, 0b00000000,
  0b00000111, 0b01100000, 0b00000000, 0b00000110, 0b00100000, 0b00000000,
  0b00000100, 0b00100000, 0b00000000, 0b00000110, 0b00110000, 0b00000000,
];

// Helper function to check if a module position is part of a locator pattern
const isLocatorModule = (x: number, y: number, originalSize: number) => {
  // Top-left locator
  if (x < LOCATOR_SIZE_MODULES && y < LOCATOR_SIZE_MODULES) {
    return true;
  }

  // Top-right locator
  if (x >= originalSize - LOCATOR_SIZE_MODULES && y < LOCATOR_SIZE_MODULES) {
    return true;
  }

  // Bottom-left locator
  if (x < LOCATOR_SIZE_MODULES && y >= originalSize - LOCATOR_SIZE_MODULES) {
    return true;
  }

  return false;
};

// Draw rounded rectangle helper function
const drawRoundRect = (
  ctx: SKRSContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
  fillStyle: string,
) => {
  ctx.fillStyle = fillStyle;
  ctx.beginPath();
  // @napi-rs/canvas might not support roundRect fully or same signature, but let's try or use arcTo
  if (ctx.roundRect) {
    ctx.roundRect(x, y, width, height, radius);
  } else {
    // Fallback
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    ctx.lineTo(x + radius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
  }
  ctx.fill();
};

// Draw QR locators at three corners (EXACT Chromium DrawLocators implementation)
const drawLocators = (
  ctx: SKRSContext2D,
  dataSize: { width: number; height: number },
  paintForeground: { color: string },
  paintBackground: { color: string },
  margin: number,
  modulePixelSize: number,
) => {
  const chromiumModuleSize = 10;
  const scaleFactor = modulePixelSize / chromiumModuleSize;
  const radius = 10 * scaleFactor;

  const drawOneLocator = (leftXModules: number, topYModules: number) => {
    // Outermost square, 7x7 modules
    let leftXPixels = leftXModules * modulePixelSize;
    let topYPixels = topYModules * modulePixelSize;
    let dimPixels = modulePixelSize * LOCATOR_SIZE_MODULES;

    drawRoundRect(
      ctx,
      margin + leftXPixels,
      margin + topYPixels,
      dimPixels,
      dimPixels,
      radius,
      paintForeground.color,
    );

    // Middle square, one module smaller in all dimensions (5x5)
    leftXPixels += modulePixelSize;
    topYPixels += modulePixelSize;
    dimPixels -= 2 * modulePixelSize;

    drawRoundRect(
      ctx,
      margin + leftXPixels,
      margin + topYPixels,
      dimPixels,
      dimPixels,
      radius,
      paintBackground.color,
    );

    // Inner square, one additional module smaller in all dimensions (3x3)
    leftXPixels += modulePixelSize;
    topYPixels += modulePixelSize;
    dimPixels -= 2 * modulePixelSize;

    drawRoundRect(
      ctx,
      margin + leftXPixels,
      margin + topYPixels,
      dimPixels,
      dimPixels,
      radius,
      paintForeground.color,
    );
  };

  // Draw the three locators
  drawOneLocator(0, 0); // Top-left
  drawOneLocator(dataSize.width - LOCATOR_SIZE_MODULES, 0); // Top-right
  drawOneLocator(0, dataSize.height - LOCATOR_SIZE_MODULES); // Bottom-left
};

// Draw dino pixel by pixel to avoid any white background
const drawDinoPixelByPixel = (
  ctx: SKRSContext2D,
  destX: number,
  destY: number,
  destWidth: number,
  destHeight: number,
) => {
  const scaleX = destWidth / kDinoWidth;
  const scaleY = destHeight / kDinoHeight;

  ctx.fillStyle = moduleColor;

  const drawPixelData = (
    srcArray: number[],
    srcNumRows: number,
    startRow: number,
  ) => {
    const bytesPerRow = kDinoWidthBytes;

    for (let row = 0; row < srcNumRows; row++) {
      let whichByte = row * bytesPerRow;
      let mask = 0b10000000;

      for (let col = 0; col < kDinoWidth; col++) {
        if (srcArray[whichByte] & mask) {
          const pixelX = destX + col * scaleX;
          const pixelY = destY + (startRow + row) * scaleY;

          ctx.fillRect(
            Math.floor(pixelX),
            Math.floor(pixelY),
            Math.ceil(scaleX),
            Math.ceil(scaleY),
          );
        }
        mask >>= 1;
        if (mask === 0) {
          mask = 0b10000000;
          whichByte++;
        }
      }
    }
  };

  drawPixelData(kDinoHeadRight, kDinoHeadHeight, 0);
  drawPixelData(kDinoBody, kDinoBodyHeight, kDinoHeadHeight);
};

// Paint center image exactly like Chromium's PaintCenterImage function
const paintCenterImage = (
  ctx: SKRSContext2D,
  canvasBounds: { x: number; y: number; width: number; height: number },
  widthPx: number,
  heightPx: number,
  borderPx: number,
  paintBackground: { color: string },
  modulePixelSize: number,
) => {
  if (
    canvasBounds.width / 2 < widthPx + borderPx ||
    canvasBounds.height / 2 < heightPx + borderPx
  ) {
    console.warn('Center image too large for canvas bounds');
    return;
  }

  let destX = (canvasBounds.width - widthPx) / 2;
  let destY = (canvasBounds.height - heightPx) / 2;

  const backgroundLeft =
    Math.floor((destX - borderPx) / modulePixelSize) * modulePixelSize;
  const backgroundTop =
    Math.floor((destY - borderPx) / modulePixelSize) * modulePixelSize;
  const backgroundRight =
    Math.floor(
      (destX + widthPx + borderPx + modulePixelSize - 1) / modulePixelSize,
    ) * modulePixelSize;
  const backgroundBottom =
    Math.floor(
      (destY + heightPx + borderPx + modulePixelSize - 1) / modulePixelSize,
    ) * modulePixelSize;

  ctx.fillStyle = paintBackground.color;
  ctx.fillRect(
    backgroundLeft,
    backgroundTop,
    backgroundRight - backgroundLeft,
    backgroundBottom - backgroundTop,
  );

  const deltaX = Math.round(
    (backgroundLeft + backgroundRight) / 2 - (destX + widthPx / 2),
  );
  const deltaY = Math.round(
    (backgroundTop + backgroundBottom) / 2 - (destY + heightPx / 2),
  );
  destX += deltaX;
  destY += deltaY;

  drawDinoPixelByPixel(ctx, destX, destY, widthPx, heightPx);
};

// Draw center image (dino implementation matching Chromium exactly)
const drawCenterImage = (
  ctx: SKRSContext2D,
  canvasBounds: { x: number; y: number; width: number; height: number },
  paintBackground: { color: string },
  modulePixelSize: number,
) => {
  const chromiumModuleSize = 10;
  const scaleFactor = modulePixelSize / chromiumModuleSize;
  const pixelsPerDinoTile = Math.round(DINO_TILE_SIZE_PIXELS * scaleFactor);
  const dinoWidthPx = pixelsPerDinoTile * kDinoWidth;
  const dinoHeightPx = pixelsPerDinoTile * kDinoHeight;
  const dinoBorderPx = Math.round(2 * scaleFactor);

  paintCenterImage(
    ctx,
    canvasBounds,
    dinoWidthPx,
    dinoHeightPx,
    dinoBorderPx,
    paintBackground,
    modulePixelSize,
  );
};

// Draw a custom uploaded image centered with the same sizing rules as the dino
const drawCustomImage = async (
  ctx: SKRSContext2D,
  canvasBounds: { x: number; y: number; width: number; height: number },
  imageData: Buffer,
  paintBackground: { color: string },
  modulePixelSize: number,
) => {
  const chromiumModuleSize = 10;
  const scaleFactor = modulePixelSize / chromiumModuleSize;
  const pixelsPerDinoTile = Math.round(DINO_TILE_SIZE_PIXELS * scaleFactor);
  const widthPx = pixelsPerDinoTile * kDinoWidth;
  const heightPx = pixelsPerDinoTile * kDinoHeight;
  const borderPx = Math.round(2 * scaleFactor);

  if (
    canvasBounds.width / 2 < widthPx + borderPx ||
    canvasBounds.height / 2 < heightPx + borderPx
  ) {
    return;
  }

  let destX = (canvasBounds.width - widthPx) / 2;
  let destY = (canvasBounds.height - heightPx) / 2;

  const backgroundLeft =
    Math.floor((destX - borderPx) / modulePixelSize) * modulePixelSize;
  const backgroundTop =
    Math.floor((destY - borderPx) / modulePixelSize) * modulePixelSize;
  const backgroundRight =
    Math.floor(
      (destX + widthPx + borderPx + modulePixelSize - 1) / modulePixelSize,
    ) * modulePixelSize;
  const backgroundBottom =
    Math.floor(
      (destY + heightPx + borderPx + modulePixelSize - 1) / modulePixelSize,
    ) * modulePixelSize;

  ctx.fillStyle = paintBackground.color;
  ctx.fillRect(
    backgroundLeft,
    backgroundTop,
    backgroundRight - backgroundLeft,
    backgroundBottom - backgroundTop,
  );

  const deltaX = Math.round(
    (backgroundLeft + backgroundRight) / 2 - (destX + widthPx / 2),
  );
  const deltaY = Math.round(
    (backgroundTop + backgroundBottom) / 2 - (destY + heightPx / 2),
  );
  destX += deltaX;
  destY += deltaY;

  const img = await loadImage(imageData);
  ctx.drawImage(img, destX, destY, widthPx, heightPx);
};

export async function generateQRCode(
  text: string,
  options: GenerateOptions = {},
): Promise<Buffer> {
  await ensureWasmInitialized();

  const { showLogo = true, customLogo } = options;

  const centerImage = showLogo ? CenterImage.Dino : CenterImage.NoCenterImage;

  const result = wasmGenerateQRCode(text, {
    moduleStyle: ModuleStyle.Circles,
    locatorStyle: LocatorStyle.Rounded,
    centerImage,
    quietZone: QuietZone.WillBeAddedByClient,
  });

  if (!result || !result.data) {
    throw new Error('Invalid QR generation result');
  }

  const qrData = result.data;
  const qrSize = result.size;
  const originalSize = result.original_size;

  const canvasSize =
    originalSize * MODULE_SIZE_PIXELS + QUIET_ZONE_SIZE_PIXELS * 2;
  const canvas = createCanvas(canvasSize, canvasSize);
  const ctx = canvas.getContext('2d');

  // Clear canvas with white background
  ctx.fillStyle = backgroundColor;
  ctx.fillRect(0, 0, canvasSize, canvasSize);

  // Enable high quality scaling
  ctx.imageSmoothingEnabled = false;
  ctx.imageSmoothingQuality = 'high';

  // Render QR code
  const targetSize = canvasSize;
  const size = qrSize;

  // Calculate margin and module size exactly like Chromium's RenderBitmap
  const margin = QUIET_ZONE_SIZE_PIXELS; // 40 pixels fixed margin
  const modulePixelSize = MODULE_SIZE_PIXELS; // 10 pixels per module

  // Setup paint styles exactly like Chromium
  const paintBlack = { color: moduleColor };
  const paintWhite = { color: backgroundColor };

  // Check if we have quiet zone in our data
  const hasQuietZone = size > originalSize;
  const quietZoneModules = hasQuietZone ? (size - originalSize) / 2 : 0;

  // First pass: Draw data modules (matching Chromium's loop exactly)
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dataIndex = y * size + x;
      if (qrData[dataIndex] & 0x1) {
        let originalX: number, originalY: number;
        if (hasQuietZone) {
          originalX = x - quietZoneModules;
          originalY = y - quietZoneModules;
          if (
            originalX < 0 ||
            originalY < 0 ||
            originalX >= originalSize ||
            originalY >= originalSize
          ) {
            continue;
          }
        } else {
          originalX = x;
          originalY = y;
        }

        // Skip locator modules - they will be drawn separately
        const isLocator = isLocatorModule(originalX, originalY, originalSize);
        if (isLocator) continue;

        // Draw circle module exactly like Chromium
        const centerX = margin + (originalX + 0.5) * modulePixelSize;
        const centerY = margin + (originalY + 0.5) * modulePixelSize;
        const radius = modulePixelSize / 2 - 1;

        ctx.fillStyle = paintBlack.color;
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
        ctx.fill();
      }
    }
  }

  // Draw locators exactly like Chromium
  drawLocators(
    ctx,
    { width: originalSize, height: originalSize },
    paintBlack,
    paintWhite,
    margin,
    modulePixelSize,
  );

  // Draw center image based on options
  if (customLogo) {
    const logoBuffer = Buffer.from(customLogo, 'base64');
    await drawCustomImage(
      ctx,
      { x: 0, y: 0, width: targetSize, height: targetSize },
      logoBuffer,
      paintWhite,
      modulePixelSize,
    );
  } else if (showLogo) {
    drawCenterImage(
      ctx,
      { x: 0, y: 0, width: targetSize, height: targetSize },
      paintWhite,
      modulePixelSize,
    );
  }

  return canvas.toBuffer('image/png');
}
