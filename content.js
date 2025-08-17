(async () => {
  const src = chrome.runtime.getURL('content.mjs');
  const contentScript = await import(src);
})();
