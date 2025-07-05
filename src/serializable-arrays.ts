import { SmartBuffer } from 'smart-buffer';
import {
  DeserializeOptions,
  Serializable,
  SerializeOptions,
} from './serializable';
import {SerializableWrapper} from './serializable-wrapper';
import {canAssignJSON, toJSON} from './utils';
import { SUInt16LE } from './serializable-scalars';

export type Pair<Key, Value> = [Key, Value];

/** A Serializable that represents a pair of other Serializables. */
export class SPair<
  ValueK extends Serializable,
  ValueV extends Serializable
> extends SerializableWrapper<Pair<ValueK, ValueV>> {
  /** Serializable Thing IDK. */
  value: Pair<ValueK, ValueV> = [null as any, null as any]; // not a big fan of this default but i dont think i have many options :sob:

  /** Type constructor. */
  readonly elementType?: new () => Pair<ValueK, ValueV>;

  deserialize(buffer: Buffer, opts?: DeserializeOptions): number {
    let offset = 0;
    offset += this.value[0].deserialize(buffer.subarray(offset), opts);
    offset += this.value[1].deserialize(buffer.subarray(offset), opts);
    return offset;
  }

  serialize(opts?: SerializeOptions): Buffer {
    return Buffer.concat([
      this.value[0].serialize(opts),
      this.value[1].serialize(opts),
    ]);
  }

  getSerializedLength(opts?: SerializeOptions): number {
    return (
      this.value[0].getSerializedLength(opts) + 
      this.value[1].getSerializedLength(opts)
    );
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  toJSON(): any {
    return [toJSON(this.value[0]), toJSON(this.value[1])];
  }

  /** Assigns key and value from a JSON array of 2 elements. */
  assignJSON(json: unknown): void {
    if (!Array.isArray(json) || json.length !== 2) {
      throw new Error(`Expected [key, value] array in SPair.assignJSON(), got: ${JSON.stringify(json)}`);
    }
    if (!canAssignJSON(this.value[0])) {
      throw new Error(`${this.value[0].constructor.name} does not support assignJSON`);
    }
    if (!canAssignJSON(this.value[1])) {
      throw new Error(`${this.value[1].constructor.name} does not support assignJSON`);
    }
    this.value[0].assignJSON(json[0]);
    this.value[1].assignJSON(json[1]);
  }

  /** Create a new instance of this wrapper class from a raw value. */
  static of<ValueK extends Serializable, ValueV extends Serializable, SPairT extends SPair<ValueK, ValueV>>(
    value: Pair<ValueK, ValueV>
  ): SPairT;
  /** Returns an SArrayWithWrapper class that wraps elements with the provided
   * SerializableWrapper. */
  static of<ValueK extends Serializable, ValueV extends Serializable>( // I don't really know how this func impl works and why its necessary i hope i can ignore it
    wrapperType: new () => SerializableWrapper<Pair<ValueK, ValueV>>
  ): SPair<ValueK, ValueV>;
  static of<ValueK, ValueV>(
    arg: Pair<ValueK, ValueV> | (new () => SerializableWrapper<Pair<ValueK, ValueV>>)
  ) {
    if (Array.isArray(arg)) {
      return super.of(arg);
    }
    
    if (
      typeof arg === 'function' &&
      arg.prototype instanceof SerializableWrapper
    ) {
      return createSArrayWithWrapperClass<Pair<ValueK, ValueV>>(arg);
    }
    throw new Error(
      'SArray.of() should be invoked either with an array of Serializable ' +
        'values or a SerializableWrapper constructor'
    );
  }
}

/** A Serializable that represents a dynamically sized vector of other Serializables. */
export class SMap<ValueK extends Serializable, ValueV extends Serializable> extends SerializableWrapper<
  Map<ValueK, ValueV>
> {
  /** Array of Serializables. */
  value: Map<ValueK, ValueV> = new Map();

  /** Element constructor used to hydrate elements during deserialization or assignJSON. */
  readonly elementType?: new () => [ValueK, ValueV];

  deserialize(buffer: Buffer, opts?: DeserializeOptions): number {
    let offset = 0;
    const length = buffer.readUint16LE(offset);
    offset += 2;

    if (!this.elementType) throw new Error(`SMap.deserialize missing elementType`);

    for (let i = 0; i < length; i++) {
      const key = new this.elementType();
      offset += key[0].deserialize(buffer.subarray(offset), opts);
      offset += key[1].deserialize(buffer.subarray(offset), opts);
      this.value.set(key[0], key[1])
    }

    return offset;
  }

  serialize(opts?: SerializeOptions): Buffer {
    const lengthBuf = Buffer.alloc(2); // i dont think this alloc has to happen but maybe it does idk
    lengthBuf.writeUint16LE(this.value.size);
    let dataBufs: Buffer<ArrayBufferLike> = Buffer.from('');
    this.value.forEach((value, key) => { 
      dataBufs = Buffer.concat([dataBufs, key.serialize(opts)])
      dataBufs = Buffer.concat([dataBufs, value.serialize(opts)])
    })
    return Buffer.concat([lengthBuf, dataBufs]);
  }

  getSerializedLength(opts?: SerializeOptions): number {
    let length = 0
    this.value.forEach((value, key) => { 
      length += key.getSerializedLength(opts)
      length += value.getSerializedLength(opts)
    })
    return (
      2 +
      length
    );
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  toJSON(): any { // sorryyy :P
    return null;
  }

  /** Assigns elements from a JSON array.
   *
   * Recursively hydrates each element using the provided element type.
   */
  assignJSON(jsonValues: Map<unknown, unknown>): void {
    if (!this.elementType) throw new Error(`SMap.deserialize missing elementType`);

    jsonValues.forEach((value, key) => {
      const keyObj = new this.elementType!();
      if (!canAssignJSON(keyObj[0])) throw new Error(`${keyObj.constructor.name} does not support assignJSON`);
      keyObj[0].assignJSON(key)
      if (!canAssignJSON(keyObj[1])) throw new Error(`${keyObj.constructor.name} does not support assignJSON`);
      keyObj[1].assignJSON(value)
    })
  }

  /** Create a new instance of this wrapper class from a raw value. */
  static of<ValueK extends Serializable, ValueV extends Serializable, SMapT extends SMap<ValueK, ValueV>>(
    value: Map<ValueK, ValueV>
  ): SMapT;
  /** Returns an SMapWithWrapper class that wraps elements with the provided
   * SerializableWrapper. */
  static of<ValueK, ValueV>(
    wrapperType: new () => SerializableWrapper<[ValueK, ValueV]>
  ): ReturnType<typeof createSMapWithWrapperClass<ValueK, ValueV>>;
  static of<ValueK, ValueV>(
    arg: Map<ValueK, ValueV> | (new () => SerializableWrapper<[ValueK, ValueV]>)
  ) {
    if (arg instanceof Map) {
      return super.of(arg);
    }
    if (
      typeof arg === 'function' &&
      arg.prototype instanceof SerializableWrapper
    ) {
      return createSMapWithWrapperClass<ValueK, ValueV>(arg);
    }
    throw new Error(
      'SMap.of() should be invoked either with an array of Serializable ' +
        'values or a SerializableWrapper constructor'
    );
  }
}

/** Returns an SMapWithWrapperClass child class with the given parameters. */
function createSMapWithWrapperClass<ValueK, ValueV>(
  wrapperType: new () => SerializableWrapper<[ValueK, ValueV]>
) {
  return class extends SMapWithWrapper<ValueK, ValueV> {
    value = new Map<ValueK, ValueV>()
    wrapperType = wrapperType;

    /** Returns an SMapWithWrapper class that pads / truncates to the provided
     * length.
     */
    static ofLength(length: number) {
      return createSMapWithWrapperClass<ValueK, ValueV>(wrapperType);
    }
  };
}

/** SMap variant that wraps each element for serialization / deserialization.
 */
export abstract class SMapWithWrapper<ValueK, ValueV> extends SerializableWrapper<
  Map<ValueK, ValueV>
> {
  /** Array of unwrapped values. */
  value: Map<ValueK, ValueV> = new Map();
  /** Wrapper type constructor. */
  abstract readonly wrapperType: new () => SerializableWrapper<[ValueK, ValueV]>;

  deserialize(buffer: Buffer, opts?: DeserializeOptions): number {
    const array = this.toSMap();
    const readOffset = array.deserialize(buffer, opts);
    array.value.forEach(({value}) => {
      this.value.set(value[0], value[1])
    })
    return readOffset;
  }

  serialize(opts?: SerializeOptions): Buffer {
    return this.toSMap().serialize(opts);
  }

  getSerializedLength(opts?: SerializeOptions): number {
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
  assignJSON(jsonValues: Map<unknown, unknown>) {
    const array = this.toSMap();
    if (array.value.length < jsonValues.size) {
      array.value.push(
        ...Array(jsonValues.size - array.value.length)
          .fill(0)
          .map(() => new this.wrapperType())
      );
    }
    let arr: Array<unknown> = []
    jsonValues.forEach((value, key) => {
      arr.push([key, value])
    })
    array.assignJSON(arr);
    array.value.forEach(({value}) => {
      this.value.set(value[0], value[1])
    })
  }

  /**  Constructs an SMap of wrappers around the current array of elements. */
  toSMap() {
    let arr: Array<SerializableWrapper<[ValueK, ValueV]>> = []
    this.value.forEach((value, key) => {
      const wrapper = new this.wrapperType();
      wrapper.value = [key, value];
      return wrapper;
    })
    return SArray.of(arr);
  }

  /** Create a new instance of this wrapper class from a raw value. */
  static ofJSON<ValueK, ValueV, SMapT extends SMapWithWrapper<ValueK, ValueV>>(
    this: new () => SMapT,
    jsonValues: Map<unknown, unknown>
  ): SMapT {
    const instance = new this();
    instance.assignJSON(jsonValues);
    return instance;
  }
}

/** A Serializable that represents a dynamically sized vector of other Serializables. */
export class SVector<ValueT extends Serializable> extends SerializableWrapper<
  Array<ValueT>
> {
  /** Array of Serializables. */
  value: Array<ValueT> = [];

  /** Element constructor used to hydrate elements during deserialization or assignJSON. */
  readonly elementType?: new () => ValueT;

  deserialize(buffer: Buffer, opts?: DeserializeOptions): number {
    let offset = 0;
    const length = buffer.readUint16LE(offset);
    offset += 2;

    this.value = Array(length)
      .fill(0)
      .map(() => {
        if (!this.elementType) {
          throw new Error(`SVector.deserialize missing elementType`);
        }
        const element = new this.elementType();
        offset += element.deserialize(buffer.subarray(offset), opts);
        return element;
      });

    return offset;
  }

  serialize(opts?: SerializeOptions): Buffer {
    const lengthBuf = Buffer.alloc(2); // i dont think this alloc has to happen but maybe it does idk
    lengthBuf.writeUint16LE(this.value.length, 0);
    const dataBufs = this.value.map((v) => v.serialize(opts));
    return Buffer.concat([lengthBuf, ...dataBufs]);
  }

  getSerializedLength(opts?: SerializeOptions): number {
    return (
      2 +
      this.value.reduce(
        (sum, v) => sum + v.getSerializedLength(opts),
        0
      )
    );
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  toJSON(): any {
    return this.value.map(toJSON);
  }

  /** Assigns elements from a JSON array.
   *
   * Recursively hydrates each element using the provided element type.
   */
  assignJSON(jsonValues: Array<unknown>): void {
    if (!Array.isArray(jsonValues)) {
      throw new Error(
        `Expected array in SVector.assignJSON(), got ${typeof jsonValues}`
      );
    }

    if (!this.elementType) {
      throw new Error(`SVector.assignJSON missing elementType`);
    }

    this.value = jsonValues.map((json) => {
      const element = new this.elementType!();
      if (!canAssignJSON(element)) {
        throw new Error(
          `${element.constructor.name} does not support assignJSON`
        );
      }
      element.assignJSON(json);
      return element;
    });
  }

  /** Create a new instance of this wrapper class from a raw value. */
  static of<ValueT extends Serializable, SVectorT extends SVector<ValueT>>(
    value: Array<ValueT>
  ): SVectorT;
  /** Returns an SVectorWithWrapper class that wraps elements with the provided
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
      'SVector.of() should be invoked either with an array of Serializable ' +
        'values or a SerializableWrapper constructor'
    );
  }
}


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

  deserialize(buffer: Buffer, opts?: DeserializeOptions): number {
    let offset = 0;
    mapSArray(this, (element, index) => {
      offset += element.deserialize(buffer.subarray(offset), opts);
      if (index >= this.value.length) {
        this.value.push(element);
      }
    });
    return offset;
  }

  serialize(opts?: SerializeOptions): Buffer {
    return Buffer.concat(mapSArray(this, (element) => element.serialize(opts)));
  }

  getSerializedLength(opts?: SerializeOptions): number {
    return mapSArray(this, (element) =>
      element.getSerializedLength(opts)
    ).reduce((a, b) => a + b, 0);
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
        return;
      }
      if (!canAssignJSON(element)) {
        throw new Error(
          `${element.constructor.name} does not support assignJSON`
        );
      }
      element.assignJSON(jsonValues[index]);
    });
  }

  /** Create a new instance of this wrapper class from a raw value. */
  static of<ValueT extends Serializable, SArrayT extends SArray<ValueT>>(
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
  fn: (element: ValueT, index: number) => ResultT
): Array<ResultT> {
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
  return elements.map((element, index) => {
    try {
      return fn(element, index);
    } catch (e) {
      if (e instanceof Error) {
        const e2 = new SArrayError(`Error at element ${index}: ${e.message}`, {
          cause: e,
        });
        e2.stack = e.stack;
        e2.element = element;
        e2.index = index;
        throw e2;
      } else {
        throw e;
      }
    }
  });
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

  deserialize(buffer: Buffer, opts?: DeserializeOptions): number {
    const array = this.toSArray();
    const readOffset = array.deserialize(buffer, opts);
    this.value.splice(
      0,
      this.value.length,
      ...array.value.map(({value}) => value)
    );
    return readOffset;
  }

  serialize(opts?: SerializeOptions): Buffer {
    return this.toSArray().serialize(opts);
  }

  getSerializedLength(opts?: SerializeOptions): number {
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

/** Error augmented by SArray with index information. */
export class SArrayError<
  ValueT extends Serializable = Serializable,
> extends Error {
  constructor(message: string, {cause}: {cause: Error}) {
    super(message);
    Object.setPrototypeOf(this, SArrayError.prototype);
    this.cause = cause;
  }
  /** The original error. */
  cause: Error;
  /** Indicates this is an SArrayError. */
  isSArrayError = true as const;
  /** The element that raised the error. */
  element!: ValueT;
  /** Index of the element that raised the error. */
  index!: number;
}
