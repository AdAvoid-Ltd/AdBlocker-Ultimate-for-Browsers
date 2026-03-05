async function rejectAfterTimeout(timeoutMs, message) {
  return new Promise((resolve, reject) => {

    self.setTimeout(() => {
      reject(new Error(message));
    }, timeoutMs);
  });
}

export async function createPromiseWithTimeout(promise, timeoutMs = 5000, errorMessage = 'Promise execution timeout') {
  return Promise.race([promise, rejectAfterTimeout(timeoutMs, errorMessage)]);
}
