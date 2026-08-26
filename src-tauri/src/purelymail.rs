use serde::{Deserialize, Serialize};

const PURELYMAIL_API_BASE: &str = "https://purelymail.com";

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DomainDnsSummary {
    pub passes_mx: Option<bool>,
    pub passes_spf: Option<bool>,
    pub passes_dkim: Option<bool>,
    pub passes_dmarc: Option<bool>,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DomainInfo {
    pub name: String,
    pub allow_account_reset: Option<bool>,
    pub symbolic_subaddressing: Option<bool>,
    pub is_shared: Option<bool>,
    pub dns_summary: Option<DomainDnsSummary>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ListDomainsResult {
    pub domains: Vec<DomainInfo>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CheckCreditResult {
    pub credit: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ListUsersResult {
    pub users: Vec<String>,
}

#[derive(Debug, Deserialize)]
#[allow(dead_code)]
struct ApiResponse<T> {
    result: Option<T>,
    code: Option<String>,
    message: Option<String>,
    #[serde(rename = "type")]
    msg_type: Option<String>,
    status: Option<String>,
}

fn create_client() -> reqwest::Client {
    reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(15))
        .build()
        .unwrap_or_default()
}

pub async fn list_domains(token: &str, include_shared: bool) -> Result<Vec<DomainInfo>, String> {
    let client = create_client();
    let url = format!("{}/api/v0/listDomains", PURELYMAIL_API_BASE);

    let res = client
        .post(&url)
        .header("Purelymail-Api-Token", token.trim())
        .json(&serde_json::json!({
            "includeShared": include_shared
        }))
        .send()
        .await
        .map_err(|e| format!("Network request failed: {}", e))?;

    let text = res
        .text()
        .await
        .map_err(|e| format!("Failed to read response: {}", e))?;

    let parsed: ApiResponse<ListDomainsResult> = serde_json::from_str(&text)
        .map_err(|e| format!("Failed to parse response: {} (Body: {})", e, text))?;

    if let Some(result) = parsed.result {
        Ok(result.domains)
    } else {
        Err(parsed
            .message
            .unwrap_or_else(|| parsed.code.unwrap_or_else(|| "Unknown API error".into())))
    }
}

pub async fn check_credit(token: &str) -> Result<String, String> {
    let client = create_client();
    let url = format!("{}/api/v0/checkAccountCredit", PURELYMAIL_API_BASE);

    let res = client
        .post(&url)
        .header("Purelymail-Api-Token", token.trim())
        .json(&serde_json::json!({}))
        .send()
        .await
        .map_err(|e| format!("Network request failed: {}", e))?;

    let text = res
        .text()
        .await
        .map_err(|e| format!("Failed to read response: {}", e))?;

    let parsed: ApiResponse<CheckCreditResult> = serde_json::from_str(&text)
        .map_err(|e| format!("Failed to parse response: {} (Body: {})", e, text))?;

    if let Some(result) = parsed.result {
        Ok(result.credit)
    } else {
        Err(parsed
            .message
            .unwrap_or_else(|| parsed.code.unwrap_or_else(|| "Unknown API error".into())))
    }
}

pub async fn list_users(token: &str) -> Result<Vec<String>, String> {
    let client = create_client();
    let url = format!("{}/api/v0/listUser", PURELYMAIL_API_BASE);

    let res = client
        .post(&url)
        .header("Purelymail-Api-Token", token.trim())
        .json(&serde_json::json!({}))
        .send()
        .await
        .map_err(|e| format!("Network request failed: {}", e))?;

    let text = res
        .text()
        .await
        .map_err(|e| format!("Failed to read response: {}", e))?;

    let parsed: ApiResponse<ListUsersResult> = serde_json::from_str(&text)
        .map_err(|e| format!("Failed to parse response: {} (Body: {})", e, text))?;

    if let Some(result) = parsed.result {
        Ok(result.users)
    } else {
        Err(parsed
            .message
            .unwrap_or_else(|| parsed.code.unwrap_or_else(|| "Unknown API error".into())))
    }
}

pub async fn create_user(
    token: &str,
    username: &str,
    domain: &str,
    password: &str,
) -> Result<String, String> {
    let client = create_client();
    let url = format!("{}/api/v0/createUser", PURELYMAIL_API_BASE);

    let res = client
        .post(&url)
        .header("Purelymail-Api-Token", token.trim())
        .json(&serde_json::json!({
            "userName": username.trim(),
            "domainName": domain.trim(),
            "password": password,
            "enablePasswordReset": false,
            "enableSearchIndexing": false,
            "sendWelcomeEmail": false
        }))
        .send()
        .await
        .map_err(|e| format!("Network request failed: {}", e))?;

    let text = res
        .text()
        .await
        .map_err(|e| format!("Failed to read response: {}", e))?;

    let parsed: ApiResponse<serde_json::Value> = serde_json::from_str(&text)
        .map_err(|e| format!("Failed to parse response: {} (Body: {})", e, text))?;

    if parsed.result.is_some() {
        Ok(format!("{}@{}", username.trim(), domain.trim()))
    } else {
        Err(parsed
            .message
            .unwrap_or_else(|| parsed.code.unwrap_or_else(|| "Failed to create user".into())))
    }
}

pub async fn delete_user(token: &str, full_username: &str) -> Result<(), String> {
    let client = create_client();
    let url = format!("{}/api/v0/deleteUser", PURELYMAIL_API_BASE);

    let res = client
        .post(&url)
        .header("Purelymail-Api-Token", token.trim())
        .json(&serde_json::json!({
            "userName": full_username.trim()
        }))
        .send()
        .await
        .map_err(|e| format!("Network request failed: {}", e))?;

    let text = res
        .text()
        .await
        .map_err(|e| format!("Failed to read response: {}", e))?;

    let parsed: ApiResponse<serde_json::Value> = serde_json::from_str(&text)
        .map_err(|e| format!("Failed to parse response: {} (Body: {})", e, text))?;

    if parsed.msg_type.as_deref() == Some("error") {
        return Err(parsed
            .message
            .unwrap_or_else(|| parsed.code.unwrap_or_else(|| "Failed to delete user".into())));
    }

    if parsed.code.is_some() && parsed.result.is_none() {
        return Err(parsed
            .message
            .unwrap_or_else(|| parsed.code.unwrap_or_else(|| "Failed to delete user".into())));
    }

    Ok(())
}
