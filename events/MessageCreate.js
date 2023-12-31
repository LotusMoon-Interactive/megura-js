const { Events, AttachmentBuilder, PermissionsBitField, EmbedBuilder } = require('discord.js');
const { openAIkey, openAIorg } = require('../config.json');
const { prefix, dahliaPrompt, dahliaPrefix } = require('../src/vars');
const { Guild } = require('../src/db');
const sendLogs = require('../functions/logs');
const { serverID } = require('../src/vars');

/**
 * This event is fired when a user sends a message.
 */

// Preparing connection to OpenAI API -----------------
const OpenAI = require('openai');

const openai = new OpenAI({
	organization: openAIorg,
	apiKey: openAIkey,
});

const chatUsers = new Map();
const userTimeouts = {};

const inactivityTimeout = 15 * 60 * 1000; // 15mins of inactivity

const resetUserTimeout = (userID) => {
	if (userTimeouts[userID]) {
		clearTimeout(userTimeouts[userID]);
	}

	userTimeouts[userID] = setTimeout(() => {
		chatUsers.delete(userID);
		delete userTimeouts[userID];
	}, inactivityTimeout);
};

const generateSummary = async (chatLog) => {
	const prompt = `Summary of the following conversation: "${chatLog
		.map((log) => `${log.role}: ${log.content}`)
		.join(' ')}"`;

	const result = await openai.chat.completions.create({
		model: 'gpt-4',
		max_tokens: 1000,
		temperature: 0.4,
		messages: [{ role: 'system', content: prompt }],
		frequency_penalty: 0.3,
		presence_penalty: 0.7,
	});

	const summary = result.choices[0].message.content;
	return summary;
};

module.exports = {
	name: Events.MessageCreate,
	async execute(message) {
		if (message.author.bot) return;

		const botMember = message.channel.guild.members.cache.get(message.client.user.id);
		const permissions = message.channel.permissionsFor(botMember);

		if (!permissions.has([PermissionsBitField.Flags.ViewChannel, PermissionsBitField.Flags.SendMessages, PermissionsBitField.Flags.ReadMessageHistory])) {
			const embed = new EmbedBuilder()
				.setTitle('Unable to send a message.')
				.setColor('Red')
				.setDescription(
					`
					> **Guild Name** : ${message.guild.name}
					> **Guild ID** : ${message.guild.id}
					> **Channel** : ${message.channel}
				`,
				);

			const logEntry = `Unable to send a message in ${message.guild.name} - ${message.channel.name}`;
			return sendLogs(message.client, serverID, embed, logEntry);
		}

		try {
			const guildCheck = await Guild.findOne({
				where: { guildID: message.guild.id },
			});

			let chatPrefix = dahliaPrefix;
			let chatPrompt = dahliaPrompt;

			if (guildCheck && guildCheck.chatPrefix) {
				chatPrefix = guildCheck.chatPrefix;
			}

			if (guildCheck && guildCheck.chatPrompt) {
				chatPrompt = guildCheck.chatPrompt;
			}

			const isOnVerifyChannel =
				message.channel.id === guildCheck.verifyChannelID;

			if (isOnVerifyChannel) {
				await message.delete();
			}

			if (
				message.content.toLowerCase().startsWith(`${chatPrefix.toLowerCase()} stop`)
			) {
				if (chatUsers.has(message.author.id)) {
					chatUsers.delete(message.author.id);
				}
				return;
			}

			if (
				message.content.toLowerCase().startsWith(chatPrefix.toLowerCase())
			) {
				chatUsers.set(message.author.id, message.channel.id);
				resetUserTimeout(message.author.id);
			}

			if (chatUsers.has(message.author.id)) {
				resetUserTimeout(message.author.id);

				try {
					if (guildCheck.chatChannelID && message.channel.id !== guildCheck.chatChannelID) return;
					if (message.channel.id !== chatUsers.get(message.author.id)) return;

					let chatLog = [
						{
							role: 'system',
							content: chatPrompt,
						},
						{
							role: 'assistant',
							content: 'Hello, how are you doing?',
						},
					];

					await message.channel.sendTyping();

					const allMessages = await message.channel.messages.fetch({ limit: 50 });
					allMessages.reverse();

					let messagesAfterLastCall = [];
					let foundLastCall = false;

					for (const msg of allMessages.values()) {
						if (
							msg.author.id === message.author.id &&
							(msg.content.toLowerCase().startsWith(chatPrefix.toLowerCase()))
						) {
							foundLastCall = true;
							messagesAfterLastCall = [msg];
						}
						else if (foundLastCall) {
							messagesAfterLastCall.push(msg);
						}
					}

					messagesAfterLastCall.forEach((msg) => {
						if (msg.author.id === message.client.user.id && msg.author.bot) {
							chatLog.push({
								role: 'assistant',
								content: msg.content,
							});
						}

						if (msg.author.id === message.author.id) {
							chatLog.push({
								role: 'user',
								content: msg.content,
							});
						}
					});

					const result = await openai.chat.completions.create({
						model: 'gpt-4',
						max_tokens: 1000,
						temperature: 0.4,
						messages: chatLog,
						frequency_penalty: 0.3,
						presence_penalty: 0.7,
					});

					const response = result.choices[0].message.content;

					if (result.usage.total_tokens > 1500 || chatLog.length > 10) {
						const summary = await generateSummary(chatLog.slice(0, 6));

						chatLog = chatLog.slice(6);

						chatLog.unshift({ role: 'assistant', content: summary });
					}

					if (response.length >= 2000) {
						const attachment = new AttachmentBuilder(
							Buffer.from(response, 'utf-8'),
							{ name: 'fromdahliatoyou.txt' },
						);
						await message.reply({
							content: 'I couldn\'t give my whole answer here so I\'m attaching the file for you.',
							files: [attachment],
						});
					}
					else {
						message.reply(`${response}`);
					}
				}
				catch (error) {
					message.reply('Yes?');
					if (error instanceof OpenAI.APIError) {
						console.error(error.status); // e.g. 401
						console.error(error.message); // e.g. The authentication token you passed was invalid...
						console.error(error.code); // e.g. 'invalid_api_key'
						console.error(error.type); // e.g. 'invalid_request_error'
					}
					else {
						// Non-API error
						console.log(error);
					}
				}
			}
		}
		catch (error) {
			console.error(error);
		}

		// For text commands
		if (!message.content.startsWith(prefix)) return;
		const args = message.content.slice(prefix.length).trim().split(/ +/);
		const commandName = args.shift().toLowerCase();

		const command =
			message.client.commands.get(commandName) ||
			message.client.commands.find((cmd) => cmd.aliases && cmd.aliases.includes(commandName));

		if (!command) return;

		try {
			await command.execute(message, args);
		}
		catch (error) {
			console.error(error);
			message.reply({
				content: 'There was an error trying to execute that command!',
				ephemeral: true,
			});
		}
	},
};