use discord_rich_presence::{activity, DiscordIpc, DiscordIpcClient};

pub struct DiscordClient {
    client: Option<DiscordIpcClient>,
    app_id: String,
    connected: bool,
}

impl DiscordClient {
    pub fn new() -> Self {
        Self {
            client: None,
            app_id: "1360628417254658159".to_string(),
            connected: false,
        }
    }

    pub fn initialize(&mut self) {
        self.app_id = "1360628417254658159".to_string();
    }

    pub fn shutdown(&mut self) {
        if let Some(client) = &mut self.client {
            let _ = client.close();
        }
        self.client = None;
        self.connected = false;
    }

    fn ensure_connected(&mut self, app_id: String) -> Result<(), String> {
        let needs_new_client = match &self.client {
            None => true,
            Some(_) if app_id != self.app_id => true,
            _ => false,
        };

        if needs_new_client {
            self.shutdown();
            self.app_id = app_id.clone();
            match DiscordIpcClient::new(&app_id) {
                Ok(client) => self.client = Some(client),
                Err(e) => return Err(format!("Failed to create Discord client: {}", e)),
            }
            self.connected = false;
        }

        if !self.connected {
            if let Some(client) = &mut self.client {
                if let Err(e) = client.connect() {
                    return Err(format!("Failed to connect to Discord: {}", e));
                }
                self.connected = true;
            }
        }

        Ok(())
    }

    fn parse_timestamp(time_str: &str) -> Option<i64> {
        time_str.parse::<i64>().ok()
    }

    pub fn update_presence(
        &mut self,
        app_id: Option<String>,
        details: Option<String>,
        state: Option<String>,
        large_image: Option<String>,
        small_image: Option<String>,
        start_time: Option<String>,
        end_time: Option<String>,
    ) -> Result<(), String> {
        let app_id_to_use = app_id.unwrap_or_else(|| self.app_id.clone());

        if let Err(e) = self.ensure_connected(app_id_to_use) {
            return Err(e);
        }

        let activity_builder = {
            if details.is_none() && state.is_none() {
                activity::Activity::new()
            } else {
                let mut builder =
                    activity::Activity::new().activity_type(activity::ActivityType::Listening);
                if let Some(details_text) = &details {
                    builder = builder.details(details_text);
                }

                if let Some(state_text) = &state {
                    builder = builder.state(state_text);
                }

                if large_image.is_some() || small_image.is_some() {
                    let mut assets_builder = activity::Assets::new();

                    if let Some(large_img) = &large_image {
                        assets_builder = assets_builder.large_image(large_img);
                    }

                    if let Some(small_img) = &small_image {
                        assets_builder = assets_builder.small_image(small_img);
                    }

                    builder = builder.assets(assets_builder);
                }

                if start_time.is_some() || end_time.is_some() {
                    let mut timestamps_builder = activity::Timestamps::new();

                    if let Some(start) = &start_time {
                        if let Some(timestamp) = Self::parse_timestamp(start) {
                            timestamps_builder = timestamps_builder.start(timestamp);
                        }
                    }

                    if let Some(end) = &end_time {
                        if let Some(timestamp) = Self::parse_timestamp(end) {
                            timestamps_builder = timestamps_builder.end(timestamp);
                        }
                    }

                    builder = builder.timestamps(timestamps_builder);
                }

                builder
            }
        };

        if let Some(client) = &mut self.client {
            match client.set_activity(activity_builder.clone()) {
                Ok(_) => Ok(()),
                Err(e) => {
                    if let Ok(client) = self.try_reconnect_client() {
                        client
                            .set_activity(activity_builder)
                            .map(|_| ())
                            .map_err(|e| format!("Failed to set activity after reconnect: {}", e))
                    } else {
                        Err(format!("Failed to set activity: {}", e))
                    }
                }
            }
        } else {
            Err("Discord client not initialized".into())
        }
    }

    fn try_reconnect_client(&mut self) -> Result<&mut DiscordIpcClient, String> {
        if let Some(client) = &mut self.client {
            match client.reconnect() {
                Ok(_) => {
                    self.connected = true;
                    Ok(client)
                }
                Err(e) => Err(format!("Failed to reconnect: {}", e)),
            }
        } else {
            Err("No client to reconnect".into())
        }
    }
}

impl Drop for DiscordClient {
    fn drop(&mut self) {
        self.shutdown();
    }
}
