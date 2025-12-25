/**
 * CalcuLTOR Service Worker
 * Enables FULL offline functionality and PWA features
 * Version 2.0 - Improved caching for complete offline support
 */

const CACHE_NAME = 'calcultor-v2.1';
const ASSETS_TO_CACHE = [
    '/',
    '/index.html',
    '/styles.css',
    '/script.js',
    '/manifest.json',
    '/version.json'
];

// Google Fonts to cache
const FONT_CACHE = 'calcultor-fonts-v1';
const FONT_URLS = [
    'https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700&display=swap'
];

// Install event - cache all assets
self.addEventListener('install', (event) => {
    event.waitUntil(
        Promise.all([
            // Cache main assets
            caches.open(CACHE_NAME).then((cache) => {
                console.log('Caching app assets...');
                return cache.addAll(ASSETS_TO_CACHE);
            }),
            // Cache fonts separately
            caches.open(FONT_CACHE).then((cache) => {
                console.log('Caching fonts...');
                return Promise.all(
                    FONT_URLS.map(url =>
                        fetch(url, { mode: 'cors' })
                            .then(response => cache.put(url, response))
                            .catch(err => console.log('Font cache failed:', err))
                    )
                );
            })
        ]).then(() => {
            console.log('All assets cached for offline use!');
            self.skipWaiting();
        }).catch((error) => {
            console.log('Cache failed:', error);
        })
    );
});

// Activate event - clean old caches
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheName !== CACHE_NAME && cacheName !== FONT_CACHE) {
                        console.log('Deleting old cache:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        }).then(() => {
            console.log('Service Worker activated - Offline mode ready!');
            self.clients.claim();
        })
    );
});

// Fetch event - Offline-first strategy
self.addEventListener('fetch', (event) => {
    const request = event.request;
    const url = new URL(request.url);

    // Skip Supabase API calls - they should go directly to network
    if (url.hostname.includes('supabase.co')) {
        return;
    }

    // Skip GitHub version check - should always check network
    if (url.hostname.includes('githubusercontent.com')) {
        event.respondWith(
            fetch(request).catch(() => {
                // Silently fail version check when offline
                return new Response(JSON.stringify({ version: '0.0.0' }), {
                    headers: { 'Content-Type': 'application/json' }
                });
            })
        );
        return;
    }

    // For everything else - Cache first, then network
    event.respondWith(
        caches.match(request).then((cachedResponse) => {
            if (cachedResponse) {
                // Return from cache
                return cachedResponse;
            }

            // Not in cache, fetch from network
            return fetch(request).then((networkResponse) => {
                // Don't cache non-GET requests or external resources
                if (request.method !== 'GET' || !url.origin.includes(self.location.origin)) {
                    return networkResponse;
                }

                // Cache the new resource
                if (networkResponse && networkResponse.status === 200) {
                    const responseToCache = networkResponse.clone();
                    caches.open(CACHE_NAME).then((cache) => {
                        cache.put(request, responseToCache);
                    });
                }

                return networkResponse;
            });
        }).catch(() => {
            // Network failed and not in cache - return offline page
            if (request.mode === 'navigate') {
                return caches.match('/index.html');
            }
            // Return empty response for other requests
            return new Response('Offline', { status: 503, statusText: 'Offline' });
        })
    );
});

// Listen for messages from the app
self.addEventListener('message', (event) => {
    if (event.data === 'skipWaiting') {
        self.skipWaiting();
    }
});
