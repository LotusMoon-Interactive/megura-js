const { Events, EmbedBuilder } = require('discord.js');
const ms = require('ms');

/**
 * This event is fired when a user initiates slash commands.
 */

module.exports = {
	name: Events.InteractionCreate,
	async execute(interaction) {
		const { client } = interaction;
		if (interaction.isChatInputCommand()) {
			const command = client.commands.get(interaction.commandName);

			if (!command) {
				console.error(
					`No command matching \`${interaction.commandName}\` was found.`,
				);
				return;
			}

			const cooldownData = `${interaction.commandName}:${interaction.user.id}`;

			if (client.cooldown.has(cooldownData)) {
				const timer = ms(client.cooldown.get(cooldownData) - Date.now());
				return interaction.reply({
					content: `You are on cooldown for another ${timer}.`,
					ephemeral: true,
				});
			}

			try {
				client.cooldown.set(cooldownData, Date.now() + command.cooldown);
				setTimeout(
					() => client.cooldown.delete(cooldownData),
					command.cooldown,
				);
				await command.execute(interaction);
			}
			catch (error) {
				const embed = new EmbedBuilder().setColor('Red').setDescription(`
                            Error executing \`${interaction.commandName}\`
                            Please join our [Support Server](https://discord.gg/X9eEW6yuhq) to report this. Thanks!`);

				console.log(error);
				await interaction.reply({ embeds: [embed], ephemeral: true });
				client.cooldown.delete(cooldownData);
			}
		}
		if (interaction.isButton()) {
			const { buttons } = interaction.client;
			const { customId } = interaction;
			const button = buttons.get(customId);
			if (!button) return new Error('There is no code for this button.');

			const cooldownData = `${customId}:${interaction.user.id}`;

			if (client.cooldown.has(cooldownData)) {
				const timer = ms(client.cooldown.get(cooldownData) - Date.now());
				return interaction.reply({
					content: `You are on cooldown for another ${timer}.`,
					ephemeral: true,
				});
			}

			try {
				if (button.data.cooldown) {
					client.cooldown.set(cooldownData, Date.now() + button.data.cooldown);
					setTimeout(() => client.cooldown.delete(cooldownData), button.data.cooldown);
				}
				await button.execute(interaction);
			}
			catch (error) {
				const embed = new EmbedBuilder().setColor('Red').setDescription(`
                            Error executing \`${interaction.customId}\`
                            Please join our [Support Server](https://discord.gg/X9eEW6yuhq) to report this. Thanks!`);

				console.log(error);
				await interaction.reply({ embeds: [embed], ephemeral: true });
				client.cooldown.delete(cooldownData);
			}
		}
		if (interaction.isStringSelectMenu()) {
			const { menus } = interaction.client;
			const { customId } = interaction;
			const menu = menus.get(customId);
			if (!menu) return new Error('There is no code for this menu.');

			try {
				await menu.execute(interaction);
			}
			catch (error) {
				console.error(error);
				const embed = new EmbedBuilder().setColor('Red').setDescription(`
                            Error executing \`${interaction.customId}\`
                            Please join our [Support Server](https://discord.gg/X9eEW6yuhq) to report this. Thanks!`);
				await interaction.reply({ embeds: [embed], ephemeral: true });
			}
		}
		if (interaction.isModalSubmit()) {
			const { modals } = interaction.client;
			const { customId } = interaction;
			const modal = modals.get(customId);
			if (!modal) return new Error('There is no code for this modal.');

			try {
				await modal.execute(interaction);
			}
			catch (error) {
				console.error(error);
				const embed = new EmbedBuilder().setColor('Red').setDescription(`
                            Error executing \`${interaction.customId}\`
                            Please join our [Support Server](https://discord.gg/X9eEW6yuhq) to report this. Thanks!`);
				await interaction.reply({ embeds: [embed], ephemeral: true });
			}
		}
		if (interaction.isUserContextMenuCommand()) {
			const contextCommand = client.commands.get(interaction.commandName);

			if (!contextCommand) {
				console.error(
					`No command matching \`${interaction.commandName}\` was found.`,
				);
				return;
			}

			try {
				await contextCommand.execute(interaction);
			}
			catch (error) {
				console.error(error);
				const embed = new EmbedBuilder().setColor('Red').setDescription(`
                            Error executing \`${interaction.commandName}\`
                            Please join our [Support Server](https://discord.gg/X9eEW6yuhq) to report this. Thanks!`);
				await interaction.reply({ embeds: [embed], ephemeral: true });
			}
		}
	},
};