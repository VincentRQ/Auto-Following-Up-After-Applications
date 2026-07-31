#!/usr/bin/env node
import { deflateSync } from "node:zlib";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

const scale = 4;
const width = 128 * scale;
const height = 128 * scale;
const pixels = Buffer.alloc(width * height * 4);

function color(x, y, [red, green, blue, alpha = 255]) {
  if (x < 0 || y < 0 || x >= width || y >= height) return;
  const offset = (y * width + x) * 4;
  pixels[offset] = red;
  pixels[offset + 1] = green;
  pixels[offset + 2] = blue;
  pixels[offset + 3] = alpha;
}

function rectangle(left, top, right, bottom, value) {
  for (let y = top * scale; y < bottom * scale; y += 1) for (let x = left * scale; x < right * scale; x += 1) color(x, y, value);
}

function line(x0, y0, x1, y1, thickness, value) {
  const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
  for (let step = 0; step <= steps; step += 1) {
    const x = Math.round(x0 + ((x1 - x0) * step) / steps);
    const y = Math.round(y0 + ((y1 - y0) * step) / steps);
    rectangle(x - Math.floor(thickness / 2), y - Math.floor(thickness / 2), x + Math.ceil(thickness / 2), y + Math.ceil(thickness / 2), value);
  }
}

rectangle(0, 0, 128, 128, [16, 21, 17, 255]);
rectangle(20, 28, 108, 36, [35, 196, 131, 255]);
rectangle(20, 92, 108, 100, [35, 196, 131, 255]);
rectangle(20, 28, 28, 100, [35, 196, 131, 255]);
rectangle(100, 28, 108, 100, [35, 196, 131, 255]);
line(26, 36, 64, 68, 7, [244, 247, 245, 255]);
line(102, 36, 64, 68, 7, [244, 247, 245, 255]);
line(38, 84, 66, 84, 7, [244, 247, 245, 255]);
line(78, 80, 88, 90, 7, [242, 191, 74, 255]);
line(88, 90, 105, 68, 7, [242, 191, 74, 255]);

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1));
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const name = Buffer.from(type, "ascii");
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const checksum = Buffer.alloc(4);
  checksum.writeUInt32BE(crc32(Buffer.concat([name, data])));
  return Buffer.concat([length, name, data, checksum]);
}

const header = Buffer.alloc(13);
header.writeUInt32BE(width, 0);
header.writeUInt32BE(height, 4);
header[8] = 8;
header[9] = 6;
const scanlines = Buffer.alloc(height * (1 + width * 4));
for (let y = 0; y < height; y += 1) pixels.copy(scanlines, y * (1 + width * 4) + 1, y * width * 4, (y + 1) * width * 4);
const png = Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", header), chunk("IDAT", deflateSync(scanlines)), chunk("IEND", Buffer.alloc(0))]);
const output = resolve("assets/outreach-icon.png");
mkdirSync(dirname(output), { recursive: true });
writeFileSync(output, png);
console.log(`Created ${output}`);
