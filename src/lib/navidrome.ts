import { SubsonicAPI, type AlbumList, type Child } from '@vmohammad/subsonic-api';
import type { LRCLIBResponse, LyricsResult, NavidromeServer, SyncedLyric } from './types/navidrome';

export class NavidromeClient {
    private api: SubsonicAPI;
    private auth: {
        username: string;
        password: string;
    }
    constructor(server: NavidromeServer) {
        console.log('Creating client')
        this.auth = {
            username: server.username,
            password: server.password
        }
        this.api = new SubsonicAPI({
            url: server.url,
            auth: this.auth,
            client: 'NaviThingy'
        });
    }
    async getGenres(): Promise<{
        value: string;
        albumCount: number;
        songCount: number;
    }[] | undefined> {
        return (await this.api.getGenres()).genres.genre as any;
    }

    async getUserData(full: boolean = false) {
        if (full) return (await this.api.getUser()).user;
        return {
            username: this.auth.username,
        }
    }

    async getPlaylists() {
        return (await this.api.getPlaylists()).playlists.playlist;
    }

    async getPlaylist(id: string) {
        const playlist = (await this.api.getPlaylist({ id })).playlist;
        if (playlist.entry) {
            playlist.entry = await this.sanitizeChildren(playlist.entry);
        }
        return playlist;
    }

    async createPlaylist(name: string) {
        return await this.api.createPlaylist({ name });
    }

    async updatePlaylist(id: string, params: {
        name?: string;
        comment?: string;
        songIdToAdd?: string[];
        songIndexToRemove?: number[];
        public?: boolean;
    }) {
        return await this.api.updatePlaylist({
            playlistId: id,
            ...params,
        });
    }


    async deletePlaylist(id: string) {
        return await this.api.deletePlaylist({ id });
    }

    async getAlbums(type: 'newest' | 'highest' | 'frequent' | 'recent' | 'favorites', params: {
        size?: number;
        offset?: number;
        fromYear?: number;
        toYear?: number;
        genre?: string;
        musicFolderId?: string;
    }
    ) {
        if (type === 'favorites') {
            return (await this.getStarred()) as AlbumList
        }
        const { albumList } = await this.api.getAlbumList({ type, ...params });

        if (albumList.album) {
            albumList.album = await this.sanitizeChildren(albumList.album);
        }
        return albumList;
    }

    async getAlbumDetails(id: string) {
        const { album } = await this.api.getAlbum({ id });
        if (album.song) {
            album.song = await this.sanitizeChildren(album.song);
        }
        if (album.coverArt) {
            album.coverArt = await this.getCoverURL(album.id);
        }
        return album;
    }

    async getCoverURL(id: string, size = 1024) {
        return (await this.api.getURL("getCoverArt", { id, size })).toString();
    }

    async search(query: string, type?: 'song' | 'album' | 'artist', offset: number = 0) {
        const { searchResult3 } = await this.api.search3({
            query,
            artistCount: type === 'artist' ? 20 : undefined,
            artistOffset: type === 'artist' ? offset : undefined,
            albumCount: type === 'album' ? 20 : undefined,
            albumOffset: type === 'album' ? offset : undefined,
            songCount: type === 'song' ? 20 : undefined,
            songOffset: type === 'song' ? offset : undefined
        });

        if (searchResult3.album) {
            searchResult3.album = await this.sanitizeChildren(searchResult3.album);
        }

        if (searchResult3.song) {
            searchResult3.song = await this.sanitizeChildren(searchResult3.song);
        }
        return searchResult3;
    }

    async getSongStream(id: string) {
        return await this.api.stream({
            id,
            format: 'raw'
        })
    }

    async getSongStreamURL(id: string) {
        return (await this.api.getURL("stream", { id, format: 'raw' })).toString();
    }

    async download(id: string) {
        return (await this.api.getURL('download', { id, format: 'raw' })).toString();
    }

    async scrobble(id: string, submission: boolean = false) {
        return await this.api.scrobble({ id, submission });
    }

    async getQueue() {
        const queue = (await this.api.getPlayQueue()).playQueue;
        if (queue?.entry) {
            queue.entry = await this.sanitizeChildren(queue.entry);
        }
        return queue;
    }

    private async sanitizeChildren<T extends { coverArt?: string; id: string }>(children: T[]): Promise<T[]> {
        return await Promise.all(children.map(async child => {
            if (child.coverArt && !child.coverArt.startsWith('http')) {
                return {
                    ...child,
                    coverArt: await this.getCoverURL(child.id)
                };
            }
            return child;
        }));
    }

    async saveQueue(params: {
        position: number;
        current?: string;
        id?: string;
    }) {
        return await this.api.savePlayQueue(params);
    }

    async getArtist(id: string) {
        const { artist } = await this.api.getArtist({ id });
        const { artistInfo } = await this.api.getArtistInfo({ id });
        if (artist.album) {
            artist.album = await this.sanitizeChildren(artist.album);
        }

        return { artist, artistInfo };
    }

    async getArtists() {
        return (await this.api.getArtists()).artists;
    }

    async getSong(id: string) {
        const { song } = await this.api.getSong({ id });
        const { similarSongs } = await this.api.getSimilarSongs({ id });
        if (song.coverArt) {
            song.coverArt = (await this.getCoverURL(song.id)).toString();
        }
        if (similarSongs.song) {
            similarSongs.song = await this.sanitizeChildren(similarSongs.song);
        }
        return { song, similarSongs };
    }

    async getRandomSongs(size = 1) {
        const { randomSongs } = await this.api.getRandomSongs({
            size
        });

        if (randomSongs.song) {
            randomSongs.song = await this.sanitizeChildren(randomSongs.song);
        }

        return randomSongs;
    }

    async getStarred() {
        const { starred } = await this.api.getStarred();
        if (starred.album) {
            starred.album = await this.sanitizeChildren(starred.album);
        }

        if (starred.song) {
            starred.song = await this.sanitizeChildren(starred.song);
        }
        return starred;
    }

    async star(id: string, type: 'track' | 'album' | 'artist') {
        switch (type) {
            case 'track':
                return await this.api.star({ id });
            case 'album':
                return await this.api.star({ albumId: id });
            case 'artist':
                return await this.api.star({ artistId: id });
        }
    }

    async unstar(id: string, type: 'track' | 'album' | 'artist') {
        switch (type) {
            case 'track':
                return await this.api.custom('unstar', { id });
            case 'album':
                return await this.api.custom('unstar', { albumId: id });
            case 'artist':
                return await this.api.custom('unstar', { artistId: id });
        }
    }

    private async getLyricsFromLRCLIB(song: Child): Promise<LyricsResult | undefined> {
        try {
            const params = new URLSearchParams({
                track_name: song.title || '',
                artist_name: song.artist!
            });

            if (song.album) params.append('album_name', song.album);
            if (song.duration) params.append('duration', Math.round(song.duration).toString());

            const response = await fetch(`https://lrclib.net/api/get?${params}`);

            if (!response.ok) {
                if (song.artist?.includes(',')) {
                    const artist = song.artist.split(',')[0];
                    return await this.getLyricsFromLRCLIB({ ...song, artist });
                }
                return undefined;
            };

            const data: LRCLIBResponse = await response.json();

            if (data.syncedLyrics) {
                const syncedLyrics = this.parseSyncedLyrics(data.syncedLyrics);
                return {
                    synced: true,
                    plain: data.plainLyrics,
                    lines: syncedLyrics
                };
            } else if (data.plainLyrics) {
                return {
                    synced: false,
                    plain: data.plainLyrics,
                    lines: []
                };
            }
        } catch (error) {
            console.error('LRCLIB fetch failed:', error);
        }
        return undefined;
    }

    async getLyrics(song: Child): Promise<LyricsResult | undefined> {
        try {
            const { lyrics } = await this.api.getLyrics({ artist: song.artist, title: song.title });
            if (lyrics?.value && lyrics.value.length > 1) {
                const syncedLyrics = this.parseSyncedLyrics(lyrics.value);
                if (syncedLyrics.length == 0) {
                    return await this.getLyricsFromLRCLIB(song);
                }
                return {
                    synced: syncedLyrics.length > 0,
                    plain: syncedLyrics.length > 0 ? syncedLyrics.map(l => l.text).join('\n') : lyrics.value,
                    lines: syncedLyrics
                };
            }
        } catch (error) {
            console.error('Subsonic lyrics fetch failed:', error);
        }

        return await this.getLyricsFromLRCLIB(song);
    }

    private parseSyncedLyrics(text: string): SyncedLyric[] {
        if (!text) return [];

        const lines = text.split('\n');
        const timeRegex = /\[(\d{2}):(\d{2})\.(\d{2,3})\]/;
        const syncedLyrics: SyncedLyric[] = [];

        for (const line of lines) {
            const match = timeRegex.exec(line);
            if (match) {
                const mins = parseInt(match[1]);
                const secs = parseInt(match[2]);
                const ms = parseInt(match[3]);
                const time = (mins * 60 + secs) + (ms / 1000);
                const text = line.replace(timeRegex, '').trim();
                if (text) {
                    syncedLyrics.push({ time, text });
                }
            }
        }

        return syncedLyrics.sort((a, b) => a.time - b.time);
    }
}