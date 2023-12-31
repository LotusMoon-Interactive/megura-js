const { ButtonBuilder, ButtonStyle, ActionRowBuilder } = require('discord.js');
const { Player } = require('../../src/db');

module.exports = {
	data: {
		name: 'confirm',
	},
	async execute(interaction) {
		const userData = interaction.client.userData.get(interaction.user.id);

		try {
			if (!userData) {
				return interaction.reply({
					content: 'No user data found. Did it time out?',
					components: [button],
					ephemeral: true,
				});
			}

			const button = new ActionRowBuilder().addComponents(
				new ButtonBuilder()
					.setCustomId('profile')
					.setEmoji('👤')
					.setLabel('Profile')
					.setStyle(ButtonStyle.Success),
				new ButtonBuilder()
					.setCustomId('inventory')
					.setEmoji('🛄')
					.setLabel('Inventory')
					.setStyle(ButtonStyle.Primary),
				new ButtonBuilder()
					.setCustomId('shop')
					.setEmoji('🛒')
					.setLabel('Shop')
					.setStyle(ButtonStyle.Danger),
			);

			const member = interaction.member;
			const guild = interaction.guild;

			const player = await Player.findOne({
				where: { discordID: member.id, guildID: guild.id },
				include: 'iura',
			});

			if (!player) {
				return interaction.reply({
					content: 'No player found. Did it time out?',
					components: [button],
					ephemeral: true,
				});
			}

			const matches = userData.tokenID.match(/#(\d+)/);
			let number;
			if (matches) {
				number = matches[1];
			}

			player.weapon = userData.weapon;
			player.armor = userData.armor;
			player.walletAddress = userData.walletAddress;
			player.tokenID = number ? number : userData.tokenID;
			player.imageURL = userData.imageURL;

			if (!player.linked) {
				player.totalAttack += 200;
				player.totalDefense += 200;
				player.linked = true;
			}

			if (userData.collection === 'Dropouts' && !player.linked) {
				player.totalAttack += 25;
				player.totalDefense += 25;
			}

			interaction.client.userData.delete(interaction.user.id);
			await player.save();
			await interaction.reply({
				content: 'Your NFT has been linked successfully!',
				components: [button],
				ephemeral: true,
			});
		}
		catch (error) {
			console.error(error);
		}
	},
};
