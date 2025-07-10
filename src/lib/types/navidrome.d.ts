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

export interface SyncedWord {
	time: number;
	word: string;
	endTime?: number;
	isParenthetical?: boolean;
}

export interface EnhancedSyncedLyric {
	time: number;
	text: string;
	words: SyncedWord[];
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
	enhanced?: boolean;
	enhancedLines?: EnhancedSyncedLyric[];
}
