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


/** Serializable implementation that wraps a key-value tuple as a single value. */
export abstract class SerializableWrapper2<ValueK, ValueV> extends SerializableWrapper<[ValueK, ValueV]> {
  /** The wrapped key-value pair. */
  abstract value: [ValueK, ValueV];

  assignJSON<JsonValueK extends ValueK, JsonValueV extends ValueV>(jsonValue: [JsonValueK, JsonValueV]) {
    this.value = jsonValue;
  }

  /** Creates a new instance from a [key, value] tuple. */
  static of<K, V, WrapperT extends SerializableWrapper2<K, V>>(
    this: new () => WrapperT,
    value: [K, V]
  ): WrapperT;

  /** Creates a new instance from key and value separately. */
  static of<K, V, WrapperT extends SerializableWrapper2<K, V>>(
    this: new () => WrapperT,
    key: K,
    value: V
  ): WrapperT;

  static of<K, V, WrapperT extends SerializableWrapper2<K, V>>(
    this: new () => WrapperT,
    arg1: [K, V] | K,
    arg2?: V
  ): WrapperT {
    const instance = new this();
    if (Array.isArray(arg1)) {
      instance.value = arg1;
    } else {
      instance.value = [arg1, arg2!] as [K, V];
    }
    return instance;
  }
}

export type WrappedValueT2<WrapperT> =
  WrapperT extends SerializableWrapper2<infer ValueK, infer ValueV> ? [ValueK, ValueV] : never;