/// <reference types="@sveltejs/kit" />
/// <reference no-default-lib="true"/>
/// <reference lib="esnext" />
/// <reference lib="webworker" />

import { version } from '$service-worker';

const sw = /** @type {ServiceWorkerGlobalScope} */ (/** @type {unknown} */ (self));

const ALBUM_ART_CACHE_NAME = `album-art-cache-${version}`;

function createCacheKey(url) {
    try {
        const urlObj = new URL(url);
        const id = urlObj.searchParams.get('id');

        if (id) {
            return `${urlObj.origin}${urlObj.pathname}?id=${id}`;
        }

        return `${urlObj.origin}${urlObj.pathname}`;
    } catch (error) {
        console.warn('Failed to parse URL for caching:', url, error);
        return url;
    }
}

function isAlbumArtRequest(request) {
    const url = request.url.toLowerCase();
    return (
        request.destination === 'image' &&
        (url.includes('getcoverart') ||
            url.includes('coverart') ||
            url.includes('/cover') ||
            url.includes('album') && url.includes('art'))
    );
}

sw.addEventListener('install', (event) => {
    sw.skipWaiting();
});

sw.addEventListener('activate', (event) => {
    async function cleanOldCaches() {
        const cacheNames = await caches.keys();
        const oldCaches = cacheNames.filter(name =>
            name.startsWith('album-art-cache-') && name !== ALBUM_ART_CACHE_NAME
        );

        await Promise.all(
            oldCaches.map(cacheName => caches.delete(cacheName))
        );
    }

    event.waitUntil(cleanOldCaches());

    sw.clients.claim();
});

sw.addEventListener('fetch', (event) => {
    if (event.request.method !== 'GET' || !isAlbumArtRequest(event.request)) {
        return;
    }

    event.respondWith(
        caches.open(ALBUM_ART_CACHE_NAME).then(async (cache) => {
            try {
                const cacheKey = createCacheKey(event.request.url);


                const cachedResponse = await cache.match(cacheKey);
                if (cachedResponse) {
                    return cachedResponse;
                }

                const networkResponse = await fetch(event.request);

                if (networkResponse && networkResponse.status === 200) {
                    cache.put(cacheKey, networkResponse.clone());
                }

                return networkResponse;
            } catch (error) {
                console.error('Service worker fetch error:', error);
                const cacheKey = createCacheKey(event.request.url);
                const cachedResponse = await cache.match(cacheKey);

                if (cachedResponse) {
                    return cachedResponse;
                }

                throw error;
            }
        })
    );
});
