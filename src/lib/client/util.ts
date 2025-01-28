import { browser } from "$app/environment";

export function download(url: string, name: string) {
    if (browser) {
        const link = document.createElement('a');
        link.href = url;
        link.download = name;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }
}

export function formatDate(date: Date | string | number) {
    if (typeof date !== 'object') {
        date = new Date(date);
    }
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
}