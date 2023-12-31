const {
	SlashCommandBuilder,
	ActionRowBuilder,
	ButtonBuilder,
	ButtonStyle,
	EmbedBuilder,
} = require('discord.js');
const { Player, Iura } = require('../../src/db');
const { expPoints, duel_expGained } = require('../../src/vars');
const { simulateBattle } = require('../../functions/battle');
const leveling = require('../../functions/level');
const levelcheck = require('../../functions/levelup');

module.exports = {
	data: new SlashCommandBuilder()
		.setName('duel')
		.setDescription('Request for Duel')
		.addUserOption((option) =>
			option
				.setName('target')
				.setDescription('Choose the player you want to fight.')
				.setRequired(true),
		),
	cooldown: 300000,
	async execute(interaction) {
		const wait = require('node:timers/promises').setTimeout;
		const { member: player1, options } = interaction;
		const player2 = options.getMember('target');

		try {
			if (player1.id === player2.id) {
				return interaction.reply('There is a saying that goes:```“The attempt to force human beings to despise themselves is what I call hell.” ― Andre Malraux```Sorry, I cannot allow that.');
			}
			if (interaction.client.user.id === player2.id) {
				return interaction.reply('I don\'t engage in battles.');
			}
			if (player2.user.bot) {
				return interaction.reply('You cannot duel with bots.');
			}

			await interaction.deferReply();

			const players = await Player.findAll({
				where: {
					discordID: [player1.id, player2.id],
					guildID: interaction.guild.id,
				},
				include: 'iura',
			});

			let p1Index = players.findIndex((p) => p.discordID === player1.id);

			if (p1Index !== 0) {
				[players[0], players[p1Index]] = [players[p1Index], players[0]];
				p1Index = 0;
			}

			const updatedPlayer1 = players[0];
			const updatedPlayer2 = players[1];

			if (!updatedPlayer1) {
				throw new Error('profile not found');
			}
			if (!updatedPlayer2) {
				return await interaction.editReply(`${player2.user.tag} does not have a voyager profile yet.`);
			}

			// checking rank
			if (updatedPlayer2.totalHealth - updatedPlayer1.totalHealth >= 15000 || updatedPlayer2.totalHealth - updatedPlayer1.totalHealth <= -15000) {
				return interaction.editReply('Your rank is inappropriate to fight this player.');
			}

			// checking balance
			if (updatedPlayer1.iura.walletAmount < 100) {
				return interaction.editReply('You do not have sufficient balance to duel! Please carry at least $100 IURA first.');
			}
			if (updatedPlayer2.iura.walletAmount < 100) {
				return interaction.editReply('This player does not have enough balance to be attacked.');
			}

			const embed1 = new EmbedBuilder()
				.setColor(0xcd7f32)
				.setDescription('The battle commences!');
			await interaction.editReply({ embeds: [embed1] });
			await wait(1000);

			const embed2 = new EmbedBuilder()
				.setColor(0xcd7f32)
				.setDescription('Starting in 10 seconds...');
			await interaction.channel.send({ embeds: [embed2] });
			await wait(10000);
			const winner = await simulateBattle(
				interaction,
				updatedPlayer1,
				updatedPlayer2,
			);

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

			const player1TotalIura = updatedPlayer2.iura.walletAmount * 0.4;
			const player2TotalIura = updatedPlayer1.iura.walletAmount * 0.4;

			if (winner === updatedPlayer1) {
				await interaction.channel.send('The battle has concluded.');
				await interaction.followUp({
					content: `🎉 **WELL DONE!** You received the following from the battle: \n\n- \`${player1TotalIura} IURA\`\n- \`${duel_expGained} EXP\`\n\n> “The supreme art of war is to subdue the enemy without fighting.”\n> ― Sun Tzu, The Art of War`,
					components: [button],
				});

				await Promise.all([
					Iura.decrement(
						{ walletAmount: player1TotalIura },
						{ where: { accountID: updatedPlayer2.iura.accountID } },
					),
					Iura.increment(
						{ walletAmount: player1TotalIura },
						{ where: { accountID: updatedPlayer1.iura.accountID } },
					),
					updatedPlayer1.increment({
						iuraEarned: player1TotalIura,
						expGained: duel_expGained,
						duelKills: 1,
					}),
				]);
			}
			if (winner === updatedPlayer2) {
				await interaction.channel.send('The battle has concluded.');
				await interaction.followUp({
					content: `👎 **YOU LOST!** You lost the following from the battle: \n\n- \`${player2TotalIura} IURA\`\n\n> “It's not whether you get knocked down; it's whether you get up.”\n> ― Vince Lombardi`,
					components: [button],
				});
				await Promise.all([
					Iura.increment(
						{ walletAmount: player2TotalIura },
						{ where: { accountID: updatedPlayer2.iura.accountID } },
					),
					Iura.decrement(
						{ walletAmount: player2TotalIura },
						{ where: { accountID: updatedPlayer1.iura.accountID } },
					),
				]);
			}

			if (updatedPlayer1.expGained > expPoints(updatedPlayer1.level)) {
				const levelUp = await leveling(updatedPlayer1.guildID, updatedPlayer1.discordID);
				await levelcheck(interaction, levelUp.level);
			}
		}
		catch (error) {
			console.log(error);
		}
	},
};
