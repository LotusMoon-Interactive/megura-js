const { ContextMenuCommandBuilder, ApplicationCommandType, userMention } = require('discord.js');
const { Player } = require('../../src/db');
const { checkProfile } = require('../../src/vars');
const logger = require('../../src/logger');

module.exports = {
	data: new ContextMenuCommandBuilder()
		.setName('Transfer IURA')
		.setDefaultMemberPermissions('0')
		.setType(ApplicationCommandType.User),
	cooldown: 3000,
	async execute(interaction) {
		const { member, guild } = interaction;

		logger.log({
			level: 'info',
			message: `User: ${member.id}, Command: ${this.data.name}, Time: ${new Date().toISOString()}`,
		});

		const numFormat = (value) =>
			new Intl.NumberFormat('en-US').format(value === null ? 0 : value);
		const recipient = interaction.targetUser;
		const amount = '30';

		try {
			if (member.id === recipient.id) {
				return interaction.reply({
					content: 'You can\'t transfer money to yourself!',
					ephemeral: true,
				});
			}

			await interaction.deferReply();

			const players = await Player.findAll({
				where: {
					discordID: [member.id, recipient.id],
					guildID: guild.id,
				},
				include: 'iura',
			});

			let p1Index = players.findIndex((p) => p.discordID === member.id);

			if (p1Index !== 0) {
				[players[0], players[p1Index]] = [players[p1Index], players[0]];
				p1Index = 0;
			}

			const updatedPlayer1 = players[0];
			const updatedPlayer2 = players[1];

			if (!updatedPlayer1) {
				return await interaction.editReply(checkProfile);
			}
			if (!updatedPlayer2) {
				return await interaction.editReply(`${recipient.user.tag} does not have a voyager profile yet.`);
			}

			if (amount > updatedPlayer1.iura.walletAmount) {
				return interaction.editReply({
					content: 'You do not have sufficient balance!',
					ephemeral: true,
				});
			}

			await updatedPlayer1.withdraw(-amount);
			await updatedPlayer2.withdraw(amount);

			await interaction.editReply(
				`\`${numFormat(amount)} IURA\` has been transferred to ${userMention(updatedPlayer2.discordID)}.`,
			);
		}
		catch (error) {
			console.error(error);
		}
	},
};