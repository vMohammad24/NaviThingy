import { writable } from 'svelte/store';

interface SidebarSettings {
	open: boolean;
	hidden: boolean;
	mobile: boolean;
}

const STORAGE_KEY = 'sidebarSettings';

function loadSettings(): SidebarSettings {
	if (typeof localStorage === 'undefined') {
		return { open: true, hidden: false, mobile: false };
	}
	const stored = localStorage.getItem(STORAGE_KEY);
	if (stored) {
		const parsed = JSON.parse(stored);
		return { ...parsed, hidden: false, mobile: false };
	}
	return { open: true, hidden: false, mobile: false };
}

const settings = loadSettings();
export const sidebarOpen = writable(settings.open);
export const sidebarHidden = writable(settings.hidden);
export const isMobile = writable(false);

if (typeof localStorage !== 'undefined') {
	let currentSettings = settings;

	sidebarOpen.subscribe((value) => {
		currentSettings = { ...currentSettings, open: value };
		localStorage.setItem(STORAGE_KEY, JSON.stringify(currentSettings));
	});

	sidebarHidden.subscribe((value) => {
		currentSettings = { ...currentSettings, hidden: value };
		localStorage.setItem(STORAGE_KEY, JSON.stringify(currentSettings));
	});
}
