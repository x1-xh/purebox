use mailparse::{parse_mail, ParsedMail};
use native_tls::TlsConnector;
use serde::{Deserialize, Serialize};

const IMAP_HOST: &str = "imap.purelymail.com";
const IMAP_PORT: u16 = 993;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EmailAttachment {
    pub filename: String,
    pub mime_type: String,
    pub size_bytes: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EmailSummary {
    pub uid: u32,
    pub message_id: String,
    pub subject: String,
    pub from: String,
    pub to: String,
    pub date: String,
    pub timestamp: i64,
    pub is_read: bool,
    pub body_plain: String,
    pub body_html: String,
    pub snippet: String,
    pub attachments: Vec<EmailAttachment>,
}

fn extract_body_parts(
    mail: &ParsedMail,
    plain: &mut String,
    html: &mut String,
    attachments: &mut Vec<EmailAttachment>,
) {
    let c_type = mail.ctype.mimetype.to_lowercase();
    let disposition = mail.get_content_disposition();

    let is_attachment = disposition.disposition == mailparse::DispositionType::Attachment
        || disposition.params.contains_key("filename")
        || mail.ctype.params.contains_key("name");

    if is_attachment {
        let filename = disposition
            .params
            .get("filename")
            .cloned()
            .or_else(|| mail.ctype.params.get("name").cloned())
            .unwrap_or_else(|| "attachment".to_string());

        let size = mail.get_body_raw().map(|b| b.len()).unwrap_or(0);
        attachments.push(EmailAttachment {
            filename,
            mime_type: c_type,
            size_bytes: size,
        });
        return;
    }

    if c_type == "text/plain" {
        if let Ok(body) = mail.get_body() {
            if !body.trim().is_empty() {
                plain.push_str(&body);
                plain.push('\n');
            }
        }
    } else if c_type == "text/html" {
        if let Ok(body) = mail.get_body() {
            if !body.trim().is_empty() {
                html.push_str(&body);
            }
        }
    }

    for subpart in &mail.subparts {
        extract_body_parts(subpart, plain, html, attachments);
    }
}

fn parse_email_message(uid: u32, raw_bytes: &[u8], is_seen: bool) -> Result<EmailSummary, String> {
    let parsed = parse_mail(raw_bytes).map_err(|e| format!("Mailparse error: {}", e))?;

    let headers = &parsed.headers;

    let mut subject = String::new();
    let mut from = String::new();
    let mut to = String::new();
    let mut date_str = String::new();
    let mut message_id = String::new();

    for header in headers {
        let name = header.get_key().to_lowercase();
        let val = header.get_value();
        match name.as_str() {
            "subject" => subject = val,
            "from" => from = val,
            "to" => to = val,
            "date" => date_str = val,
            "message-id" => message_id = val,
            _ => {}
        }
    }

    let mut body_plain = String::new();
    let mut body_html = String::new();
    let mut attachments = Vec::new();

    extract_body_parts(&parsed, &mut body_plain, &mut body_html, &mut attachments);

    // If no plain body but HTML is available, generate plain text fallback
    if body_plain.trim().is_empty() && !body_html.is_empty() {
        let cleaned = body_html
            .replace("<br>", "\n")
            .replace("<br/>", "\n")
            .replace("<br />", "\n")
            .replace("</p>", "\n\n");
        let stripped: String = cleaned
            .split('<')
            .enumerate()
            .map(|(i, s)| {
                if i == 0 {
                    s
                } else if let Some(idx) = s.find('>') {
                    &s[idx + 1..]
                } else {
                    ""
                }
            })
            .collect();
        body_plain = stripped.trim().to_string();
    }

    let snippet = if !body_plain.trim().is_empty() {
        let trimmed: String = body_plain
            .lines()
            .map(|l| l.trim())
            .filter(|l| !l.is_empty())
            .collect::<Vec<&str>>()
            .join(" ");
        if trimmed.chars().count() > 140 {
            let s: String = trimmed.chars().take(140).collect();
            format!("{}...", s)
        } else {
            trimmed
        }
    } else {
        "(No content)".to_string()
    };

    let timestamp = chrono::DateTime::parse_from_rfc2822(&date_str)
        .map(|dt| dt.timestamp())
        .unwrap_or_else(|_| chrono::Utc::now().timestamp());

    let formatted_date = if !date_str.is_empty() {
        date_str
    } else {
        chrono::Utc::now().to_rfc2822()
    };

    if subject.is_empty() {
        subject = "(No Subject)".to_string();
    }

    Ok(EmailSummary {
        uid,
        message_id,
        subject,
        from,
        to,
        date: formatted_date,
        timestamp,
        is_read: is_seen,
        body_plain,
        body_html,
        snippet,
        attachments,
    })
}

pub fn fetch_inbox_sync(
    email: &str,
    password: &str,
    limit: usize,
) -> Result<Vec<EmailSummary>, String> {
    let tls = TlsConnector::builder()
        .build()
        .map_err(|e| format!("TLS init error: {}", e))?;

    let client = imap::connect((IMAP_HOST, IMAP_PORT), IMAP_HOST, &tls)
        .map_err(|e| format!("Could not connect to IMAP server {}:{}: {}", IMAP_HOST, IMAP_PORT, e))?;

    let mut session = client
        .login(email.trim(), password)
        .map_err(|(e, _)| format!("IMAP login failed for {}: {}", email, e))?;

    let _mailbox = session
        .select("INBOX")
        .map_err(|e| format!("Could not select INBOX: {}", e))?;

    // Search for all message sequence numbers
    let sequence_set = session
        .search("ALL")
        .map_err(|e| format!("IMAP search error: {}", e))?;

    if sequence_set.is_empty() {
        let _ = session.logout();
        return Ok(Vec::new());
    }

    // Get latest `limit` messages
    let mut seqs: Vec<u32> = sequence_set.into_iter().collect();
    seqs.sort_unstable();

    let take_count = if limit > 0 { limit.min(seqs.len()) } else { seqs.len().min(50) };
    let start_idx = seqs.len().saturating_sub(take_count);
    let selected_seqs = &seqs[start_idx..];

    if selected_seqs.is_empty() {
        let _ = session.logout();
        return Ok(Vec::new());
    }

    let query = selected_seqs
        .iter()
        .map(|s| s.to_string())
        .collect::<Vec<String>>()
        .join(",");

    let messages = session
        .fetch(&query, "(UID FLAGS RFC822)")
        .map_err(|e| format!("IMAP fetch error: {}", e))?;

    let mut result_emails = Vec::new();

    for message in messages.iter() {
        let uid = message.uid.unwrap_or(0);
        let flags = message.flags();
        let is_seen = flags.iter().any(|f| match f {
            imap::types::Flag::Seen => true,
            imap::types::Flag::Custom(c) => c.eq_ignore_ascii_case("seen"),
            _ => false,
        });

        if let Some(body_bytes) = message.body() {
            if let Ok(parsed_email) = parse_email_message(uid, body_bytes, is_seen) {
                result_emails.push(parsed_email);
            }
        }
    }

    // Sort descending by timestamp / UID (newest first)
    result_emails.sort_by(|a, b| b.timestamp.cmp(&a.timestamp).then_with(|| b.uid.cmp(&a.uid)));

    let _ = session.logout();
    Ok(result_emails)
}

pub fn delete_email_sync(email: &str, password: &str, uid: u32) -> Result<(), String> {
    let tls = TlsConnector::builder()
        .build()
        .map_err(|e| format!("TLS init error: {}", e))?;

    let client = imap::connect((IMAP_HOST, IMAP_PORT), IMAP_HOST, &tls)
        .map_err(|e| format!("Could not connect to IMAP server: {}", e))?;

    let mut session = client
        .login(email.trim(), password)
        .map_err(|(e, _)| format!("IMAP login failed: {}", e))?;

    session
        .select("INBOX")
        .map_err(|e| format!("Could not select INBOX: {}", e))?;

    // Mark deleted flag
    session
        .uid_store(format!("{}", uid), "+FLAGS (\\Deleted)")
        .map_err(|e| format!("Failed to set Deleted flag on UID {}: {}", uid, e))?;

    session
        .expunge()
        .map_err(|e| format!("Expunge error: {}", e))?;

    let _ = session.logout();
    Ok(())
}

pub fn mark_read_sync(email: &str, password: &str, uid: u32, read: bool) -> Result<(), String> {
    let tls = TlsConnector::builder()
        .build()
        .map_err(|e| format!("TLS init error: {}", e))?;

    let client = imap::connect((IMAP_HOST, IMAP_PORT), IMAP_HOST, &tls)
        .map_err(|e| format!("Could not connect to IMAP server: {}", e))?;

    let mut session = client
        .login(email.trim(), password)
        .map_err(|(e, _)| format!("IMAP login failed: {}", e))?;

    session
        .select("INBOX")
        .map_err(|e| format!("Could not select INBOX: {}", e))?;

    let flag_op = if read { "+FLAGS (\\Seen)" } else { "-FLAGS (\\Seen)" };
    session
        .uid_store(format!("{}", uid), flag_op)
        .map_err(|e| format!("Failed to update Seen flag on UID {}: {}", uid, e))?;

    let _ = session.logout();
    Ok(())
}
