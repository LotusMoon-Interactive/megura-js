module.exports = (sequelize, DataTypes) => {
    const User = sequelize.define(
        'User',
        {
            id: {
                type: DataTypes.INTEGER,
                autoIncrement: true,
                primaryKey: true,
            },
            registrationID: DataTypes.STRING,
            discordID: {
                type: DataTypes.STRING,
                unique: true,
            },
            guildID: {
                type: DataTypes.STRING,
            },
            type: DataTypes.STRING,
            walletAddress: {
                type: DataTypes.STRING,
                unique: true,
            },
            publicKey: {
                type: DataTypes.STRING,
                unique: true,
            },
        },
        {
            freezeTableName: true,
            timestamps: true,
        },
    );

    return User;
};
