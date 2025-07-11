import {
  field,
  json,
  SArray,
  SObject,
  SPair,
  SString,
  SUInt16BE,
  SUInt8,
} from '../';

enum TestEnum {
  ZERO = 0,
  ONE = 1,
}

/** Example object that exercises `field()`. */
class TestObjectA extends SObject {
  @field()
  prop1 = new SUInt8();

  @field(SUInt16BE)
  prop2 = 0;

  @field(SString)
  prop3 = '';

  @field(SUInt8.enum(TestEnum))
  prop4 = TestEnum.ZERO;
}

const TEST_OBJECT_A_SERIALIZED_LENGTH = 6;

/** Example object that tests serialize with accessors. */
class TestObjectB extends SObject {
  firstName: string = '';
  lastName: string = '';

  @field()
  get fullName(): SString {
    return SString.of(`${this.firstName} ${this.lastName}`);
  }
  set fullName(fullName: SString) {
    [this.firstName, this.lastName] = fullName.value.split(' ');
  }
}

/** Example object that tests `field()` with accessors. */
class TestObjectC extends SObject {
  @field(SUInt8)
  prop1 = 0;

  @field()
  objectB: TestObjectB = new TestObjectB();
}

/** Example object with JSON setting decorators. */
class TestObjectD extends SObject {
  prop1 = 0;

  @json(true)
  prop2 = 0;

  @json(false)
  prop3 = 0;

  @json(false)
  @field(SUInt8)
  prop4 = 0;

  @field(SUInt8)
  @json(false)
  prop5 = 0;

  @json(true)
  get prop6() {
    return this.prop1 + this.prop2;
  }

  @json(false)
  @field(SUInt8)
  get prop7() {
    return this.prop1 + this.prop2;
  }
}

describe('SObject', function () {
  describe('field and field.as', function () {
    test('using constructor and assignment', function () {
      const obj1 = new TestObjectA();
      expect(obj1.getSerializedLength().unwrap()).toStrictEqual(
        TEST_OBJECT_A_SERIALIZED_LENGTH
      );
      obj1.prop1.value = 42;
      obj1.prop2 = 153;
      obj1.prop3 = 'FOO!';
      obj1.prop4 = TestEnum.ONE;
      const serializedObj1 = obj1.serialize().unwrap();
      expect(serializedObj1).toHaveLength(obj1.getSerializedLength().unwrap());

      const obj2 = TestObjectA.from(serializedObj1);
      expect(obj2.prop1.value).toStrictEqual(obj1.prop1.value);
      expect(obj2.prop2).toStrictEqual(obj1.prop2);
      expect(obj2.prop3).toStrictEqual(obj1.prop3);
      expect(obj2.prop4).toStrictEqual(obj1.prop4);
    });

    test('using "with"', function () {
      const obj1 = TestObjectA.with({
        prop1: SUInt8.of(100),
        prop2: 15,
      });
      expect(obj1.getSerializedLength().unwrap()).toStrictEqual(
        TEST_OBJECT_A_SERIALIZED_LENGTH
      );
      expect(obj1.prop1.value).toStrictEqual(100);
      expect(obj1.prop2).toStrictEqual(15);
      expect(obj1.prop3).toStrictEqual(new TestObjectA().prop3);
      expect(obj1.prop4).toStrictEqual(TestEnum.ZERO);
    });

    test('using getter', function () {
      const obj1 = new TestObjectB();
      obj1.firstName = 'Jane';
      obj1.lastName = 'Doe';
      expect(obj1.fullName.value).toStrictEqual('Jane Doe');
      expect(obj1.getSerializedLength().unwrap()).toStrictEqual(
        obj1.fullName.value.length + 2
      );
    });

    test('using setter', function () {
      const obj2 = new TestObjectB();
      obj2.fullName = SString.of('Jane Doe');
      expect(obj2.fullName.value).toStrictEqual('Jane Doe');
      expect(obj2.firstName).toStrictEqual('Jane');
      expect(obj2.lastName).toStrictEqual('Doe');
      expect(obj2.getSerializedLength().unwrap()).toStrictEqual(
        obj2.fullName.value.length + 2
      );
    });
  });

  test('JSON conversion', function () {
    const obj1 = TestObjectA.with({
      prop1: SUInt8.of(100),
      prop2: 50,
      prop3: 'FOO!',
      prop4: TestEnum.ONE,
    });
    expect(obj1.toJSON()).toStrictEqual({
      prop1: 100,
      prop2: 50,
      prop3: 'FOO!',
      prop4: 'ONE',
    });
    obj1.assignJSON({prop4: 'ZERO'});
    expect(obj1.prop4).toStrictEqual(TestEnum.ZERO);
    expect(obj1.toJSON()).toStrictEqual({
      prop1: 100,
      prop2: 50,
      prop3: 'FOO!',
      prop4: 'ZERO',
    });

    const obj2 = TestObjectB.with({firstName: 'Jane', lastName: 'Doe'});
    expect(obj2.toJSON()).toStrictEqual({
      firstName: 'Jane',
      lastName: 'Doe',
    });

    const obj3 = TestObjectC.withJSON({
      prop1: 42,
      objectB: {firstName: 'John', lastName: 'Doe'},
    });
    expect(obj3.toJSON()).toStrictEqual({
      prop1: 42,
      objectB: {
        firstName: 'John',
        lastName: 'Doe',
      },
    });
    obj3.assignJSON({prop1: 100});
    expect(obj3.toJSON()).toStrictEqual({
      prop1: 100,
      objectB: {
        firstName: 'John',
        lastName: 'Doe',
      },
    });
    obj3.assignJSON({objectB: {firstName: 'Jane'}});
    expect(obj3.toJSON()).toStrictEqual({
      prop1: 100,
      objectB: {
        firstName: 'Jane',
        lastName: 'Doe',
      },
    });
    obj3.assignJSON({});
    expect(obj3.toJSON()).toStrictEqual({
      prop1: 100,
      objectB: {
        firstName: 'Jane',
        lastName: 'Doe',
      },
    });

    // @ts-expect-error assign non-object value
    expect(() => obj3.assignJSON('not an object')).toThrow(Error);
    // @ts-expect-error assignment null
    expect(() => obj3.assignJSON(null)).toThrow(Error);
  });

  test('JSON setting decorators', function () {
    const obj1 = TestObjectD.with({
      prop1: 1,
      prop2: 2,
      prop3: 3,
      prop4: 4,
      prop5: 5,
    });
    expect(obj1.toJSON()).toStrictEqual({
      prop1: 1,
      prop2: 2,
      prop6: 3,
    });
  });
});