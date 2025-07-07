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
  /** Fixed size, or undefined if dynamically sized. */
  readonly length?: number;
  /** Element constructor in fixed size SArrays.
   *
   * Will only be present if length !== undefined. */
  readonly elementType?: new () => ValueT;

  deserialize(buffer: Buffer, opts?: DeserializeOptions): Result<number, string> {
    let offset = 0;
    mapSArray(this, (element, index) => {
      const elem = element.deserialize(buffer.subarray(offset), opts)
      if (elem.err) return Err(elem.val)
      offset += elem.val;
      if (index >= this.value.length) {
        this.value.push(element);
      }
      return Ok.EMPTY
    });
    return Ok(offset);
  }

  serialize(opts?: SerializeOptions): Result<Buffer, string> {
    const map = mapSArray(this, (element) => element.serialize(opts))
    if (map.err) return Err(map.val)
    return Ok(Buffer.concat(map.unwrap()));
  }

  getSerializedLength(opts?: SerializeOptions): Result<number, string> {
    const map = mapSArray(this, (element) =>
      element.getSerializedLength(opts)
    )
    if (map.err) return Err(map.val)
    return Ok(map.val.reduce((a, b) => a + b, 0));
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  toJSON(): any {
    return mapSArray(this, (element, index) => {
      return Ok(toJSON(element))
    });
  }

  /** Assigns elements from a JSON array.
   *
   * Conceptually equivalent to assigning to this.values directly, but
   * recursively hydrates SObjects / SArrays / SerializableWrappers etc and
   * invokes their assignJSON() to process JSON values.
   */
  assignJSON(jsonValues: Array<unknown>) {
    if (!Array.isArray(jsonValues)) {
      throw new Error(
        `Expected array in SArray.assignJSON(), got ${typeof jsonValues}`
      );
    }
    if (jsonValues.length < this.value.length) {
      // If jsonValues has fewer elements, truncate value.
      this.value.length = jsonValues.length;
    } else if (jsonValues.length > this.value.length) {
      if (!this.elementType) {
        throw new Error(
          'SArray.assignJSON invoked with too many elements: ' +
            `expected ${this.value.length}, got ${jsonValues.length}`
        );
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
  }

  /** Create a new instance of this wrapper class from a raw value. */
  static of<ValueT extends Serializable, SArrayT extends SArray<ValueT>>(
    this: new () => SArrayT,
    value: Array<ValueT>
  ): SArrayT;
  /** Returns an SArrayWithWrapper class that wraps elements with the provided
   * SerializableWrapper. */
  static of<ValueT>(
    wrapperType: new () => SerializableWrapper<ValueT>
  ): ReturnType<typeof createSArrayWithWrapperClass<ValueT>>;
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
      return createSArrayWithWrapperClass<ValueT>(arg);
    }
    throw new Error(
      'SArray.of() should be invoked either with an array of Serializable ' +
        'values or a SerializableWrapper constructor'
    );
  }

  /** Returns an SArray class that pads / truncates to the provided length. */
  static ofLength<ValueT extends Serializable>(
    length: number,
    elementType: new () => ValueT
  ) {
    return class extends SArray<ValueT> {
      value = Array(length)
        .fill(0)
        .map(() => new elementType());
      length = length;
      elementType = elementType;
      /** Create a new instance of this wrapper class from a raw value. */
      static ofJSON<
        ValueT extends Serializable,
        SArrayT extends SArray<ValueT>,
      >(this: new () => SArrayT, jsonValues: Array<unknown>): SArrayT {
        const instance = new this();
        instance.assignJSON(jsonValues);
        return instance;
      }
    };
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
  let elements: Array<ValueT>;
  if (sarray.length !== undefined && sarray.value.length < sarray.length) {
    elements = [
      ...sarray.value,
      ...Array(sarray.length - sarray.value.length)
        .fill(0)
        .map(() => new sarray.elementType!()),
    ];
  } else if (
    sarray.length !== undefined &&
    sarray.value.length > sarray.length
  ) {
    elements = sarray.value.slice(0, sarray.length);
  } else {
    elements = sarray.value;
  }
  const res = elements.map((element, index) => {
    try {
      return fn(element, index);
    } catch (e) {
      if (e instanceof Error) return Err(`Error at element ${index}: ${e.message}`)
    }
  })
  return Ok(res as unknown as Array<ResultT>)
}

/** Returns an SArrayWithWrapperClass child class with the given parameters. */
function createSArrayWithWrapperClass<ValueT>(
  wrapperType: new () => SerializableWrapper<ValueT>,
  length?: number
) {
  return class extends SArrayWithWrapper<ValueT> {
    value = Array(length ?? 0)
      .fill(0)
      .map(() => new wrapperType().value);
    wrapperType = wrapperType;
    length = length;

    /** Returns an SArrayWithWrapper class that pads / truncates to the provided
     * length.
     */
    static ofLength(length: number) {
      return createSArrayWithWrapperClass<ValueT>(wrapperType, length);
    }
  };
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
  /** Fixed size, or undefined if dynamically sized. */
  readonly length?: number;

  deserialize(buffer: Buffer, opts?: DeserializeOptions): Result<number, string> {
    const array = this.toSArray();
    const readOffset = array.deserialize(buffer, opts);
    this.value.splice(
      0,
      this.value.length,
      ...array.value.map(({value}) => value)
    );
    return readOffset;
  }

  serialize(opts?: SerializeOptions): Result<Buffer, string> {
    return this.toSArray().serialize(opts);
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
    const cls =
      this.length === undefined
        ? SArray
        : SArray.ofLength(this.length, this.wrapperType);
    return cls.of(
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

/** A Serializable that represents a concatenation of other Serializables. */
export class SVector<ValueT extends Serializable> extends SerializableWrapper<
  Array<ValueT>
> {
  /** Array of Serializables. */
  value: Array<ValueT> = [];
  /** Element constructor in fixed size SVectors.
   *
   * Will only be present if length !== undefined. */
  readonly elementType?: new () => ValueT;

  deserialize(buffer: Buffer, opts?: DeserializeOptions): Result<number, string> {
    let offset = 2;
    const map = mapSVector(this, (element, index) => {
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
    const val = mapSVector(this, (element) => {
      const res = element.serialize(opts);
      if (res.err) return Err(res.unwrap())
      return Ok(res.unwrap())
    })
    if (val.err) return Err(val.val)
    return Ok(Buffer.concat([ lengthBuf, ...val.unwrap() ]));
  }

  getSerializedLength(opts?: SerializeOptions): Result<number, string> {
    const map = mapSVector(this, (element) =>
      element.getSerializedLength(opts)
    );
    if (map.err) return Err(map.val)
    return Ok(map.unwrap().reduce((a, b) => a + b, 0))
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  toJSON(): any {
    return mapSVector(this, (element, index) => {
      return Ok(toJSON(element))
    });
  }

  /** Assigns elements from a JSON array.
   *
   * Conceptually equivalent to assigning to this.values directly, but
   * recursively hydrates SObjects / SVectors / SerializableWrappers etc and
   * invokes their assignJSON() to process JSON values.
   */
  assignJSON(jsonValues: Array<unknown>): Result<void, string> {
    if (!Array.isArray(jsonValues)) {
      return Err(`Expected array in SVector.assignJSON(), got ${typeof jsonValues}`)
    }
    if (jsonValues.length < this.value.length) {
      // If jsonValues has fewer elements, truncate value.
      this.value.length = jsonValues.length;
    } else if (jsonValues.length > this.value.length) {
      if (!this.elementType) {
        return Err(`SVector.assignJSON invoked with too many elements: Expected ${this.value.length}, got ${jsonValues.length}`)
      }
      this.value.push(
        ...Array(jsonValues.length - this.value.length)
          .fill(0)
          .map(() => new this.elementType!())
      );
    }

    mapSVector(this, (element, index) => {
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
  static of<ValueT extends Serializable, SVectorT extends SVector<ValueT>>(
    value: Array<ValueT>
  ): SVectorT;
  /** Returns an SVectorWithWrapper class that wraps elements with the provided
   * SerializableWrapper. */
  static of<ValueT>(
    wrapperType: new () => SerializableWrapper<ValueT>
  ): SVectorWithWrapper<ValueT>;
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
      return SVectorWithWrapper<ValueT>;
    }
    throw new Error(
      'SVector.of() should be invoked either with an array of Serializable ' +
        'values or a SerializableWrapper constructor'
    );
  }
}

/** Applys the provided function over the elements of an SVector, subject to
 * padding / truncation.
 *
 * This should really be a private method of SVector, but TypeScript doesn't
 * allow classes with anonymous child classes to contain private methods.
 */
function mapSVector<ValueT extends Serializable, ResultT>(
  SVector: SVector<ValueT>,
  fn: (element: ValueT, index: number) => Result<ResultT, string>
): Result<Array<ResultT>, string> {
  const elements: Array<ValueT> = SVector.value;
  const res = elements.map((element, index) => {
    try {
      return fn(element, index);
    } catch (e) {
      if (e instanceof Error) return Err(`Error at element ${index}: ${e.message}`)
    }
  })
  return Ok(res as unknown as Array<ResultT>)
}

/** SVector variant that wraps each element for serialization / deserialization.
 */
export abstract class SVectorWithWrapper<ValueT> extends SerializableWrapper<
  Array<ValueT>
> {
  /** Array of unwrapped values. */
  value: Array<ValueT> = [];
  /** Wrapper type constructor. */
  abstract readonly wrapperType: new () => SerializableWrapper<ValueT>;

  deserialize(buffer: Buffer, opts?: DeserializeOptions): Result<number, string> {
    const array = this.toSVector();
    const readOffset = array.deserialize(buffer, opts);
    this.value.splice(
      0,
      this.value.length,
      ...array.value.map(({value}) => value)
    );
    return readOffset
  }

  serialize(opts?: SerializeOptions): Result<Buffer, string> {
    return this.toSVector().serialize(opts)
  }

  getSerializedLength(opts?: SerializeOptions): Result<number, string> {
    return this.toSVector().getSerializedLength(opts);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  toJSON(): any {
    return this.toSVector().toJSON();
  }

  /** Assigns elements from a JSON array.
   *
   * JSON values are processed with wrapperType.assignJSON().
   */
  assignJSON(jsonValues: Array<unknown>) {
    const array = this.toSVector();
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

  /**  Constructs an SVector of wrappers around the current array of elements. */
  toSVector() {
    return SVector.of(
      this.value.map((element) => {
        const wrapper = new this.wrapperType();
        wrapper.value = element;
        return wrapper;
      })
    );
  }

  /** Create a new instance of this wrapper class from a raw value. */
  static ofJSON<ValueT, SVectorT extends SVectorWithWrapper<ValueT>>(
    this: new () => SVectorT,
    jsonValues: Array<unknown>
  ): SVectorT {
    const instance = new this();
    instance.assignJSON(jsonValues);
    return instance;
  }
}