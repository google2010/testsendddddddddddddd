const nodemailer = require('nodemailer');
const dns = require('dns');
const fs = require('fs');
const util = require('util');
const { v4: uuidv4 } = require('uuid');

// Promisify DNS resolve to use with async/await
const resolveMx = util.promisify(dns.resolveMx);

// Get MX records for a domain
async function getMxRecords(domain) {
    try {
        const records = await resolveMx(domain);
        return records.sort((a, b) => a.priority - b.priority).map(record => record.exchange);
    } catch (error) {
        console.error(`Failed to resolve MX records for domain ${domain}:`, error.message);
        return [];
    }
}

// Save emails to a file
function saveEmailsToFile(emailList, fileName = "sent_emails.txt") {
    fs.appendFileSync(fileName, emailList.join('\n') + '\n', 'utf8');
    console.log(`Emails saved to ${fileName}`);
}

// Send email via MX record
async function sendEmailViaMx(toEmails, fromEmail, fromName, subject, htmlBody) {
    if (!toEmails || toEmails.length === 0) return;

    const domain = toEmails[0].split('@')[1];
    const mxRecords = await getMxRecords(domain);

    const randomString = uuidv4().slice(0, 8);
    const personalizedFromEmail = `${randomString}${fromEmail}`;
    const updatedHtmlBody = htmlBody.replace('{{random}}', randomString);

    const mailOptions = {
        from: `${fromName} <${personalizedFromEmail}>`,
        to: personalizedFromEmail, // Placeholder for "To" (may not be checked)
        bcc: toEmails.join(','),
        subject: subject,
        html: updatedHtmlBody,
        headers: { 'Message-ID': `<${uuidv4()}@nike.org>` },
    };

    for (const mx of mxRecords) {
        try {
            const transporter = nodemailer.createTransport({
                host: mx,
                port: 25, // Common port for unauthenticated email sending
                secure: false, // Disable TLS for basic SMTP
            });

            await transporter.sendMail(mailOptions);
            console.log(`Batch of ${toEmails.length} emails sent successfully via ${mx}`);
            saveEmailsToFile(toEmails);
            break; // Exit on successful send
        } catch (error) {
            console.error(`Failed to send emails via ${mx}:`, error.message);
        }
    }
}

// Read email list from a file
function readEmailList(filePath) {
    return fs.readFileSync(filePath, 'utf8').split('\n').filter(email => email.trim() !== '');
}

// Batch email list
function batchEmailList(emailList, batchSize) {
    const batches = [];
    for (let i = 0; i < emailList.length; i += batchSize) {
        batches.push(emailList.slice(i, i + batchSize));
    }
    return batches;
}

// Main function to process and send emails
async function main() {
    const fromEmail = "info@nike.org";
    const fromName = "1";
    const subject = "1";
    const htmlBody = fs.readFileSync('insta.html', 'utf8');
    const emailList = readEmailList('mails-insta.txt');

    const batchSize = 10;
    const batches = batchEmailList(emailList, batchSize);

    for (const batch of batches) {
        await sendEmailViaMx(batch, fromEmail, fromName, subject, htmlBody);
        await new Promise(resolve => setTimeout(resolve, 3000)); // Pause between batches
    }
}

main().catch(error => console.error("Error in main process:", error));
