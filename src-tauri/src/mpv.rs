use serde::{Deserialize, Serialize};
use std::io::{BufRead, BufReader, Write};
use std::process::{Child, Command, Stdio};
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::Duration;
use uuid::Uuid;

#[cfg(target_os = "windows")]
use named_pipe::PipeClient;
#[cfg(unix)]
use std::os::unix::net::UnixStream;
#[cfg(target_os = "windows")]
use std::os::windows::process::CommandExt;
#[cfg(unix)]
use std::path::Path;
#[cfg(target_os = "windows")]
const CREATE_NO_WINDOW: u32 = 0x08000000;

pub struct MpvPlayer {
    process: Option<Child>,
    status: Arc<Mutex<MpvStatus>>,
    ipc_thread: Option<thread::JoinHandle<()>>,
    ipc_path: Arc<Mutex<String>>,
    request_counter: Arc<Mutex<i32>>,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct MpvStatus {
    pub initialized: bool,
    pub position: f64,
    pub duration: f64,
    pub volume: f64,
    pub state: String,
    pub playlist_pos: i32,
    pub playlist_count: i32,
    pub media_title: Option<String>,
    pub playback_time: Option<f64>,
    pub pause: Option<bool>,
    pub chapter: Option<i32>,
    pub chapter_count: Option<i32>,
}

impl Default for MpvStatus {
    fn default() -> Self {
        Self {
            initialized: false,
            position: 0.0,
            duration: 0.0,
            volume: 1.0,
            state: "idle".to_string(),
            playlist_pos: -1,
            playlist_count: 0,
            media_title: None,
            playback_time: None,
            pause: None,
            chapter: None,
            chapter_count: None,
        }
    }
}

#[derive(Serialize, Deserialize)]
struct MpvCommand {
    command: Vec<serde_json::Value>,
    request_id: i32,
}

#[derive(Serialize, Deserialize, Debug)]
struct MpvResponse {
    request_id: Option<i32>,
    error: Option<String>,
    data: Option<serde_json::Value>,
    #[serde(rename = "event")]
    event_name: Option<String>,
}

#[derive(Serialize, Deserialize, Debug)]
struct MpvEvent {
    #[serde(rename = "name")]
    name: String,
    data: Option<serde_json::Value>,
}

impl MpvPlayer {
    pub fn new() -> Self {
        Self {
            process: None,
            status: Arc::new(Mutex::new(MpvStatus::default())),
            ipc_thread: None,
            ipc_path: Arc::new(Mutex::new(String::new())),
            request_counter: Arc::new(Mutex::new(1)),
        }
    }

    pub fn init(&mut self, custom_path: Option<String>) -> Result<bool, String> {
        if self.process.is_some() {
            return Ok(true);
        }

        let mpv_executable = if let Some(path) = custom_path {
            if path.trim().is_empty() {
                self.find_mpv_executable()?
            } else {
                path
            }
        } else {
            self.find_mpv_executable()?
        };

        let uuid = Uuid::new_v4().to_string();
        let socket_path = {
            #[cfg(target_os = "windows")]
            {
                format!("\\\\.\\pipe\\mpvsocket-{}", uuid)
            }
            #[cfg(any(target_os = "linux", target_os = "macos"))]
            {
                format!("/tmp/mpvsocket-{}", uuid)
            }
        };

        {
            let mut path = self.ipc_path.lock().unwrap();
            *path = socket_path.clone();
        }
        let mut command = Command::new(&mpv_executable);
        command.args([
            "--idle=yes",
            &format!("--input-ipc-server={}", socket_path),
            "--no-terminal",
            "--no-config",
            "--keep-open=yes",
            "--audio-display=no",
            "--ytdl=no",
            "--hr-seek=yes",
            "--osd-level=0",
            "--cache=yes",
            "--cache-secs=10",
            "--no-audio-display",
            "--gapless-audio=yes",
        ]);

        #[cfg(target_os = "windows")]
        {
            command.creation_flags(CREATE_NO_WINDOW);
        }

        let process = command
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .spawn()
            .map_err(|e| format!("Failed to start MPV: {}", e))?;

        thread::sleep(Duration::from_millis(500));

        let status_clone = Arc::clone(&self.status);
        let ipc_path_clone = Arc::clone(&self.ipc_path);
        let request_counter_clone = Arc::clone(&self.request_counter);

        let ipc_thread = thread::spawn(move || {
            Self::ipc_communication_loop(ipc_path_clone, status_clone, request_counter_clone);
        });

        self.process = Some(process);
        self.ipc_thread = Some(ipc_thread);

        {
            let mut status = self.status.lock().unwrap();
            status.initialized = true;
        }

        Ok(true)
    }

    fn find_mpv_executable(&self) -> Result<String, String> {
        #[cfg(target_os = "windows")]
        {
            let locations = vec![
                "mpv.exe",
                "C:\\Program Files\\mpv\\mpv.exe",
                "C:\\Program Files (x86)\\mpv\\mpv.exe",
            ];

            for location in locations {
                if std::path::Path::new(location).exists() {
                    return Ok(location.to_string());
                }
            }

            if let Ok(path) = which::which("mpv") {
                return Ok(path.to_string_lossy().to_string());
            }
        }

        #[cfg(target_os = "linux")]
        {
            if let Ok(path) = which::which("mpv") {
                return Ok(path.to_string_lossy().to_string());
            }
        }

        #[cfg(target_os = "macos")]
        {
            let locations = vec![
                "/usr/local/bin/mpv",
                "/opt/homebrew/bin/mpv",
                "/usr/bin/mpv",
            ];

            for location in locations {
                if std::path::Path::new(location).exists() {
                    return Ok(location.to_string());
                }
            }

            if let Ok(path) = which::which("mpv") {
                return Ok(path.to_string_lossy().to_string());
            }
        }

        Err("MPV executable not found. Please install MPV or provide a custom path.".to_string())
    }

    fn ipc_communication_loop(
        ipc_path: Arc<Mutex<String>>,
        status: Arc<Mutex<MpvStatus>>,
        request_counter: Arc<Mutex<i32>>,
    ) {
        let path = ipc_path.lock().unwrap().clone();
        let mut retry_count = 0;
        let max_retries = 50;

        while retry_count < max_retries {
            #[cfg(target_os = "windows")]
            {
                if let Ok(client) = PipeClient::connect(&path) {
                    drop(client);
                    break;
                }
            }

            #[cfg(unix)]
            {
                if Path::new(&path).exists() {
                    break;
                }
            }

            thread::sleep(Duration::from_millis(100));
            retry_count += 1;
        }

        if retry_count >= max_retries {
            eprintln!("Failed to connect to MPV socket after multiple retries");
            return;
        }

        #[cfg(target_os = "windows")]
        {
            if let Ok(mut client) = PipeClient::connect(&path) {
                let props = [
                    "time-pos",
                    "duration",
                    "pause",
                    "eof-reached",
                    "volume",
                    "playlist-pos",
                    "playlist-count",
                    "media-title",
                    "playback-time",
                    "chapter",
                    "chapter-list/count",
                    "metadata",
                    "filename",
                ];

                let request_id = {
                    let mut counter = request_counter.lock().unwrap();
                    *counter += 1;
                    *counter
                };

                let cmd = MpvCommand {
                    command: vec!["enable_event".into(), "all".into()],
                    request_id,
                };

                if let Ok(cmd_json) = serde_json::to_string(&cmd) {
                    let _ = writeln!(client, "{}", cmd_json);
                }

                for prop in props {
                    let request_id = {
                        let mut counter = request_counter.lock().unwrap();
                        *counter += 1;
                        *counter
                    };

                    let cmd = MpvCommand {
                        command: vec!["observe_property".into(), request_id.into(), prop.into()],
                        request_id,
                    };

                    if let Ok(cmd_json) = serde_json::to_string(&cmd) {
                        let _ = writeln!(client, "{}", cmd_json);
                    }
                }
            }
        }

        #[cfg(unix)]
        {
            if let Ok(mut stream) = UnixStream::connect(&path) {
                let props = [
                    "time-pos",
                    "duration",
                    "pause",
                    "eof-reached",
                    "volume",
                    "playlist-pos",
                    "playlist-count",
                    "media-title",
                    "playback-time",
                    "chapter",
                    "chapter-list/count",
                ];

                let request_id = {
                    let mut counter = request_counter.lock().unwrap();
                    *counter += 1;
                    *counter
                };

                let cmd = MpvCommand {
                    command: vec!["enable_event".into(), "all".into()],
                    request_id,
                };

                if let Ok(cmd_json) = serde_json::to_string(&cmd) {
                    let _ = writeln!(stream, "{}", cmd_json);
                }

                for prop in props {
                    let request_id = {
                        let mut counter = request_counter.lock().unwrap();
                        *counter += 1;
                        *counter
                    };

                    let cmd = MpvCommand {
                        command: vec!["observe_property".into(), request_id.into(), prop.into()],
                        request_id,
                    };

                    if let Ok(cmd_json) = serde_json::to_string(&cmd) {
                        let _ = writeln!(stream, "{}", cmd_json);
                    }
                }
            }
        }

        loop {
            #[cfg(target_os = "windows")]
            {
                if let Ok(client) = PipeClient::connect(&path) {
                    let reader = BufReader::new(client);
                    for line in reader.lines() {
                        if let Ok(line) = line {
                            if let Ok(response) = serde_json::from_str::<MpvResponse>(&line) {
                                Self::process_mpv_response(response, &status);
                            }
                        }
                    }
                } else {
                    Self::poll_properties(&path, &request_counter, &status);
                }
            }

            #[cfg(unix)]
            {
                if let Ok(stream) = UnixStream::connect(&path) {
                    let reader = BufReader::new(stream);
                    for line in reader.lines() {
                        if let Ok(line) = line {
                            if let Ok(response) = serde_json::from_str::<MpvResponse>(&line) {
                                Self::process_mpv_response(response, &status);
                            }
                        }
                    }
                } else {
                    Self::poll_properties(&path, &request_counter, &status);
                }
            }

            thread::sleep(Duration::from_millis(500));
        }
    }

    fn poll_properties(
        path: &str,
        request_counter: &Arc<Mutex<i32>>,
        status: &Arc<Mutex<MpvStatus>>,
    ) {
        if let Some(position) = Self::get_property_value::<f64>(path, request_counter, "time-pos") {
            let mut status_guard = status.lock().unwrap();
            status_guard.position = position;
        }

        if let Some(duration) = Self::get_property_value::<f64>(path, request_counter, "duration") {
            let mut status_guard = status.lock().unwrap();
            status_guard.duration = duration;
        }

        if let Some(paused) = Self::get_property_value::<bool>(path, request_counter, "pause") {
            let mut status_guard = status.lock().unwrap();
            status_guard.state = if paused {
                "paused".to_string()
            } else {
                "playing".to_string()
            };
        }

        if let Some(volume) = Self::get_property_value::<f64>(path, request_counter, "volume") {
            let mut status_guard = status.lock().unwrap();
            status_guard.volume = volume / 100.0;
        }
    }

    fn get_property_value<T: serde::de::DeserializeOwned>(
        path: &str,
        request_counter: &Arc<Mutex<i32>>,
        property: &str,
    ) -> Option<T> {
        let request_id = {
            let mut counter = request_counter.lock().unwrap();
            *counter += 1;
            *counter
        };

        let cmd = MpvCommand {
            command: vec!["get_property".into(), property.into()],
            request_id,
        };

        if let Ok(cmd_json) = serde_json::to_string(&cmd) {
            #[cfg(target_os = "windows")]
            {
                if let Ok(mut client) = PipeClient::connect(path) {
                    if writeln!(client, "{}", cmd_json).is_ok() {
                        let reader = BufReader::new(client);
                        for line in reader.lines().take(1) {
                            if let Ok(line) = line {
                                if let Ok(response) = serde_json::from_str::<MpvResponse>(&line) {
                                    if response.request_id == Some(request_id)
                                        && response.error.is_none()
                                    {
                                        if let Some(data) = response.data {
                                            return serde_json::from_value(data).ok();
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }

            #[cfg(unix)]
            {
                if let Ok(mut stream) = UnixStream::connect(path) {
                    if writeln!(stream, "{}", cmd_json).is_ok() {
                        let reader = BufReader::new(stream);
                        for line in reader.lines().take(1) {
                            if let Ok(line) = line {
                                if let Ok(response) = serde_json::from_str::<MpvResponse>(&line) {
                                    if response.request_id == Some(request_id)
                                        && response.error.is_none()
                                    {
                                        if let Some(data) = response.data {
                                            return serde_json::from_value(data).ok();
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }

        None
    }

    fn process_mpv_response(response: MpvResponse, status: &Arc<Mutex<MpvStatus>>) {
        if let Some(event_name) = &response.event_name {
            match event_name.as_str() {
                "property-change" => {
                    if let Some(data) = &response.data {
                        if let Ok(property_data) =
                            serde_json::from_value::<serde_json::Value>(data.clone())
                        {
                            let property_name = property_data.get("name").and_then(|v| v.as_str());
                            let property_value = property_data.get("data");

                            if let (Some(name), Some(value)) = (property_name, property_value) {
                                let mut status_guard = status.lock().unwrap();

                                match name {
                                    "time-pos" => {
                                        if let Some(pos) = value.as_f64() {
                                            status_guard.position = pos;
                                            status_guard.playback_time = Some(pos);
                                        }
                                    }
                                    "duration" => {
                                        if let Some(dur) = value.as_f64() {
                                            status_guard.duration = dur;
                                        }
                                    }
                                    "pause" => {
                                        if let Some(paused) = value.as_bool() {
                                            status_guard.pause = Some(paused);
                                            status_guard.state = if paused {
                                                "paused".to_string()
                                            } else {
                                                "playing".to_string()
                                            };
                                        }
                                    }
                                    "eof-reached" => {
                                        if let Some(eof) = value.as_bool() {
                                            if eof {
                                                status_guard.state = "ended".to_string();
                                            }
                                        }
                                    }
                                    "volume" => {
                                        if let Some(vol) = value.as_f64() {
                                            status_guard.volume = vol / 100.0;
                                        }
                                    }
                                    "playlist-pos" => {
                                        if let Some(pos) = value.as_i64() {
                                            status_guard.playlist_pos = pos as i32;
                                        }
                                    }
                                    "playlist-count" => {
                                        if let Some(count) = value.as_i64() {
                                            status_guard.playlist_count = count as i32;
                                        }
                                    }
                                    "media-title" => {
                                        if let Some(title) = value.as_str() {
                                            status_guard.media_title = Some(title.to_string());
                                        }
                                    }
                                    "playback-time" => {
                                        if let Some(time) = value.as_f64() {
                                            status_guard.playback_time = Some(time);
                                        }
                                    }
                                    "chapter" => {
                                        if let Some(chapter) = value.as_i64() {
                                            status_guard.chapter = Some(chapter as i32);
                                        }
                                    }
                                    "chapter-list/count" => {
                                        if let Some(count) = value.as_i64() {
                                            status_guard.chapter_count = Some(count as i32);
                                        }
                                    }
                                    _ => {
                                        println!("Unhandled property: {}", name);
                                    }
                                }
                            }
                        }
                    }
                }
                "playback-restart" => {
                    let mut status_guard = status.lock().unwrap();
                    status_guard.state = "playing".to_string();
                }
                "seek" => {
                    if let Some(data) = &response.data {
                        let position = if let Some(target) =
                            data.get("target").and_then(|v| v.as_f64())
                        {
                            Some(target)
                        } else if let Some(pos) = data.get("position").and_then(|v| v.as_f64()) {
                            Some(pos)
                        } else if let Some(pos) = data.as_f64() {
                            Some(pos)
                        } else {
                            None
                        };

                        if let Some(pos) = position {
                            let mut status_guard = status.lock().unwrap();
                            status_guard.position = pos;
                            status_guard.playback_time = Some(pos);
                        }
                    }
                }
                "end-file" => {
                    if let Some(data) = &response.data {
                        if let Some(reason) = data.get("reason").and_then(|v| v.as_str()) {
                            let mut status_guard = status.lock().unwrap();
                            match reason {
                                "eof" => status_guard.state = "ended".to_string(),
                                "stop" => status_guard.state = "stopped".to_string(),
                                "quit" => status_guard.state = "idle".to_string(),
                                "error" => status_guard.state = "error".to_string(),
                                _ => {}
                            }
                        }
                    }
                }
                _ => {}
            }
        } else if let Some(_request_id) = &response.request_id {
            if let Some(data) = &response.data {
                if let Some(position) = data.as_f64() {
                    let mut status_guard = status.lock().unwrap();

                    if position > 10.0 && (position - position.round()).abs() < 0.01 {
                        status_guard.duration = position;
                    } else {
                        status_guard.position = position;
                    }
                } else if let Some(paused) = data.as_bool() {
                    let mut status_guard = status.lock().unwrap();
                    status_guard.state = if paused {
                        "paused".to_string()
                    } else {
                        "playing".to_string()
                    };
                }
            }
        }
    }

    fn send_command(&self, command: Vec<serde_json::Value>) -> Result<(), String> {
        let path = self.ipc_path.lock().unwrap().clone();

        if path.is_empty() {
            return Err("MPV IPC path not initialized".to_string());
        }

        let request_id = {
            let mut counter = self.request_counter.lock().unwrap();
            *counter += 1;
            *counter
        };

        let cmd = MpvCommand {
            command,
            request_id,
        };

        let cmd_json = serde_json::to_string(&cmd)
            .map_err(|e| format!("Failed to serialize command: {}", e))?;

        #[cfg(target_os = "windows")]
        {
            let mut client = PipeClient::connect(&path)
                .map_err(|e| format!("Failed to connect to MPV pipe: {}", e))?;

            writeln!(client, "{}", cmd_json)
                .map_err(|e| format!("Failed to send command to MPV: {}", e))?;
        }

        #[cfg(unix)]
        {
            let mut stream = UnixStream::connect(&path)
                .map_err(|e| format!("Failed to connect to MPV socket: {}", e))?;

            writeln!(stream, "{}", cmd_json)
                .map_err(|e| format!("Failed to send command to MPV: {}", e))?;
        }

        Ok(())
    }

    pub fn get_status(&self) -> MpvStatus {
        let status = self.status.lock().unwrap().clone();
        if !status.initialized {
            return status;
        }

        let path = self.ipc_path.lock().unwrap().clone();
        if path.is_empty() {
            return status;
        }

        use std::cell::RefCell;
        thread_local! {
            static LAST_POLL: RefCell<std::time::Instant> = RefCell::new(std::time::Instant::now());
            static CACHED_STATUS: RefCell<Option<MpvStatus>> = RefCell::new(None);
        }

        let now = std::time::Instant::now();
        let should_update = LAST_POLL.with(|last| {
            let last_poll = *last.borrow();
            let should_poll = now.duration_since(last_poll).as_millis() >= 100;
            if should_poll {
                *last.borrow_mut() = now;
            }
            should_poll
        });

        let cached = CACHED_STATUS.with(|cache| cache.borrow().clone());
        if !should_update && cached.is_some() {
            return cached.unwrap();
        }

        let mut updated_status = status.clone();
        let properties_to_fetch = [
            ("playback-time", 1001),
            ("duration", 1002),
            ("media-title", 1003),
            ("pause", 1004),
            ("chapter", 1005),
            ("chapter-list/count", 1006),
            ("playlist-pos", 1007),
            ("playlist-count", 1008),
        ];

        #[cfg(target_os = "windows")]
        {
            if let Ok(mut client) = PipeClient::connect(&path) {
                let mut batch_cmd = String::new();
                for (prop, id) in &properties_to_fetch {
                    batch_cmd.push_str(&format!(
                        "{{\"command\": [\"get_property\", \"{}\"], \"request_id\": {}}}\n",
                        prop, id
                    ));
                }

                if writeln!(client, "{}", batch_cmd.trim()).is_ok() {
                    let reader = BufReader::new(client);
                    for line in reader.lines().take(properties_to_fetch.len()) {
                        if let Ok(line) = line {
                            if let Ok(json) = serde_json::from_str::<serde_json::Value>(&line) {
                                if let Some(request_id) =
                                    json.get("request_id").and_then(|id| id.as_i64())
                                {
                                    match request_id {
                                        1001 => {
                                            if let Some(data) = json.get("data") {
                                                if let Some(time) = data.as_f64() {
                                                    updated_status.position = time;
                                                    updated_status.playback_time = Some(time);
                                                }
                                            }
                                        }
                                        1002 => {
                                            if let Some(data) = json.get("data") {
                                                if let Some(duration) = data.as_f64() {
                                                    updated_status.duration = duration;
                                                }
                                            }
                                        }
                                        1003 => {
                                            if let Some(data) = json.get("data") {
                                                if let Some(title) = data.as_str() {
                                                    updated_status.media_title =
                                                        Some(title.to_string());
                                                }
                                            }
                                        }
                                        1004 => {
                                            if let Some(data) = json.get("data") {
                                                if let Some(paused) = data.as_bool() {
                                                    updated_status.pause = Some(paused);
                                                    updated_status.state = if paused {
                                                        "paused".to_string()
                                                    } else {
                                                        "playing".to_string()
                                                    };
                                                }
                                            }
                                        }
                                        1005 => {
                                            if let Some(data) = json.get("data") {
                                                if let Some(chapter) = data.as_i64() {
                                                    updated_status.chapter = Some(chapter as i32);
                                                }
                                            }
                                        }
                                        1006 => {
                                            if let Some(data) = json.get("data") {
                                                if let Some(count) = data.as_i64() {
                                                    updated_status.chapter_count =
                                                        Some(count as i32);
                                                }
                                            }
                                        }
                                        1007 => {
                                            if let Some(data) = json.get("data") {
                                                if let Some(pos) = data.as_i64() {
                                                    updated_status.playlist_pos = pos.max(0) as i32;
                                                }
                                            }
                                        }
                                        1008 => {
                                            if let Some(data) = json.get("data") {
                                                if let Some(count) = data.as_i64() {
                                                    updated_status.playlist_count = count as i32;
                                                }
                                            }
                                        }
                                        _ => {}
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
        {
            let mut current_status = self.status.lock().unwrap();
            current_status.position = updated_status.position;
            current_status.duration = updated_status.duration;
            current_status.playback_time = updated_status.playback_time;
            current_status.media_title = updated_status.media_title;
            current_status.pause = updated_status.pause;
            current_status.chapter = updated_status.chapter;
            current_status.chapter_count = updated_status.chapter_count;
            current_status.state = updated_status.state;
            if updated_status.playlist_pos >= 0 {
                current_status.playlist_pos = updated_status.playlist_pos;
            } else if current_status.playlist_count > 0 {
                current_status.playlist_pos = 0;
            }

            current_status.playlist_count = updated_status.playlist_count;

            updated_status = current_status.clone();
        }

        CACHED_STATUS.with(|cache| {
            *cache.borrow_mut() = Some(updated_status.clone());
        });

        updated_status
    }

    pub fn load(&mut self, url: &str) -> Result<(), String> {
        let command = vec!["loadfile".into(), url.into(), "replace".into()];
        self.send_command(command)?;

        {
            let mut status = self.status.lock().unwrap();
            status.state = "idle".to_string();
            status.position = 0.0;
        }

        Ok(())
    }

    pub fn load_playlist(&mut self, urls: Vec<String>) -> Result<(), String> {
        let command = vec!["playlist-clear".into()];
        self.send_command(command)?;

        for url in &urls {
            let command = vec!["loadfile".into(), url.as_str().into(), "append".into()];
            self.send_command(command)?;
        }
        {
            let mut status = self.status.lock().unwrap();
            status.state = "idle".to_string();
            status.position = 0.0;
        }

        let request_id = {
            let mut counter = self.request_counter.lock().unwrap();
            *counter += 1;
            *counter
        };

        let cmd = MpvCommand {
            command: vec![
                "observe_property".into(),
                request_id.into(),
                "playlist-pos".into(),
            ],
            request_id,
        };

        let path = self.ipc_path.lock().unwrap().clone();

        #[cfg(target_os = "windows")]
        {
            if let Ok(mut client) = PipeClient::connect(&path) {
                if let Ok(cmd_json) = serde_json::to_string(&cmd) {
                    let _ = writeln!(client, "{}", cmd_json);
                }
            }
        }

        #[cfg(unix)]
        {
            if let Ok(mut stream) = UnixStream::connect(&path) {
                if let Ok(cmd_json) = serde_json::to_string(&cmd) {
                    let _ = writeln!(stream, "{}", cmd_json);
                }
            }
        }

        Ok(())
    }

    pub fn load_playlist_optimized(&mut self, urls: Vec<String>) -> Result<(), String> {
        self.stop()?;

        self.send_command(vec!["playlist-clear".into()])?;

        thread::sleep(Duration::from_millis(50));

        let status_before = self.get_status();
        if status_before.playlist_count > 0 {
            println!("Warning: Playlist wasn't cleared properly, forcing a restart");

            self.send_command(vec!["quit".into()])?;
            thread::sleep(Duration::from_millis(100));

            self.init(None)?;
            thread::sleep(Duration::from_millis(100));
        }

        println!("Loading playlist with {} tracks", urls.len());

        if let Some(first_url) = urls.get(0) {
            let command = vec![
                "loadfile".into(),
                first_url.as_str().into(),
                "replace".into(),
            ];
            self.send_command(command)?;

            thread::sleep(Duration::from_millis(50));

            self.send_command(vec!["set_property".into(), "playlist-pos".into(), 0.into()])?;
        }

        for (i, url) in urls.iter().skip(1).enumerate() {
            let command = vec!["loadfile".into(), url.as_str().into(), "append".into()];
            self.send_command(command)?;

            if i % 10 == 0 {
                thread::sleep(Duration::from_millis(10));
            }
        }

        thread::sleep(Duration::from_millis(150));
        let status_after = self.get_status();
        println!("Playlist loaded with {} items", status_after.playlist_count);

        if status_after.playlist_count != urls.len() as i32 {
            println!(
                "Warning: Playlist count mismatch - expected {}, got {}",
                urls.len(),
                status_after.playlist_count
            );
        }

        let request_id = {
            let mut counter = self.request_counter.lock().unwrap();
            *counter += 1;
            *counter
        };

        let cmd = MpvCommand {
            command: vec![
                "observe_property".into(),
                request_id.into(),
                "playlist-pos".into(),
            ],
            request_id,
        };

        let path = self.ipc_path.lock().unwrap().clone();

        #[cfg(target_os = "windows")]
        {
            if let Ok(mut client) = PipeClient::connect(&path) {
                if let Ok(cmd_json) = serde_json::to_string(&cmd) {
                    let _ = writeln!(client, "{}", cmd_json);
                }
            }
        }

        #[cfg(unix)]
        {
            if let Ok(mut stream) = UnixStream::connect(&path) {
                if let Ok(cmd_json) = serde_json::to_string(&cmd) {
                    let _ = writeln!(stream, "{}", cmd_json);
                }
            }
        }

        {
            let mut status = self.status.lock().unwrap();
            status.state = "idle".to_string();
            status.position = 0.0;
            status.playlist_count = urls.len() as i32;
            status.playlist_pos = 0;
        }

        Ok(())
    }

    pub fn playlist_next(&mut self) -> Result<(), String> {
        let command = vec!["playlist-next".into(), "weak".into()];
        self.send_command(command)
    }

    pub fn playlist_prev(&mut self) -> Result<(), String> {
        let command = vec!["playlist-prev".into(), "weak".into()];
        self.send_command(command)
    }

    pub fn playlist_play_index(&mut self, index: usize) -> Result<(), String> {
        let command = vec!["set_property".into(), "playlist-pos".into(), index.into()];
        self.send_command(command)
    }

    pub fn set_playlist_position(&mut self, index: usize) -> Result<(), String> {
        let command = vec!["playlist-play-index".into(), index.into()];
        self.send_command(command)
    }

    pub fn playlist_jump_to_index(&mut self, index: usize) -> Result<(), String> {
        let status = self.get_status();

        if status.playlist_count <= 0 {
            return Err("Playlist is empty".to_string());
        }

        if index as i32 >= status.playlist_count {
            return Err(format!(
                "Index {} out of range, playlist has {} items",
                index, status.playlist_count
            ));
        }

        let command = vec![
            "set_property".into(),
            "playlist-pos".into(),
            (index as i64).into(),
        ];

        let result = self.send_command(command);

        thread::sleep(Duration::from_millis(20));

        {
            let mut status = self.status.lock().unwrap();
            status.playlist_pos = index as i32;
        }

        result
    }

    pub fn play(&mut self) -> Result<(), String> {
        let command = vec!["set_property".into(), "pause".into(), false.into()];
        self.send_command(command)?;

        {
            let mut status = self.status.lock().unwrap();
            status.state = "playing".to_string();
            status.pause = Some(false);
        }

        Ok(())
    }

    pub fn pause(&mut self) -> Result<(), String> {
        let command = vec!["set_property".into(), "pause".into(), true.into()];
        self.send_command(command)?;

        {
            let mut status = self.status.lock().unwrap();
            status.state = "paused".to_string();
            status.pause = Some(true);
        }

        Ok(())
    }

    pub fn stop(&mut self) -> Result<(), String> {
        let command = vec!["stop".into()];
        self.send_command(command)?;

        {
            let mut status = self.status.lock().unwrap();
            status.state = "idle".to_string();
            status.position = 0.0;
        }

        Ok(())
    }

    pub fn seek(&mut self, position: f64) -> Result<(), String> {
        let command = vec!["seek".into(), position.into(), "absolute+exact".into()];
        self.send_command(command)?;

        {
            let mut status = self.status.lock().unwrap();
            status.position = position;
        }

        Ok(())
    }

    pub fn set_volume(&mut self, volume: f64) -> Result<(), String> {
        let mpv_volume = volume * 100.0;
        let command = vec!["set_property".into(), "volume".into(), mpv_volume.into()];
        self.send_command(command)?;

        {
            let mut status = self.status.lock().unwrap();
            status.volume = volume;
        }

        Ok(())
    }

    pub fn shutdown(&mut self) {
        let _ = self.send_command(vec!["quit".into()]);
        thread::sleep(Duration::from_millis(100));

        if let Some(mut process) = self.process.take() {
            let _ = process.kill();
            let _ = process.wait();
        }

        #[cfg(unix)]
        {
            let path = self.ipc_path.lock().unwrap().clone();
            if !path.is_empty() {
                let _ = std::fs::remove_file(&path);
            }
        }

        self.ipc_thread = None;

        let mut status = self.status.lock().unwrap();
        *status = MpvStatus::default();
    }
}

impl Drop for MpvPlayer {
    fn drop(&mut self) {
        self.shutdown();
    }
}
