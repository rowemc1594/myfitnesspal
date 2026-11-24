// Generates minimal PNG icons without any npm deps
// Uses raw PNG binary with zlib deflate
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

function makePNG(size) {
  const pixels = new Uint8Array(size * size * 4);
  const cx = size / 2, cy = size / 2;
  const r = size * 0.42;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const idx = (y * size + x) * 4;
      const dx = x - cx, dy = y - cy;
      const dist = Math.sqrt(dx*dx + dy*dy);
      if (dist <= r) {
        // red accent circle
        pixels[idx]   = 0xe9;
        pixels[idx+1] = 0x45;
        pixels[idx+2] = 0x60;
        pixels[idx+3] = 0xff;
      } else {
        // dark background
        pixels[idx]   = 0x1a;
        pixels[idx+1] = 0x1a;
        pixels[idx+2] = 0x2e;
        pixels[idx+3] = 0xff;
      }
    }
  }

  // Write raw RGBA rows as PNG
  // Build uncompressed image data with filter bytes
  const rowSize = 1 + size * 4; // filter byte + RGBA per row
  const raw = Buffer.alloc(size * rowSize);
  for (let y = 0; y < size; y++) {
    raw[y * rowSize] = 0; // filter None
    for (let x = 0; x < size; x++) {
      const src = (y * size + x) * 4;
      const dst = y * rowSize + 1 + x * 4;
      raw[dst]   = pixels[src];
      raw[dst+1] = pixels[src+1];
      raw[dst+2] = pixels[src+2];
      raw[dst+3] = pixels[src+3];
    }
  }

  const compressed = zlib.deflateSync(raw);

  function chunk(type, data) {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const typeB = Buffer.from(type);
    const crc = crc32(Buffer.concat([typeB, data]));
    const crcB = Buffer.alloc(4);
    crcB.writeInt32BE(crc);
    return Buffer.concat([len, typeB, data, crcB]);
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;  // bit depth
  ihdr[9] = 6;  // color type RGBA
  ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;

  const sig = Buffer.from([137,80,78,71,13,10,26,10]);
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', compressed), chunk('IEND', Buffer.alloc(0))]);
}

// CRC32 table
const CRC_TABLE = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    t[n] = c;
  }
  return t;
})();

function crc32(buf) {
  let c = -1;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ -1);
}

fs.mkdirSync(path.join(__dirname, 'icons'), { recursive: true });
[192, 512].forEach(size => {
  const png = makePNG(size);
  fs.writeFileSync(path.join(__dirname, 'icons', `icon-${size}.png`), png);
  console.log(`icon-${size}.png written (${png.length} bytes)`);
});
