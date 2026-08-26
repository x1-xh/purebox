mod imap_client;
mod purelymail;
mod smtp_client;

use rand::Rng;
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GeneratedCredentials {
    pub username: String,
    pub domain: String,
    pub email: String,
    pub password: String,
}

fn generate_random_string(len: usize) -> String {
    const CHARSET: &[u8] = b"abcdefghjkmnpqrstuvwxyz23456789";
    let mut rng = rand::thread_rng();
    (0..len)
        .map(|_| {
            let idx = rng.gen_range(0..CHARSET.len());
            CHARSET[idx] as char
        })
        .collect()
}

fn generate_secure_password() -> String {
    const CHARS: &[u8] = b"abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789!@#$%^&*";
    let mut rng = rand::thread_rng();
    (0..18)
        .map(|_| {
            let idx = rng.gen_range(0..CHARS.len());
            CHARS[idx] as char
        })
        .collect()
}

#[tauri::command]
fn generate_credentials(
    custom_prefix: Option<String>,
    domain: String,
) -> Result<GeneratedCredentials, String> {
    let adjectives = [
        "swift", "silent", "cool", "quick", "bright", "bold", "frost", "neon", "amber", "vivid",
        "nova", "shadow", "cyber", "cosmic", "solar", "lunar", "wild", "prime", "zen", "cloud",
    ];
    let nouns = [
        "fox", "hawk", "wolf", "otter", "badger", "panda", "falcon", "tiger", "lynx", "orca",
        "echo", "drift", "spark", "pulse", "orbit", "flare", "wave", "breeze", "nexus", "stream",
    ];

    let mut rng = rand::thread_rng();
    let prefix = match custom_prefix.filter(|p| !p.trim().is_empty()) {
        Some(p) => {
            let clean_p: String = p
                .trim()
                .to_lowercase()
                .chars()
                .filter(|c| c.is_ascii_alphanumeric())
                .collect();
            let base = if clean_p.is_empty() { "temp".to_string() } else { clean_p };
            format!("{}{}", base, generate_random_string(4))
        }
        None => {
            let adj = adjectives[rng.gen_range(0..adjectives.len())];
            let noun = nouns[rng.gen_range(0..nouns.len())];
            let rand_num = rng.gen_range(10..99);
            format!("{}{}{}", adj, noun, rand_num)
        }
    };

    let password = generate_secure_password();
    let email = format!("{}@{}", prefix, domain.trim());

    Ok(GeneratedCredentials {
        username: prefix,
        domain: domain.trim().to_string(),
        email,
        password,
    })
}

#[tauri::command]
async fn purelymail_list_domains(
    api_token: String,
    include_shared: Option<bool>,
) -> Result<Vec<purelymail::DomainInfo>, String> {
    purelymail::list_domains(&api_token, include_shared.unwrap_or(false)).await
}

#[tauri::command]
async fn purelymail_check_credit(api_token: String) -> Result<String, String> {
    purelymail::check_credit(&api_token).await
}

#[tauri::command]
async fn purelymail_list_users(api_token: String) -> Result<Vec<String>, String> {
    purelymail::list_users(&api_token).await
}

#[tauri::command]
async fn purelymail_create_user(
    api_token: String,
    username: String,
    domain: String,
    password: String,
) -> Result<String, String> {
    purelymail::create_user(&api_token, &username, &domain, &password).await
}

#[tauri::command]
async fn purelymail_delete_user(api_token: String, full_username: String) -> Result<(), String> {
    purelymail::delete_user(&api_token, &full_username).await
}

#[tauri::command]
async fn fetch_inbox(
    email: String,
    password: String,
    limit: Option<usize>,
) -> Result<Vec<imap_client::EmailSummary>, String> {
    tokio::task::spawn_blocking(move || {
        imap_client::fetch_inbox_sync(&email, &password, limit.unwrap_or(40))
    })
    .await
    .map_err(|e| format!("Task join error: {}", e))?
}

#[tauri::command]
async fn delete_email(email: String, password: String, uid: u32) -> Result<(), String> {
    tokio::task::spawn_blocking(move || imap_client::delete_email_sync(&email, &password, uid))
        .await
        .map_err(|e| format!("Task join error: {}", e))?
}

#[tauri::command]
async fn mark_email_read(
    email: String,
    password: String,
    uid: u32,
    read: bool,
) -> Result<(), String> {
    tokio::task::spawn_blocking(move || {
        imap_client::mark_read_sync(&email, &password, uid, read)
    })
    .await
    .map_err(|e| format!("Task join error: {}", e))?
}

#[tauri::command]
async fn send_email(
    from_email: String,
    password: String,
    to_email: String,
    subject: String,
    body_text: String,
    body_html: Option<String>,
) -> Result<(), String> {
    tokio::task::spawn_blocking(move || {
        smtp_client::send_email_sync(
            &from_email,
            &password,
            &to_email,
            &subject,
            &body_text,
            body_html.as_deref(),
        )
    })
    .await
    .map_err(|e| format!("Task join error: {}", e))?
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .invoke_handler(tauri::generate_handler![
            generate_credentials,
            purelymail_list_domains,
            purelymail_check_credit,
            purelymail_list_users,
            purelymail_create_user,
            purelymail_delete_user,
            fetch_inbox,
            delete_email,
            mark_email_read,
            send_email
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_generate_credentials_random() {
        let creds = generate_credentials(None, "example.com".to_string()).unwrap();
        assert!(creds.email.ends_with("@example.com"));
        assert!(!creds.username.is_empty());
        assert!(creds.password.len() >= 16);
    }

    #[test]
    fn test_generate_credentials_custom_prefix() {
        let creds = generate_credentials(Some("tempuser".to_string()), "mydomain.org".to_string()).unwrap();
        assert!(creds.email.starts_with("tempuser"));
        assert!(creds.email.ends_with("@mydomain.org"));
        assert!(!creds.username.contains('.'));
        assert_eq!(creds.domain, "mydomain.org");
    }
}

