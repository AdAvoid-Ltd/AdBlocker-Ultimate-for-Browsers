export class StringStorage {
  key;
  storage;
  data;
  constructor(key, storage) {
    this.key = key;
    this.storage = storage;
  }

  getData() {
    if (!this.data) {
      throw new Error('Data is not set!');
    }
    return this.data;
  }

  setCache(data) {
    this.data = data;
  }

  setData(data) {
    this.setCache(data);
    return this.save();
  }

  save() {
    return this.storage.set(this.key, JSON.stringify(this.data));
  }

  read() {
    return this.storage.get(this.key);
  }
}
