chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'getAuthToken') {
    const manifest = chrome.runtime.getManifest();
    const clientId = manifest.oauth2.client_id;
    const scopes = manifest.oauth2.scopes.join(' ');
    const redirectUrl = chrome.identity.getRedirectURL();

    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&response_type=token&redirect_uri=${encodeURIComponent(redirectUrl)}&scope=${encodeURIComponent(scopes)}`;

    chrome.identity.launchWebAuthFlow({
      url: authUrl,
      interactive: true
    }, function(responseUrl) {
      if (chrome.runtime.lastError) {
        return sendResponse({ error: chrome.runtime.lastError.message });
      }
      if (!responseUrl) {
        return sendResponse({ error: 'Auth failed: No response URL' });
      }

      // Extract the access token from the URL hash
      // The URL looks like: https://<id>.chromiumapp.org/#access_token=TOKEN&...
      const params = new URLSearchParams(new URL(responseUrl).hash.substring(1));
      const token = params.get('access_token');
      
      if (token) {
        sendResponse({ token: token });
      } else {
        const errorMsg = params.get('error') || 'Failed to extract token';
        sendResponse({ error: errorMsg });
      }
    });
    return true; // Keep the message channel open for async response
  }
});
