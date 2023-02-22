const { Player } = require('../../src/db');

module.exports = {
    data: {
        name: `confirm`,
    },
    async execute(interaction) {
        const member = interaction.member;
        const guild = interaction.guild;

        const player = await Player.findOne({ where: { discordID: member.id, guildID: guild.id }, include: 'iura' });
        
        if (player.walletAddress) return;

            await Player.increment({ totalAttack: 200, totalDefense: 200 }, { where: { discordID: member.id, guildID: guild.id }});

        await interaction.reply({ content: `Your NFT has been linked successfully!`});
    }
};