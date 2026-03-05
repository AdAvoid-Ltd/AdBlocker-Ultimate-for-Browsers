export const AppContextKey = {
  IsInit: 'isInit',
};

class AppContext {
  #data = {
    [AppContextKey.IsInit]: false,
  };

  get(key) {
    return this.#data[key];
  }

  set(key, value) {
    this.#data[key] = value;
  }
}

export const appContext = new AppContext();
