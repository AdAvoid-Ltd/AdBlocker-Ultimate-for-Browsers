import { nanoid } from 'nanoid';
import { SuperJSON } from 'superjson';
import { deleteDB, openDB } from 'idb';

import { BrowserModel } from './browser-storage';
import { IDBModel } from './idb-storage';

/**
 * Implements a hybrid storage mechanism that can switch between IndexedDB and a fallback storage
 * based on browser capabilities and environment constraints. This class adheres to the StorageInterface,
 * allowing for asynchronous get and set operations.
 */
export class HybridModel {
  static #isIDBCapabilityChecked = false;

  static #idbCapabilityCheckerPromise;

  static #idbSupported = false;

  static #TEST_IDB_NAME_PREFIX = 'test_';

  static #TEST_IDB_VERSION = 1;

  static #SUPERJSON_META_KEY = 'meta';

  #storage = null;

  #fallbackStorage;

  constructor(fallbackStorage) {
    this.#fallbackStorage = fallbackStorage;
  }

  static #isIdbStorage(storage) {
    return storage instanceof IDBModel;
  }

  async #getStorage() {
    if (this.#storage) {
      return this.#storage;
    }

    if (await HybridModel.isIDBSupported()) {
      this.#storage = new IDBModel();
    } else {
      this.#storage = new BrowserModel(this.#fallbackStorage);
    }

    return this.#storage;
  }

  static serialize = (data) => SuperJSON.serialize(data);

  static deserialize = (data) => SuperJSON.deserialize(data);

  static #isSuperJSONResult(value) {
    return typeof value === 'object' && value !== null && HybridModel.#SUPERJSON_META_KEY in value;
  }

  /**
   * Checks if IndexedDB is supported in the current environment.
   * This is determined by trying to open a test database; if successful, IndexedDB is supported.
   * The result of this check is cached to prevent multiple checks.
   */
  static async isIDBSupported() {
    if (HybridModel.#isIDBCapabilityChecked) {
      return HybridModel.#idbSupported;
    }

    if (HybridModel.#idbCapabilityCheckerPromise) {
      return HybridModel.#idbCapabilityCheckerPromise;
    }

    HybridModel.#idbCapabilityCheckerPromise = (async () => {
      try {
        const testDbName = `${HybridModel.#TEST_IDB_NAME_PREFIX}${nanoid()}`;
        const testDb = await openDB(testDbName, HybridModel.#TEST_IDB_VERSION);
        testDb.close();
        await deleteDB(testDbName);
        HybridModel.#idbSupported = true;
      } catch (e) {
        HybridModel.#idbSupported = false;
      }

      HybridModel.#isIDBCapabilityChecked = true;
      return HybridModel.#idbSupported;
    })();

    return HybridModel.#idbCapabilityCheckerPromise;
  }

  async set(key, value) {
    const storage = await this.#getStorage();

    /**
     * If the selected storage mechanism is IndexedDB, we store the value as is,
     * as IndexedDB can store complex objects.
     */
    if (HybridModel.#isIdbStorage(storage)) {
      return storage.set(key, value);
    }

    const serialized = HybridModel.serialize(value);

    /**
     * If the serialized value contains a meta key, it means that the value provided
     * contains special data that are not JSON-serializable and require SuperJSON serialization,
     * like typed arrays, dates, and other complex objects.
     * In this case, we store the SuperJSON-serialized value.
     */
    if (HybridModel.#SUPERJSON_META_KEY in serialized) {
      return storage.set(key, serialized);
    }

    /**
     * If the serialized value does not contain a meta key, it means that the value
     * provided was a primitive value or a plain object that is JSON-serializable,
     * and it does not contain any special data that requires SuperJSON serialization.
     * In this case, we store the value as is.
     */
    return storage.set(key, value);
  }

  async get(key) {
    const storage = await this.#getStorage();

    /**
     * If the selected storage mechanism is IndexedDB, we return the value as is,
     * as IndexedDB can store complex objects.
     */
    if (HybridModel.#isIdbStorage(storage)) {
      return storage.get(key);
    }

    const value = await storage.get(key);

    // Do not attempt to deserialize undefined values.
    if (value === undefined) {
      return undefined;
    }

    // If the value is a SuperJSON-serialized object, we need to deserialize it.
    if (HybridModel.#isSuperJSONResult(value)) {
      return HybridModel.deserialize(value);
    }

    // Otherwise, we return the value as is.
    return value;
  }

  async remove(key) {
    const storage = await this.#getStorage();
    return storage.remove(key);
  }

  /**
   * Atomic set operation for multiple key-value pairs.
   * This method are using transaction to ensure atomicity, if any of the operations fail,
   * the entire operation is rolled back. This helps to prevent data corruption / inconsistency.
   */
  async setMultiple(data) {
    const storage = await this.#getStorage();
    if (HybridModel.#isIdbStorage(storage)) {
      return (await storage.setMultiple(data)) ?? false;
    }

    const cloneData = Object.entries(data).reduce((acc, [key, value]) => {
      const serialized = SuperJSON.serialize(value);

      /**
       * If the serialized value contains a meta key, it means that the value provided
       * contains special data that are not JSON-serializable and require SuperJSON serialization,
       * like typed arrays, dates, and other complex objects.
       * In this case, we store the SuperJSON-serialized value.
       */
      if (HybridModel.#SUPERJSON_META_KEY in serialized) {
        acc[key] = serialized;
        return acc;
      }

      /**
       * If the serialized value does not contain a meta key, it means that the value
       * provided was a primitive value or a plain object that is JSON-serializable,
       * and it does not contain any special data that requires SuperJSON serialization.
       * In this case, we store the value as is.
       */
      acc[key] = value;

      return acc;
    }, {});

    return (await storage.setMultiple(cloneData)) ?? false;
  }

  async removeMultiple(keys) {
    const storage = await this.#getStorage();
    return (await storage.removeMultiple(keys)) ?? false;
  }

  async entries() {
    const storage = await this.#getStorage();

    if (HybridModel.#isIdbStorage(storage)) {
      return storage.entries();
    }

    const entries = await storage.entries();

    return Object.entries(entries).reduce((acc, [key, value]) => {
      acc[key] = HybridModel.#isSuperJSONResult(value) ? HybridModel.deserialize(value) : value;
      return acc;
    }, {});
  }

  async keys() {
    const storage = await this.#getStorage();
    return storage.keys();
  }

  async has(key) {
    const storage = await this.#getStorage();
    return storage.has(key);
  }

  async clear() {
    const storage = await this.#getStorage();
    await storage.clear();
  }
}
