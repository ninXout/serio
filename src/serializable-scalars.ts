import { Ok, Result } from 'ts-results';
import {SerializableWrapper} from './serializable-wrapper';

/** Serializable wrapper for an unsigned 8-bit integer. */
export class SUInt8 extends createSerializableScalarWrapperClass<number>({
  readFn: Buffer.prototype.readUInt8,
  writeFn: Buffer.prototype.writeUInt8,
  serializedLength: 1,
  defaultValue: 0,
}) {}

/** Serializable wrapper for a signed 8-bit integer. */
export class SInt8 extends createSerializableScalarWrapperClass<number>({
  readFn: Buffer.prototype.readInt8,
  writeFn: Buffer.prototype.writeInt8,
  serializedLength: 1,
  defaultValue: 0,
}) {}

/** Serializable wrapper for an unsigned 16-bit integer with big endian encoding. */
export class SUInt16BE extends createSerializableScalarWrapperClass<number>({
  readFn: Buffer.prototype.readUInt16BE,
  writeFn: Buffer.prototype.writeUInt16BE,
  serializedLength: 2,
  defaultValue: 0,
}) {}

/** Serializable wrapper for a signed 16-bit integer with big endian encoding. */
export class SInt16BE extends createSerializableScalarWrapperClass<number>({
  readFn: Buffer.prototype.readInt16BE,
  writeFn: Buffer.prototype.writeInt16BE,
  serializedLength: 2,
  defaultValue: 0,
}) {}

/** Serializable wrapper for an unsigned 16-bit integer with little endian encoding. */
export class SUInt16LE extends createSerializableScalarWrapperClass<number>({
  readFn: Buffer.prototype.readUInt16LE,
  writeFn: Buffer.prototype.writeUInt16LE,
  serializedLength: 2,
  defaultValue: 0,
}) {}

/** Serializable wrapper for a signed 16-bit integer with little endian encoding. */
export class SInt16LE extends createSerializableScalarWrapperClass<number>({
  readFn: Buffer.prototype.readInt16LE,
  writeFn: Buffer.prototype.writeInt16LE,
  serializedLength: 2,
  defaultValue: 0,
}) {}

/** Serializable wrapper for an unsigned 32-bit integer with big endian encoding. */
export class SUInt32BE extends createSerializableScalarWrapperClass<number>({
  readFn: Buffer.prototype.readUInt32BE,
  writeFn: Buffer.prototype.writeUInt32BE,
  serializedLength: 4,
  defaultValue: 0,
}) {}

/** Serializable wrapper for a signed 32-bit integer with big endian encoding. */
export class SInt32BE extends createSerializableScalarWrapperClass<number>({
  readFn: Buffer.prototype.readInt32BE,
  writeFn: Buffer.prototype.writeInt32BE,
  serializedLength: 4,
  defaultValue: 0,
}) {}

/** Serializable wrapper for an unsigned 32-bit integer with little endian encoding. */
export class SUInt32LE extends createSerializableScalarWrapperClass<number>({
  readFn: Buffer.prototype.readUInt32LE,
  writeFn: Buffer.prototype.writeUInt32LE,
  serializedLength: 4,
  defaultValue: 0,
}) {}

/** Serializable wrapper for a signed 32-bit integer with little endian encoding. */
export class SInt32LE extends createSerializableScalarWrapperClass<number>({
  readFn: Buffer.prototype.readInt32LE,
  writeFn: Buffer.prototype.writeInt32LE,
  serializedLength: 4,
  defaultValue: 0,
}) {}

/** Serializable wrapper for an unsigned 64-bit integer with big endian encoding. */
export class SUInt64BE extends createSerializableScalarWrapperClass<number>({
  readFn: Buffer.prototype.readUInt64BE,
  writeFn: Buffer.prototype.writeUInt64BE,
  serializedLength: 8,
  defaultValue: 0,
}) {}

/** Serializable wrapper for a signed 64-bit integer with big endian encoding. */
export class SInt64BE extends createSerializableScalarWrapperClass<number>({
  readFn: Buffer.prototype.readInt64BE,
  writeFn: Buffer.prototype.writeInt64BE,
  serializedLength: 8,
  defaultValue: 0,
}) {}

/** Serializable wrapper for an unsigned 64-bit integer with little endian encoding. */
export class SUInt64LE extends createSerializableScalarWrapperClass<number>({
  readFn: Buffer.prototype.readUInt64LE,
  writeFn: Buffer.prototype.writeUInt64LE,
  serializedLength: 8,
  defaultValue: 0,
}) {}

/** Serializable wrapper for a signed 64-bit integer with little endian encoding. */
export class SInt64LE extends createSerializableScalarWrapperClass<number>({
  readFn: Buffer.prototype.readInt64LE,
  writeFn: Buffer.prototype.writeInt64LE,
  serializedLength: 8,
  defaultValue: 0,
}) {}

/** Serializable wrapper for a signed 32-bit float with big endian encoding. */
export class SFloat32BE extends createSerializableScalarWrapperClass<number>({
  readFn: Buffer.prototype.readFloatBE,
  writeFn: Buffer.prototype.writeFloatBE,
  serializedLength: 4,
  defaultValue: 0,
}) {}

/** Serializable wrapper for a signed 32-bit float with little endian encoding. */
export class SFloat32LE extends createSerializableScalarWrapperClass<number>({
  readFn: Buffer.prototype.readFloatLE,
  writeFn: Buffer.prototype.writeFloatLE,
  serializedLength: 4,
  defaultValue: 0,
}) {}

/** Serializable wrapper for a signed 64-bit float with big endian encoding. */
export class SFloat64BE extends createSerializableScalarWrapperClass<number>({
  readFn: Buffer.prototype.readDoubleBE,
  writeFn: Buffer.prototype.writeDoubleBE,
  serializedLength: 8,
  defaultValue: 0,
}) {}

/** Serializable wrapper for a signed 64-bit float with little endian encoding. */
export class SFloat64LE extends createSerializableScalarWrapperClass<number>({
  readFn: Buffer.prototype.readDoubleLE,
  writeFn: Buffer.prototype.writeDoubleLE,
  serializedLength: 8,
  defaultValue: 0,
}) {}

/** Factory for Serializable wrappers for basic data types. */
export function createSerializableScalarWrapperClass<ValueT extends number>({
  readFn,
  writeFn,
  serializedLength,
  defaultValue,
}: {
  readFn: () => ValueT;
  writeFn: (value: ValueT) => void;
  serializedLength: number;
  defaultValue: ValueT;
}) {
  const SerializableScalarWrapperClass = class extends SerializableWrapper<ValueT> {
    value: ValueT = defaultValue;

    /** Return a variant of this class that looks up an enum value for toJSON(). */
    static enum(enumType: object) {
      return class extends createSerializableScalarWrapperClass<ValueT>({
        readFn,
        writeFn,
        serializedLength,
        defaultValue,
      }) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        toJSON(): any {
          return (enumType as Record<ValueT, string>)[this.value] ?? this.value;
        }
        assignJSON(jsonValue: ValueT | string) {
          if (typeof jsonValue === 'string') {
            // TypeScript generates a reverse mapping from label => value for
            // numeric enums.
            if (!(jsonValue in enumType)) {
              throw new Error(
                `Invalid label for enum ${enumType.constructor.name}: ${jsonValue}`
              );
            }
            this.value = (enumType as Record<string, ValueT>)[jsonValue];
          } else {
            this.value = jsonValue;
          }
        }
      };
    }

    deserialize(buffer: Buffer): Result<number, string> {
      this.value = readFn.call(buffer);
      return Ok(serializedLength);
    }

    serialize(): Result<Buffer, string> {
      const buffer = Buffer.alloc(serializedLength);
      writeFn.call(buffer, this.value);
      return Ok(buffer);
    }

    getSerializedLength(): Result<number, string> {
      return Ok(serializedLength);
    }
  };
  return SerializableScalarWrapperClass;
}
