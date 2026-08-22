export function chromeAsync(fn) {
  return new Promise((resolve, reject) => {
    fn((result) => {
      const error = chrome.runtime.lastError;
      if (error) reject(new Error(error.message));
      else resolve(result);
    });
  });
}

export async function getLocal(defaults) {
  const keys = Object.keys(defaults);
  if (window.chrome && chrome.storage && chrome.storage.local) {
    return chromeAsync((done) => chrome.storage.local.get(defaults, done));
  }

  return keys.reduce((data, key) => {
    try {
      data[key] = JSON.parse(localStorage.getItem(key)) || defaults[key];
    } catch (_error) {
      data[key] = defaults[key];
    }
    return data;
  }, {});
}

export async function setLocal(data) {
  if (window.chrome && chrome.storage && chrome.storage.local) {
    await chromeAsync((done) => chrome.storage.local.set(data, done));
    return;
  }

  Object.entries(data).forEach(([key, value]) => {
    localStorage.setItem(key, JSON.stringify(value));
  });
}

export async function getSession(defaults) {
  const keys = Object.keys(defaults);
  if (window.chrome && chrome.storage && chrome.storage.session) {
    return chromeAsync((done) => chrome.storage.session.get(defaults, done));
  }

  return keys.reduce((data, key) => {
    try {
      data[key] = JSON.parse(sessionStorage.getItem(key)) || defaults[key];
    } catch (_error) {
      data[key] = defaults[key];
    }
    return data;
  }, {});
}

export async function setSession(data) {
  if (window.chrome && chrome.storage && chrome.storage.session) {
    await chromeAsync((done) => chrome.storage.session.set(data, done));
    return;
  }

  Object.entries(data).forEach(([key, value]) => {
    sessionStorage.setItem(key, JSON.stringify(value));
  });
}
