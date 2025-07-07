import { Err, Ok, Result } from 'ts-results';
import {DeserializeOptions, SerializeOptions} from './serializable';
import {SerializableWrapper} from './serializable-wrapper';

/** No-op Serializable implementation that serializes to / from Buffers. */
export class SBuffer extends SerializableWrapper<Buffer> {
  value: Buffer = Buffer.alloc(0);

  deserialize(buffer: Buffer): Result<number, string> {
    this.value = Buffer.alloc(buffer.length);
    buffer.copy(this.value);
    return Ok(this.value.length);
  }

  serialize(): Result<Buffer, string> {
    return Ok(this.value);
  }

  getSerializedLength(): Result<number, string> {
    return Ok(this.value.length);
  }

  assignJSON(
    jsonValue: {data: Array<number>; type: 'Buffer'} | Array<number> | Buffer
  ) {
    if (Buffer.isBuffer(jsonValue)) {
      this.value = jsonValue;
    } else if (
      jsonValue &&
      typeof jsonValue === 'object' &&
      'data' in jsonValue &&
      Array.isArray(jsonValue.data) &&
      'type' in jsonValue &&
      jsonValue.type === 'Buffer'
    ) {
      this.value = Buffer.from(jsonValue.data);
    } else if (jsonValue && Array.isArray(jsonValue)) {
      this.value = Buffer.from(jsonValue);
    } else {
      throw new Error(
        `Invalid JSON value for SBuffer: ${JSON.stringify(jsonValue)}`
      );
    }
  }
}

/** A Buffer encoded as a number N followed by N bytes. */
export abstract class SDynamicBuffer<
  LengthT extends SerializableWrapper<number>,
> extends SBuffer {
  /** Length type, to be provided by child classes. */
  protected abstract lengthType: new () => LengthT;

  deserialize(buffer: Buffer, opts?: DeserializeOptions) {
    const length = new this.lengthType();
    const readOffset = length.deserialize(buffer, opts);
    if (readOffset.err) return Err(readOffset.val)
    this.value = buffer.subarray(readOffset.val, readOffset.val + length.value);
    return Ok(readOffset.val + length.value);
  }

  serialize(opts?: SerializeOptions) {
    const length = new this.lengthType();
    length.value = this.value.length;
    const srl = length.serialize(opts)
    if (srl.err) return Err(srl.val)
    return Ok(Buffer.concat([srl.val, this.value]));
  }

  getSerializedLength(opts?: SerializeOptions) {
    const length = new this.lengthType();
    length.value = this.value.length;
    const nl = length.getSerializedLength(opts)
    if (nl.err) return Err(nl.val)
    return Ok(nl.val + this.value.length);
  }
}
