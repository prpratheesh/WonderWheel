/**
 * Share via URL:
 * Serializes and compresses a wheel configuration (and optional small image references)
 * into a shareable URL string using Deflate/Inflate CompressionStream (native in all modern browsers).
 */
import type { WheelConfig } from '../types/wheel';
import { normalizeWheel } from './defaults';
import { uid } from '../utils/misc';

function bytesToBase64Url(bytes: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < bytes.length; i++) {
    bin += String.fromCharCode(bytes[i]);
  }
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlToBytes(str: string): Uint8Array {
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4 !== 0) base64 += '=';
  const bin = atob(base64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) {
    bytes[i] = bin.charCodeAt(i);
  }
  return bytes;
}

export async function compressWheelForShare(wheel: WheelConfig): Promise<string> {
  // Strip unique internal ids so target device creates fresh ones
  const payload = {
    name: wheel.name,
    design: wheel.design,
    animation: wheel.animation,
    result: wheel.result,
    segments: wheel.segments.map((s) => ({
      title: s.title,
      subtitle: s.subtitle,
      bgColor: s.bgColor,
      textColor: s.textColor,
      textSize: s.textSize,
      fontWeight: s.fontWeight,
      textAlign: s.textAlign,
      layout: s.layout,
      visible: s.visible,
      enabled: s.enabled,
      weight: s.weight,
      // exclude local imageId as local IndexedDB blob IDs are device-specific
    })),
  };

  const jsonStr = JSON.stringify(payload);
  const jsonBytes = new TextEncoder().encode(jsonStr);

  if (typeof CompressionStream !== 'undefined') {
    try {
      const cs = new CompressionStream('deflate-raw');
      const writer = cs.writable.getWriter();
      writer.write(jsonBytes);
      writer.close();
      const compressedBuffer = await new Response(cs.readable).arrayBuffer();
      return 'z_' + bytesToBase64Url(new Uint8Array(compressedBuffer));
    } catch {
      // fallback to plain base64url if compression stream fails
    }
  }

  return 'b_' + bytesToBase64Url(jsonBytes);
}

export async function decompressWheelFromShare(dataStr: string): Promise<WheelConfig | null> {
  try {
    const isCompressed = dataStr.startsWith('z_');
    const isBase64 = dataStr.startsWith('b_');
    const rawData = isCompressed || isBase64 ? dataStr.slice(2) : dataStr;
    const bytes = base64UrlToBytes(rawData);

    let jsonStr: string;

    if (isCompressed && typeof DecompressionStream !== 'undefined') {
      const ds = new DecompressionStream('deflate-raw');
      const writer = ds.writable.getWriter();
      writer.write(bytes as unknown as Uint8Array<ArrayBuffer>);
      writer.close();
      const decompressedBuffer = await new Response(ds.readable).arrayBuffer();
      jsonStr = new TextDecoder().decode(decompressedBuffer);
    } else {
      jsonStr = new TextDecoder().decode(bytes);
    }

    const parsed = JSON.parse(jsonStr);
    const normalized = normalizeWheel(parsed);
    if (!normalized) return null;

    // Assign fresh IDs
    normalized.id = uid('w_');
    normalized.segments.forEach((s) => (s.id = uid('s_')));
    return normalized;
  } catch {
    return null;
  }
}

export async function generateShareLink(wheel: WheelConfig): Promise<string> {
  const code = await compressWheelForShare(wheel);
  const origin = window.location.origin;
  const pathname = window.location.pathname;
  return `${origin}${pathname}#/share?wheel=${code}`;
}
