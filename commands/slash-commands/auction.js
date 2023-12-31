const { SlashCommandBuilder, EmbedBuilder, ChannelType, channelMention, userMention, WebhookClient } = require('discord.js');
const { validateFeature } = require('../../src/feature');
const { startAuction } = require('../../functions/startAuction');
const { endAuction } = require('../../functions/endAuction');
const { changeChannel } = require('../../functions/webhook');
const { Guild, Auction } = require('../../src/db');
const { dahliaAvatar, dahliaName } = require('../../src/vars');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('auction')
		.setDescription('Manage auctions.')
		.setDefaultMemberPermissions('0')
		.addSubcommand((subcommand) =>
			subcommand
				.setName('start')
				.setDescription('Start an Auction.')
				.addStringOption(option =>
					option.setName('item')
						.setDescription('Name of the item to be auctioned')
						.setRequired(true))
				.addNumberOption(option =>
					option.setName('startprice')
						.setDescription('Starting price of the auction in Bitcoin')
						.setMaxValue(999999)
						.setRequired(true))
				.addIntegerOption(option =>
					option.setName('endtime')
						.setDescription('Duration of the auction in hours')
						.setRequired(true))
				.addStringOption(option =>
					option.setName('description')
						.setDescription('Description of the item')
						.setRequired(false))
				.addIntegerOption(option =>
					option.setName('quantity')
						.setDescription('Quantity of the item')
						.setRequired(false))
				.addAttachmentOption(option =>
					option
						.setName('image')
						.setDescription('Attach an image as preview for the auctioned item.')
						.setRequired(false)),
		)
		.addSubcommand((subcommand) =>
			subcommand
				.setName('end')
				.setDescription('End an Auction.')
				.addIntegerOption(option =>
					option.setName('auctionid')
						.setDescription('Enter the auction ID of the auction you want to remote')
						.setRequired(true)),
		)
		.addSubcommand((subcommand) =>
			subcommand
				.setName('settings')
				.setDescription('Adjust settings for auctions.')
				.addChannelOption((option) =>
					option
						.setName('channelid')
						.setDescription('Choose the channel for auctions.')
						.addChannelTypes(ChannelType.GuildText)
						.setRequired(true),
				),
		),
	cooldown: 3000,
	async execute(interaction) {
		const { options } = interaction;
		const subCommand = options.getSubcommand();
		const guildCheck = await Guild.findOne({ where: { guildID: interaction.guild.id } });

		const item1 = options.getString('item');
		const description = options.getString('description');
		const quantity = options.getInteger('quantity');
		const startPrice = options.getNumber('startprice');
		const endTime = options.getInteger('endtime');
		const attachment = options.getAttachment('image');
		let attachmentUrl = null;

		switch (subCommand) {
			case 'start':
				await interaction.deferReply();
				if (!guildCheck) {
					throw new Error('guild not found');
				}
				if (!await validateFeature(interaction, guildCheck.subscription, 'hasAuction')) {
					return;
				}

				if (attachment) {
					attachmentUrl = attachment.proxyURL;
				}

				const start = await startAuction(interaction, item1, description, quantity, startPrice, endTime, interaction.user.id, attachmentUrl);

				// respond to the interaction
				if (start) {
					const startDateTimeUnix = Math.floor(start.startDateTime.getTime() / 1000);
					const endDateTimeUnix = Math.floor(start.endDateTime.getTime() / 1000);

					const embed0 = new EmbedBuilder()
						.setTitle('Auction Started!')
						.setColor(0xcd7f32)
						.setDescription(`**Item Name:** ${item1}\n**Starting Price:** ${startPrice} 🪙\n**Start Time:** <t:${startDateTimeUnix}:f>\n**Ending Time:** <t:${endDateTimeUnix}:f>\n**Auctioneer:** ${userMention(interaction.user.id)}\nAuction ID: ${start.id}`);

					await interaction.editReply({
						embeds: [embed0],
					});

				}
				else {
					await interaction.editReply({ content: 'Sorry, there was a problem starting the auction.', ephemeral: true });
				}
				break;

			case 'end':
				// this command only updates the auction end time and gets the highest bidder
				try {
					await interaction.deferReply();
					if (!guildCheck) {
						throw new Error('guild not found');
					}
					if (!await validateFeature(interaction, guildCheck.subscription, 'hasAuction')) {
						return;
					}

					const id = options.getInteger('auctionid');
					const end = await endAuction(id);

					if (end) {
						// remove the job from the queue
						const jobs = await interaction.client.auctionQueue.getJobs(['waiting', 'delayed']);
						const job = jobs.find(job1 => job1.data.auctionId === id);

						if (job) await job.remove();

						const auction = await Auction.findByPk(id);
						const item = await auction.getAuctionItem();
						const { auctionwebhookId, auctionwebhookToken } = await Guild.findOne({ where: { guildId: interaction.guild.id } });
						const webhookClient = new WebhookClient({ id: auctionwebhookId, token: auctionwebhookToken });

						const newEmbed = new EmbedBuilder()
							.setTitle(`Auction: ${item.itemName}`)
							.setColor(0xcd7f32)
							.addFields(
								{ name: 'Quantity:', value: `${item.quantity}`, inline: true },
								{ name: 'Starting Price:', value: `${auction.startPrice / 100000000} 🪙`, inline: true },
								{ name: 'Highest Bid:', value: `${auction.currentPrice / 100000000} 🪙`, inline: true },
								{ name: 'Auctioneer:', value: `${userMention(auction.userID)}`, inline: true },
							)
							.setFooter({ text: `Auction ID: ${auction.id}` });

						if (auction.attachmentURL) {
							newEmbed.setImage(auction.attachmentURL);
						}

						if (item.description !== 'No description provided') {
							newEmbed.setDescription(item.description);
						}

						if (auction.winnerId) {
							const discordID = auction.winnerId.split('-');
							const winningID = discordID[0];
							newEmbed.addFields(
								{ name: 'Winner:', value: `${userMention(winningID)}`, inline: true },
							);
						}

						const message = await webhookClient.editMessage(auction.messageID, {
							content: '**The Auction is now CLOSED!**',
							username: dahliaName,
							avatarURL: dahliaAvatar,
							embeds: [newEmbed],
							components: [],
						});

						if (message) return await interaction.editReply({ content: 'Auction ended successfully.', ephemeral: true });
					}
					else {
						await interaction.editReply({ content: 'Failed to end auction due to an error.' });
					}
				}
				catch (error) {
					console.error(error);
				}
				break;
			case 'settings':
				try {
					if (!guildCheck) {
						throw new Error('guild not found');
					}
					if (!await validateFeature(interaction, guildCheck.subscription, 'hasAuction')) {
						return;
					}
					await interaction.deferReply();
					const channel = options.getChannel('channelid');

					const fieldsToUpdate = {
						channelField: 'auctionChannelID',
						webhookIDField: 'auctionwebhookId',
						webhookTokenField: 'auctionwebhookToken',
						webhookName: 'auctionChannel',
						webhookReason: 'For announcements related to auctions',
					};
					const updateChannel = await changeChannel(interaction, interaction.guild.id, channel.id, fieldsToUpdate);

					if (updateChannel) {
						return await interaction.editReply({
							content: `Auction Channel has been set to ${channelMention(channel.id)}.\n`,
							ephemeral: true,
						});
					}
				}
				catch (error) {
					console.error(error);
				}
				break;
		}
	},
};
