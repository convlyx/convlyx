/// Service Worker for Convlyx PWA

// Cache name
const CACHE_NAME = "convlyx-v1";

// Install — cache essential assets
self.addEventListener("install", (event) => {
  self.skipWaiting();
});

// Activate — clean old caches
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Push notification received
self.addEventListener("push", (event) => {
  const data = event.data?.json() ?? {};

  const title = data.title ?? "Convlyx";
  const options = {
    body: data.body ?? "",
    icon: "/favicon.png",
    badge: "/favicon.png",
    data: {
      url: data.url ?? "/",
    },
    vibrate: [200, 100, 200],
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

// Notification click — open the app
self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const url = event.notification.data?.url ?? "/";

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      // Focus existing window if open
      for (const client of clients) {
        if (client.url.includes(self.location.origin) && "focus" in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      // Otherwise open new window
      return self.clients.openWindow(url);
    })
  );
});
