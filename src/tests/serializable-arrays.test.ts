import times from 'lodash/times';
import {
  SArray,
  SInt16LE,
  SInt8,
  SObject,
  SPair,
  SString,
  SUInt16BE,
  SUInt8,
  Serializable,
} from '../';

enum TestEnum {
  ZERO = 0,
  ONE = 1,
}

describe('SArray', function () {
  test('create', function () {
    const arr1 = SArray.of(times(3, () => SUInt16BE.of(42)));
    expect(arr1.value.map(({value}) => value)).toStrictEqual([42, 42, 42]);
  });

  test('serialize and deserialize', function () {
    const arr1 = new SArray();
    expect(arr1.getSerializedLength().unwrap()).toStrictEqual(0);
    expect(arr1.serialize().unwrap()).toStrictEqual(Buffer.alloc(0));

    arr1.value = [SString.of('hello'), SInt8.of(10), SInt8.of(20)];
    expect(arr1.getSerializedLength().unwrap()).toStrictEqual(9);

    const arr2 = SArray.of([new SString(), new SInt8(), new SInt8()]);
    arr2.deserialize(arr1.serialize().unwrap());
    expect((arr2.value[0] as SString).value).toStrictEqual('hello');
    expect((arr2.value[1] as SInt8).value).toStrictEqual(10);
    expect((arr2.value[2] as SInt8).value).toStrictEqual(20);
  });

  test('JSON conversion', function () {
    const arr1 = SArray.of([
      SString.of('hello'),
      SInt16LE.of(42),
      SArray.of([SInt16LE.of(100), SInt16LE.of(200)]),
    ]);
    expect(arr1.toJSON()).toStrictEqual(['hello', 42, [100, 200]]);

    arr1.assignJSON(['world', 100, [300]]);
    expect(arr1.toJSON()).toStrictEqual(['world', 100, [300]]);
    arr1.value.forEach((el) => expect(el instanceof Serializable));

    // Extra non-serializable element
    //expect(() => arr1.assignJSON(['world', 100, [300, 400]])).toThrow();
    //expect(() => arr1.assignJSON(['world', 100, [300], 'foo'])).toThrow();

    arr1.assignJSON([]);
    expect(arr1.toJSON()).toStrictEqual([]);
  });

  test('fixed length', function () {
    const arr1 = new (SArray.ofLength(3, SInt8))();
    expect(arr1.value).toHaveLength(3);
    expect(arr1.toJSON()).toStrictEqual([0, 0, 0]);
    expect(arr1.serialize().unwrap()).toStrictEqual(Buffer.of(0, 0, 0));
    arr1.deserialize(Buffer.of(42, 42, 42, 42)).unwrap();
    expect(arr1.serialize().unwrap()).toStrictEqual(Buffer.of(42, 42, 42));

    arr1.value.push(SInt8.of(100));
    expect(arr1.value).toHaveLength(4);
    expect(arr1.serialize().unwrap()).toStrictEqual(Buffer.of(42, 42, 42));
    expect(arr1.value).toHaveLength(4);
    arr1.deserialize(Buffer.of(53, 53, 53, 53));
    expect(arr1.value).toHaveLength(4);
    expect(arr1.toJSON()).toStrictEqual([53, 53, 53]);

    arr1.value = [];
    expect(arr1.serialize().unwrap()).toStrictEqual(Buffer.of(0, 0, 0));
    expect(arr1.value).toHaveLength(0);
    arr1.deserialize(Buffer.of(42, 42, 42, 42)).unwrap();
    expect(arr1.value).toHaveLength(3);
    expect(arr1.toJSON()).toStrictEqual([42, 42, 42]);
  });

  test('fixed length JSON conversion', function () {
    const arr1 = new (SArray.ofLength(3, SInt8))();
    expect(arr1.toJSON()).toStrictEqual([0, 0, 0]);

    arr1.assignJSON([1, 2, 3, 4]);
    expect(arr1.toJSON()).toStrictEqual([1, 2, 3]);

    arr1.assignJSON([]);
    expect(arr1.toJSON()).toStrictEqual([0, 0, 0]);

    arr1.assignJSON([10, 20]);
    expect(arr1.toJSON()).toStrictEqual([10, 20, 0]);

    const arr2 = SArray.ofLength(3, SInt8).ofJSON([1, 2]);
    expect(arr2.toJSON()).toStrictEqual([1, 2, 0]);

    const arr3 = SArray.ofLength(3, SInt8).ofJSON([1, 2, 3, 4]);
    expect(arr3.toJSON()).toStrictEqual([1, 2, 3]);
  });
});

describe('SArrayWithWrapper', function () {
  test('create', function () {
    const arr1 = SArray.of(SUInt16BE).of([42, 42, 42]);
    expect(arr1.value).toStrictEqual([42, 42, 42]);
  });

  test('serialize and deserialize', function () {
    const arr1 = SArray.of(SUInt16BE).of([100, 200, 300]);
    expect(arr1.getSerializedLength().unwrap()).toStrictEqual(6);

    const arr8 = SArray.of(SPair.of(SUInt16BE, SUInt16BE)).of([[10, 10], [10, 10]]);
    expect(arr8.getSerializedLength().unwrap()).toStrictEqual(8);

    const arr2 = SArray.of(times(3, () => SUInt16BE.of(0)));
    arr2.deserialize(arr1.serialize().unwrap());
    expect(arr2.value.map(({value}) => value)).toStrictEqual([100, 200, 300]);

    const arr3 = SArray.of(SUInt16BE).of([0, 0, 0]);
    arr3.deserialize(arr1.serialize().unwrap());
    expect(arr3.value).toStrictEqual([100, 200, 300]);

    const arr4 = SArray.of(SArray.of(SUInt16BE)).of([
      [1, 2, 3],
      [4, 5, 6],
      [7, 8, 9],
    ]);
    expect(arr4.getSerializedLength().unwrap()).toStrictEqual(18);
    const arr5 = SArray.of(SUInt16BE).of(times(9, () => 0));
    arr5.deserialize(arr4.serialize().unwrap());
    expect(arr5.value).toStrictEqual([1, 2, 3, 4, 5, 6, 7, 8, 9]);
  });

  test('JSON conversion', function () {
    const arr1 = SArray.of(SUInt16BE).of([100, 200, 300]);
    expect(arr1.toJSON()).toStrictEqual([100, 200, 300]);

    const arr2 = SArray.of(SString).of(['hello', 'world']);
    expect(arr2.toJSON()).toStrictEqual(['hello', 'world']);

    arr1.assignJSON([1, 2, 3, 4, 5]);
    expect(arr1.toJSON()).toStrictEqual([1, 2, 3, 4, 5]);
    arr1.assignJSON([]);
    expect(arr1.toJSON()).toStrictEqual([]);

    arr2.assignJSON(['foo', 'bar', 'baz']);
    expect(arr2.toJSON()).toStrictEqual(['foo', 'bar', 'baz']);
    arr2.assignJSON(['wombat']);
    expect(arr2.toJSON()).toStrictEqual(['wombat']);

    const arr3 = SArray.of(SUInt8.enum(TestEnum)).of([
      TestEnum.ZERO,
      TestEnum.ONE,
    ]);
    expect(arr3.toJSON()).toStrictEqual(['ZERO', 'ONE']);
    arr3.assignJSON([TestEnum.ZERO, TestEnum.ONE, 'ONE']);
    expect(arr3.value).toStrictEqual([
      TestEnum.ZERO,
      TestEnum.ONE,
      TestEnum.ONE,
    ]);
    expect(arr3.toJSON()).toStrictEqual(['ZERO', 'ONE', 'ONE']);
    arr3.assignJSON(['ONE', 0]);
    expect(arr3.value).toStrictEqual([TestEnum.ONE, TestEnum.ZERO]);
    expect(arr3.toJSON()).toStrictEqual(['ONE', 'ZERO']);

    const arr4 = SArray.of(SUInt8.enum(TestEnum)).ofJSON([TestEnum.ONE, 'ONE']);
    expect(arr4.toJSON()).toStrictEqual(['ONE', 'ONE']);
  });

  test('fixed length', function () {
    const arr1 = new (SArray.of(SInt8).ofLength(3))();
    expect(arr1.value).toHaveLength(3);
    expect(arr1.toJSON()).toStrictEqual([0, 0, 0]);
    expect(arr1.serialize().unwrap()).toStrictEqual(Buffer.of(0, 0, 0));
    arr1.deserialize(Buffer.of(42, 42, 42, 42));
    expect(arr1.serialize().unwrap()).toStrictEqual(Buffer.of(42, 42, 42));

    arr1.value.push(100);
    expect(arr1.value).toHaveLength(4);
    expect(arr1.serialize().unwrap()).toStrictEqual(Buffer.of(42, 42, 42));
    expect(arr1.value).toHaveLength(4);
    arr1.deserialize(Buffer.of(53, 53, 53, 53));
    expect(arr1.value).toHaveLength(4);
    expect(arr1.toJSON()).toStrictEqual([53, 53, 53]);

    arr1.value = [];
    expect(arr1.serialize().unwrap()).toStrictEqual(Buffer.of(0, 0, 0));
    expect(arr1.value).toHaveLength(0);
    arr1.deserialize(Buffer.of(42, 42, 42, 42));
    expect(arr1.value).toHaveLength(3);
    expect(arr1.toJSON()).toStrictEqual([42, 42, 42]);

    const arr2 = new (SArray.of(SArray.of(SInt8).ofLength(3)).ofLength(2))();
    expect(arr2.toJSON()).toStrictEqual([
      [0, 0, 0],
      [0, 0, 0],
    ]);
    expect(arr2.serialize().unwrap()).toStrictEqual(Buffer.of(0, 0, 0, 0, 0, 0));
    arr2.deserialize(Buffer.of(1, 2, 3, 4, 5, 6));
    expect(arr2.toJSON()).toStrictEqual([
      [1, 2, 3],
      [4, 5, 6],
    ]);
    expect(arr2.serialize().unwrap()).toStrictEqual(Buffer.of(1, 2, 3, 4, 5, 6));
  });

  test('fixed length JSON conversion', function () {
    const arr1 = new (SArray.of(SInt8).ofLength(3))();
    expect(arr1.toJSON()).toStrictEqual([0, 0, 0]);

    arr1.assignJSON([1, 2, 3, 4]);
    expect(arr1.toJSON()).toStrictEqual([1, 2, 3]);

    arr1.assignJSON([]);
    expect(arr1.toJSON()).toStrictEqual([0, 0, 0]);

    arr1.assignJSON([10, 20]);
    expect(arr1.toJSON()).toStrictEqual([10, 20, 0]);

    const arr2 = new (SArray.of(SInt8.enum(TestEnum)).ofLength(3))();
    arr2.assignJSON([1, 'ONE']);
    expect(arr2.toJSON()).toStrictEqual(['ONE', 'ONE', 'ZERO']);

    const arr3 = SArray.of(SUInt8.enum(TestEnum))
      .ofLength(3)
      .ofJSON([TestEnum.ONE, 'ONE']);
    expect(arr3.toJSON()).toStrictEqual(['ONE', 'ONE', 'ZERO']);
  });

  test('error handling', function () {
    const c1 = class extends SObject {};
    // @ts-expect-error invalid argument type
    expect(() => SArray.of(c1)).toThrow(Error);
  });
});