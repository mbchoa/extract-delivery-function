import fs from "fs";
import quotedPrintable from "quoted-printable";
import {Base64} from "js-base64";
import {Auth, gmail_v1 as gmailV1, google} from "googleapis";

import doordashEmailExtractor from "./doordash-email-extractor";

import type {ExtractorData} from "./types";

if (process.env.NODE_ENV === "development") {
	require("dotenv").config();
}

interface Credentials {
	clientId: string;
	clientSecret: string;
	redirectUri: string;
}

// The Gmail API instance
let gmail: gmailV1.Gmail;

(async function main() {
	// Authorize with Google OAuth
	const oAuth2Client: Auth.OAuth2Client = await authorize({
		clientId: process.env.CLIENT_ID,
		clientSecret: process.env.CLIENT_SECRET,
		redirectUri: process.env.REDIRECT_URI,
	});

	// Create new Gmail API instance
	gmail = google.gmail({version: "v1", auth: oAuth2Client});

	// Extract order data from emails
	const [firstMessage] = await getMessages();
	const messageBody = await getMessageDetail(firstMessage);
	const data = await extractMessageData(firstMessage, messageBody);
	console.log(data);
})();

/**
 * Create an OAuth2 client with the given credentials, and then execute the
 * given callback function.
 *
 * @param {Object} credentials The authorization client credentials.
 */
function authorize(credentials: Credentials): Promise<Auth.OAuth2Client> {
	const oAuth2Client = new google.auth.OAuth2(
		credentials.clientId,
		credentials.clientSecret,
		credentials.redirectUri,
	);

	oAuth2Client.setCredentials({
		access_token: process.env.ACCESS_TOKEN,
		refresh_token: process.env.REFRESH_TOKEN,
		scope: process.env.SCOPE,
		token_type: process.env.TOKEN_TYPE,
		expiry_date: parseInt(process.env.EXPIRY_DATE, 10),
	});

	return Promise.resolve(oAuth2Client);
}

/**
 * Fetches the messages in the user's account.
 */
function getMessages(): Promise<Array<gmailV1.Schema$Message>> {
	console.log("\u2022 Fetching messages");
	return new Promise((resolve, reject) => {
		gmail.users.messages.list(
			{
				userId: "me",
				q: "from:no-reply@doordash.com subject: Order Confirmation",
				includeSpamTrash: false,
			},
			(err, res) => {
				if (err) {
					return reject(new Error(`The API returned an error: ${err}`));
				}

				if (!((res?.data)?.messages)?.length) {
					return reject(new Error("No DoorDash orders found."));
				}

				resolve(res.data.messages);
			},
		);
	});
}

/**
 * Fetches the message body for the specific message.
 *
 * @see https://stackoverflow.com/questions/24811008/gmail-api-decoding-messages-in-javascript
 */
function getMessageDetail(message: gmailV1.Schema$Message): Promise<string> {
	console.log("\u2022 Printing message");
	return new Promise((resolve, reject) => {
		gmail.users.messages.get(
			{
				userId: "me",
				id: (message.id as string),
				format: "FULL",
			},
			(err, res) => {
				if (err) {
					reject(new Error(`The API returned an error: ${err}`));
				}

				if (!res?.data) {
					reject(new Error("No message found"));
				}

				const message = res.data;
				const {body} = ((message?.payload)?.parts ?? []).filter((part) =>
					part.mimeType === "text/html"
				)[0];

				if (!body.data.length) {
					reject(new Error("Unable to extract message body data"));
				}

				resolve(body.data);
			},
		);
	});
}

/**
 * Decodes email message and extracts delivery order data.
 */
function extractMessageData(
	message: gmailV1.Schema$Message | null | undefined,
	messageBody: string,
): Promise<ExtractorData> {
	console.log(`• Extracting message #${message.id} data`);
	return new Promise((resolve, reject) => {
		if (!message) {
			reject(new Error('Missing "message" parameter'));
		}
		const htmlString = quotedPrintable.decode(Base64.decode(messageBody));
		const data = doordashEmailExtractor(message, htmlString);

		if (process.env.NODE_ENV === "development") {
			fs.writeFileSync(
				`message-${message.id}.json`,
				JSON.stringify(data, null, 2),
			);
		}

		resolve(data);
	});
}
