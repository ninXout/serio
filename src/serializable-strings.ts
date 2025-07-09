import iconv from 'iconv-lite';
import {SmartBuffer} from 'smart-buffer';
import {DeserializeOptions, SerializeOptions} from './serializable';
import {SerializableWrapper} from './serializable-wrapper';
import { Ok } from 'ts-results';

/** Serializable wrapper class for size specified strings. */
export class SString extends SerializableWrapper<string> {
  value: string = '';

  deserialize(buffer: Buffer, opts?: DeserializeOptions) {
    const length = buffer.readUInt16LE(0)
    buffer = buffer.subarray(2, 2 + length);
    this.value = decodeString(buffer, opts);
    return Ok(2 + buffer.length);
  }

  serialize(opts?: SerializeOptions) {
    const encodedValue = encodeString(this.value, opts);
    let writer: SmartBuffer;
    writer = new SmartBuffer();
    writer.writeUInt16LE(encodedValue.length)
    writer.writeBuffer(encodedValue);
    return Ok(writer.toBuffer());
  }

  getSerializedLength(opts?: SerializeOptions) {
    return Ok(2 + encodeString(this.value, opts).length);
  }
}

/** Default text encoding used by this library. */
let defaultEncoding = 'utf-8';

/** Set the default text encoding used by this library.
 *
 * Available list of encodings:
 * https://github.com/ashtuchkin/iconv-lite/wiki/Supported-Encodings
 */
export function setDefaultEncoding(encoding: string) {
  if (!iconv.encodingExists(encoding)) {
    throw new Error(`Unknown text encoding: '${encoding}'`);
  }
  defaultEncoding = encoding;
}

/** Returns the default text encoding used by this library. */
export function getDefaultEncoding() {
  return defaultEncoding;
}

/** Helper for getting the encoding from DeserializeOptions / SerializeOptions. */
function getEncodingOrDefault(opts?: DeserializeOptions | SerializeOptions) {
  const encoding = opts?.encoding ?? defaultEncoding;
  if (!iconv.encodingExists(encoding)) {
    throw new Error(`Unknown text encoding: '${encoding}'`);
  }
  return encoding;
}

/** Shorthand for decoding a buffer to string given ParseOptions. */
export function decodeString(
  buffer: Buffer,
  opts?: DeserializeOptions
): string {
  return iconv.decode(buffer, getEncodingOrDefault(opts));
}

/** Shorthand for encoding a string to buffer given SerializeOptions. */
export function encodeString(s: string, opts?: SerializeOptions): Buffer {
  return iconv.encode(s, getEncodingOrDefault(opts));
}
