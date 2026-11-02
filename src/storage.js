let database;
async function open() {
  if (database) return database;
  database = await new Promise((resolve, reject) => {
    const request = indexedDB.open('meedee-library', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('songs', { keyPath: 'id' });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  return database;
}
export async function readImports() {
  const db = await open();
  return new Promise((resolve, reject) => {
    const request = db.transaction('songs', 'readonly').objectStore('songs').getAll();
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
export async function saveImport(value) {
  const db = await open();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('songs', 'readwrite');
    transaction.objectStore('songs').put(value);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error);
    transaction.onabort = () => reject(transaction.error);
  });
}
