// Web push for the operator dashboard ("Bus X marked inoperable", sent by the
// markBusInoperable Cloud Function). Registered by src/utils/pushServices.js
// with the Firebase config in the query string — Vite env isn't available in
// a service worker. Keep the version in step with the `firebase` package.

// Clicking a notification focuses the dashboard (or opens it). Registered
// before the Firebase scripts so it runs instead of their handler.
self.addEventListener('notificationclick', (event) => {
  event.stopImmediatePropagation();
  event.notification.close();
  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
      const open = windows.find((client) => new URL(client.url).origin === self.location.origin);
      if (open) return open.focus();
      return self.clients.openWindow('/dashboard');
    })(),
  );
});

importScripts('https://www.gstatic.com/firebasejs/12.18.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/12.18.0/firebase-messaging-compat.js');

const params = new URL(self.location.href).searchParams;
firebase.initializeApp({
  apiKey: params.get('apiKey'),
  projectId: params.get('projectId'),
  messagingSenderId: params.get('messagingSenderId'),
  appId: params.get('appId'),
});

// Messages with a `notification` payload are shown automatically while the
// dashboard isn't focused.
firebase.messaging();
