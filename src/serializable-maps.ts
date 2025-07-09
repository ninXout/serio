import { SmartBuffer } from 'smart-buffer';
import {
  DeserializeOptions,
  Serializable,
  SerializeOptions,
} from './serializable';
import {SerializableWrapper} from './serializable-wrapper';
import {canAssignJSON, toJSON} from './utils';
import { SUInt16LE } from './serializable-scalars';
import { Ok, Err, Result } from 'ts-results';

/** A Serializable that represents a concatenation of other Serializables. */
export class SMap<ValueK extends Serializable, ValueV extends Serializable> extends SerializableWrapper<
  Array<[ValueK, ValueV]>
> {
  /** Array of Serializables. */
  value: Array<[ValueK, ValueV]> = [];
  /** Element constructor in fixed size SMaps.
   *
   * Will only be present if length !== undefined. */
  readonly elementType?: new () => [ValueK, ValueV];

  deserialize(buffer: Buffer, opts?: DeserializeOptions): Result<number, string> {
    let offset = 2;
    const map = mapSMap(this, (element, index) => {
      const deserk = element[0].deserialize(buffer.subarray(offset), opts);
      if (deserk.err) return Err(deserk.val)
      offset += deserk.unwrap();
      const deserv = element[1].deserialize(buffer.subarray(offset), opts);
      if (deserv.err) return Err(deserv.val)
      offset += deserv.unwrap();
      if (index >= this.value.length) {
        this.value.push(element);
      }
      return Ok.EMPTY
    });
    if (map.err) return Err(map.val)
    return Ok(offset);
  }

  serialize(opts?: SerializeOptions): Result<Buffer, string> {
    const lengthBuf = Buffer.alloc(2); // i dont think this alloc has to happen but maybe it does idk
    lengthBuf.writeUint16LE(this.value.length);
    const val = mapSMap(this, (element) => {
      const resk = element[0].serialize(opts);
      if (resk.err) return Err(resk.unwrap())
      const resv = element[1].serialize(opts);
      if (resv.err) return Err(resv.unwrap())
      return Ok(Buffer.concat([resk.unwrap(), resv.unwrap()]))
    })
    if (val.err) return Err(val.val)
    return Ok(Buffer.concat([ lengthBuf, ...val.unwrap() ]));
  }

  getSerializedLength(opts?: SerializeOptions): Result<number, string> {
    const map = mapSMap(this, (element) => {
        return Ok(element[0].getSerializedLength(opts).unwrap() + element[1].getSerializedLength(opts).unwrap())
    });
    if (map.err) return Err(map.val)
    return Ok(map.unwrap().reduce((a, b) => a + b, 0))
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  toJSON(): any {
    const map = mapSMap(this, (element) => {
      return Ok(toJSON(element))
    })
    if (map.err) throw new Error(map.val)
    return map.val;
  }

  /** Assigns elements from a JSON array.
   *
   * Conceptually equivalent to assigning to this.values directly, but
   * recursively hydrates SObjects / SMaps / SerializableWrappers etc and
   * invokes their assignJSON() to process JSON values.
   */
  assignJSON(jsonValues: Array<[unknown, unknown]>): Result<void, string> {
    if (!(jsonValues instanceof Map)) {
      return Err(`Expected array in SMap.assignJSON(), got ${typeof jsonValues}`)
    }
    if (jsonValues.length < this.value.length) {
      // If jsonValues has fewer elements, truncate value.
      this.value.length = jsonValues.length;
    } else if (jsonValues.length > this.value.length) {
      if (!this.elementType) {
        return Err(`SMap.assignJSON invoked with too many elements: Expected ${this.value.length}, got ${jsonValues.length}`)
      }
      this.value.push(
        ...Array(jsonValues.length - this.value.length)
          .fill(0)
          .map(() => new this.elementType!())
      );
    }

    mapSMap(this, (element, index) => {
      if (index >= jsonValues.length) {
        return Ok.EMPTY;
      }
      if (!canAssignJSON(element)) {
        return Err(`${element.constructor.name} does not support assignJSON`)
      }
      element.assignJSON(jsonValues.get(index));
      return Ok.EMPTY
    });

    return Ok.EMPTY;
  }

  /** Create a new instance of this wrapper class from a raw value. */
  static of<ValueK extends Serializable, ValueV extends Serializable, SMapT extends SMap<ValueK, ValueV>>(
    value: Array<[ValueK, ValueV]>
  ): SMapT;
  /** Returns an SMapWithWrapper class that wraps elements with the provided
   * SerializableWrapper. */
  static of<ValueK, ValueV>(
    wrapperType: new () => [SerializableWrapper<ValueK>, SerializableWrapper<ValueV>]
  ): SMapWithWrapper<ValueK, ValueV>;
  static of<ValueK, ValueV>(
    arg: Array<[ValueK, ValueV]> | (new () => [SerializableWrapper<ValueK>, SerializableWrapper<ValueV>])
  ) {
    if (Array.isArray(arg)) {
      return super.of(arg);
    }
    if (
      typeof arg === 'function' &&
      arg.prototype instanceof SerializableWrapper
    ) {
      return SMapWithWrapper<ValueK, ValueV>;
    }
    throw new Error(
      'SMap.of() should be invoked either with an array of Serializable ' +
        'values or a SerializableWrapper constructor'
    );
  }
}

/** Applys the provided function over the elements of an SMap, subject to
 * padding / truncation.
 *
 * This should really be a private method of SMap, but TypeScript doesn't
 * allow classes with anonymous child classes to contain private methods.
 */
function mapSMap<ValueK extends Serializable, ValueV extends Serializable, ResultT>(
  SMap: SMap<ValueK, ValueV>,
  fn: (element: [ValueK, ValueV], index: number) => Result<ResultT, string>
): Result<Array<ResultT>, string> {
  const res = SMap.value.map((element, index) => {
    try {
      return fn(element, index);
    } catch (e) {
      if (e instanceof Error) return Err(`Error at element ${index}: ${e.message}`)
    }
  })
  return Ok(res as unknown as Array<ResultT>)
}

/** SMap variant that wraps each element for serialization / deserialization.
 */
export abstract class SMapWithWrapper<ValueK, ValueV> extends SerializableWrapper<
  Array<[ValueK, ValueV]>
> {
  /** Array of unwrapped values. */
  value: Array<[ValueK, ValueV]> = [];
  /** Wrapper type constructor. */
  abstract readonly wrapperType: new () => [SerializableWrapper<ValueK>, SerializableWrapper<ValueV>];
  abstract readonly keyType: new () => SerializableWrapper<ValueK>;
  abstract readonly valType: new () => SerializableWrapper<ValueV>;

  deserialize(buffer: Buffer, opts?: DeserializeOptions): Result<number, string> {
    const array = this.toSMap();
    const readOffset = array.deserialize(buffer, opts);
    this.value.splice(
      0,
      this.value.length,
      ...array.value.map((value) => {
        return [value[0].value, value[1].value] as [ValueK, ValueV]
      })
    );
    return readOffset
  }

  serialize(opts?: SerializeOptions): Result<Buffer, string> {
    return this.toSMap().serialize(opts)
  }

  getSerializedLength(opts?: SerializeOptions): Result<number, string> {
    return this.toSMap().getSerializedLength(opts);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  toJSON(): any {
    return this.toSMap().toJSON();
  }

  /** Assigns elements from a JSON array.
   *
   * JSON values are processed with wrapperType.assignJSON().
   */
  assignJSON(jsonValues: Array<[unknown, unknown]>) {
    const array = this.toSMap();
    if (array.value.length < jsonValues.length) {
      array.value.push(
        ...Array(jsonValues.length - array.value.length)
          .fill(0)
          .map(() => new this.wrapperType())
      );
    }
    array.assignJSON(jsonValues);
    this.value.splice(
      0,
      this.value.length,
      ...array.value.map((value) => {
        return [value[0].value, value[1].value] as [ValueK, ValueV]
      })
    );
  }

  /**  Constructs an SMap of wrappers around the current array of elements. */
  toSMap() {
    const wrapped: [SerializableWrapper<ValueK>, SerializableWrapper<ValueV>][] = this.value.map((element) => {
        const key = new this.keyType();
        key.value = element[0];
        const value = new this.valType();
        value.value = element[1]
        return [key, value];
    });

    return SMap.of(wrapped);
  }

  /** Create a new instance of this wrapper class from a raw value. */
  static ofJSON<ValueK, ValueV, SMapT extends SMapWithWrapper<ValueK, ValueV>>(
    this: new () => SMapT,
    jsonValues: Array<[unknown, unknown]>
  ): SMapT {
    const instance = new this();
    instance.assignJSON(jsonValues);
    return instance;
  }
}