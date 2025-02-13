export interface NavidromeServer {
    id: string;
    name: string;
    url: string;
    username: string;
    password: string;
}

export interface SyncedLyric {
    time: number;
    text: string;
}

export interface LRCLIBResponse {
    id: number;
    trackName: string;
    artistName: string;
    albumName?: string;
    duration?: number;
    instrumental: boolean;
    plainLyrics: string;
    syncedLyrics: string;
}

export interface LyricsResult {
    synced: boolean;
    plain: string;
    lines: SyncedLyric[];
}
