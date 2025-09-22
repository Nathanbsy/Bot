// ===============================
// Bot de Música com DisTube (versão corrigida)
// ===============================

const keepAlive = require("./server.js");
require("dotenv").config();
keepAlive();

const { Client, GatewayIntentBits, PermissionsBitField, EmbedBuilder } = require("discord.js");
const { DisTube } = require("distube");
const { YtDlpPlugin } = require("@distube/yt-dlp");
const { YouTubePlugin } = require("@distube/youtube");

const TOKEN = process.env.TOKEN;

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildVoiceStates
  ]
});

const distube = new DisTube(client, {
  nsfw: true,
  emitAddSongWhenCreatingQueue: false,
  emitAddListWhenCreatingQueue: false,
  plugins: [
    new YouTubePlugin(),
    new YtDlpPlugin()
  ]
});

client.once("ready", () => {
  console.log(`✅ Bot online como ${client.user.tag}`);
});

// Função auxiliar segura para enviar mensagens
async function safeSend(possibleChannel, payload) {
  try {
    if (!possibleChannel) return false;

    if (typeof possibleChannel.send === "function") {
      await possibleChannel.send(payload);
      return true;
    }
    if (possibleChannel.textChannel && typeof possibleChannel.textChannel.send === "function") {
      await possibleChannel.textChannel.send(payload);
      return true;
    }
    if (possibleChannel.channel && typeof possibleChannel.channel.send === "function") {
      await possibleChannel.channel.send(payload);
      return true;
    }

    const guild = possibleChannel.guild || possibleChannel?.textChannel?.guild || possibleChannel?.channel?.guild;
    if (guild && guild.systemChannel && typeof guild.systemChannel.send === "function") {
      await guild.systemChannel.send(payload);
      return true;
    }
  } catch (err) {
    console.error("safeSend falhou:", err);
  }
  return false;
}

// ===============================
// Comandos do bot
// ===============================
client.on("messageCreate", async (message) => {
  if (!message.content.startsWith("!") || message.author.bot) return;

  const args = message.content.split(" ");
  const command = args[0].toLowerCase();

  // !penis (seu comando play)
  if (command === "!penis") {
    const query = args.slice(1).join(" ").trim();
    if (!query) return message.reply("❌ Você precisa passar um link ou nome da música!");

    const voiceChannel = message.member?.voice.channel;
    if (!voiceChannel) return message.reply("❌ Você precisa estar em um canal de voz!");
    if (!voiceChannel.permissionsFor(message.client.user).has([PermissionsBitField.Flags.Connect, PermissionsBitField.Flags.Speak])) {
      return message.reply("❌ Não tenho permissões para conectar ou falar no canal de voz!");
    }

    try {
      await distube.play(voiceChannel, query, {
        textChannel: message.channel,
        member: message.member
      });
      message.reply(`🎶 Adicionando: **${query}**`);
    } catch (err) {
      console.error("Erro ao tocar música (play):", err);

      const isVoiceConnectFailed = err?.errorCode === "VOICE_CONNECT_FAILED"
        || (err?.message && err.message.includes("Cannot connect to the voice channel"))
        || (String(err).includes("VOICE_CONNECT_FAILED"));

      if (isVoiceConnectFailed) {
        message.reply("❌ Falha ao conectar ao canal de voz — provavelmente a hospedagem não permite conexões de voz/UDP.");
      } else {
        message.reply(`❌ Erro ao tentar tocar: ${err?.message ?? String(err)}`);
      }
    }
  }

  // !skip
  if (command === "!skip") {
    try {
      await distube.skip(message);
      message.reply("⏭ Música pulada!");
    } catch {
      message.reply("❌ Não tem música para pular!");
    }
  }

  // !stop
  if (command === "!stop") {
    try {
      await distube.stop(message);
      message.reply("⏹ Música parada e bot saiu do canal.");
    } catch {
      message.reply("❌ Não tem nada tocando.");
    }
  }

  // !pause
  if (command === "!pause") {
    try {
      await distube.pause(message);
      message.reply("⏸ Música pausada.");
    } catch {
      message.reply("❌ Não tem música tocando.");
    }
  }

  // !resume
  if (command === "!resume") {
    try {
      await distube.resume(message);
      message.reply("▶ Música retomada.");
    } catch {
      message.reply("❌ Não tem música pausada.");
    }
  }

  // !queue
  if (command === "!queue") {
    const queue = distube.getQueue(message);
    if (!queue) return message.reply("❌ Não há músicas na fila.");

    const q = queue.songs
      .map((song, i) => `${i === 0 ? "🎵 Tocando agora:" : `${i}.`} ${song.name} \`[${song.formattedDuration}]\``)
      .slice(0, 10)
      .join("\n");

    const embed = new EmbedBuilder()
      .setColor("#FFB347")
      .setTitle("📜 Fila de músicas")
      .setDescription(q)
      .setFooter({ text: `Total: ${queue.songs.length} músicas` });

    await safeSend(message.channel, { embeds: [embed] });
  }

  // !loop
  if (command === "!loop") {
    const queue = distube.getQueue(message);
    if (!queue) return message.reply("❌ Não há nada tocando.");

    let mode = queue.repeatMode;
    mode = (mode + 1) % 3;
    queue.setRepeatMode(mode);

    const modeName = mode === 0 ? "❌ Loop desativado" : mode === 1 ? "🔂 Loop de música" : "🔁 Loop de fila";
    message.reply(modeName);
  }

  // !shuffle
  if (command === "!shuffle") {
    const queue = distube.getQueue(message);
    if (!queue) return message.reply("❌ Não há músicas na fila.");

    try {
      queue.shuffle();
      message.reply("🔀 Fila embaralhada com sucesso!");
    } catch (err) {
      console.error("Erro ao embaralhar:", err);
      message.reply("❌ Não foi possível embaralhar a fila.");
    }
  }
});

// ===============================
// Eventos de reprodução
// ===============================
distube.on("playSong", async (queue, song) => {
  try {
    const embed = new EmbedBuilder()
      .setColor("#1DB954")
      .setTitle("🎵 Tocando agora:")
      .setDescription(`[${song.name}](${song.url})`)
      .setThumbnail(song.thumbnail)
      .addFields(
        { name: "👤 Autor", value: song.uploader.name ?? "—", inline: true },
        { name: "⏱️ Duração", value: song.formattedDuration ?? "—", inline: true },
        { name: "🎶 Pedido por", value: `${song.member?.user?.tag ?? String(song.member)}`, inline: true }
      )
      .setFooter({ text: "Bot de Música 🎧" })
      .setTimestamp();

    await safeSend(queue, { embeds: [embed] });
  } catch (err) {
    console.error("Erro no playSong:", err);
  }
});

distube.on("addList", async (queue, playlist) => {
  try {
    await safeSend(queue, `📑 Playlist **${playlist.name}** adicionada com **${playlist.songs.length} músicas**!`);
  } catch (err) {
    console.error("Erro em addList:", err);
  }
});

// ===============================
// Evento de erro corrigido
// ===============================
distube.on("error", async (channel, error) => {
  let errorMsg;

  if (error instanceof Error) {
    errorMsg = error.message;
  } else if (typeof error === "object") {
    errorMsg = error.constructor?.name || JSON.stringify(error, null, 2);
  } else {
    errorMsg = String(error);
  }

  console.error("Erro no DisTube:", error);

  const msg = `❌ Ocorreu um erro no DisTube: ${errorMsg}`;

  const sent = await safeSend(channel, msg)
    || await safeSend(channel?.textChannel, msg)
    || await safeSend(channel?.channel, msg);

  if (!sent) {
    console.error("Não foi possível enviar mensagem de erro para o canal. Mensagem:", msg);
  }
});

// ===============================
// Login
// ===============================
client.login(TOKEN);
