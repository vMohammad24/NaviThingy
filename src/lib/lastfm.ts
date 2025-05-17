


export async function getAlbumInfo(album: string, artist: string, apiKey: string): Promise<any> {
    const url = `https://ws.audioscrobbler.com/2.0/?method=album.getinfo&api_key=${apiKey}&artist=${encodeURIComponent(artist)}&album=${encodeURIComponent(album)}&format=json`;
    const response = await fetch(url);
    if (!response.ok) {
        throw new Error(`Error fetching album info: ${response.statusText}`);
    }
    return response.json();
}