importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyDIFNIAmbKFT3r5YJ8wkiSieKsEt9duFaM",
  authDomain: "tongseo-e5d28.firebaseapp.com",
  projectId: "tongseo-e5d28",
  storageBucket: "tongseo-e5d28.firebasestorage.app",
  messagingSenderId: "376390993636",
  appId: "1:376390993636:web:7277b40cc0519b86690ef1"
});

const messaging = firebase.messaging();

// 앱이 백그라운드 상태일 때 수신된 메시지 처리
messaging.onBackgroundMessage((payload) => {
  const title = payload.notification?.title ?? '통서(通書)';
  const options = {
    body: payload.notification?.body ?? '',
    icon: '/icon.svg',
    badge: '/icon.svg',
    tag: payload.data?.note_id ?? 'tongseo-notification',
    data: payload.data,
  };
  self.registration.showNotification(title, options);
});

// 알림 클릭 시 앱으로 이동
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      if (clientList.length > 0) {
        clientList[0].focus();
      } else {
        clients.openWindow('/');
      }
    })
  );
});
