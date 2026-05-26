// Firebase Messaging Service Worker
// This file must be at the root of the served app (public/)
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js');

// NOTE: Replace placeholder values with your actual Firebase config
// These are read at runtime; they must match your environment config.
// The VAPID key is used in the main app, not here.
firebase.initializeApp({
    apiKey: self.__FIREBASE_API_KEY__ || 'YOUR_FIREBASE_API_KEY',
    authDomain: self.__FIREBASE_AUTH_DOMAIN__ || 'YOUR_PROJECT_ID.firebaseapp.com',
    projectId: self.__FIREBASE_PROJECT_ID__ || 'YOUR_PROJECT_ID',
    storageBucket: self.__FIREBASE_STORAGE_BUCKET__ || 'YOUR_PROJECT_ID.appspot.com',
    messagingSenderId: '535081495411',
    appId: self.__FIREBASE_APP_ID__ || 'YOUR_FIREBASE_APP_ID',
});

const messaging = firebase.messaging();

// Handle background messages
messaging.onBackgroundMessage((payload) => {
    const { title, body, icon } = payload.notification ?? {};
    const link = payload.fcmOptions?.link ?? payload.data?.url ?? '/';

    self.registration.showNotification(title ?? 'mhfrough.dev', {
        body: body ?? '',
        icon: icon ?? '/icons/icon-192x192.png',
        badge: '/icons/icon-72x72.png',
        data: { url: link },
        requireInteraction: false,
    });
});

// Open the linked URL when the notification is clicked
self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    const url = event.notification.data?.url ?? '/';
    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
            for (const client of windowClients) {
                if (client.url === url && 'focus' in client) {
                    return client.focus();
                }
            }
            if (clients.openWindow) {
                return clients.openWindow(url);
            }
        }),
    );
});
