use lettre::message::{header::ContentType, MultiPart, SinglePart};
use lettre::transport::smtp::authentication::Credentials;
use lettre::{Message, SmtpTransport, Transport};

const SMTP_HOST: &str = "smtp.purelymail.com";

pub fn send_email_sync(
    from_email: &str,
    password: &str,
    to_email: &str,
    subject: &str,
    body_text: &str,
    body_html: Option<&str>,
) -> Result<(), String> {
    let from_addr = from_email
        .trim()
        .parse()
        .map_err(|e| format!("Invalid 'from' email address: {}", e))?;

    let to_addr = to_email
        .trim()
        .parse()
        .map_err(|e| format!("Invalid 'to' email address: {}", e))?;

    let message_builder = Message::builder()
        .from(from_addr)
        .to(to_addr)
        .subject(subject.trim());

    let email = if let Some(html) = body_html.filter(|h| !h.trim().is_empty()) {
        message_builder
            .multipart(
                MultiPart::alternative()
                    .singlepart(
                        SinglePart::builder()
                            .header(ContentType::TEXT_PLAIN)
                            .body(body_text.to_string()),
                    )
                    .singlepart(
                        SinglePart::builder()
                            .header(ContentType::TEXT_HTML)
                            .body(html.to_string()),
                    ),
            )
            .map_err(|e| format!("Failed to build multipart email: {}", e))?
    } else {
        message_builder
            .header(ContentType::TEXT_PLAIN)
            .body(body_text.to_string())
            .map_err(|e| format!("Failed to build email body: {}", e))?
    };

    let creds = Credentials::new(from_email.trim().to_string(), password.to_string());

    // Connect to Purelymail SMTP on port 465 with TLS
    let mailer = SmtpTransport::relay(SMTP_HOST)
        .map_err(|e| format!("SMTP relay init error: {}", e))?
        .port(465)
        .credentials(creds)
        .build();

    mailer
        .send(&email)
        .map_err(|e| format!("Failed to send email: {}", e))?;

    Ok(())
}
