import {
  DeserializeOptions,
  Serializable,
  SerializeOptions,
} from './serializable';
import {SerializableWrapper} from './serializable-wrapper';
import {canAssignJSON, toJSON} from './utils';

/** A Serializable that represents a pair of other Serializables. */
export class SPair<
  ValueK extends Serializable,
  ValueV extends Serializable
> extends SerializableWrapper<[ValueK, ValueV]> {
  /** Serializable Thing IDK. */
  value: [ValueK, ValueV] = [null as any, null as any]; // not a big fan of this default but i dont think i have many options :sob:

  /** Type constructor. */
  readonly elementType?: new () => [ValueK, ValueV];

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
      throw new Error(
        `Expected [key, value] array in SPair.assignJSON(), got: ${JSON.stringify(
          json
        )}`
      );
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
    value: [ValueK, ValueV]
  ): SPairT;
  /** Returns an SArrayWithWrapper class that wraps elements with the provided
   * SerializableWrapper. */
  static of<ValueT>( // I don't really know how this func impl works and why its necessary i hope i can ignore it
    wrapperType: new () => SerializableWrapper<ValueT>
  ): ReturnType<typeof createSArrayWithWrapperClass<ValueT>>;
  static of<ValueK, ValueV>(
    arg: [ValueK, ValueV] | (new () => SerializableWrapper<[ValueK, ValueV]>)
  ) {
    return super.of(arg); // i'm going to hope that i can guarantee these values because i really dont know how to properly check this
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
