import { Command, isTextChannel, throwError } from "discord-bot-shared"
import { ChannelType, SlashCommandBuilder, TextChannel } from "discord.js"
import { getApplicant, saveApplicant } from "../applicant.js"
import { getGuildInfo } from "../util.js"

const decline: Command = {
  command: new SlashCommandBuilder()
    .setName("decline")
    .setDescription("Decline an applicant.")
    .addChannelOption((option) =>
      option.setName("channel").setDescription("Select the channel of the applicant you wish to decline.").setRequired(true),
    )
    .addStringOption((option) => option.setName("decline-message").setDescription("Leave blank to send the default decline message."))
    .addBooleanOption((option) =>
      option.setName("kick").setDescription("Choose whether the applicant is kicked from the server. (Default: true)"),
    ) as SlashCommandBuilder,
  run: async (interaction) => {
    if (!interaction.guildId) throwError("Unable to get guild ID.")
    const { guild, settings } = await getGuildInfo(interaction.guildId)
    if (!settings) return

    await interaction.deferReply()

    const channel = interaction.options.getChannel("channel") || throwError("Unable to get channel.")
    if (!isTextChannel(channel)) throwError("Channel is not a text channel.")

    const applicant = (await getApplicant(channel.name, guild.id)) || throwError(`Unable to get applicant ${channel.name}.`)
    if (!applicant.memberId) throwError(`Applicant ${channel.name} is not in the server or hasn't been linked.`)

    const declineMessageText = interaction.options.getString("decline-message") || settings.declineMessage

    const kick = interaction.options.getBoolean("kick") !== false
    const kickText = kick ? " and you will be removed from the server." : "."
    const declineMessage = await channel.send(
      `<@${applicant.memberId}>\n\n${declineMessageText}\n\nPlease click the 👍 reaction on this message to confirm that you have read this message. Upon confirmation your application will be closed${kickText}`,
    )
    await declineMessage.react("👍")

    applicant.kick = kick
    applicant.declineMessageId = declineMessage.id
    await saveApplicant(applicant, guild.id)

    const emojis = await guild.emojis
    const appsChannel =
      (await guild.getChannel<TextChannel>(settings.appsChannel.id, ChannelType.GuildText)) || throwError("Unable to get Apps channel.")

    const declinedEmoji = emojis.find((emoji) => emoji.name === "declined") || throwError(`Unable to get declined emoji.`)
    const appMessage = (await appsChannel.messages.fetch(applicant.appMessageId)) || throwError(`Unable to get App message.`)
    await appMessage.react(declinedEmoji)

    await interaction.editReply(`${channel.name} has been declined.\n${declineMessageText}`)
  },
}

export default decline
