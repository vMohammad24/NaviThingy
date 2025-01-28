import { writable } from 'svelte/store';

const storedOpenValue = typeof localStorage !== 'undefined'
    ? localStorage.getItem('sidebarOpen') !== 'false'
    : true;

const storedHiddenValue = typeof localStorage !== 'undefined'
    ? localStorage.getItem('sidebarHidden') === 'true'
    : false;

export const sidebarOpen = writable(storedOpenValue);
export const sidebarHidden = writable(storedHiddenValue);

if (typeof localStorage !== 'undefined') {
    sidebarOpen.subscribe(value => {
        localStorage.setItem('sidebarOpen', value.toString());
    });

    sidebarHidden.subscribe(value => {
        localStorage.setItem('sidebarHidden', value.toString());
    });
}