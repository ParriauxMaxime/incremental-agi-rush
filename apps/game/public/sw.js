const CACHE_NAME = "flopsed-__BUILD_HASH__";

self.addEventListener("install", (event) => {
	self.skipWaiting();
	event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(["/"])));
});

self.addEventListener("activate", (event) => {
	event.waitUntil(
		caches
			.keys()
			.then((keys) =>
				Promise.all(
					keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)),
				),
			),
	);
	self.clients.claim();
});

self.addEventListener("fetch", (event) => {
	if (event.request.method !== "GET") return;
	event.respondWith(
		fetch(event.request)
			.then((response) => {
				const clone = response.clone();
				caches
					.open(CACHE_NAME)
					.then((cache) => cache.put(event.request, clone));
				return response;
			})
			.catch(() => caches.match(event.request)),
	);
});
