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
export class SArray<ValueT extends Serializable> extends SerializableWrapper<
  Array<ValueT>
> {
  /** Array of Serializables. */
  value: Array<ValueT> = [];
  /** Element constructor in fixed size SArrays.
   *
   * Will only be present if length !== undefined. */
  readonly elementType?: new () => ValueT;

  deserialize(buffer: Buffer, opts?: DeserializeOptions): Result<number, string> {
    let offset = 2;
    const map = mapSArray(this, (element, index) => {
      const deser = element.deserialize(buffer.subarray(offset), opts);
      if (deser.err) return Err(deser.val)
      offset += deser.unwrap();
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
    const val = mapSArray(this, (element) => {
      const res = element.serialize(opts);
      if (res.err) return Err(res.unwrap())
      return Ok(res.unwrap())
    })
    if (val.err) return Err(val.val)
    return Ok(Buffer.concat([ lengthBuf, ...val.unwrap() ]));
  }

  getSerializedLength(opts?: SerializeOptions): Result<number, string> {
    const map = mapSArray(this, (element) =>
      element.getSerializedLength(opts)
    );
    if (map.err) return Err(map.val)
    return Ok(map.unwrap().reduce((a, b) => a + b, 0))
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  toJSON(): any {
    return mapSArray(this, toJSON);
  }

  /** Assigns elements from a JSON array.
   *
   * Conceptually equivalent to assigning to this.values directly, but
   * recursively hydrates SObjects / SArrays / SerializableWrappers etc and
   * invokes their assignJSON() to process JSON values.
   */
  assignJSON(jsonValues: Array<unknown>): Result<void, string> {
    if (!Array.isArray(jsonValues)) {
      return Err(`Expected array in SArray.assignJSON(), got ${typeof jsonValues}`)
    }
    if (jsonValues.length < this.value.length) {
      // If jsonValues has fewer elements, truncate value.
      this.value.length = jsonValues.length;
    } else if (jsonValues.length > this.value.length) {
      if (!this.elementType) {
        return Err(`SArray.assignJSON invoked with too many elements: Expected ${this.value.length}, got ${jsonValues.length}`)
      }
      this.value.push(
        ...Array(jsonValues.length - this.value.length)
          .fill(0)
          .map(() => new this.elementType!())
      );
    }

    mapSArray(this, (element, index) => {
      if (index >= jsonValues.length) {
        return Ok.EMPTY;
      }
      if (!canAssignJSON(element)) {
        return Err(`${element.constructor.name} does not support assignJSON`)
      }
      element.assignJSON(jsonValues[index]);
      return Ok.EMPTY
    });

    return Ok.EMPTY;
  }

  /** Create a new instance of this wrapper class from a raw value. */
  static of<ValueT extends Serializable, SArrayT extends SArray<ValueT>>(
    value: Array<ValueT>
  ): SArrayT;
  /** Returns an SArrayWithWrapper class that wraps elements with the provided
   * SerializableWrapper. */
  static of<ValueT>(
    wrapperType: new () => SerializableWrapper<ValueT>
  ): SArrayWithWrapper<ValueT>;
  static of<ValueT>(
    arg: Array<ValueT> | (new () => SerializableWrapper<ValueT>)
  ) {
    if (Array.isArray(arg)) {
      return super.of(arg);
    }
    if (
      typeof arg === 'function' &&
      arg.prototype instanceof SerializableWrapper
    ) {
      return SArrayWithWrapper<ValueT>;
    }
    throw new Error(
      'SArray.of() should be invoked either with an array of Serializable ' +
        'values or a SerializableWrapper constructor'
    );
  }
}

/** Applys the provided function over the elements of an SArray, subject to
 * padding / truncation.
 *
 * This should really be a private method of SArray, but TypeScript doesn't
 * allow classes with anonymous child classes to contain private methods.
 */
function mapSArray<ValueT extends Serializable, ResultT>(
  sarray: SArray<ValueT>,
  fn: (element: ValueT, index: number) => Result<ResultT, string>
): Result<Array<ResultT>, string> {
  const elements: Array<ValueT> = sarray.value;
  const res = elements.map((element, index) => {
    try {
      return fn(element, index);
    } catch (e) {
      if (e instanceof Error) return Err(`Error at element ${index}: ${e.message}`)
    }
  })
  return Ok(res as unknown as Array<ResultT>)
}

/** SArray variant that wraps each element for serialization / deserialization.
 */
export abstract class SArrayWithWrapper<ValueT> extends SerializableWrapper<
  Array<ValueT>
> {
  /** Array of unwrapped values. */
  value: Array<ValueT> = [];
  /** Wrapper type constructor. */
  abstract readonly wrapperType: new () => SerializableWrapper<ValueT>;

  deserialize(buffer: Buffer, opts?: DeserializeOptions): Result<number, string> {
    const array = this.toSArray();
    const readOffset = array.deserialize(buffer, opts);
    this.value.splice(
      0,
      this.value.length,
      ...array.value.map(({value}) => value)
    );
    return readOffset
  }

  serialize(opts?: SerializeOptions): Result<Buffer, string> {
    return this.toSArray().serialize(opts)
  }

  getSerializedLength(opts?: SerializeOptions): Result<number, string> {
    return this.toSArray().getSerializedLength(opts);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  toJSON(): any {
    return this.toSArray().toJSON();
  }

  /** Assigns elements from a JSON array.
   *
   * JSON values are processed with wrapperType.assignJSON().
   */
  assignJSON(jsonValues: Array<unknown>) {
    const array = this.toSArray();
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
      ...array.value.map(({value}) => value)
    );
  }

  /**  Constructs an SArray of wrappers around the current array of elements. */
  toSArray() {
    return SArray.of(
      this.value.map((element) => {
        const wrapper = new this.wrapperType();
        wrapper.value = element;
        return wrapper;
      })
    );
  }

  /** Create a new instance of this wrapper class from a raw value. */
  static ofJSON<ValueT, SArrayT extends SArrayWithWrapper<ValueT>>(
    this: new () => SArrayT,
    jsonValues: Array<unknown>
  ): SArrayT {
    const instance = new this();
    instance.assignJSON(jsonValues);
    return instance;
  }
}