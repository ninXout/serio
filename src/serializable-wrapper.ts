import {Serializable} from './serializable';
import {toJSON} from './utils';

/** Serializable implementation that simply wraps another value. */
export abstract class SerializableWrapper<ValueT> extends Serializable {
  abstract value: ValueT;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  toJSON(): any {
    return toJSON(this.value);
  }

  assignJSON<JsonValueT extends ValueT>(jsonValue: JsonValueT) {
    this.value = jsonValue;
  }

  /** Create a new instance of this wrapper class from a raw value. */
  static of<ValueT, WrapperT extends SerializableWrapper<ValueT>>(
    this: new () => WrapperT,
    value: ValueT
  ): WrapperT {
    const instance = new this();
    instance.value = value;
    return instance;
  }
}

export type WrappedValueT<WrapperT> =
  WrapperT extends SerializableWrapper<infer ValueT> ? ValueT : never;

// Maybe try a 2 type version??
/** Serializable implementation that simply wraps another value. */
export abstract class SerializableWrapperKV<ValueK, ValueV> extends Serializable {
  abstract value: [ValueK, ValueV];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  toJSON(): any {
    return toJSON(this.value);
  }

  assignJSON<JsonValueK extends ValueK, JsonValueV extends ValueV>(jsonKey: JsonValueK, jsonValue: JsonValueV) {
    this.value = [jsonKey, jsonValue];
  }

  /** Create a new instance of this wrapper class from a raw value. */
  static of<ValueK, ValueV, WrapperT extends SerializableWrapperKV<ValueK, ValueV>>(
    this: new () => WrapperT,
    value: [ValueK, ValueV]
  ): WrapperT {
    const instance = new this();
    instance.value = value;
    return instance;
  }
}

export type WrappedValueKV<WrapperT> =
  WrapperT extends SerializableWrapperKV<infer ValueK, infer ValueV> ? [ValueK, ValueV] : never;
