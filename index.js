require('dotenv').config();
const { Client, GatewayIntentBits } = require('discord.js');
const { joinVoiceChannel, createAudioPlayer, createAudioResource, AudioPlayerStatus } = require('@discordjs/voice');
const playdl = require('play-dl');

const client = new Client({
    intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildVoiceStates,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.MessageContent,
    ],
});

const queue = new Map(); // A fila de músicas
const PREFIX = '!'; // Prefixo dos comandos

client.once('ready', () => {
    console.log(`${client.user.tag} está online!`);
});

client.on('messageCreate', async (message) => {
    if (!message.content.startsWith(PREFIX) || message.author.bot) return;

    const args = message.content.slice(PREFIX.length).trim().split(/\s+/);
    const command = args.shift().toLowerCase();

    const serverQueue = queue.get(message.guild.id);

    if (command === 'p' || command === 'play') {
        const url = args[0];
        if (!url || !playdl.yt_validate(url)) {
            return message.channel.send('Por favor, forneça um link válido do YouTube!');
        }
        
        const songInfo = await playdl.video_basic_info(url);
        const song = {
            title: songInfo.video_details.title,
            url: songInfo.video_details.url,
        };

        if (!serverQueue) {
            const queueConstruct = {
                textChannel: message.channel,
                voiceChannel: null,
                connection: null,
                songs: [],
                player: createAudioPlayer(),
                timeout: null,
            };

            queue.set(message.guild.id, queueConstruct);
            queueConstruct.songs.push(song);

            try {
                const voiceChannel = message.member.voice.channel;
                if (!voiceChannel) return message.channel.send('Entre em um canal de voz primeiro!');

                const connection = joinVoiceChannel({
                    channelId: voiceChannel.id,
                    guildId: message.guild.id,
                    adapterCreator: message.guild.voiceAdapterCreator,
                });

                queueConstruct.voiceChannel = voiceChannel;
                queueConstruct.connection = connection;

                playSong(message.guild, queueConstruct.songs[0]);
            } catch (err) {
                console.error(err);
                queue.delete(message.guild.id);
                return message.channel.send('Ocorreu um erro ao tentar se conectar ao canal de voz.');
            }
        } else {
            serverQueue.songs.push(song);
            return message.channel.send(`${song.title} foi adicionada à fila!`);
        }
    } else if (command === 's' || command === 'stop') {
        if (!serverQueue) return message.channel.send('Não há músicas na fila para pular!');
        serverQueue.player.stop();
    } else if (command === 'q' || command === 'quit') {
        if (!serverQueue) return message.channel.send('Serviço ja encerrado.');
        serverQueue.songs = [];
        serverQueue.player.stop();
        serverQueue.connection.destroy();
        queue.delete(message.guild.id);
        return message.channel.send('Serviço encerrado!');
    } else if (command === 'pause') {
        if (serverQueue.player.state.status === AudioPlayerStatus.Playing) {
            serverQueue.player.pause();
            return message.channel.send('Para para para tudo!'); // Música pausada
        } else {
            return message.channel.send('ta pausando oque fio?'); // Não há música tocando para pausar.
        }
    } else if (command === 'h' || command === 'help') {
        // Novo comando !h
        message.channel.send(`
        **Ajuda - Comandos do RanMusic** 🎵
        Aqui estão os comandos disponíveis para usar o bot:

        **(play)!p <link do YouTube>** - Reproduz a música do link fornecido. Se já estiver tocando, adiciona a música à fila.
        Exemplo: \`!p https://www.youtube.com/watch?v=dQw4w9WgXcQ\`

        **(skyp)!s** - Pula para a próxima música na fila.
        Exemplo: \`!s\`

        **(quit)!q** - Encerra o serviço de música e faz o bot sair do canal de voz.
        Exemplo: \`!q\`

        **!pause** - Pausa a música atual. Use apenas quando algo estiver tocando.
        Exemplo: \`!pause\`

        **(help)!h** - Exibe esta mensagem de ajuda com todos os comandos disponíveis.
        Exemplo: \`!h\`
        
        Aproveite a música! 🎶
        `);
    }
});

async function playSong(guild, song) {
    const serverQueue = queue.get(guild.id);

    if (!song) {
        serverQueue.timeout = setTimeout(() => {
            serverQueue.connection.destroy();
            queue.delete(guild.id);
            serverQueue.textChannel.send('Mem deixarao sozinho.'); // Saindo por inatividade
        }, 7 * 60 * 1000); // 7 minutos
        return;
    }

    const stream = await playdl.stream(song.url);
    console.log('Stream criado:', stream);

    const resource = createAudioResource(stream.stream, { inputType: stream.type });
    serverQueue.player.play(resource);
    serverQueue.connection.subscribe(serverQueue.player);


    serverQueue.player.play(resource);
    serverQueue.connection.subscribe(serverQueue.player);

    serverQueue.player.on(AudioPlayerStatus.Idle, () => {
        serverQueue.songs.shift();
        playSong(guild, serverQueue.songs[0]);
    });

    serverQueue.textChannel.send(`Playando: **${song.title}**`); // Tocando agora
}

client.login(process.env.BOT_TOKEN);
