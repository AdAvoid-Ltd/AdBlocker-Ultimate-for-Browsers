import { openDB } from 'idb';

import { logger } from '../../common/logger';

/**
 * Provides a storage mechanism using IndexedDB. This class implements the
 * StorageInterface with asynchronous methods to interact with the database.
 */
export class IDBModel {
  static DEFAULT_STORE_NAME = 'defaultStore';

  static DEFAULT_IDB_VERSION = 1;

  static DEFAULT_IDB_NAME = 'abuIDB';

  #db = null;

  #dbGetterPromise = null;

  #name;

  #version;

  #store;

  constructor(
    name = IDBModel.DEFAULT_IDB_NAME,
    version = IDBModel.DEFAULT_IDB_VERSION,
    store = IDBModel.DEFAULT_STORE_NAME,
  ) {
    this.#name = name;
    this.#version = version;
    this.#store = store;
  }

  async #getOpenedDb() {
    if (this.#db) {
      return this.#db;
    }

    if (this.#dbGetterPromise) {
      return this.#dbGetterPromise;
    }

    this.#dbGetterPromise = (async () => {
      this.#db = await openDB(this.#name, this.#version, {
        upgrade: (db) => {
          // Make sure the store exists
          if (!db.objectStoreNames.contains(this.#store)) {
            db.createObjectStore(this.#store);
          }
        },
      });

      this.#dbGetterPromise = null;

      return this.#db;
    })();

    return this.#dbGetterPromise;
  }

  async get(key) {
    const db = await this.#getOpenedDb();
    return db.get(this.#store, key);
  }

  async set(key, value) {
    const db = await this.#getOpenedDb();
    await db.put(this.#store, value, key);
  }

  async remove(key) {
    const db = await this.#getOpenedDb();
    await db.delete(this.#store, key);
  }

  /**
   * Atomic set operation for multiple key-value pairs.
   * This method is using transaction to ensure atomicity, if any of the operations fail,
   * the entire operation is rolled back. This helps to prevent data corruption / inconsistency.
   */
  async setMultiple(data) {
    const db = await this.#getOpenedDb();
    const tx = db.transaction(this.#store, 'readwrite');

    try {
      await Promise.all(Object.entries(data).map(([key, value]) => tx.store.put(value, key)));
      await tx.done;
    } catch (e) {
      logger.error('[ext.IDBModel.setMultiple]: error while setting multiple keys in the storage:', e);
      tx.abort();
      return false;
    }

    return true;
  }

  async removeMultiple(keys) {
    const db = await this.#getOpenedDb();
    const tx = db.transaction(this.#store, 'readwrite');

    try {
      await Promise.all(keys.map((key) => tx.store.delete(key)));
      await tx.done;
    } catch (e) {
      logger.error('[ext.IDBModel.removeMultiple]: error while removing multiple keys from the storage:', e);
      tx.abort();
      return false;
    }

    return true;
  }

  async entries() {
    const db = await this.#getOpenedDb();
    const entries = {};
    const tx = db.transaction(this.#store, 'readonly');

    for await (const cursor of tx.store) {
      const key = String(cursor.key);
      entries[key] = cursor.value;
    }

    return entries;
  }

  async keys() {
    const db = await this.#getOpenedDb();
    const idbKeys = await db.getAllKeys(this.#store);
    return idbKeys.map((key) => key.toString());
  }

  async has(key) {
    const db = await this.#getOpenedDb();
    const idbKey = await db.getKey(this.#store, key);
    return idbKey !== undefined;
  }

  async clear() {
    const db = await this.#getOpenedDb();
    await db.clear(this.#store);
  }
}
